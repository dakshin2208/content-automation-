import { NextResponse } from "next/server";
import { isValidClientId } from "@/lib/clients";
import { generateStoryboard } from "@/lib/steps/generate";
import { ensureHeaderRow, readRows, updateRow } from "@/lib/sheets";
import { logLine, type StepLogResult } from "@/lib/api/step-result";

export const maxDuration = 300;
export const runtime = "nodejs";

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
        r.storyboard.trim() === ""
    );

    const total = candidates.length;
    if (total === 0) {
      logLine(
        logs,
        "No rows need storyboards (all filled or script missing)."
      );
      return NextResponse.json({
        ok: true,
        logs,
        processed: 0,
        skipped: rows.filter(
          (r) => r.client === clientId && r.storyboard.trim() !== ""
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
        `Processing row ${i}/${total} (sheet row ${row.sheetRowIndex}) — ${Math.round((i / total) * 100)}%`
      );

      try {
        const trimmed = await generateStoryboard(clientId, row.script);

        await updateRow(row.sheetRowIndex, {
          storyboard: trimmed,
          status: "storyboard",
        });
        processed++;
        logLine(logs, `Row ${i}/${total}: storyboard saved.`);
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        logLine(logs, `Row ${i}/${total}: FAILED — ${msg}`);
        try {
          await updateRow(row.sheetRowIndex, {
            status: `error:storyboard:${msg.slice(0, 80)}`,
          });
        } catch {
          /* ignore */
        }
      }
    }

    logLine(logs, `Finished storyboards: ${processed} ok, ${failed} failed.`);
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
    console.error("[api/generate-storyboard]", e);
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
