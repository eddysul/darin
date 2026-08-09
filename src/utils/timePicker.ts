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

export function formatTimeOfDay(value: string | null | undefined, placeholder = "시간 선택") {
  const parsed = parseHHmm(value);
  if (!parsed) return placeholder;
  const period = parsed.hour < 12 ? "오전" : "오후";
  return `${period} ${parsed.hour % 12 || 12}:${String(parsed.minute).padStart(2, "0")}`;
}

export function formatDurationMinutes(value: number | null | undefined, placeholder = "기간 선택") {
  if (value == null || !Number.isFinite(value) || value <= 0) return placeholder;
  const total = Math.round(value);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes}분`;
  if (!minutes) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}
