import type { DayRhythm, RhythmTickKind } from "./overviewRhythm";

export type RhythmTrackSegment =
  | { kind: "sleep"; start: number; duration: number }
  | { kind: "event"; start: number; duration: number; eventKinds: RhythmTickKind[] };

type EventSlot = { start: number; end: number; kinds: Set<RhythmTickKind> };

const MIN_EVENT_WIDTH_PX = 7;
const EVENT_GAP_PX = 2;
const KIND_ORDER: RhythmTickKind[] = ["feed", "diaper", "activity"];

/** Compose one visual lane without changing the timestamps or durations of the records. */
export function buildOverviewRhythmSegments(
  rhythm: DayRhythm,
  untilMinutes: number,
  trackWidthPx: number,
): RhythmTrackSegment[] {
  const limit = Math.max(0, Math.min(1440, untilMinutes));
  if (!limit) return [];

  // A point event needs a minimum visible width on a phone. This visual slot
  // does not change its recorded time or the sleep duration used by summaries.
  const minutesPerPx = 1440 / Math.max(1, trackWidthPx);
  const minimum = MIN_EVENT_WIDTH_PX * minutesPerPx;
  const gap = EVENT_GAP_PX * minutesPerPx;
  const slots = rhythm.ticks
    .filter((tick) => Number.isFinite(tick.start) && tick.start <= limit)
    .map((tick): EventSlot => {
      const actualDuration = tick.kind === "activity" ? Math.max(0, tick.duration ?? 0) : 0;
      const center = tick.start + actualDuration / 2;
      const width = Math.max(minimum, actualDuration);
      return {
        start: Math.max(0, center - width / 2),
        end: Math.min(limit, center + width / 2),
        kinds: new Set([tick.kind]),
      };
    })
    .filter((slot) => slot.end > slot.start)
    .sort((a, b) => a.start - b.start);

  const events: EventSlot[] = [];
  for (const slot of slots) {
    const previous = events[events.length - 1];
    if (previous && slot.start < previous.end + gap) {
      previous.end = Math.max(previous.end, slot.end);
      for (const kind of slot.kinds) previous.kinds.add(kind);
    } else {
      events.push(slot);
    }
  }

  const sleepRanges = rhythm.sleep
    .map((block) => ({ start: Math.max(0, block.start), end: Math.min(limit, block.start + block.duration) }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);
  const mergedSleep: Array<{ start: number; end: number }> = [];
  for (const range of sleepRanges) {
    const previous = mergedSleep[mergedSleep.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else mergedSleep.push({ ...range });
  }

  const segments: RhythmTrackSegment[] = [];
  for (const range of mergedSleep) {
    let cursor = range.start;
    for (const event of events) {
      if (event.end <= cursor) continue;
      if (event.start >= range.end) break;
      const visibleEnd = Math.min(event.start, range.end);
      if (visibleEnd > cursor) segments.push({ kind: "sleep", start: cursor, duration: visibleEnd - cursor });
      cursor = Math.max(cursor, Math.min(event.end, range.end));
      if (cursor >= range.end) break;
    }
    if (cursor < range.end) segments.push({ kind: "sleep", start: cursor, duration: range.end - cursor });
  }
  for (const event of events) {
    segments.push({
      kind: "event",
      start: event.start,
      duration: event.end - event.start,
      eventKinds: KIND_ORDER.filter((kind) => event.kinds.has(kind)),
    });
  }
  return segments.sort((a, b) => a.start - b.start || (a.kind === "sleep" ? -1 : 1));
}
