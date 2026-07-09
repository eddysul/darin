import type { ChildProfile, ParentProfile, PostpartumStatus } from "../types/careSetup";
import type { Locale } from "../i18n";

function parseFlexibleDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d;
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
