import { readRows, updateRow } from "../sheets";
import { logLine } from "../api/step-result";
import {
  generateScript,
  generateStoryboard,
  generatePrompts,
  generateVoiceover,
} from "./generate";
import { generateAudio } from "./audio";

export type StepName =
  | "script"
  | "storyboard"
  | "prompts"
  | "voiceover"
  | "audio";

/** Canonical run order — also the dependency order. */
export const STEP_ORDER: StepName[] = [
  "script",
  "storyboard",
  "prompts",
  "voiceover",
  "audio",
];

/** Everything that becomes stale when a given field changes. */
const DOWNSTREAM: Record<StepName, StepName[]> = {
  script: ["storyboard", "prompts", "voiceover", "audio"],
  storyboard: ["prompts"],
  prompts: [],
  voiceover: ["audio"],
  audio: [],
};

export function isStepName(x: unknown): x is StepName {
  return typeof x === "string" && (STEP_ORDER as string[]).includes(x);
}

/**
 * Resolve which steps to regenerate.
 * - inclusive: regenerate `from` itself (e.g. "give me a new script")
 * - cascade:   also regenerate everything downstream of `from`
 *
 * Human edited the field in Sheets and wants the rest rebuilt:
 *   { from: "script", inclusive: false, cascade: true } -> storyboard, prompts, voiceover, audio
 * Don't like the AI output, regenerate it + rebuild:
 *   { from: "script", inclusive: true,  cascade: true } -> script, storyboard, prompts, voiceover, audio
 */
export function resolveSteps(
  from: StepName,
  inclusive: boolean,
  cascade: boolean
): StepName[] {
  const set = new Set<StepName>();
  if (inclusive) set.add(from);
  if (cascade) for (const s of DOWNSTREAM[from]) set.add(s);
  return STEP_ORDER.filter((s) => set.has(s));
}

export interface RegenerateResult {
  ok: boolean;
  rowId: string;
  regenerated: StepName[];
  skipped: StepName[];
  failed: { step: StepName; error: string }[];
}

/**
 * Regenerate the given steps for one row, in dependency order, force-overwriting.
 * Each step reads its upstream from a working copy that is updated as we go, so a
 * freshly regenerated (or human-edited) script flows into the storyboard, etc.
 * Stops on the first failure so a downstream step never runs on stale input.
 */
export async function regenerateRow(opts: {
  clientId: string;
  rowId: string;
  steps: StepName[];
  appBaseUrl: string;
  logs: string[];
}): Promise<RegenerateResult> {
  const { clientId, rowId, steps, appBaseUrl, logs } = opts;

  const rows = await readRows();
  const row = rows.find((r) => r.id === rowId && r.client === clientId);
  if (!row) {
    throw new Error(
      `Row not found for id "${rowId}" (client "${clientId}"). Reload rows and try again.`
    );
  }

  const work = { ...row };
  const regenerated: StepName[] = [];
  const failed: { step: StepName; error: string }[] = [];
  let aborted = false;

  for (const step of steps) {
    if (aborted) break;
    try {
      logLine(logs, `Row ${work.sheetRowIndex}: regenerating ${step}…`);

      if (step === "script") {
        if (!work.topic.trim() || !work.category.trim()) {
          throw new Error("Missing topic/category");
        }
        const v = await generateScript(clientId, work.topic, work.category);
        await updateRow(work.sheetRowIndex, { script: v, status: "scripts" });
        work.script = v;
      } else if (step === "storyboard") {
        if (!work.script.trim()) throw new Error("Missing script");
        const v = await generateStoryboard(clientId, work.script);
        await updateRow(work.sheetRowIndex, {
          storyboard: v,
          status: "storyboard",
        });
        work.storyboard = v;
      } else if (step === "prompts") {
        if (!work.storyboard.trim()) throw new Error("Missing storyboard");
        const v = await generatePrompts(clientId, work.storyboard);
        await updateRow(work.sheetRowIndex, {
          prompts: v,
          status: "PROMPTS_DONE",
        });
        work.prompts = v;
      } else if (step === "voiceover") {
        if (!work.script.trim()) throw new Error("Missing script");
        const v = await generateVoiceover(clientId, work.script);
        await updateRow(work.sheetRowIndex, {
          voiceover_direction: v,
          status: "VOICEOVER_DONE",
        });
        work.voiceover_direction = v;
      } else if (step === "audio") {
        if (!work.voiceover_direction.trim()) {
          throw new Error("Missing voiceover_direction");
        }
        const { url, voiceId } = await generateAudio(
          clientId,
          work.voiceover_direction,
          work.id,
          appBaseUrl
        );
        await updateRow(work.sheetRowIndex, {
          voiceover_audio_url: url,
          voice_id: voiceId,
          status: "VOICE_AUDIO_DONE",
        });
        work.voiceover_audio_url = url;
        work.voice_id = voiceId;
      }

      regenerated.push(step);
      logLine(logs, `Row ${work.sheetRowIndex}: ${step} done.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.push({ step, error: msg });
      logLine(logs, `Row ${work.sheetRowIndex}: ${step} FAILED — ${msg}`);
      aborted = true; // don't run downstream steps on stale input
    }
  }

  const done = new Set([...regenerated, ...failed.map((f) => f.step)]);
  const skipped = steps.filter((s) => !done.has(s));
  if (skipped.length) {
    logLine(
      logs,
      `Skipped (upstream failed): ${skipped.join(", ")}.`
    );
  }

  return {
    ok: failed.length === 0,
    rowId,
    regenerated,
    skipped,
    failed,
  };
}
