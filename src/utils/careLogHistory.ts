import type { BabyLogEntry } from "../types/babyLog";
import type { LogCategoryKey } from "../types/logCategory";
import type { LocalDataScope } from "./scopedLocalStorage";
import { formatDateKey, offsetDateKey } from "./dateKey";

export const CARE_LOG_RECENT_WINDOW_DAYS = 90;

export type CareLogHistoryCoverage =
  | { kind: "full" }
  | { kind: "range"; fromDateKey: string; toDateKey: string };

export function careLogRequestMatchesScope(
  requestedScopeId: string,
  currentScope: LocalDataScope | null,
): boolean {
  return Boolean(
    currentScope
    && `${currentScope.userId}:${currentScope.babyId}` === requestedScopeId,
  );
}

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

export function extendCareLogCoverage(
  current: CareLogHistoryCoverage | null,
  incoming: Extract<CareLogHistoryCoverage, { kind: "range" }>,
): CareLogHistoryCoverage {
  if (!current) return incoming;
  if (current.kind === "full") return current;
  const touchesCurrent = incoming.fromDateKey <= offsetDateKey(current.toDateKey, 1)
    && incoming.toDateKey >= offsetDateKey(current.fromDateKey, -1);
  if (!touchesCurrent) return current;
  return {
    kind: "range",
    fromDateKey: incoming.fromDateKey < current.fromDateKey ? incoming.fromDateKey : current.fromDateKey,
    toDateKey: incoming.toDateKey > current.toDateKey ? incoming.toDateKey : current.toDateKey,
  };
}

export function filterCareLogsByDateRange(
  logs: readonly BabyLogEntry[],
  fromDateKey: string,
  toDateKey: string,
): BabyLogEntry[] {
  return logs.filter((entry) => {
    // Legacy same-day cache entries may not have dateKey. Match the app-wide
    // report/timeline contract by treating them as today's local calendar day.
    const dateKey = entry.dateKey ?? formatDateKey();
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

/** Replace one server-authoritative date window while retaining rows outside it. */
export function reconcileCareLogRange(
  current: readonly BabyLogEntry[],
  remote: readonly BabyLogEntry[],
  fromDateKey: string,
  toDateKey: string,
): BabyLogEntry[] {
  const from = fromDateKey <= toDateKey ? fromDateKey : toDateKey;
  const to = fromDateKey <= toDateKey ? toDateKey : fromDateKey;
  const todayKey = formatDateKey();
  const outside = current.filter((entry) => {
    const dateKey = entry.dateKey ?? todayKey;
    return dateKey < from || dateKey > to;
  });
  return mergeCareLogEntries(outside, remote);
}

/** Replace complete category histories so remote deletions do not survive in cache. */
export function reconcileCareLogCategories(
  current: readonly BabyLogEntry[],
  remote: readonly BabyLogEntry[],
  categories: readonly LogCategoryKey[],
): BabyLogEntry[] {
  const categorySet = new Set(categories);
  const outside = current.filter((entry) => !categorySet.has(entry.cat));
  return mergeCareLogEntries(outside, remote);
}
