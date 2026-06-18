import { NextResponse } from "next/server";
import { isValidClientId } from "@/lib/clients";
import { delay } from "@/lib/delay";
import { logLine, type StepLogResult } from "@/lib/api/step-result";
import { ensureHeaderRow, readRows, updateRow } from "@/lib/sheets";
import { generateAudio } from "@/lib/steps/audio";
import { getVoiceIdForClient } from "@/lib/voice";

export const runtime = "nodejs";
export const maxDuration = 600;

const BETWEEN_ROWS_MS = 1500;

export async function POST(req: Request) {
  const logs: string[] = [];
  let processed = 0;
  let failed = 0;
  const skipped = 0;

  try {
    const body = (await req.json()) as { clientId?: string };
    const clientId = body.clientId?.trim();

    if (!clientId || !isValidClientId(clientId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid or missing clientId", logs },
        { status: 400 }
      );
    }

    if (!process.env.ELEVENLABS_API_KEY?.trim()) {
      throw new Error("Missing ELEVENLABS_API_KEY");
    }
    const voiceId = getVoiceIdForClient(clientId);
    if (!voiceId || voiceId.startsWith("REPLACE_WITH")) {
      throw new Error(`No valid voice_id configured for client "${clientId}"`);
    }

    await ensureHeaderRow();
    const rows = await readRows();
    const candidates = rows.filter(
      (r) =>
        r.client === clientId &&
        r.voiceover_direction.trim() !== "" &&
        r.voiceover_audio_url.trim() === ""
    );

    if (candidates.length === 0) {
      logLine(
        logs,
        "No rows need voice audio generation (voiceover missing or audio already exists)."
      );
      return NextResponse.json({
        ok: true,
        logs,
        processed: 0,
        skipped: rows.filter(
          (r) => r.client === clientId && r.voiceover_audio_url.trim() !== ""
        ).length,
        failed: 0,
        progressPercent: 100,
      } satisfies StepLogResult);
    }

    const appBaseUrl =
      process.env.APP_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      new URL(req.url).origin;

    let index = 0;
    for (const row of candidates) {
      index++;
      logLine(logs, `Generating audio for row ${row.sheetRowIndex}`);

      try {
        const { url, voiceId: usedVoiceId } = await generateAudio(
          clientId,
          row.voiceover_direction,
          row.id,
          appBaseUrl
        );
        await updateRow(row.sheetRowIndex, {
          voiceover_audio_url: url,
          voice_id: usedVoiceId,
          status: "VOICE_AUDIO_DONE",
        });

        processed++;
        logLine(logs, `Saved audio for row ${row.sheetRowIndex}`);
      } catch (error) {
        failed++;
        const msg = error instanceof Error ? error.message : String(error);
        logLine(logs, `Row ${row.sheetRowIndex} FAILED — ${msg}`);
        try {
          await updateRow(row.sheetRowIndex, { status: "FAILED" });
        } catch {
          // ignore secondary sheet update failures
        }
      }

      if (index < candidates.length) {
        await delay(BETWEEN_ROWS_MS);
      }
    }

    return NextResponse.json({
      ok: failed === 0,
      logs,
      processed,
      skipped,
      failed,
      progressPercent: 100,
    } satisfies StepLogResult);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logLine(logs, `Error: ${msg}`);
    return NextResponse.json(
      {
        ok: false,
        logs,
        processed,
        skipped,
        failed: failed + 1,
        error: msg,
      } satisfies StepLogResult,
      { status: 500 }
    );
  }
}
