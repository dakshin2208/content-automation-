import { azureChat, azureChatWithRetry } from "../azure-openai";
import { buildScriptPrompt } from "../ai/script-prompt";
import { buildStoryboardPrompt } from "../ai/storyboard-prompt";
import { buildImagePromptsPrompt } from "../ai/prompts-prompt";
import { buildVoiceoverPrompt } from "../ai/voiceover-prompt";

/**
 * Single source of truth for per-row text generation.
 * Both the batch routes (fill empty cells) and the regenerate engine
 * (force-overwrite one row) call these, so prompts/params never drift.
 */

export async function generateScript(
  clientId: string,
  topic: string,
  category: string
): Promise<string> {
  const prompt = buildScriptPrompt(clientId, topic, category);
  const out = await azureChat(
    [
      {
        role: "system",
        content:
          "You write high-conversion short-form voiceover scripts. Follow the user's structure and timing exactly, include a re-hook, and output only script text with the requested section labels and quoted lines.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.65, maxTokens: 2048 }
  );
  const trimmed = out.trim();
  if (!trimmed) throw new Error("Empty script from model");
  return trimmed;
}

export async function generateStoryboard(
  clientId: string,
  script: string
): Promise<string> {
  const prompt = buildStoryboardPrompt(script, clientId);
  const out = await azureChat(
    [
      {
        role: "system",
        content:
          clientId === "choose_your_college"
            ? "You convert education video scripts into storyboards with student journey and data visuals. Output only the storyboard."
            : "You convert scripts into structured storyboards. Output only the storyboard.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.55, maxTokens: 4096 }
  );
  const trimmed = out.trim();
  if (!trimmed) throw new Error("Empty storyboard from model");
  return trimmed;
}

export async function generatePrompts(
  clientId: string,
  storyboard: string
): Promise<string> {
  const prompt = buildImagePromptsPrompt(storyboard, clientId);
  const out = await azureChat(
    [
      {
        role: "system",
        content:
          "You write cinematic image prompts for short-form video. For each storyboard scene you output exactly 2–3 distinct prompts (different angle, composition, or moment), using the Scene N / Scene N.M format requested. Medical or education tone must match the user prompt. Output only the prompts.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.55, maxTokens: 4096 }
  );
  const trimmed = out.trim();
  if (!trimmed) throw new Error("Empty prompts from model");
  return trimmed;
}

export async function generateVoiceover(
  clientId: string,
  script: string
): Promise<string> {
  const userPrompt = buildVoiceoverPrompt(script, clientId);
  const systemPrompt =
    clientId === "choose_your_college"
      ? "You write voiceover direction for education short-form video: calm advisor tone, warm and clear. Output only the formatted voiceover."
      : "You write cinematic voiceover direction for short-form video. Output only the formatted voiceover.";
  const out = await azureChatWithRetry(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.55, maxTokens: 4096 }
  );
  const trimmed = out.trim();
  if (!trimmed) throw new Error("Empty voiceover from model");
  return trimmed;
}
