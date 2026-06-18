import { getClientLabel } from "./clients";

export const VOICE_MAP: Record<string, string> = {
  "Dr. Shrutika": "5FwHiusFvpqKZR9b2uZN",
  "Dr. Bharath": "REPLACE_WITH_VOICE_ID",
  /** Neutral, confident, advisor-style — set in ElevenLabs dashboard */
  ChooseYourCollege: "REPLACE_WITH_VOICE_ID",
};

const VOICE_MODEL_MAP: Record<string, string> = {
  "Dr. Shrutika": "eleven_v3",
  "Dr. Bharath": "eleven_multilingual_v2",
  ChooseYourCollege: "eleven_multilingual_v2",
};

/** Per-request ElevenLabs `voice_settings` (and optional overrides). */
export interface VoiceSettingsPayload {
  voice_settings: {
    stability: number;
    similarity_boost: number;
    speed?: number;
  };
}

export function getVoiceSettingsPayload(clientId: string): VoiceSettingsPayload {
  const label = getClientLabel(clientId);
  if (label === "ChooseYourCollege") {
    return {
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75,
        speed: 0.92,
      },
    };
  }
  return {
    voice_settings: {
      stability: 0.4,
      similarity_boost: 0.8,
    },
  };
}

export function getVoiceIdForClient(clientId: string): string {
  const label = getClientLabel(clientId);
  return VOICE_MAP[label] ?? "";
}

export function getVoiceModelForClient(clientId: string): string {
  const label = getClientLabel(clientId);
  return VOICE_MODEL_MAP[label] ?? "eleven_multilingual_v2";
}

/**
 * Voiceover direction is generated in final ElevenLabs form (bracket tags + plain speech).
 * No timestamp stripping or reformatting here — keep TTS input identical to the sheet.
 */
export function cleanVoiceText(text: string): string {
  return text.trim();
}
