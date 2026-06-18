import { NextResponse } from "next/server";
import { isValidClientId } from "@/lib/clients";
import { generateScript } from "@/lib/steps/generate";
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
        r.topic.trim() !== "" &&
        r.category.trim() !== "" &&
        r.script.trim() === ""
    );

    const total = candidates.length;
    if (total === 0) {
      logLine(logs, "No rows need scripts (all filled or missing topic/category).");
      return NextResponse.json({
        ok: true,
        logs,
        processed: 0,
        skipped: rows.filter((r) => r.client === clientId && r.script.trim() !== "")
          .length,
        failed: 0,
        progressPercent: 100,
      } satisfies StepLogResult);
    }

    let i = 0;
    for (const row of candidates) {
      i++;
      logLine(
        logs,
        `Processing row ${i}/${total} (sheet row ${row.sheetRowIndex}, id ${row.id.slice(0, 8)}…) — ${Math.round((i / total) * 100)}%`
      );

      try {
        const trimmed = await generateScript(clientId, row.topic, row.category);

        await updateRow(row.sheetRowIndex, {
          script: trimmed,
          status: "scripts",
        });
        processed++;
        logLine(logs, `Row ${i}/${total}: script saved.`);
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        logLine(logs, `Row ${i}/${total}: FAILED — ${msg}`);
        try {
          await updateRow(row.sheetRowIndex, {
            status: `error:script:${msg.slice(0, 80)}`,
          });
        } catch {
          /* ignore secondary failure */
        }
      }
    }

    logLine(logs, `Finished scripts: ${processed} ok, ${failed} failed.`);
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
    console.error("[api/generate-scripts]", e);
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
