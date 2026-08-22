import type { CareReminderState } from "../types/careReminder";

export type FeedingReminderStatusKey = "recent" | "comfortable" | "soon" | "due" | "empty";

export function feedingReminderProgress(
  lastRelevantLogAt: string | null,
  intervalMinutes: number,
  now = new Date(),
): number | null {
  if (!lastRelevantLogAt || intervalMinutes <= 0) return null;
  const elapsed = now.getTime() - Date.parse(lastRelevantLogAt);
  if (!Number.isFinite(elapsed)) return null;
  return Math.max(0, elapsed / (intervalMinutes * 60_000));
}

export function feedingReminderStatusKey(progress: number | null): FeedingReminderStatusKey {
  if (progress === null) return "empty";
  if (progress < 0.4) return "recent";
  if (progress < 0.8) return "comfortable";
  if (progress < 1) return "soon";
  return "due";
}

export function elapsedMinutesSince(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const elapsed = now.getTime() - Date.parse(iso);
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 60_000)) : null;
}

export function isFeedingReminderOverdue(state: CareReminderState | null): boolean {
  return state?.sendStatus === "overdue_not_scheduled";
}
