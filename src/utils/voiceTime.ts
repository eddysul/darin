import { formatDateKey as formatDateKeyShared, yesterdayDateKey as yesterdayKeyShared } from "./dateKey";

export type ParsedTime = {
  time: string;
  dateKey?: string;
  ambiguous?: boolean;
  options?: string[];
  relativeNote?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function formatHhMm(d = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const formatDateKey = formatDateKeyShared;

function yesterdayKey(now = new Date()): string {
  return yesterdayKeyShared(now);
}

export function toMinutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Extract relative / absolute time hints from a Korean utterance snippet. */
export function parseVoiceTime(text: string, now = new Date()): ParsedTime {
  const t = text.trim();

  if (/방금|지금|막\s*전에/.test(t)) {
    return { time: formatHhMm(now) };
  }

  if (/어제/.test(t)) {
    const clock = extractClock(t, now);
    return {
      time: clock?.time ?? "21:00",
      dateKey: yesterdayKey(now),
      ambiguous: !clock,
      options: clock?.options,
      relativeNote: clock ? undefined : "어제",
    };
  }

  if (/새벽/.test(t)) {
    const m = t.match(/새벽\s*(\d{1,2})\s*시(?:\s*반|\s*(\d{1,2})\s*분)?/);
    if (m) {
      const hour = Number(m[1]);
      const half = /시\s*반/.test(t.slice(t.indexOf("새벽")));
      const minute = half ? 30 : m[2] ? Number(m[2]) : 0;
      const h = hour === 12 ? 0 : hour;
      const dateKey = now.getHours() < 6 && h > now.getHours() ? yesterdayKey(now) : undefined;
      return { time: `${pad(h)}:${pad(minute)}`, dateKey, relativeNote: "새벽" };
    }
  }

  // Absolute clock beats vague "아까" when both appear ("아까 1시에…")
  const clock = extractClock(t, now);
  if (clock) {
    if (/아까|전에|조금\s*전/.test(t)) {
      return { ...clock, relativeNote: "아까" };
    }
    return clock;
  }

  if (/아까|전에|조금\s*전/.test(t)) {
    return {
      time: formatHhMm(now),
      relativeNote: "아까",
    };
  }

  return { time: formatHhMm(now) };
}

function resolveHour(
  hour: number,
  minute: number,
  text: string,
  now: Date,
): ParsedTime {
  const am = /오전|아침/.test(text);
  const pm = /오후|저녁|밤/.test(text);
  let h = hour;

  if (am) {
    if (h === 12) h = 0;
    return { time: `${pad(h)}:${pad(minute)}` };
  }
  if (pm) {
    if (h < 12) h += 12;
    return { time: `${pad(h)}:${pad(minute)}` };
  }

  if (h >= 1 && h <= 11) {
    const morning = `${pad(h)}:${pad(minute)}`;
    const evening = `${pad(h + 12)}:${pad(minute)}`;
    const preferPm = now.getHours() >= 12;
    return {
      time: preferPm ? evening : morning,
      ambiguous: true,
      options: [morning, evening],
    };
  }

  return { time: `${pad(h)}:${pad(minute)}` };
}

/** All clock mentions in left-to-right order (for sleep start→wake). */
export function extractClockHits(text: string, now = new Date()): ParsedTime[] {
  const hits: { index: number; parsed: ParsedTime }[] = [];
  const patterns: RegExp[] = [
    /(\d{1,2})\s*시\s*(\d{1,2})\s*분/g,
    /(\d{1,2})\s*시\s*반/g,
    /(\d{1,2})\s*시(?!\s*(?:\d|반))/g,
    /\b([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)\b/g,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      let hour: number;
      let minute = 0;
      if (m[0].includes(":")) {
        hour = Number(m[1]);
        minute = Number(m[2]);
      } else if (/반/.test(m[0])) {
        hour = Number(m[1]);
        minute = 30;
      } else if (m[2] != null && /^\d+$/.test(m[2])) {
        hour = Number(m[1]);
        minute = Number(m[2]);
      } else {
        hour = Number(m[1]);
        minute = 0;
      }
      if (hour > 23) continue;
      // Skip overlaps (e.g. "2시 10분" also matching hour-only "2시")
      if (hits.some((h) => Math.abs(h.index - m!.index) < 2)) continue;
      hits.push({ index: m.index, parsed: resolveHour(hour, minute, text, now) });
    }
  }

  hits.sort((a, b) => a.index - b.index);
  // Deduplicate near-identical consecutive times
  const out: ParsedTime[] = [];
  for (const h of hits) {
    if (out.some((p) => p.time === h.parsed.time)) continue;
    out.push(h.parsed);
  }
  return out;
}

function extractClock(text: string, now: Date): ParsedTime | null {
  return extractClockHits(text, now)[0] ?? null;
}

export function parseDurationMinutes(text: string): string | undefined {
  // Avoid treating "2시 10분" clock minutes as sleep duration when "분" alone
  if (/\d+\s*시\s*\d+\s*분/.test(text) && !/(?:잤|재웠|낮잠|수면|터미).*\d+\s*분|\d+\s*분\s*(?:잤|재웠)/.test(text)) {
    const explicit = text.match(/(?:잤|재웠|낮잠|수면|터미)[^\d]{0,8}(\d+)\s*분|(\d+)\s*분\s*(?:잤|재웠|동안)/);
    return explicit?.[1] ?? explicit?.[2];
  }
  const m = text.match(/(\d+)\s*분/);
  return m?.[1];
}

/** Sleep span: start clock + optional duration inferred to wake clock. */
export function parseSleepSpan(
  text: string,
  now = new Date(),
): { start: ParsedTime; duration?: string } | null {
  const clocks = extractClockHits(text, now);
  if (clocks.length >= 2 && /낮잠|수면|잤|재웠|깼|Wake/i.test(text)) {
    let diff = toMinutesOfDay(clocks[1].time) - toMinutesOfDay(clocks[0].time);
    if (diff < 0) diff += 24 * 60;
    return { start: clocks[0], duration: String(diff) };
  }
  if (clocks.length === 1) return { start: clocks[0], duration: parseDurationMinutes(text) };
  return null;
}
