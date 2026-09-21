import type { BabyLogEntry } from "../types/babyLog";

// Keep the loading fallback referentially stable: report derivations and their
// effects must not restart merely because an unrelated screen state changed.
const EMPTY_REPORT_LOGS: BabyLogEntry[] = [];

export function reportLogsForDisplay(
  logs: BabyLogEntry[],
  rangeCovered: boolean,
  historyComplete: boolean,
): BabyLogEntry[] {
  return rangeCovered || historyComplete ? logs : EMPTY_REPORT_LOGS;
}
