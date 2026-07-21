import type { CustomCategory, LogCategoryKey } from "../types/logCategory";
import { resolveLogCategory } from "./resolveLogCategory";

export function formatLogMeta(
  entry: {
    cat: LogCategoryKey;
    chip?: string;
    chip2?: string;
    stoolState?: string;
    amount?: string;
    duration?: string;
    notes?: string;
    title?: string;
    details?: string;
    nextAt?: string;
  },
  customCategories: CustomCategory[] = [],
): string {
  const c = resolveLogCategory(entry.cat, customCategories);
  const parts: string[] = [];
  if (entry.title) parts.push(entry.title);
  if (entry.chip) parts.push(entry.chip);
  if (entry.chip2) parts.push(entry.chip2);
  if (entry.stoolState) parts.push(entry.stoolState);
  if (entry.amount) parts.push(`${entry.amount}${c.amount ?? ""}`);
  if (entry.duration) parts.push(`${entry.duration}분`);
  if (entry.details) parts.push(entry.details.length > 16 ? `${entry.details.slice(0, 16)}…` : entry.details);
  if (entry.nextAt) parts.push(`다음 ${entry.nextAt}`);
  if (entry.notes) parts.push(entry.notes.length > 16 ? `${entry.notes.slice(0, 16)}…` : entry.notes);
  return parts.join(" · ") || "기록됨";
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Elapsed wall-clock minutes, allowing a session to cross one midnight. */
export function elapsedClockMinutes(startTime: string, endTime: string): number {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  return end >= start ? end - start : 24 * 60 - start + end;
}
