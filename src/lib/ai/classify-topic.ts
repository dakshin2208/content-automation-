import { azureChat } from "../azure-openai";
import type { TopicCategory } from "../types";
import { normalizeCategory } from "./json-parse";

/** Fallback when category is missing or invalid. */
export async function classifyTopicCategory(
  topic: string,
  clientId?: string
): Promise<TopicCategory> {
  const education = clientId === "choose_your_college";
  const userContent = education
    ? `Classify this Instagram/Reels topic for an education platform (college choice, NIRF data, students after 12th):\n"${topic}"\n\nDefinitions:\n- TALKING_HEAD: advice, direct speaking to camera\n- AI_EXPLAINER: how the system works, data explanation\n- AI_STORY: student journey, transformation`
    : `Classify this Instagram video topic for a medical professional:\n"${topic}"\n\nDefinitions:\n- TALKING_HEAD: doctor speaking to camera, advice, FAQs\n- AI_EXPLAINER: procedures, concepts, how things work\n- AI_STORY: patient journey, transformation, storytelling`;

  const content = await azureChat(
    [
      {
        role: "system",
        content:
          "Reply with exactly one token: TALKING_HEAD, AI_EXPLAINER, or AI_STORY. No other text.",
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    { temperature: 0.2, maxTokens: 32 }
  );

  const token = content.trim().split(/\s+/)[0] ?? "";
  const n = normalizeCategory(token.replace(/[^A-Za-z_]/g, ""));
  if (n) return n;
  return "TALKING_HEAD";
}
