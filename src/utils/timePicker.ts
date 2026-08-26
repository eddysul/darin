import type { Locale } from "../i18n";
import { getAppSettings } from "./appSettingsStore";
import { toIntlLocale } from "./localeFormat";

export function parseHHmm(value: string | null | undefined) {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function formatHHmm(hour: number, minute: number) {
  const safeHour = Math.max(0, Math.min(23, Math.round(hour)));
  const safeMinute = Math.max(0, Math.min(59, Math.round(minute)));
  return `${String(safeHour).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")}`;
}

export function formatTimeOfDay(
  value: string | null | undefined,
  placeholder = "",
  locale?: Locale,
) {
  const parsed = parseHHmm(value);
  if (!parsed) return placeholder;
  if (getAppSettings().time.clock === "24h") return formatHHmm(parsed.hour, parsed.minute);
  if (locale) {
    const date = new Date(2000, 0, 1, parsed.hour, parsed.minute);
    return new Intl.DateTimeFormat(toIntlLocale(locale), {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }
  const period = parsed.hour < 12 ? "오전" : "오후";
  return `${period} ${parsed.hour % 12 || 12}:${String(parsed.minute).padStart(2, "0")}`;
}

export function formatDurationMinutes(
  value: number | null | undefined,
  placeholder = "",
  format?: (hours: number, minutes: number) => string,
) {
  if (value == null || !Number.isFinite(value) || value <= 0) return placeholder;
  const total = Math.round(value);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (format) return format(hours, minutes);
  if (!hours) return `${minutes}분`;
  if (!minutes) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}
