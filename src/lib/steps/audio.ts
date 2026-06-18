import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { delay } from "../delay";
import {
  cleanVoiceText,
  getVoiceIdForClient,
  getVoiceModelForClient,
  getVoiceSettingsPayload,
} from "../voice";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

async function callElevenLabs(
  apiKey: string,
  voiceId: string,
  modelId: string,
  cleanedText: string,
  clientId: string
): Promise<Buffer> {
  const { voice_settings } = getVoiceSettingsPayload(clientId);
  const res = await fetch(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: cleanedText,
        model_id: modelId,
        voice_settings,
      }),
    }
  );

  if (!res.ok) {
    const errText = (await res.text()).slice(0, 240);
    throw new Error(`ElevenLabs HTTP ${res.status}: ${errText}`);
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer());
  if (audioBuffer.length === 0) {
    throw new Error("ElevenLabs returned empty audio");
  }
  return audioBuffer;
}

async function generateAudioWithRetry(
  apiKey: string,
  voiceId: string,
  modelId: string,
  cleanedText: string,
  clientId: string
): Promise<Buffer> {
  try {
    return await callElevenLabs(apiKey, voiceId, modelId, cleanedText, clientId);
  } catch (firstError) {
    await delay(1000);
    try {
      return await callElevenLabs(
        apiKey,
        voiceId,
        modelId,
        cleanedText,
        clientId
      );
    } catch {
      throw firstError;
    }
  }
}

export interface AudioResult {
  url: string;
  voiceId: string;
}

/**
 * Generate TTS audio for one row's voiceover text and persist the file.
 * Returns the public URL + the voice id used; the caller writes them to the sheet.
 *
 * NOTE: writes to public/audio on local disk. On Azure App Service this works
 * for a single instance; switch to Azure Blob Storage before scaling out
 * (see deployment notes).
 */
export async function generateAudio(
  clientId: string,
  voiceoverText: string,
  rowId: string,
  appBaseUrl: string
): Promise<AudioResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing ELEVENLABS_API_KEY");

  const voiceId = getVoiceIdForClient(clientId);
  const modelId = getVoiceModelForClient(clientId);
  if (!voiceId || voiceId.startsWith("REPLACE_WITH")) {
    throw new Error(`No valid voice_id configured for client "${clientId}"`);
  }

  const cleanedText = cleanVoiceText(voiceoverText);
  if (!cleanedText) {
    throw new Error("voiceover_direction became empty after cleaning");
  }

  const audioBuffer = await generateAudioWithRetry(
    apiKey,
    voiceId,
    modelId,
    cleanedText,
    clientId
  );

  const outDir = path.join(process.cwd(), "public", "audio");
  await mkdir(outDir, { recursive: true });
  const filename = `${rowId || clientId}_${Date.now()}.mp3`;
  await writeFile(path.join(outDir, filename), audioBuffer);

  const url = `${appBaseUrl.replace(/\/+$/, "")}/audio/${filename}`;
  return { url, voiceId };
}
