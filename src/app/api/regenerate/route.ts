import { NextResponse } from "next/server";
import { isValidClientId } from "@/lib/clients";
import { logLine, type StepLogResult } from "@/lib/api/step-result";
import {
  isStepName,
  regenerateRow,
  resolveSteps,
  type StepName,
} from "@/lib/steps/regenerate";

export const maxDuration = 600;
export const runtime = "nodejs";

interface RegenBody {
  clientId?: string;
  rowId?: string;
  /** Explicit step list (advanced). Takes precedence over from/inclusive/cascade. */
  steps?: string[];
  /** The edited / target field. */
  from?: string;
  /** Regenerate `from` itself (default true). */
  inclusive?: boolean;
  /** Also regenerate everything downstream of `from` (default false). */
  cascade?: boolean;
}

export async function POST(req: Request) {
  const logs: string[] = [];

  try {
    const body = (await req.json()) as RegenBody;
    const clientId = body.clientId?.trim();
    if (!clientId || !isValidClientId(clientId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid or missing clientId", logs },
        { status: 400 }
      );
    }

    const rowId = body.rowId?.trim();
    if (!rowId) {
      return NextResponse.json(
        { ok: false, error: "Missing rowId", logs },
        { status: 400 }
      );
    }

    let steps: StepName[];
    if (Array.isArray(body.steps) && body.steps.length > 0) {
      const invalid = body.steps.filter((s) => !isStepName(s));
      if (invalid.length) {
        return NextResponse.json(
          { ok: false, error: `Invalid step(s): ${invalid.join(", ")}`, logs },
          { status: 400 }
        );
      }
      steps = body.steps.filter(isStepName);
    } else {
      const from = body.from;
      if (!isStepName(from)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Provide `from` (script|storyboard|prompts|voiceover|audio) or an explicit `steps` array.",
            logs,
          },
          { status: 400 }
        );
      }
      const inclusive = body.inclusive !== false; // default true
      const cascade = body.cascade === true; // default false
      steps = resolveSteps(from, inclusive, cascade);
    }

    if (steps.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No steps resolved to regenerate", logs },
        { status: 400 }
      );
    }

    const appBaseUrl =
      process.env.APP_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      new URL(req.url).origin;

    logLine(logs, `Regenerate [${steps.join(" → ")}] for row ${rowId}…`);
    const result = await regenerateRow({
      clientId,
      rowId,
      steps,
      appBaseUrl,
      logs,
    });

    logLine(
      logs,
      `Done: ${result.regenerated.length} regenerated, ${result.failed.length} failed, ${result.skipped.length} skipped.`
    );

    const payload: StepLogResult = {
      ok: result.ok,
      logs,
      processed: result.regenerated.length,
      skipped: result.skipped.length,
      failed: result.failed.length,
      progressPercent: 100,
      error: result.failed.length
        ? result.failed.map((f) => `${f.step}: ${f.error}`).join("; ")
        : undefined,
    };
    return NextResponse.json(payload, { status: result.ok ? 200 : 500 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/regenerate]", e);
    logLine(logs, `Error: ${msg}`);
    return NextResponse.json(
      {
        ok: false,
        logs,
        processed: 0,
        skipped: 0,
        failed: 1,
        error: msg,
      } satisfies StepLogResult,
      { status: 500 }
    );
  }
}
