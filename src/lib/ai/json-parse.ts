import type { TopicCategory } from "../types";

/** Strip markdown fences and extract JSON array or object substring. */
export function extractJsonPayload(text: string): string {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence) t = fence[1].trim();

  const arrStart = t.indexOf("[");
  const objStart = t.indexOf("{");
  if (arrStart === -1 && objStart === -1) return t;

  const start =
    arrStart === -1
      ? objStart
      : objStart === -1
        ? arrStart
        : Math.min(arrStart, objStart);

  let depth = 0;
  let inStr = false;
  let esc = false;
  const open = t[start];
  const close = open === "[" ? "]" : "}";
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === open) depth++;
    if (c === close) {
      depth--;
      if (depth === 0) return t.slice(start, i + 1);
    }
  }
  return t.slice(start);
}

export function safeParseJson<T>(text: string): T {
  const payload = extractJsonPayload(text);
  return JSON.parse(payload) as T;
}

const VALID_CATEGORIES = new Set<string>([
  "TALKING_HEAD",
  "AI_EXPLAINER",
  "AI_STORY",
]);

export function normalizeCategory(raw: unknown): TopicCategory | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (VALID_CATEGORIES.has(u)) return u as TopicCategory;
  return null;
}
