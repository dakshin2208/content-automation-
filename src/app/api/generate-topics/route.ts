import { NextResponse } from "next/server";
import { isValidClientId } from "@/lib/clients";
import { generateTopicItems } from "@/lib/ai/generate-topics";
import {
  appendRows,
  ensureHeaderRow,
  newRowId,
  readRows,
} from "@/lib/sheets";
import type { VideoRow } from "@/lib/types";
import { logLine, type StepLogResult } from "@/lib/api/step-result";

const TARGET_TOPICS = 60;

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(req: Request) {
  const logs: string[] = [];
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const body = (await req.json()) as { clientId?: string };
    const clientId = body.clientId?.trim();
    if (!clientId || !isValidClientId(clientId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid or missing clientId", logs },
        { status: 400 }
      );
    }

    await ensureHeaderRow();
    const rows = await readRows();
    const forClient = rows.filter((r) => r.client === clientId);
    const withTopic = forClient.filter((r) => r.topic.trim() !== "");
    const need = Math.max(0, TARGET_TOPICS - withTopic.length);

    logLine(
      logs,
      `Client ${clientId}: ${withTopic.length}/${TARGET_TOPICS} topic rows present.`
    );

    if (need === 0) {
      skipped = TARGET_TOPICS;
      logLine(logs, "Skipping: all topic slots already filled (idempotent).");
      const result: StepLogResult = {
        ok: true,
        logs,
        processed: 0,
        skipped,
        failed: 0,
        progressPercent: 100,
      };
      return NextResponse.json(result);
    }

    logLine(logs, `Generating ${need} new topic(s) via Azure OpenAI…`);
    const items = await generateTopicItems(clientId, need);

    const toAppend: VideoRow[] = items.map((item) => ({
      id: newRowId(),
      client: clientId,
      topic: item.topic,
      category: item.category,
      script: "",
      storyboard: "",
      prompts: "",
      voiceover_direction: "",
      voiceover_audio_url: "",
      voice_id: "",
      status: "topics",
    }));

    await appendRows(toAppend);
    processed = toAppend.length;
    logLine(logs, `Appended ${processed} row(s) with topic + category.`);
    logLine(logs, "Done.");

    const result: StepLogResult = {
      ok: true,
      logs,
      processed,
      skipped: 0,
      failed: 0,
      progressPercent: 100,
    };
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/generate-topics]", e);
    logLine(logs, `Error: ${msg}`);
    failed = 1;
    return NextResponse.json(
      {
        ok: false,
        logs,
        processed,
        skipped,
        failed,
        error: msg,
      } satisfies StepLogResult,
      { status: 500 }
    );
  }
}
