import type { ChildProfile, ParentProfile, PostpartumStatus } from "../types/careSetup";
import type { DiaryEntry } from "../types/babyLog";
import type { Locale } from "../i18n";
import type { BabyAgeFormat } from "../types/appSettings";
import { formatLocalizedDate } from "./localeFormat";

const ageCopy: Record<Locale, {
  pregnant: (weeks: number, days: number) => string;
  dueMinus: (days: number) => string;
  duePlus: (days: number) => string;
  days: (days: number) => string;
  weeksDays: (weeks: number, days: number) => string;
  monthsDays: (months: number, days: number) => string;
  yearsMonths: (years: number, months: number) => string;
}> = {
  ko: { pregnant: (w, d) => `임신 중 ${w}주 ${d}일`, dueMinus: (d) => `출산 예정일까지 D-${d}`, duePlus: (d) => `출산 예정일까지 D+${d}`, days: (d) => `생후 ${d}일`, weeksDays: (w, d) => `${w}주 ${d}일`, monthsDays: (m, d) => `${m}개월 ${d}일`, yearsMonths: (y, m) => `만 ${y}세 ${m}개월` },
  en: { pregnant: (w, d) => `${w} weeks ${d} days pregnant`, dueMinus: (d) => `D-${d} until due date`, duePlus: (d) => `D+${d} past due date`, days: (d) => `${d} days old`, weeksDays: (w, d) => `${w} weeks ${d} days`, monthsDays: (m, d) => `${m} months ${d} days`, yearsMonths: (y, m) => `${y} years ${m} months` },
  ja: { pregnant: (w, d) => `妊娠${w}週${d}日`, dueMinus: (d) => `出産予定日までD-${d}`, duePlus: (d) => `出産予定日からD+${d}`, days: (d) => `生後${d}日`, weeksDays: (w, d) => `${w}週${d}日`, monthsDays: (m, d) => `生後${m}か月${d}日`, yearsMonths: (y, m) => `${y}歳${m}か月` },
  es: { pregnant: (w, d) => `${w} semanas y ${d} días de embarazo`, dueMinus: (d) => `D-${d} para la fecha prevista`, duePlus: (d) => `D+${d} desde la fecha prevista`, days: (d) => `${d} días de vida`, weeksDays: (w, d) => `${w} semanas y ${d} días`, monthsDays: (m, d) => `${m} meses y ${d} días`, yearsMonths: (y, m) => `${y} años y ${m} meses` },
  "zh-CN": { pregnant: (w, d) => `孕${w}周${d}天`, dueMinus: (d) => `距预产期D-${d}`, duePlus: (d) => `超过预产期D+${d}`, days: (d) => `出生${d}天`, weeksDays: (w, d) => `${w}周${d}天`, monthsDays: (m, d) => `出生${m}个月${d}天`, yearsMonths: (y, m) => `${y}岁${m}个月` },
};

function parseFlexibleDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseCalendarDate(value?: string): Date | null {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return parseFlexibleDate(value);
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calendarDayDifference(later: Date, earlier: Date): number {
  const laterUtc = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const earlierUtc = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.floor((laterUtc - earlierUtc) / 86_400_000);
}

/** Full-term pregnancy in days (40w0d). Due date is treated as day 280. */
const PREGNANCY_TERM_DAYS = 280;

/** Accepts a raw `child_status` string so callers can pass a `BabyRow` directly. */
export function isPregnancyStage(child: { childStatus: string; birthDate?: string }): boolean {
  return child.childStatus === "unborn" && !child.birthDate;
}

export function formatDottedDate(value?: string): string | null {
  const parsed = parseCalendarDate(value);
  if (!parsed) return null;
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${parsed.getFullYear()}.${month}.${day}`;
}

export function formatGestationalAge(dueDate?: string, onDate: Date | string = new Date(), locale: Locale = "ko"): string | null {
  const due = parseCalendarDate(dueDate);
  const on = typeof onDate === "string" ? parseCalendarDate(onDate) : onDate;
  if (!due || !on) return null;
  const remainingDays = calendarDayDifference(startOfLocalDay(due), startOfLocalDay(on));
  const gestationalDays = PREGNANCY_TERM_DAYS - remainingDays;
  if (gestationalDays < 0) return ageCopy[locale].pregnant(0, 0);
  const weeks = Math.floor(gestationalDays / 7);
  const days = gestationalDays % 7;
  return ageCopy[locale].pregnant(weeks, days);
}

const BIRTH_CTA_WINDOW_DAYS = 7;

/** Home birth CTA: last week before due date, and while overdue until converted. */
export function shouldShowBirthCta(child: Pick<ChildProfile, "childStatus" | "birthDate" | "dueDate">, now = new Date()): boolean {
  if (!isPregnancyStage(child)) return false;
  const due = parseCalendarDate(child.dueDate);
  if (!due) return false;
  const remainingDays = calendarDayDifference(startOfLocalDay(due), startOfLocalDay(now));
  return remainingDays <= BIRTH_CTA_WINDOW_DAYS;
}

export function formatDueCountdown(dueDate?: string, onDate: Date | string = new Date(), locale: Locale = "ko"): string | null {
  const due = parseCalendarDate(dueDate);
  const on = typeof onDate === "string" ? parseCalendarDate(onDate) : onDate;
  if (!due || !on) return null;
  const remainingDays = calendarDayDifference(startOfLocalDay(due), startOfLocalDay(on));
  return remainingDays >= 0
    ? ageCopy[locale].dueMinus(remainingDays)
    : ageCopy[locale].duePlus(Math.abs(remainingDays));
}

export function formatPostnatalAge(birthDate?: string, onDate: Date | string = new Date(), locale: Locale = "ko"): string | null {
  const birthDateValue = parseCalendarDate(birthDate);
  const on = typeof onDate === "string" ? parseCalendarDate(onDate) : onDate;
  if (!birthDateValue || !on) return null;
  const birth = startOfLocalDay(birthDateValue);
  const today = startOfLocalDay(on);
  const ageDays = Math.max(0, calendarDayDifference(today, birth));
  if (ageDays <= 30) return ageCopy[locale].days(ageDays);

  let completedMonths = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) completedMonths -= 1;
  completedMonths = Math.max(0, completedMonths);

  const anchorYear = birth.getFullYear() + Math.floor((birth.getMonth() + completedMonths) / 12);
  const anchorMonth = (birth.getMonth() + completedMonths) % 12;
  const lastAnchorDay = new Date(anchorYear, anchorMonth + 1, 0).getDate();
  const monthAnchor = new Date(anchorYear, anchorMonth, Math.min(birth.getDate(), lastAnchorDay));
  const remainingDays = Math.max(0, calendarDayDifference(today, monthAnchor));
  if (completedMonths < 24) return ageCopy[locale].monthsDays(completedMonths, remainingDays);

  return ageCopy[locale].yearsMonths(Math.floor(completedMonths / 12), completedMonths % 12);
}

/**
 * Age label for a diary/log written on `onDateKey`.
 * Uses due_date before birth_date, and actual birth_date from the birthday onward.
 */
export function formatDiaryStageLabel(
  child: Pick<ChildProfile, "birthDate" | "dueDate">,
  onDateKey: string,
  locale: Locale = "ko",
): string | null {
  if (child.birthDate && onDateKey >= child.birthDate) {
    return formatPostnatalAge(child.birthDate, onDateKey, locale);
  }
  if (child.dueDate) return formatGestationalAge(child.dueDate, onDateKey, locale);
  return null;
}

/** Prefer the label frozen at save; fall back for legacy rows without a snapshot. */
export function diaryStageLabel(
  entry: Pick<DiaryEntry, "dateKey" | "stageLabelSnapshot">,
  child: Pick<ChildProfile, "birthDate" | "dueDate">,
): string | null {
  const frozen = entry.stageLabelSnapshot?.trim();
  if (frozen) return frozen;
  return formatDiaryStageLabel(child, entry.dateKey);
}

/** Compact, non-abbreviated age label used in the record header. */
export function formatRecordHeaderAge(child: ChildProfile, now = new Date(), locale: Locale = "ko"): string | null {
  if (isPregnancyStage(child)) {
    const gestational = formatGestationalAge(child.dueDate, now, locale);
    const countdown = formatDueCountdown(child.dueDate, now, locale);
    if (gestational && countdown) return `${gestational}\n${countdown}`;
    return gestational ?? countdown;
  }
  return formatPostnatalAge(child.birthDate, now, locale);
}

function formatDateLabel(value: string, locale: Locale): string {
  const d = parseFlexibleDate(value);
  if (!d) return value;
  return formatLocalizedDate(d, locale, {
    year: "numeric",
    month: locale === "en" || locale === "es" ? "short" : "long",
    day: "numeric",
  });
}

export function computeChildAgeDays(child: ChildProfile): number | null {
  const birth = parseFlexibleDate(child.birthDate);
  if (!birth) return null;
  return Math.max(0, Math.floor((Date.now() - birth.getTime()) / 86_400_000));
}

export function formatBabyAge(child: ChildProfile, format: BabyAgeFormat, locale: Locale = "ko"): string | null {
  if (isPregnancyStage(child)) return formatGestationalAge(child.dueDate, new Date(), locale);
  const days = computeChildAgeDays(child);
  if (days == null) return null;
  if (format === "weeks") return ageCopy[locale].weeksDays(Math.floor(days / 7), days % 7);
  if (format === "monthsDays") {
    const months = Math.floor(days / 30);
    return ageCopy[locale].monthsDays(months, days % 30);
  }
  return `D+${days}`;
}

export function buildBabyDisplay(child: ChildProfile, locale: Locale = "ko") {
  const name = child.childName.trim() || (locale === "ko" ? "아기" : "Baby");
  const emoji = isPregnancyStage(child) ? "🤰" : child.childStatus === "newborn" ? "👶" : "🧒";

  if (isPregnancyStage(child) && child.dueDate) {
    const gestational = formatGestationalAge(child.dueDate, new Date(), locale);
    const countdown = formatDueCountdown(child.dueDate, new Date(), locale);
    const dueLabel = formatDateLabel(child.dueDate, locale);
    const badge = gestational ?? (locale === "ko" ? `출산 예정 · ${dueLabel}` : `Due · ${dueLabel}`);
    const birthMeta = [gestational, countdown].filter(Boolean).join(" · ") || (locale === "ko" ? `예정일 ${dueLabel}` : `Due date ${dueLabel}`);
    return { babyName: name, babyEmoji: emoji, babyBadge: badge, babyBirthMeta: birthMeta };
  }

  const ageDays = computeChildAgeDays(child);
  if (ageDays != null) {
    const postnatal = formatPostnatalAge(child.birthDate, new Date(), locale);
    const badge = postnatal ?? (locale === "ko" ? `생후 ${ageDays}일 · D+${ageDays}` : `Day ${ageDays} · D+${ageDays}`);
    const birthMeta =
      locale === "ko"
        ? `${child.birthDate ? formatDateLabel(child.birthDate, locale) + " 출생 · " : ""}${postnatal ?? `생후 ${ageDays}일`}`
        : `${child.birthDate ? "Born " + formatDateLabel(child.birthDate, locale) + " · " : ""}${postnatal ?? `Day ${ageDays}`}`;
    return { babyName: name, babyEmoji: emoji, babyBadge: badge, babyBirthMeta: birthMeta };
  }

  if (child.dueDate) {
    const dueLabel = formatDateLabel(child.dueDate, locale);
    const badge = locale === "ko" ? `예정일 ${dueLabel}` : `Due ${dueLabel}`;
    return { babyName: name, babyEmoji: emoji, babyBadge: badge, babyBirthMeta: badge };
  }

  const statusLabel =
    child.childStatus === "infant"
      ? locale === "ko"
        ? "영아"
        : "Infant"
      : child.childStatus === "newborn"
        ? locale === "ko"
          ? "신생아"
          : "Newborn"
        : locale === "ko"
          ? "출산 전"
          : "Unborn";

  return {
    babyName: name,
    babyEmoji: emoji,
    babyBadge: statusLabel,
    babyBirthMeta: statusLabel,
  };
}

export function postpartumStatusLabel(status: PostpartumStatus, locale: Locale): string {
  const ko: Record<PostpartumStatus, string> = {
    pregnant: "임신 중",
    expecting: "출산 예정",
    postpartum: "산후",
    not_applicable: "해당 없음",
  };
  const en: Record<PostpartumStatus, string> = {
    pregnant: "Pregnant",
    expecting: "Expecting",
    postpartum: "Postpartum",
    not_applicable: "Not applicable",
  };
  return locale === "ko" ? ko[status] : en[status];
}

export function buildProfileContextBlock(
  parent: ParentProfile,
  child: ChildProfile,
  locale: Locale,
): string {
  const isKo = locale === "ko";
  const display = buildBabyDisplay(child, locale);
  const lines = isKo
    ? [
        "[프로필 컨텍스트 — 일일 기록이 아님]",
        `보호자: ${parent.parentName} (${parent.relationshipToChild})`,
        `산후 상태: ${postpartumStatusLabel(parent.postpartumStatus, locale)}`,
        parent.birthRecoveryNote ? `회복 메모: ${parent.birthRecoveryNote}` : null,
        `아기: ${display.babyName} · ${display.babyBirthMeta}`,
        child.gestationalAgeWeeks ? `임신 주수: ${child.gestationalAgeWeeks}주` : isPregnancyStage(child) ? `임신 주수: ${formatGestationalAge(child.dueDate) ?? "-"}` : null,
        child.birthWeight ? `출생 체중: ${child.birthWeight}` : null,
        child.specialNotes ? `특이사항: ${child.specialNotes}` : null,
      ]
    : [
        "[PROFILE CONTEXT — not daily log events]",
        `Caregiver/parent: ${parent.parentName} (${parent.relationshipToChild})`,
        `Postpartum status: ${postpartumStatusLabel(parent.postpartumStatus, locale)}`,
        parent.birthRecoveryNote ? `Recovery note: ${parent.birthRecoveryNote}` : null,
        `Baby: ${display.babyName} · ${display.babyBirthMeta}`,
        child.gestationalAgeWeeks ? `Gestational age: ${child.gestationalAgeWeeks} wks` : isPregnancyStage(child) ? `Gestational age: ${formatGestationalAge(child.dueDate) ?? "-"}` : null,
        child.birthWeight ? `Birth weight: ${child.birthWeight}` : null,
        child.specialNotes ? `Special notes: ${child.specialNotes}` : null,
      ];
  return lines.filter(Boolean).join("\n");
}
