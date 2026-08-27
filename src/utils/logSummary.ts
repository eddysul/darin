import { formatLogMeta, toMinutes } from "./formatLog";
import type { BabyLogEntry } from "../types/babyLog";
import type { CustomCategory } from "../types/logCategory";
import { isCustomCategoryKey } from "../types/logCategory";
import { resolveLogCategory } from "./resolveLogCategory";
import { getAppSettings } from "./appSettingsStore";
import { formatTemperature, formatVolume } from "./measurementFormat";
import { diaperTypeLabel } from "./diaperLog";
import { customCategoryDisplayLabel, recordCategoryLabel, storedRecordValueLabel, type Translate } from "./recordDisplay";
import { contractionIntensityLabel, formatContractionSpan } from "./contractionLog";
import { createT } from "../i18n";

const defaultRecordTranslate = createT("ko");

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

export function formatTimelineLabel(
  entry: BabyLogEntry,
  customCategories: CustomCategory[] = [],
  t: Translate = defaultRecordTranslate,
): string {
  const c = resolveLogCategory(entry.cat, customCategories);
  if (!isCustomCategoryKey(entry.cat)) {
    const label = recordCategoryLabel(t, entry.cat);
    if (entry.cat === "formula" && entry.amount) return t("record.timeline.labelAmount", { label, amount: formatVolume(entry.amount) });
    if (entry.cat === "storedMilk") return entry.amount ? t("record.timeline.labelAmount", { label, amount: formatVolume(entry.amount) }) : label;
    if (entry.cat === "water") return entry.amount ? t("record.timeline.labelAmount", { label, amount: formatVolume(entry.amount) }) : label;
    if (entry.cat === "milk") return entry.amount ? t("record.timeline.labelAmount", { label, amount: formatVolume(entry.amount) }) : label;
    if (entry.cat === "breast") {
      if (entry.leftDuration || entry.rightDuration) {
        return [label, entry.leftDuration ? t("record.timeline.sideValue", { side: t("record.timeline.left"), value: t("record.timeline.minutes", { count: entry.leftDuration }) }) : null, entry.rightDuration ? t("record.timeline.sideValue", { side: t("record.timeline.right"), value: t("record.timeline.minutes", { count: entry.rightDuration }) }) : null].filter(Boolean).join(" · ");
      }
      if (entry.duration) return t("record.timeline.labelDuration", { label, duration: t("record.timeline.minutes", { count: entry.duration }) });
      return entry.chip ? `${label} · ${storedRecordValueLabel(t, entry.chip)}` : label;
    }
    if (entry.cat === "pump") {
      if (entry.leftAmount || entry.rightAmount) {
        return [label, entry.leftAmount ? t("record.timeline.sideValue", { side: t("record.timeline.left"), value: formatVolume(entry.leftAmount) }) : null, entry.rightAmount ? t("record.timeline.sideValue", { side: t("record.timeline.right"), value: formatVolume(entry.rightAmount) }) : null].filter(Boolean).join(" · ");
      }
      if (entry.amount) return t("record.timeline.labelAmount", { label, amount: formatVolume(entry.amount) });
    }
    if (entry.cat === "sleep") {
      if (entry.duration) return t("record.timeline.labelDuration", { label, duration: t("record.timeline.minutes", { count: entry.duration }) });
      return t("record.timeline.sleepStart");
    }
    if (entry.cat === "contraction") {
      const parts = [label];
      if (entry.durationSeconds != null) parts.push(`${t("record.contraction.duration")} ${formatContractionSpan(t, entry.durationSeconds)}`);
      if (entry.intervalSeconds != null) parts.push(`${t("record.contraction.interval")} ${formatContractionSpan(t, entry.intervalSeconds)}`);
      else parts.push(t("record.contraction.first"));
      if (entry.chip) parts.push(contractionIntensityLabel(t, entry.chip));
      return parts.join(" · ");
    }
    if (entry.cat === "diaper") {
      const parts = [label];
      const typeLabel = diaperTypeLabel(entry);
      if (typeLabel) parts.push(storedRecordValueLabel(t, typeLabel));
      // New records use chip2 for stool amount. Historic colour values remain
      // readable, so no existing care log needs migration.
      if (entry.chip2) parts.push(storedRecordValueLabel(t, entry.chip2));
      if (entry.stoolState) parts.push(storedRecordValueLabel(t, entry.stoolState));
      return parts.join(" · ");
    }
    if (entry.cat === "temp" && entry.amount) return t("record.timeline.labelAmount", { label, amount: formatTemperature(entry.amount) });
    if (entry.cat === "doctor") return entry.title ? `${label} · ${entry.title}` : label;
    if (entry.cat === "play" && entry.details) return `${label} · ${entry.details}`;
    if (entry.cat === "other") return entry.title || t("record.timeline.other");
    const meta = formatLogMeta(entry, customCategories, t);
    return meta === t("record.timeline.recorded") ? label : `${label} · ${meta}`;
  }
  const meta = formatLogMeta(entry, customCategories, t);
  const categoryLabel = customCategoryDisplayLabel(t, c);
  return meta === t("record.timeline.recorded") ? categoryLabel : `${categoryLabel} · ${meta}`;
}

export function formatTimelineSubtitle(entry: BabyLogEntry, t: Translate = defaultRecordTranslate): string | null {
  const parts = [
    entry.burped === "yes" ? t("record.timeline.burped") : entry.burped === "no" ? t("record.timeline.notBurped") : null,
    entry.spitUp === "yes" ? t("record.timeline.spitUp") : entry.spitUp === "no" ? t("record.timeline.noSpitUp") : null,
    entry.supplement ? t("record.timeline.supplement", { value: storedRecordValueLabel(t, entry.supplement) }) : null,
    entry.feedingNote ? storedRecordValueLabel(t, entry.feedingNote) : null,
    entry.notes ? storedRecordValueLabel(t, entry.notes) : null,
  ].filter(Boolean) as string[];
  if (!parts.length) return null;
  const text = parts.join(" · ");
  return text.length > 54 ? `${text.slice(0, 54)}…` : text;
}

export function sortLogsNewest(logs: BabyLogEntry[]): BabyLogEntry[] {
  return [...logs].sort((a, b) => toMinutes(b.time) - toMinutes(a.time));
}
