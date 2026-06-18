import { google, sheets_v4 } from "googleapis";
import { randomUUID } from "crypto";
import type { VideoRow } from "./types";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/** Accepts raw ID or full `docs.google.com/spreadsheets/d/...` URL. */
export function normalizeSpreadsheetId(input: string): string {
  const t = input.trim();
  const fromUrl = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fromUrl) return fromUrl[1];
  if (/^[a-zA-Z0-9-_]+$/.test(t)) return t;
  throw new Error(
    "Invalid GOOGLE_SHEETS_SPREADSHEET_ID. Paste only the spreadsheet ID, or the full Google Sheets URL."
  );
}

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!id) throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID");
  return normalizeSpreadsheetId(id);
}

function sheetTitleFromEnv(): string {
  return (process.env.GOOGLE_SHEETS_TAB_NAME ?? "Scripts").trim();
}

/** A1 range with sheet title quoted per Google Sheets rules (internal `'` → `''`). */
export function a1SheetRange(title: string, cellRange: string): string {
  return `'${title.replace(/'/g, "''")}'!${cellRange}`;
}

const resolvedTabCache = new Map<string, string>();

/**
 * Resolves which tab to use: exact match to env name, then case-insensitive,
 * then "Sheet1", then the first tab. Caches per spreadsheet + env name.
 */
export async function getResolvedSheetTitle(): Promise<string> {
  const spreadsheetId = getSpreadsheetId();
  const desired = sheetTitleFromEnv();
  const cacheKey = `${spreadsheetId}::${desired}`;
  const hit = resolvedTabCache.get(cacheKey);
  if (hit) return hit;

  const api = getSheetsClient();
  const meta = await api.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(title)",
  });
  const titles =
    (meta.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => typeof t === "string" && t.length > 0);

  let resolved: string | undefined = titles.find((t) => t === desired);
  if (!resolved) {
    resolved = titles.find((t) => t.toLowerCase() === desired.toLowerCase());
  }
  if (!resolved) {
    resolved = titles.find((t) => t === "Sheet1");
  }
  if (!resolved && titles.length > 0) {
    resolved = titles[0];
  }
  if (!resolved) {
    throw new Error(
      `No worksheet tabs in this spreadsheet. Check GOOGLE_SHEETS_SPREADSHEET_ID. Env tab name: "${desired}".`
    );
  }
  if (resolved !== desired) {
    console.warn(
      `[sheets] Tab "${desired}" not found; using "${resolved}". Available tabs: ${titles.join(", ")}`
    );
  }
  resolvedTabCache.set(cacheKey, resolved);
  return resolved;
}

function getSheetsClient(): sheets_v4.Sheets {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON (service account JSON string)");
  }
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Use a single-line string or escape newlines in .env.local."
    );
  }
  const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  return google.sheets({ version: "v4", auth });
}

const HEADER: string[] = [
  "id",
  "client",
  "topic",
  "category",
  "script",
  "storyboard",
  "prompts",
  "voiceover_direction",
  "voiceover_audio_url",
  "voice_id",
  "status",
];

const COL_LAST = "K";

function rowToVideoRow(cells: string[], sheetRowIndex: number): import("./types").SheetRow {
  const s = cells.map((c) => String(c ?? ""));
  const pad = (i: number) => (s[i] ?? "").trim();

  if (s.length <= 8) {
    return {
      sheetRowIndex,
      id: pad(0),
      client: pad(1),
      topic: pad(2),
      category: pad(3),
      script: pad(4),
      storyboard: pad(5),
      prompts: pad(6),
      voiceover_direction: "",
      voiceover_audio_url: "",
      voice_id: "",
      status: pad(7),
    };
  }

  if (s.length <= 9) {
    return {
      sheetRowIndex,
      id: pad(0),
      client: pad(1),
      topic: pad(2),
      category: pad(3),
      script: pad(4),
      storyboard: pad(5),
      prompts: pad(6),
      voiceover_direction: pad(7),
      voiceover_audio_url: "",
      voice_id: "",
      status: pad(8),
    };
  }

  if (s.length <= 10) {
    return {
      sheetRowIndex,
      id: pad(0),
      client: pad(1),
      topic: pad(2),
      category: pad(3),
      script: pad(4),
      storyboard: pad(5),
      prompts: pad(6),
      voiceover_direction: pad(7),
      voiceover_audio_url: pad(8),
      voice_id: "",
      status: pad(9),
    };
  }

  return {
    sheetRowIndex,
    id: pad(0),
    client: pad(1),
    topic: pad(2),
    category: pad(3),
    script: pad(4),
    storyboard: pad(5),
    prompts: pad(6),
    voiceover_direction: pad(7),
    voiceover_audio_url: pad(8),
    voice_id: pad(9),
    status: pad(10),
  };
}

/** Read all data rows (skips header). Returns rows with 1-based sheet index. */
export async function readRows(): Promise<import("./types").SheetRow[]> {
  const tab = await getResolvedSheetTitle();
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: a1SheetRange(tab, `A:${COL_LAST}`),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = res.data.values as string[][] | undefined;
  if (!values || values.length === 0) return [];

  let start = 0;
  const first = values[0]?.map((c) => String(c ?? "").trim().toLowerCase());
  const looksLikeHeader =
    first?.[0] === "id" &&
    first?.[1] === "client" &&
    first?.[2] === "topic";
  if (looksLikeHeader) start = 1;

  const out: import("./types").SheetRow[] = [];
  for (let i = start; i < values.length; i++) {
    const rowNum = i + 1;
    const cells = values[i].map((c) => String(c ?? ""));
    out.push(rowToVideoRow(cells, rowNum));
  }
  return out;
}

export async function ensureHeaderRow(): Promise<void> {
  const tab = await getResolvedSheetTitle();
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === tab);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId == null) {
    throw new Error(`Could not resolve sheet id for tab "${tab}"`);
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: a1SheetRange(tab, `A1:${COL_LAST}1`),
  });
  const row = (res.data.values?.[0] ?? []).map((c) => String(c ?? "").trim());

  const isNewHeader =
    row[0]?.toLowerCase() === "id" &&
    row[6]?.toLowerCase() === "prompts" &&
    row[7]?.toLowerCase() === "voiceover_direction" &&
    row[8]?.toLowerCase() === "voiceover_audio_url" &&
    row[9]?.toLowerCase() === "voice_id" &&
    row[10]?.toLowerCase() === "status";

  if (isNewHeader) return;

  const legacyHeader =
    row.length >= 8 &&
    row[0]?.toLowerCase() === "id" &&
    row[6]?.toLowerCase() === "prompts";

  if (legacyHeader) {
    const needsVoiceoverDirection = row[7]?.toLowerCase() !== "voiceover_direction";
    const needsVoiceAudioUrl = row[8]?.toLowerCase() !== "voiceover_audio_url";
    const needsVoiceId = row[9]?.toLowerCase() !== "voice_id";
    const requests: sheets_v4.Schema$Request[] = [];

    if (needsVoiceoverDirection) {
      requests.push({
        insertDimension: {
          range: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: 7,
            endIndex: 8,
          },
          inheritFromBefore: false,
        },
      });
    }
    if (needsVoiceAudioUrl) {
      requests.push({
        insertDimension: {
          range: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: 8,
            endIndex: 9,
          },
          inheritFromBefore: false,
        },
      });
    }
    if (needsVoiceId) {
      requests.push({
        insertDimension: {
          range: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: 9,
            endIndex: 10,
          },
          inheritFromBefore: false,
        },
      });
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: a1SheetRange(tab, `A1:${COL_LAST}1`),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [HEADER] },
  });
}

/**
 * 1-based index of the row after the last one containing any data in A:K.
 * Used instead of values.append's table auto-detection, which can anchor on
 * the wrong column when existing rows are offset.
 */
async function nextEmptyRow(): Promise<number> {
  const tab = await getResolvedSheetTitle();
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: a1SheetRange(tab, `A:${COL_LAST}`),
  });
  const values = (res.data.values as string[][] | undefined) ?? [];
  let last = 0;
  for (let i = 0; i < values.length; i++) {
    const hasData = (values[i] ?? []).some((c) => String(c ?? "").trim() !== "");
    if (hasData) last = i + 1; // 1-based
  }
  return Math.max(last + 1, 2); // never overwrite the header row
}

/** Append rows after the last data row, always anchored at column A. */
export async function appendRows(rows: VideoRow[]): Promise<void> {
  if (rows.length === 0) return;
  const tab = await getResolvedSheetTitle();
  const sheets = getSheetsClient();
  const values = rows.map((r) => [
    r.id,
    r.client,
    r.topic,
    r.category,
    r.script,
    r.storyboard,
    r.prompts,
    r.voiceover_direction,
    r.voiceover_audio_url,
    r.voice_id,
    r.status,
  ]);
  const startRow = await nextEmptyRow();
  const endRow = startRow + values.length - 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: a1SheetRange(tab, `A${startRow}:${COL_LAST}${endRow}`),
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/** Update one row by sheet row index (1-based). Merges partial VideoRow. */
export async function updateRow(
  sheetRowIndex: number,
  data: Partial<VideoRow>
): Promise<void> {
  const tab = await getResolvedSheetTitle();
  const sheets = getSheetsClient();
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: a1SheetRange(tab, `A${sheetRowIndex}:${COL_LAST}${sheetRowIndex}`),
  });
  const existing = (current.data.values?.[0] ?? []).map((c) => String(c ?? ""));
  const pad = (i: number) => (existing[i] ?? "").trim();

  let base: VideoRow;
  if (existing.length <= 8) {
    base = {
      id: pad(0),
      client: pad(1),
      topic: pad(2),
      category: pad(3),
      script: pad(4),
      storyboard: pad(5),
      prompts: pad(6),
      voiceover_direction: "",
      voiceover_audio_url: "",
      voice_id: "",
      status: pad(7),
    };
  } else if (existing.length <= 9) {
    base = {
      id: pad(0),
      client: pad(1),
      topic: pad(2),
      category: pad(3),
      script: pad(4),
      storyboard: pad(5),
      prompts: pad(6),
      voiceover_direction: pad(7),
      voiceover_audio_url: "",
      voice_id: "",
      status: pad(8),
    };
  } else if (existing.length <= 10) {
    base = {
      id: pad(0),
      client: pad(1),
      topic: pad(2),
      category: pad(3),
      script: pad(4),
      storyboard: pad(5),
      prompts: pad(6),
      voiceover_direction: pad(7),
      voiceover_audio_url: pad(8),
      voice_id: "",
      status: pad(9),
    };
  } else {
    base = {
      id: pad(0),
      client: pad(1),
      topic: pad(2),
      category: pad(3),
      script: pad(4),
      storyboard: pad(5),
      prompts: pad(6),
      voiceover_direction: pad(7),
      voiceover_audio_url: pad(8),
      voice_id: pad(9),
      status: pad(10),
    };
  }

  const merged: VideoRow = {
    id: data.id ?? base.id,
    client: data.client ?? base.client,
    topic: data.topic ?? base.topic,
    category: data.category ?? base.category,
    script: data.script ?? base.script,
    storyboard: data.storyboard ?? base.storyboard,
    prompts: data.prompts ?? base.prompts,
    voiceover_direction: data.voiceover_direction ?? base.voiceover_direction,
    voiceover_audio_url: data.voiceover_audio_url ?? base.voiceover_audio_url,
    voice_id: data.voice_id ?? base.voice_id,
    status: data.status ?? base.status,
  };

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: a1SheetRange(tab, `A${sheetRowIndex}:${COL_LAST}${sheetRowIndex}`),
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          merged.id,
          merged.client,
          merged.topic,
          merged.category,
          merged.script,
          merged.storyboard,
          merged.prompts,
          merged.voiceover_direction,
          merged.voiceover_audio_url,
          merged.voice_id,
          merged.status,
        ],
      ],
    },
  });
}

export function newRowId(): string {
  return randomUUID();
}
