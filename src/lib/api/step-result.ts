export interface StepLogResult {
  ok: boolean;
  logs: string[];
  processed: number;
  skipped: number;
  failed: number;
  progressPercent?: number;
  error?: string;
}

export function logLine(logs: string[], msg: string): void {
  logs.push(`[${new Date().toISOString()}] ${msg}`);
}
