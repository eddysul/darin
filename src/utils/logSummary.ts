import { formatLogMeta, toMinutes } from "./formatLog";
import type { BabyLogEntry } from "../types/babyLog";
import type { CustomCategory } from "../types/logCategory";
import { isCustomCategoryKey } from "../types/logCategory";
import { resolveLogCategory } from "./resolveLogCategory";

export function formatDisplayTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatTimelineLabel(entry: BabyLogEntry, customCategories: CustomCategory[] = []): string {
  const c = resolveLogCategory(entry.cat, customCategories);
  if (!isCustomCategoryKey(entry.cat)) {
    if (entry.cat === "formula" && entry.amount) return `분유 ${entry.amount}ml`;
    if (entry.cat === "storedMilk") return entry.amount ? `저장 모유 ${entry.amount}ml` : "저장 모유 수유";
    if (entry.cat === "water") return entry.amount ? `물 ${entry.amount}ml` : "물";
    if (entry.cat === "milk") return entry.amount ? `우유 ${entry.amount}ml` : "우유";
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
      if (entry.chip2) parts.push(entry.chip2);
      if (entry.stoolState) parts.push(entry.stoolState);
      return parts.join(" · ");
    }
    if (entry.cat === "temp" && entry.amount) return `체온 ${entry.amount}℃`;
    if (entry.cat === "doctor") return entry.title ? `진료 · ${entry.title}` : "진료";
    if (entry.cat === "play" && entry.details) return `놀이 · ${entry.details}`;
    if (entry.cat === "other") return entry.title || "기타 기록";
  }
  const meta = formatLogMeta(entry, customCategories);
  return meta === "기록됨" ? c.label : `${c.label} · ${meta}`;
}

export function sortLogsNewest(logs: BabyLogEntry[]): BabyLogEntry[] {
  return [...logs].sort((a, b) => toMinutes(b.time) - toMinutes(a.time));
}
