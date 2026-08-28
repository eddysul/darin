import type { BabyLogEntry } from "../types/babyLog";
import { offsetDateKey } from "./dateKey";

export const CARE_LOG_RECENT_WINDOW_DAYS = 90;

export type CareLogHistoryCoverage =
  | { kind: "full" }
  | { kind: "range"; fromDateKey: string; toDateKey: string };

export function recentCareLogRange(
  todayKey: string,
  days = CARE_LOG_RECENT_WINDOW_DAYS,
): Extract<CareLogHistoryCoverage, { kind: "range" }> {
  const safeDays = Math.max(1, Math.floor(days));
  return {
    kind: "range",
    fromDateKey: offsetDateKey(todayKey, -(safeDays - 1)),
    toDateKey: todayKey,
  };
}

export function careLogCoverageContains(
  coverage: CareLogHistoryCoverage,
  fromDateKey: string,
  toDateKey: string,
): boolean {
  if (coverage.kind === "full") return true;
  return coverage.fromDateKey <= fromDateKey && coverage.toDateKey >= toDateKey;
}

export function filterCareLogsByDateRange(
  logs: readonly BabyLogEntry[],
  fromDateKey: string,
  toDateKey: string,
): BabyLogEntry[] {
  return logs.filter((entry) => {
    const dateKey = entry.dateKey ?? "";
    return dateKey >= fromDateKey && dateKey <= toDateKey;
  });
}

export function mergeCareLogEntries(
  current: readonly BabyLogEntry[],
  incoming: readonly BabyLogEntry[],
): BabyLogEntry[] {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => byId.set(entry.id, entry));
  return [...byId.values()].sort((left, right) => {
    const leftKey = `${left.dateKey ?? ""}T${left.time}`;
    const rightKey = `${right.dateKey ?? ""}T${right.time}`;
    return leftKey.localeCompare(rightKey) || left.id.localeCompare(right.id);
  });
}
