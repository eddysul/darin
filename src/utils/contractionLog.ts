import type { BabyLogEntry } from "../types/babyLog";
import type { Translate } from "./recordDisplay";
import { recordedAtFromDateKeyTime } from "./supabaseMappers";

export const CONTRACTION_INTENSITY = ["약함", "보통", "강함"] as const;
export type ContractionIntensity = (typeof CONTRACTION_INTENSITY)[number];

const NEW_CONTRACTION_ID = "__contraction-new__";

export function isContractionLog(entry: { cat: string }): boolean {
  return entry.cat === "contraction";
}

export function hhmmFromIso(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function dateKeyFromIso(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function durationSecondsOf(startedAt: string, endedAt: string): number {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function splitDuration(totalSeconds: number): { hours: number; minutes: number; seconds: number } {
  const value = Math.max(0, Math.floor(totalSeconds));
  return {
    hours: Math.floor(value / 3600),
    minutes: Math.floor((value % 3600) / 60),
    seconds: value % 60,
  };
}

export function formatContractionSpan(t: Translate, totalSeconds: number | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "";
  const { hours, minutes, seconds } = splitDuration(totalSeconds);
  if (hours > 0) return t("record.contraction.hms", { hours, minutes, seconds });
  if (minutes > 0 && seconds > 0) return t("record.contraction.ms", { minutes, seconds });
  if (minutes > 0) return t("record.contraction.m", { minutes });
  return t("record.contraction.s", { count: seconds });
}

export function contractionIntensityLabel(t: Translate, value: string | undefined): string {
  if (value === "약함") return t("record.contraction.intensityMild");
  if (value === "보통") return t("record.contraction.intensityModerate");
  if (value === "강함") return t("record.contraction.intensityStrong");
  return value ?? "";
}

function padDate(dateKey: string, deltaDays: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(year, (month ?? 1) - 1, (day ?? 1) + deltaDays);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

export function clocksToContractionTimes(
  dateKey: string,
  startHHmm: string,
  endHHmm: string,
  existing?: { startedAt?: string; endedAt?: string },
): { startedAt: string; endedAt: string; dateKey: string; time: string } {
  const keepStart = existing?.startedAt && hhmmFromIso(existing.startedAt) === startHHmm
    && dateKeyFromIso(existing.startedAt) === dateKey;
  const startedAt = keepStart ? existing!.startedAt! : recordedAtFromDateKeyTime(dateKey, startHHmm);
  let endedAt = recordedAtFromDateKeyTime(dateKey, endHHmm);
  if (Date.parse(endedAt) < Date.parse(startedAt)) {
    endedAt = recordedAtFromDateKeyTime(padDate(dateKey, 1), endHHmm);
  }
  if (existing?.endedAt && hhmmFromIso(existing.endedAt) === endHHmm) {
    const existingEnd = Date.parse(existing.endedAt);
    const rebuiltEnd = Date.parse(endedAt);
    if (Number.isFinite(existingEnd) && Math.abs(existingEnd - rebuiltEnd) < 60_000) {
      endedAt = existing.endedAt;
    }
  }
  return {
    startedAt,
    endedAt,
    dateKey: dateKeyFromIso(startedAt) ?? dateKey,
    time: hhmmFromIso(startedAt) || startHHmm,
  };
}

export function contractionStartMs(entry: Pick<BabyLogEntry, "startedAt" | "dateKey" | "time">): number {
  if (entry.startedAt) {
    const ms = Date.parse(entry.startedAt);
    if (Number.isFinite(ms)) return ms;
  }
  if (entry.dateKey && entry.time) {
    const ms = Date.parse(recordedAtFromDateKeyTime(entry.dateKey, entry.time));
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

export function sortContractionsChronological(entries: BabyLogEntry[]): BabyLogEntry[] {
  return entries
    .filter(isContractionLog)
    .slice()
    .sort((a, b) => {
      const delta = contractionStartMs(a) - contractionStartMs(b);
      if (delta !== 0) return delta;
      return a.id.localeCompare(b.id);
    });
}

function startedAtOf(entry: BabyLogEntry): string {
  if (entry.startedAt && Number.isFinite(Date.parse(entry.startedAt))) return entry.startedAt;
  if (entry.dateKey && entry.time) return recordedAtFromDateKeyTime(entry.dateKey, entry.time);
  return new Date(contractionStartMs(entry)).toISOString();
}

function endedAtOf(entry: BabyLogEntry, startedAt: string): string {
  if (entry.endedAt && Number.isFinite(Date.parse(entry.endedAt))) return entry.endedAt;
  if (typeof entry.durationSeconds === "number") {
    return new Date(Date.parse(startedAt) + entry.durationSeconds * 1000).toISOString();
  }
  return startedAt;
}

export function withRecalculatedIntervals(entries: BabyLogEntry[]): BabyLogEntry[] {
  const chronological = sortContractionsChronological(entries);
  return chronological.map((entry, index) => {
    const startedAt = startedAtOf(entry);
    const endedAt = endedAtOf(entry, startedAt);
    const durationSeconds = durationSecondsOf(startedAt, endedAt);
    const previous = chronological[index - 1];
    const intervalSeconds = previous
      ? Math.max(0, Math.floor((Date.parse(startedAt) - contractionStartMs(previous)) / 1000))
      : undefined;
    return {
      ...entry,
      startedAt,
      endedAt,
      durationSeconds,
      intervalSeconds,
      time: hhmmFromIso(startedAt) || entry.time,
      dateKey: dateKeyFromIso(startedAt) ?? entry.dateKey,
    };
  });
}

function contractionFieldsEqual(a: BabyLogEntry, b: BabyLogEntry): boolean {
  return a.startedAt === b.startedAt
    && a.endedAt === b.endedAt
    && a.durationSeconds === b.durationSeconds
    && a.intervalSeconds === b.intervalSeconds
    && a.time === b.time
    && a.dateKey === b.dateKey;
}

export function buildContractionSaveEntry(
  draft: Omit<BabyLogEntry, "id">,
  logs: BabyLogEntry[],
  editId?: string,
): Omit<BabyLogEntry, "id"> {
  const temp: BabyLogEntry = { ...draft, id: editId ?? NEW_CONTRACTION_ID };
  const nextLogs = editId
    ? logs.map((entry) => (entry.id === editId ? temp : entry))
    : [...logs, temp];
  const self = withRecalculatedIntervals(nextLogs).find((entry) => entry.id === temp.id);
  if (!self) return draft;
  const { id: _id, ...rest } = self;
  return rest;
}

export function siblingContractionUpdates(
  logs: BabyLogEntry[],
  saved: BabyLogEntry,
): Array<{ id: string; entry: Omit<BabyLogEntry, "id"> }> {
  const withSaved = logs.some((entry) => entry.id === saved.id)
    ? logs.map((entry) => (entry.id === saved.id ? saved : entry))
    : [...logs, saved];
  return withRecalculatedIntervals(withSaved)
    .filter((entry) => entry.id !== saved.id)
    .flatMap((entry) => {
      const previous = logs.find((item) => item.id === entry.id);
      if (previous && contractionFieldsEqual(previous, entry)) return [];
      const { id, ...rest } = entry;
      return [{ id, entry: rest }];
    });
}

export function contractionUpdatesAfterDelete(
  logs: BabyLogEntry[],
  deletedId: string,
): Array<{ id: string; entry: Omit<BabyLogEntry, "id"> }> {
  const remaining = logs.filter((entry) => entry.id !== deletedId);
  return withRecalculatedIntervals(remaining).flatMap((entry) => {
    const previous = remaining.find((item) => item.id === entry.id);
    if (previous && contractionFieldsEqual(previous, entry)) return [];
    const { id, ...rest } = entry;
    return [{ id, entry: rest }];
  });
}

export function todayContractionSummary(logs: BabyLogEntry[], dateKey: string): {
  count: number;
  lastDurationSeconds?: number;
  lastIntervalSeconds?: number;
  avgIntervalSeconds?: number;
} {
  const day = logs.filter((entry) => isContractionLog(entry) && (entry.dateKey ?? "") === dateKey);
  const latest = [...day].sort((a, b) => contractionStartMs(b) - contractionStartMs(a))[0];
  const intervals = day
    .map((entry) => entry.intervalSeconds)
    .filter((value): value is number => typeof value === "number");
  return {
    count: day.length,
    lastDurationSeconds: latest?.durationSeconds,
    lastIntervalSeconds: latest?.intervalSeconds,
    avgIntervalSeconds: intervals.length
      ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length)
      : undefined,
  };
}

export function groupContractionsByDate(entries: BabyLogEntry[]): Array<{ dateKey: string; items: BabyLogEntry[] }> {
  const newestFirst = sortContractionsChronological(entries).reverse();
  const groups: Array<{ dateKey: string; items: BabyLogEntry[] }> = [];
  for (const item of newestFirst) {
    const key = item.dateKey ?? "";
    const current = groups[groups.length - 1];
    if (current && current.dateKey === key) current.items.push(item);
    else groups.push({ dateKey: key, items: [item] });
  }
  return groups;
}
