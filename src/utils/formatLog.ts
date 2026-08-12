import type { CustomCategory, LogCategoryKey } from "../types/logCategory";
import { resolveLogCategory } from "./resolveLogCategory";
import { formatTemperature, formatVolume } from "./measurementFormat";

export function formatLogMeta(
  entry: {
    cat: LogCategoryKey;
    chip?: string;
    chip2?: string;
    stoolState?: string;
    amount?: string;
    duration?: string;
    leftDuration?: string;
    rightDuration?: string;
    leftAmount?: string;
    rightAmount?: string;
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
  },
  customCategories: CustomCategory[] = [],
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
  if (entry.cat === "doctor" && entry.visitType) parts.push(entry.visitType === "checkup" ? "검진" : "질환");
  if (entry.cat === "doctor" && entry.doctorName) parts.push(entry.doctorName);
  if (entry.chip) parts.push(entry.chip);
  if (entry.chip2) parts.push(entry.chip2);
  if (entry.stoolState) parts.push(entry.stoolState);
  if (entry.amount && entry.cat !== "med") {
    if (["formula", "storedMilk", "pump", "water", "milk"].includes(entry.cat)) {
      parts.push(formatVolume(entry.amount));
    } else if (entry.cat === "temp") {
      parts.push(formatTemperature(entry.amount));
    } else {
      parts.push(`${entry.amount}${c.amount ?? ""}`);
    }
  }
  if (entry.duration) parts.push(`${entry.duration}분`);
  if (entry.leftDuration) parts.push(`왼쪽 ${entry.leftDuration}분`);
  if (entry.rightDuration) parts.push(`오른쪽 ${entry.rightDuration}분`);
  if (entry.leftAmount) parts.push(`왼쪽 ${formatVolume(entry.leftAmount)}`);
  if (entry.rightAmount) parts.push(`오른쪽 ${formatVolume(entry.rightAmount)}`);
  if (entry.details) parts.push(entry.details.length > 16 ? `${entry.details.slice(0, 16)}…` : entry.details);
  if (entry.nextAt) parts.push(`다음 ${entry.nextAt}`);
  const displayNotes = entry.cat === "med" && !entry.medicationName
    ? legacyMedicationNotes.slice(1).join(" · ")
    : entry.notes;
  if (displayNotes) parts.push(displayNotes.length > 16 ? `${displayNotes.slice(0, 16)}…` : displayNotes);
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
