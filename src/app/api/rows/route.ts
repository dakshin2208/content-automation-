import { NextResponse } from "next/server";
import { isValidClientId } from "@/lib/clients";
import { ensureHeaderRow, readRows } from "@/lib/sheets";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface RowSummary {
  id: string;
  sheetRowIndex: number;
  topic: string;
  category: string;
  status: string;
  has: {
    script: boolean;
    storyboard: boolean;
    prompts: boolean;
    voiceover: boolean;
    audio: boolean;
  };
}

/** Lightweight row list for the regenerate row-picker. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId")?.trim();
    if (!clientId || !isValidClientId(clientId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid or missing clientId" },
        { status: 400 }
      );
    }

    await ensureHeaderRow();
    const rows = await readRows();
    const out: RowSummary[] = rows
      .filter((r) => r.client === clientId && r.topic.trim() !== "")
      .map((r) => ({
        id: r.id,
        sheetRowIndex: r.sheetRowIndex,
        topic: r.topic,
        category: r.category,
        status: r.status,
        has: {
          script: r.script.trim() !== "",
          storyboard: r.storyboard.trim() !== "",
          prompts: r.prompts.trim() !== "",
          voiceover: r.voiceover_direction.trim() !== "",
          audio: r.voiceover_audio_url.trim() !== "",
        },
      }));

    return NextResponse.json({ ok: true, rows: out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/rows]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
