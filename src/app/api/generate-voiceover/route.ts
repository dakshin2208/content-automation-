import { NextResponse } from "next/server";
import { isValidClientId } from "@/lib/clients";
import { generateVoiceover } from "@/lib/steps/generate";
import { delay } from "@/lib/delay";
import { ensureHeaderRow, readRows, updateRow } from "@/lib/sheets";
import { logLine, type StepLogResult } from "@/lib/api/step-result";

export const maxDuration = 600;
export const runtime = "nodejs";

const BETWEEN_ROWS_MS = 1500;

function failedStatusMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const tail = msg.replace(/\s+/g, " ").trim().slice(0, 180);
  return `FAILED:voiceover:${tail}`;
}

export async function POST(req: Request) {
  const logs: string[] = [];
  let processed = 0;
  const skipped = 0;
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
    const candidates = rows.filter(
      (r) =>
        r.client === clientId &&
        r.script.trim() !== "" &&
        r.voiceover_direction.trim() === ""
    );

    const total = candidates.length;
    if (total === 0) {
      logLine(
        logs,
        "No rows need voiceover direction (all filled or script missing)."
      );
      return NextResponse.json({
        ok: true,
        logs,
        processed: 0,
        skipped: rows.filter(
          (r) =>
            r.client === clientId && r.voiceover_direction.trim() !== ""
        ).length,
        failed: 0,
        progressPercent: 100,
      } satisfies StepLogResult);
    }

    let i = 0;
    for (const row of candidates) {
      i++;
      logLine(
        logs,
        `Processing row ${i}/${total} (sheet row ${row.sheetRowIndex})`
      );

      try {
        const trimmed = await generateVoiceover(clientId, row.script);

        await updateRow(row.sheetRowIndex, {
          voiceover_direction: trimmed,
          status: "VOICEOVER_DONE",
        });
        processed++;
        logLine(logs, `Completed row ${i}/${total}`);
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        logLine(logs, `Row ${i}/${total}: FAILED — ${msg}`);
        try {
          await updateRow(row.sheetRowIndex, {
            status: failedStatusMessage(e),
          });
        } catch {
          /* ignore */
        }
      }

      if (i < total) {
        await delay(BETWEEN_ROWS_MS);
      }
    }

    logLine(
      logs,
      `Finished voiceover: ${processed} ok, ${failed} failed.`
    );
    return NextResponse.json({
      ok: failed === 0,
      logs,
      processed,
      skipped,
      failed,
      progressPercent: 100,
    } satisfies StepLogResult);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/generate-voiceover]", e);
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
