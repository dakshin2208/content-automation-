"use client";

import { useCallback, useRef, useState } from "react";

const CLIENT_OPTIONS = [
  { id: "dr_shrutika", label: "Dr. Shrutika (Dentist, Bangalore)" },
  { id: "dr_bharath", label: "Dr. Bharath (Sports Doctor, Bangalore)" },
  { id: "choose_your_college", label: "ChooseYourCollege (Education Platform)" },
] as const;

type StepKey =
  | "topics"
  | "scripts"
  | "storyboard"
  | "prompts"
  | "voiceover"
  | "voiceAudio";

const STEP_ENDPOINT: Record<StepKey, string> = {
  topics: "/api/generate-topics",
  scripts: "/api/generate-scripts",
  storyboard: "/api/generate-storyboard",
  prompts: "/api/generate-prompts",
  voiceover: "/api/generate-voiceover",
  voiceAudio: "/api/generate-voice-audio",
};

const STEP_LABEL: Record<StepKey, string> = {
  topics: "Generate Topics",
  scripts: "Generate Scripts",
  storyboard: "Generate Storyboard",
  prompts: "Generate Prompts",
  voiceover: "Generate Voiceover",
  voiceAudio: "Generate Voice Audio",
};

interface StepResponse {
  ok?: boolean;
  logs?: string[];
  processed?: number;
  skipped?: number;
  failed?: number;
  progressPercent?: number;
  error?: string;
}

interface RowSummary {
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

type RegenBody = {
  from: "script" | "storyboard" | "prompts" | "voiceover" | "audio";
  inclusive: boolean;
  cascade: boolean;
};

/**
 * Human-in-the-loop actions. The team edits a cell in Google Sheets, then runs
 * the matching "Rebuild after … edit" here; the engine reads the edited value
 * fresh and recomputes only what's downstream.
 */
const REGEN_ACTIONS: {
  key: string;
  label: string;
  hint: string;
  body: RegenBody;
}[] = [
  {
    key: "rebuild_after_script",
    label: "Rebuild after script edit",
    hint: "keeps your edited script → storyboard, prompts, voiceover, audio",
    body: { from: "script", inclusive: false, cascade: true },
  },
  {
    key: "rebuild_after_storyboard",
    label: "Rebuild after storyboard edit",
    hint: "keeps your edited storyboard → prompts",
    body: { from: "storyboard", inclusive: false, cascade: true },
  },
  {
    key: "rebuild_after_voiceover",
    label: "Rebuild after voiceover edit",
    hint: "keeps your edited voiceover → audio",
    body: { from: "voiceover", inclusive: false, cascade: true },
  },
  {
    key: "new_script_rebuild",
    label: "New script → rebuild all",
    hint: "regenerate script from topic, then everything below",
    body: { from: "script", inclusive: true, cascade: true },
  },
  {
    key: "regen_storyboard",
    label: "Regenerate storyboard",
    hint: "from current script (storyboard only)",
    body: { from: "storyboard", inclusive: true, cascade: false },
  },
  {
    key: "regen_prompts",
    label: "Regenerate prompts",
    hint: "from current storyboard (prompts only)",
    body: { from: "prompts", inclusive: true, cascade: false },
  },
  {
    key: "regen_voiceover_audio",
    label: "Regenerate voiceover + audio",
    hint: "from current script",
    body: { from: "voiceover", inclusive: true, cascade: true },
  },
  {
    key: "regen_audio",
    label: "Regenerate audio",
    hint: "from current voiceover (audio only)",
    body: { from: "audio", inclusive: true, cascade: false },
  },
];

export function Dashboard() {
  const [clientId, setClientId] = useState<string>(CLIENT_OPTIONS[0].id);
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState<StepKey | null>(null);
  const [regenRunning, setRegenRunning] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rows, setRows] = useState<RowSummary[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string>("");
  const [lastResult, setLastResult] = useState<"success" | "failure" | null>(
    null
  );
  const activeRequestRef = useRef<AbortController | null>(null);

  const busy = running !== null || regenRunning !== null || loadingRows;

  const appendLogs = useCallback((lines: string[]) => {
    setLogs((prev) => [...prev, ...lines]);
  }, []);

  const handleResponse = useCallback(
    (raw: string, status: number, okStatus: boolean): boolean => {
      let data: StepResponse = {};
      try {
        data = raw ? (JSON.parse(raw) as StepResponse) : {};
      } catch {
        appendLogs([`✗ Invalid response (${status}): ${raw.slice(0, 400)}`]);
        setLastResult("failure");
        return false;
      }
      if (data.logs?.length) appendLogs(data.logs);

      if (!okStatus || data.ok === false) {
        setLastResult("failure");
        appendLogs([
          `✗ Failed${data.error ? `: ${data.error}` : ""}`,
          `Processed: ${data.processed ?? 0}, skipped: ${data.skipped ?? 0}, failed: ${data.failed ?? 0}`,
        ]);
        return false;
      }
      setLastResult("success");
      appendLogs([
        `✓ Success — processed ${data.processed ?? 0}, skipped ${data.skipped ?? 0}, failed ${data.failed ?? 0}`,
      ]);
      return true;
    },
    [appendLogs]
  );

  const runStep = async (step: StepKey) => {
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setRunning(step);
    setLastResult(null);
    appendLogs([`── ${STEP_LABEL[step]} started ──`]);

    try {
      const res = await fetch(STEP_ENDPOINT[step], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
        signal: controller.signal,
      });
      const raw = await res.text();
      handleResponse(raw, res.status, res.ok);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        appendLogs([`⏹ Stopped by user (${STEP_LABEL[step]}).`]);
      } else {
        setLastResult("failure");
        appendLogs([
          `✗ Network or client error: ${e instanceof Error ? e.message : String(e)}`,
        ]);
      }
    } finally {
      setRunning(null);
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
    }
  };

  const stopCurrentRun = () => {
    if (!activeRequestRef.current) return;
    activeRequestRef.current.abort();
    appendLogs([`Stop requested…`]);
  };

  const loadRows = async () => {
    setLoadingRows(true);
    setLastResult(null);
    appendLogs([`── Loading rows for ${clientId} ──`]);
    try {
      const res = await fetch(
        `/api/rows?clientId=${encodeURIComponent(clientId)}`
      );
      const data = (await res.json()) as {
        ok?: boolean;
        rows?: RowSummary[];
        error?: string;
      };
      if (!res.ok || data.ok === false || !data.rows) {
        appendLogs([`✗ Could not load rows: ${data.error ?? res.status}`]);
        setRows([]);
        return;
      }
      setRows(data.rows);
      setSelectedRowId(data.rows[0]?.id ?? "");
      appendLogs([`Loaded ${data.rows.length} row(s).`]);
    } catch (e) {
      appendLogs([
        `✗ Failed to load rows: ${e instanceof Error ? e.message : String(e)}`,
      ]);
    } finally {
      setLoadingRows(false);
    }
  };

  const runRegen = async (action: (typeof REGEN_ACTIONS)[number]) => {
    if (!selectedRowId) {
      appendLogs(["Pick a row first (Load rows → choose one)."]);
      return;
    }
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setRegenRunning(action.key);
    setLastResult(null);
    appendLogs([`── ${action.label} (row ${selectedRowId.slice(0, 8)}…) ──`]);
    try {
      const res = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          rowId: selectedRowId,
          ...action.body,
        }),
        signal: controller.signal,
      });
      const raw = await res.text();
      const ok = handleResponse(raw, res.status, res.ok);
      if (ok) await loadRowsQuiet();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        appendLogs([`⏹ Stopped by user (${action.label}).`]);
      } else {
        setLastResult("failure");
        appendLogs([
          `✗ Network or client error: ${e instanceof Error ? e.message : String(e)}`,
        ]);
      }
    } finally {
      setRegenRunning(null);
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
    }
  };

  // Refresh row badges silently after a regenerate.
  const loadRowsQuiet = async () => {
    try {
      const res = await fetch(
        `/api/rows?clientId=${encodeURIComponent(clientId)}`
      );
      const data = (await res.json()) as { rows?: RowSummary[] };
      if (data.rows) setRows(data.rows);
    } catch {
      /* ignore */
    }
  };

  const selectedRow = rows.find((r) => r.id === selectedRowId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-10">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Phase 1 · AI Content Automation
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Run each step independently, or edit a cell in Google Sheets and
          rebuild what depends on it. Existing cells are never overwritten by the
          batch steps.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
        <label
          htmlFor="client"
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          Client
        </label>
        <select
          id="client"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setRows([]);
            setSelectedRowId("");
          }}
          disabled={busy}
          className="mt-2 block w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {CLIENT_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        <div className="mt-8">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Batch actions (fill empty cells)
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {(Object.keys(STEP_LABEL) as StepKey[]).map((step) => (
              <ActionButton
                key={step}
                label={STEP_LABEL[step]}
                onClick={() => runStep(step)}
                loading={running === step}
                disabled={busy && running !== step}
              />
            ))}
            <button
              type="button"
              onClick={stopCurrentRun}
              disabled={running === null && regenRunning === null}
              className="min-w-[160px] rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-rose-500 dark:hover:bg-rose-400"
            >
              Stop
            </button>
          </div>
        </div>
      </section>

      {/* Human-in-the-loop regenerate */}
      <section className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-6 dark:border-indigo-900/60 dark:bg-indigo-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Edit &amp; regenerate (one row)
          </h2>
          <button
            type="button"
            onClick={loadRows}
            disabled={busy}
            className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-700 dark:bg-slate-900 dark:text-indigo-200"
          >
            {loadingRows ? "Loading…" : "Load rows"}
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Edit the script / storyboard / voiceover cell in Google Sheets, then
          pick the row here and rebuild what depends on it.
        </p>

        {rows.length > 0 ? (
          <>
            <label
              htmlFor="row"
              className="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Row
            </label>
            <select
              id="row"
              value={selectedRowId}
              onChange={(e) => setSelectedRowId(e.target.value)}
              disabled={busy}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {`#${r.sheetRowIndex} [${r.category}] ${r.topic.slice(0, 70)}`}
                </option>
              ))}
            </select>

            {selectedRow && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["script", selectedRow.has.script],
                    ["storyboard", selectedRow.has.storyboard],
                    ["prompts", selectedRow.has.prompts],
                    ["voiceover", selectedRow.has.voiceover],
                    ["audio", selectedRow.has.audio],
                  ] as const
                ).map(([name, present]) => (
                  <span
                    key={name}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      present
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                        : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {present ? "✓" : "—"} {name}
                  </span>
                ))}
                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  status: {selectedRow.status || "—"}
                </span>
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {REGEN_ACTIONS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => runRegen(a)}
                  disabled={busy || !selectedRowId}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-left text-sm shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  <span className="block font-medium text-slate-900 dark:text-slate-100">
                    {regenRunning === a.key ? "Working…" : a.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    {a.hint}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Click “Load rows” to choose a row to regenerate.
          </p>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Status &amp; logs
          </h2>
          <div className="flex items-center gap-2">
            {lastResult === "success" && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                Last run: success
              </span>
            )}
            {lastResult === "failure" && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200">
                Last run: failure
              </span>
            )}
            <button
              type="button"
              onClick={() => setLogs([])}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Clear logs
            </button>
          </div>
        </div>
        <div className="mt-4 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
          {logs.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-500">
              Run a step to see progress (e.g. &quot;Processing row 12/60&quot;).
            </p>
          ) : (
            logs.map((line, i) => (
              <div key={`${i}-${line.slice(0, 40)}`} className="whitespace-pre-wrap">
                {line}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  loading,
  disabled,
}: {
  label: string;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-w-[160px] rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
    >
      {loading ? "Working…" : label}
    </button>
  );
}
