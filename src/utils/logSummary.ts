import { formatLogMeta, toMinutes } from "./formatLog";
import type { BabyLogEntry } from "../types/babyLog";
import type { CustomCategory } from "../types/logCategory";
import { isCustomCategoryKey } from "../types/logCategory";
import { resolveLogCategory } from "./resolveLogCategory";
import { getAppSettings } from "./appSettingsStore";
import { formatTemperature, formatVolume } from "./measurementFormat";
import { diaperTypeLabel } from "./diaperLog";

export function formatDisplayTime(
  time: string,
  clock = getAppSettings().time.clock,
): string {
  const [h, m] = time.split(":").map(Number);
  if (clock === "24h") return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatTimelineLabel(entry: BabyLogEntry, customCategories: CustomCategory[] = []): string {
  const c = resolveLogCategory(entry.cat, customCategories);
  if (!isCustomCategoryKey(entry.cat)) {
    if (entry.cat === "formula" && entry.amount) return `분유 · ${formatVolume(entry.amount)}`;
    if (entry.cat === "storedMilk") return entry.amount ? `저장 모유 수유 · ${formatVolume(entry.amount)}` : "저장 모유 수유";
    if (entry.cat === "water") return entry.amount ? `물 ${formatVolume(entry.amount)}` : "물";
    if (entry.cat === "milk") return entry.amount ? `우유 ${formatVolume(entry.amount)}` : "우유";
    if (entry.cat === "breast") {
      if (entry.leftDuration || entry.rightDuration) {
        return ["모유수유", entry.leftDuration ? `왼쪽 ${entry.leftDuration}분` : null, entry.rightDuration ? `오른쪽 ${entry.rightDuration}분` : null].filter(Boolean).join(" · ");
      }
      if (entry.duration) return `모유수유 · ${entry.duration}분`;
      return entry.chip ? `모유 · ${entry.chip}` : "모유 수유";
    }
    if (entry.cat === "pump") {
      if (entry.leftAmount || entry.rightAmount) {
        return ["유축", entry.leftAmount ? `왼쪽 ${formatVolume(entry.leftAmount)}` : null, entry.rightAmount ? `오른쪽 ${formatVolume(entry.rightAmount)}` : null].filter(Boolean).join(" · ");
      }
      if (entry.amount) return `유축 · ${formatVolume(entry.amount)}`;
    }
    if (entry.cat === "sleep") {
      if (entry.duration) return `수면 ${entry.duration}분`;
      return "낮잠 시작";
    }
    if (entry.cat === "diaper") {
      const parts = ["기저귀"];
      const typeLabel = diaperTypeLabel(entry);
      if (typeLabel) parts.push(typeLabel);
      // New records use chip2 for stool amount. Historic colour values remain
      // readable, so no existing care log needs migration.
      if (entry.chip2) parts.push(entry.chip2);
      if (entry.stoolState) parts.push(entry.stoolState);
      return parts.join(" · ");
    }
    if (entry.cat === "temp" && entry.amount) return `체온 ${formatTemperature(entry.amount)}`;
    if (entry.cat === "doctor") return entry.title ? `진료 · ${entry.title}` : "진료";
    if (entry.cat === "play" && entry.details) return `놀이 · ${entry.details}`;
    if (entry.cat === "other") return entry.title || "기타 기록";
  }
  const meta = formatLogMeta(entry, customCategories);
  return meta === "기록됨" ? c.label : `${c.label} · ${meta}`;
}

export function formatTimelineSubtitle(entry: BabyLogEntry): string | null {
  const parts = [
    entry.burped === "yes" ? "트림했어요" : entry.burped === "no" ? "트림 안 함" : null,
    entry.spitUp === "yes" ? "게워냄 있었어요" : entry.spitUp === "no" ? "게워냄 없음" : null,
    entry.supplement ? `영양제 ${entry.supplement}` : null,
    entry.feedingNote || null,
    entry.notes || null,
  ].filter(Boolean) as string[];
  if (!parts.length) return null;
  const text = parts.join(" · ");
  return text.length > 54 ? `${text.slice(0, 54)}…` : text;
}

export function sortLogsNewest(logs: BabyLogEntry[]): BabyLogEntry[] {
  return [...logs].sort((a, b) => toMinutes(b.time) - toMinutes(a.time));
}
