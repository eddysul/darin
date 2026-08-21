import type { CustomCategory, LogCategoryKey } from "../types/logCategory";
import { resolveLogCategory } from "./resolveLogCategory";
import { formatTemperature, formatVolume } from "./measurementFormat";
import { storedRecordValueLabel, type Translate } from "./recordDisplay";

export function formatLogMeta(
  entry: {
    cat: LogCategoryKey;
    chip?: string;
    chip2?: string;
    stoolState?: string;
    amount?: string;
    amountValue?: number | string;
    amountUnit?: string;
    amountText?: string;
    duration?: string;
    leftDuration?: string;
    rightDuration?: string;
    leftAmount?: string;
    rightAmount?: string;
    leftAmountText?: string;
    rightAmountText?: string;
    notes?: string;
    title?: string;
    details?: string;
    nextAt?: string;
    medicationType?: string;
    medicationName?: string;
    medicationStatus?: string;
    doseValue?: number | string;
    doseUnit?: string;
    doseText?: string;
    visitType?: "checkup" | "illness";
    doctorName?: string;
    cautions?: string;
    vaccineName?: string;
    vaccinationRound?: "first" | "second" | "third" | "booster" | "other";
    vaccinationRoundText?: string;
    vaccinationHospitalName?: string;
    aftercareNotes?: string[];
  },
  customCategories: CustomCategory[] = [],
  t?: Translate,
): string {
  const c = resolveLogCategory(entry.cat, customCategories);
  const parts: string[] = [];
  const legacyMedicationNotes = entry.cat === "med" && !entry.medicationName
    ? (entry.notes ?? "").split(" · ")
    : [];
  if (entry.title) parts.push(entry.title);
  if (entry.cat === "med") {
    const medicationName = entry.medicationName ?? legacyMedicationNotes[0];
    if (medicationName) parts.push(medicationName);
  }
  if (entry.cat === "med") {
    const dose = entry.doseText
      ?? (entry.doseValue != null && entry.doseUnit ? `${entry.doseValue} ${entry.doseUnit}` : entry.amount);
    if (dose) parts.push(dose);
  }
  if (entry.cat === "doctor" && entry.visitType) {
    parts.push(t ? t(entry.visitType === "checkup" ? "record.timeline.checkup" : "record.timeline.illness") : entry.visitType === "checkup" ? "검진" : "질환");
  }
  if (entry.cat === "doctor" && entry.doctorName) parts.push(entry.doctorName);
  if (entry.cat === "vaccination") {
    if (entry.vaccineName) parts.push(entry.vaccineName);
    const roundLabels = {
      first: t ? t("home.vaccine.first") : "1차",
      second: t ? t("home.vaccine.second") : "2차",
      third: t ? t("home.vaccine.third") : "3차",
      booster: t ? t("home.vaccine.booster") : "추가",
      other: entry.vaccinationRoundText ?? (t ? t("record.category.other") : "기타"),
    } as const;
    if (entry.vaccinationRound) parts.push(roundLabels[entry.vaccinationRound]);
    if (entry.vaccinationHospitalName) parts.push(entry.vaccinationHospitalName);
    if (entry.aftercareNotes?.length) parts.push(entry.aftercareNotes.join(", "));
  }
  if (entry.chip) parts.push(t ? storedRecordValueLabel(t, entry.chip) : entry.chip);
  if (entry.chip2) parts.push(t ? storedRecordValueLabel(t, entry.chip2) : entry.chip2);
  if (entry.stoolState) parts.push(t ? storedRecordValueLabel(t, entry.stoolState) : entry.stoolState);
  if (entry.amountText && entry.cat !== "med") {
    parts.push(entry.amountText);
  } else if (entry.amount && entry.cat !== "med") {
    if (["formula", "storedMilk", "pump", "water", "milk"].includes(entry.cat)) {
      parts.push(formatVolume(entry.amount));
    } else if (entry.cat === "temp") {
      parts.push(formatTemperature(entry.amount));
    } else {
      parts.push(`${entry.amount}${c.amount ?? ""}`);
    }
  }
  const minuteLabel = (value: string) => t ? t("record.timeline.minutes", { count: value }) : `${value}분`;
  const sideLabel = (side: "left" | "right", value: string) => t
    ? t("record.timeline.sideValue", { side: t(`record.timeline.${side}`), value })
    : `${side === "left" ? "왼쪽" : "오른쪽"} ${value}`;
  if (entry.duration) parts.push(minuteLabel(entry.duration));
  if (entry.leftDuration) parts.push(sideLabel("left", minuteLabel(entry.leftDuration)));
  if (entry.rightDuration) parts.push(sideLabel("right", minuteLabel(entry.rightDuration)));
  if (entry.leftAmountText) parts.push(sideLabel("left", entry.leftAmountText));
  else if (entry.leftAmount) parts.push(sideLabel("left", formatVolume(entry.leftAmount)));
  if (entry.rightAmountText) parts.push(sideLabel("right", entry.rightAmountText));
  else if (entry.rightAmount) parts.push(sideLabel("right", formatVolume(entry.rightAmount)));
  if (entry.details) parts.push(entry.details.length > 16 ? `${entry.details.slice(0, 16)}…` : entry.details);
  if (entry.nextAt) parts.push(t ? t("record.timeline.next", { value: entry.nextAt }) : `다음 ${entry.nextAt}`);
  const displayNotes = entry.cat === "med" && !entry.medicationName
    ? legacyMedicationNotes.slice(1).join(" · ")
    : entry.notes;
  if (displayNotes) parts.push(displayNotes.length > 16 ? `${displayNotes.slice(0, 16)}…` : displayNotes);
  return parts.join(" · ") || (t ? t("record.timeline.recorded") : "기록됨");
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
