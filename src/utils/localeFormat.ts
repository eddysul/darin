import type { Locale } from "../i18n";

const intlLocale: Record<Locale, string> = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP",
  es: "es-ES",
  "zh-CN": "zh-CN",
};

export function toIntlLocale(locale: Locale): string {
  return intlLocale[locale];
}

export function formatLocalizedDate(
  value: Date | string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "";
  return new Intl.DateTimeFormat(toIntlLocale(locale), options).format(date);
}

export function formatLocalizedNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(toIntlLocale(locale), options).format(value);
}

export function formatRelativeTime(value: Date | string, locale: Locale, now = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  const [amount, unit]: [number, Intl.RelativeTimeFormatUnit] = abs < 60
    ? [seconds, "second"]
    : abs < 3_600
      ? [Math.round(seconds / 60), "minute"]
      : abs < 86_400
        ? [Math.round(seconds / 3_600), "hour"]
        : [Math.round(seconds / 86_400), "day"];
  return new Intl.RelativeTimeFormat(toIntlLocale(locale), { numeric: "auto" }).format(amount, unit);
}

export function formatDurationMinutes(totalMinutes: number, locale: Locale): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (locale === "ko") return hours ? `${hours}시간 ${rest}분` : `${rest}분`;
  if (locale === "ja") return hours ? `${hours}時間${rest}分` : `${rest}分`;
  if (locale === "zh-CN") return hours ? `${hours}小时${rest}分钟` : `${rest}分钟`;
  if (locale === "es") return hours ? `${hours} h ${rest} min` : `${rest} min`;
  return hours ? `${hours} hr ${rest} min` : `${rest} min`;
}

export function formatUnitValue(value: number, unit: string, locale: Locale): string {
  return `${formatLocalizedNumber(value, locale)} ${unit}`;
}
