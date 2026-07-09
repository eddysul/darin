import { formatLogMeta, toMinutes } from "./formatLog";
import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import type { BabyLogEntry } from "../types/babyLog";
import type { CustomCategory } from "../types/logCategory";
import { isCustomCategoryKey } from "../types/logCategory";
import { resolveLogCategory } from "./resolveLogCategory";

const FEEDING_CATS: BabyLogCategoryId[] = ["breast", "formula", "food", "snack", "pump"];

export function formatDisplayTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function minutesAgoLabel(time: string, now = new Date()): string {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const entryMin = toMinutes(time);
  let diff = nowMin - entryMin;
  if (diff < 0) diff += 24 * 60;

  if (diff < 1) return "방금 전";
  if (diff < 60) return `${diff}분 전`;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (mins === 0) return `${hours}시간 전`;
  return `${hours}시간 ${mins}분 전`;
}

export function findLastLog(logs: BabyLogEntry[], cats: BabyLogCategoryId[]): BabyLogEntry | null {
  return (
    [...logs]
      .filter((l) => !isCustomCategoryKey(l.cat) && cats.includes(l.cat as BabyLogCategoryId))
      .sort((a, b) => toMinutes(b.time) - toMinutes(a.time))[0] ?? null
  );
}

export function countTodayLogs(logs: BabyLogEntry[], cats: BabyLogCategoryId[]): number {
  return logs.filter((l) => !isCustomCategoryKey(l.cat) && cats.includes(l.cat as BabyLogCategoryId)).length;
}

export function formatTimelineLabel(entry: BabyLogEntry, customCategories: CustomCategory[] = []): string {
  const c = resolveLogCategory(entry.cat, customCategories);
  if (!isCustomCategoryKey(entry.cat)) {
    if (entry.cat === "formula" && entry.amount) return `분유 ${entry.amount}ml`;
    if (entry.cat === "breast") {
      if (entry.duration) return `모유 ${entry.duration}분`;
      return entry.chip ? `모유 · ${entry.chip}` : "모유 수유";
    }
    if (entry.cat === "pump" && entry.amount) return `유축 ${entry.amount}ml`;
    if (entry.cat === "sleep") {
      if (entry.duration) return `수면 ${entry.duration}분`;
      return "낮잠 시작";
    }
    if (entry.cat === "diaper") {
      const parts = ["기저귀 교체"];
      if (entry.chip) parts.push(entry.chip);
      return parts.join(" · ");
    }
    if (entry.cat === "temp" && entry.amount) return `체온 ${entry.amount}℃`;
  }
  const meta = formatLogMeta(entry, customCategories);
  return meta === "기록됨" ? c.label : `${c.label} · ${meta}`;
}

export function sortLogsNewest(logs: BabyLogEntry[]): BabyLogEntry[] {
  return [...logs].sort((a, b) => toMinutes(b.time) - toMinutes(a.time));
}
