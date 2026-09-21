const PREGNANCY_TERM_DAYS = 280;

export type PregnancyProgress = {
  gestationalDays: number;
  weeks: number;
  days: number;
  remainingDays: number;
  percent: number;
};

function parseDate(value?: string): Date | null {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateDifference(later: Date, earlier: Date): number {
  return Math.floor((
    Date.UTC(later.getFullYear(), later.getMonth(), later.getDate())
    - Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate())
  ) / 86_400_000);
}

/** Canonical pregnancy progress; childDisplay and the overview both consume this source. */
export function pregnancyProgressFromDueDate(
  dueDate?: string,
  onDate: Date | string = new Date(),
): PregnancyProgress | null {
  const due = parseDate(dueDate);
  const on = typeof onDate === "string"
    ? parseDate(onDate)
    : new Date(onDate.getFullYear(), onDate.getMonth(), onDate.getDate());
  if (!due || !on) return null;
  const remainingDays = dateDifference(due, on);
  const gestationalDays = Math.max(0, PREGNANCY_TERM_DAYS - remainingDays);
  return {
    gestationalDays,
    weeks: Math.floor(gestationalDays / 7),
    days: gestationalDays % 7,
    remainingDays,
    percent: Math.max(0, Math.min(100, Math.floor(
      (gestationalDays * 100 + PREGNANCY_TERM_DAYS / 2) / PREGNANCY_TERM_DAYS,
    ))),
  };
}
