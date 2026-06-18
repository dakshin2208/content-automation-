import { CLIENTS } from "../clients";
import { azureChat, azureChatWithRetry } from "../azure-openai";
import type { TopicCategory } from "../types";
import { buildTopicsUserPrompt, TOPICS_SYSTEM } from "./topic-prompts";
import { safeParseJson, normalizeCategory } from "./json-parse";
import { classifyTopicCategory } from "./classify-topic";

export interface TopicItem {
  topic: string;
  category: TopicCategory;
}

interface RawItem {
  topic?: unknown;
  category?: unknown;
}

function isRawArray(x: unknown): x is RawItem[] {
  return Array.isArray(x);
}

const MAX_ROUNDS = 8;
const TOPIC_GEN_MAX_TOKENS = 16_384;

async function fetchTopicBatchJson(
  clientId: string,
  batchCount: number,
  excludeTopics: string[]
): Promise<unknown> {
  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) throw new Error(`Unknown client: ${clientId}`);

  const userPrompt = buildTopicsUserPrompt(client, batchCount, excludeTopics);
  const messages = [
    { role: "system" as const, content: TOPICS_SYSTEM },
    { role: "user" as const, content: userPrompt },
  ];

  const opts = {
    temperature: 0.7,
    maxTokens: TOPIC_GEN_MAX_TOKENS,
  } as const;

  let content: string;
  try {
    content = await azureChatWithRetry(messages, opts);
  } catch {
    content = await azureChat(messages, opts);
  }

  try {
    return safeParseJson<unknown>(content);
  } catch {
    content = await azureChat(messages, { ...opts, temperature: 0.5 });
    return safeParseJson<unknown>(content);
  }
}

async function ingestParsedArray(
  parsed: unknown,
  seen: Set<string>,
  out: TopicItem[],
  cap: number,
  clientId: string
): Promise<void> {
  if (!isRawArray(parsed)) {
    throw new Error("Expected JSON array of topics from model");
  }

  for (const item of parsed) {
    if (out.length >= cap) return;
    if (!item || typeof item !== "object") continue;
    const topic =
      typeof item.topic === "string" ? item.topic.trim() : "";
    if (!topic) continue;

    let cat = normalizeCategory(item.category);
    if (!cat) {
      cat = await classifyTopicCategory(topic, clientId);
    }

    const key = topic.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ topic, category: cat });
  }
}

export async function generateTopicItems(
  clientId: string,
  count: number
): Promise<TopicItem[]> {
  const out: TopicItem[] = [];
  const seen = new Set<string>();
  let round = 0;

  while (out.length < count && round < MAX_ROUNDS) {
    round++;
    const need = count - out.length;
    const excludeTopics = out.map((x) => x.topic);

    const parsed = await fetchTopicBatchJson(clientId, need, excludeTopics);
    const before = out.length;
    await ingestParsedArray(parsed, seen, out, count, clientId);

    if (out.length === before) {
      throw new Error(
        `Round ${round}: model returned no new distinct topics (have ${out.length}, need ${count}). Try again or lower batch size in code.`
      );
    }
  }

  if (out.length < count) {
    throw new Error(
      `After ${MAX_ROUNDS} rounds, only ${out.length} distinct topics; need ${count}. Try again.`
    );
  }

  return out.slice(0, count);
}
