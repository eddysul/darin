import type { CustomCategory, LogCategoryKey } from "../types/logCategory";
import { resolveLogCategory } from "./resolveLogCategory";

export function formatLogMeta(
  entry: {
    cat: LogCategoryKey;
    chip?: string;
    chip2?: string;
    amount?: string;
    duration?: string;
    notes?: string;
  },
  customCategories: CustomCategory[] = [],
): string {
  const c = resolveLogCategory(entry.cat, customCategories);
  const parts: string[] = [];
  if (entry.chip) parts.push(entry.chip);
  if (entry.chip2) parts.push(entry.chip2);
  if (entry.amount) parts.push(`${entry.amount}${c.amount ?? ""}`);
  if (entry.duration) parts.push(`${entry.duration}분`);
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
