export type TopicCategory = "TALKING_HEAD" | "AI_EXPLAINER" | "AI_STORY";

export const SHEET_COLUMNS = [
  "id",
  "client",
  "topic",
  "category",
  "script",
  "storyboard",
  "prompts",
  "voiceover_direction",
  "voiceover_audio_url",
  "voice_id",
  "status",
] as const;

export type SheetColumn = (typeof SHEET_COLUMNS)[number];

export interface VideoRow {
  id: string;
  client: string;
  topic: string;
  category: string;
  script: string;
  storyboard: string;
  prompts: string;
  voiceover_direction: string;
  voiceover_audio_url: string;
  voice_id: string;
  status: string;
}

/** 1-based sheet row index (includes header at row 1) */
export interface SheetRow extends VideoRow {
  sheetRowIndex: number;
}
