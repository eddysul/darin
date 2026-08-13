import type { ChildProfile, ParentProfile, PostpartumStatus } from "../types/careSetup";
import type { Locale } from "../i18n";
import type { BabyAgeFormat } from "../types/appSettings";

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

/** Compact, non-abbreviated age label used in the record header. */
export function formatRecordHeaderAge(child: ChildProfile, now = new Date()): string | null {
  const today = startOfLocalDay(now);
  const birthDate = parseCalendarDate(child.birthDate);

  if (!birthDate) {
    const dueDate = parseCalendarDate(child.dueDate);
    if (!dueDate) return null;
    const remainingDays = calendarDayDifference(startOfLocalDay(dueDate), today);
    return remainingDays >= 0 ? `출산 예정 D-${remainingDays}` : `출산 예정 D+${Math.abs(remainingDays)}`;
  }

  const birth = startOfLocalDay(birthDate);
  const ageDays = Math.max(0, calendarDayDifference(today, birth));
  if (ageDays <= 30) return `생후 ${ageDays}일`;

  let completedMonths = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) completedMonths -= 1;
  completedMonths = Math.max(0, completedMonths);

  const anchorYear = birth.getFullYear() + Math.floor((birth.getMonth() + completedMonths) / 12);
  const anchorMonth = (birth.getMonth() + completedMonths) % 12;
  const lastAnchorDay = new Date(anchorYear, anchorMonth + 1, 0).getDate();
  const monthAnchor = new Date(anchorYear, anchorMonth, Math.min(birth.getDate(), lastAnchorDay));
  const remainingDays = Math.max(0, calendarDayDifference(today, monthAnchor));
  if (completedMonths < 24) return `${completedMonths}개월 ${remainingDays}일`;

  return `만 ${Math.floor(completedMonths / 12)}세 ${completedMonths % 12}개월`;
}

function formatDateLabel(value: string, locale: Locale): string {
  const d = parseFlexibleDate(value);
  if (!d) return value;
  return d.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: locale === "ko" ? "long" : "short",
    day: "numeric",
  });
}

export function computeChildAgeDays(child: ChildProfile): number | null {
  const birth = parseFlexibleDate(child.birthDate);
  if (!birth) return null;
  return Math.max(0, Math.floor((Date.now() - birth.getTime()) / 86_400_000));
}

export function formatBabyAge(child: ChildProfile, format: BabyAgeFormat): string | null {
  const days = computeChildAgeDays(child);
  if (days == null) return null;
  if (format === "weeks") return `${Math.floor(days / 7)}주 ${days % 7}일`;
  if (format === "monthsDays") {
    const months = Math.floor(days / 30);
    return `${months}개월 ${days % 30}일`;
  }
  return `D+${days}`;
}

export function buildBabyDisplay(child: ChildProfile, locale: Locale = "ko") {
  const name = child.childName.trim() || (locale === "ko" ? "아기" : "Baby");
  const emoji = child.childStatus === "unborn" ? "🤰" : child.childStatus === "newborn" ? "👶" : "🧒";

  const ageDays = computeChildAgeDays(child);
  if (child.childStatus === "unborn" && child.dueDate) {
    const dueLabel = formatDateLabel(child.dueDate, locale);
    const badge = locale === "ko" ? `출산 예정 · ${dueLabel}` : `Due · ${dueLabel}`;
    const birthMeta = locale === "ko" ? `예정일 ${dueLabel}` : `Due date ${dueLabel}`;
    return { babyName: name, babyEmoji: emoji, babyBadge: badge, babyBirthMeta: birthMeta };
  }

  if (ageDays != null) {
    const badge = locale === "ko" ? `생후 ${ageDays}일 · D+${ageDays}` : `Day ${ageDays} · D+${ageDays}`;
    const birthMeta =
      locale === "ko"
        ? `${child.birthDate ? formatDateLabel(child.birthDate, locale) + " 출생 · " : ""}생후 ${ageDays}일`
        : `${child.birthDate ? "Born " + formatDateLabel(child.birthDate, locale) + " · " : ""}Day ${ageDays}`;
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
        child.gestationalAgeWeeks ? `임신 주수: ${child.gestationalAgeWeeks}주` : null,
        child.birthWeight ? `출생 체중: ${child.birthWeight}` : null,
        child.specialNotes ? `특이사항: ${child.specialNotes}` : null,
      ]
    : [
        "[PROFILE CONTEXT — not daily log events]",
        `Caregiver/parent: ${parent.parentName} (${parent.relationshipToChild})`,
        `Postpartum status: ${postpartumStatusLabel(parent.postpartumStatus, locale)}`,
        parent.birthRecoveryNote ? `Recovery note: ${parent.birthRecoveryNote}` : null,
        `Baby: ${display.babyName} · ${display.babyBirthMeta}`,
        child.gestationalAgeWeeks ? `Gestational age: ${child.gestationalAgeWeeks} wks` : null,
        child.birthWeight ? `Birth weight: ${child.birthWeight}` : null,
        child.specialNotes ? `Special notes: ${child.specialNotes}` : null,
      ];
  return lines.filter(Boolean).join("\n");
}
