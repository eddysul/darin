import type { BabyLogEntry, DiaryEntry } from "../types/babyLog";
import type { FamilyMember } from "../types/family";

const LEGACY_DIARY_IDS = new Set(["d1", "d2", "d3"]);
const LEGACY_LOG_FINGERPRINTS = new Set([
  "formula|14:10|80|||m1",
  "sleep|13:20||35||m1",
  "diaper|12:40|||소변|m3",
  "breast|11:30||12|좌측|m1",
  "diaper|09:42|||대변|m1",
  "sleep|09:28||40||m2",
  "diaper|08:32|||소변|m2",
  "tummy|15:00||10||m3",
  "formula|10:00|90|||m1",
  "formula|14:00|80|||m1",
  "sleep|13:00||90||m2",
  "diaper|11:00|||소변|m3",
  "diaper|16:00|||대변|m1",
  "formula|09:30|100|||m1",
  "sleep|12:00||60||m1",
  "diaper|10:20|||소변|m2",
  "breast|15:10||15||m1",
  "sleep|11:00||45||m3",
  "diaper|13:40|||대변|m3",
  "formula|08:00|80|||m1",
  "diaper|09:00|||소변|m1",
  "sleep|14:00||70||m2",
  "formula|12:30|70|||m2",
  "diaper|18:00|||소변|m1",
  "sleep|10:00||50||m1",
]);

function logFingerprint(entry: BabyLogEntry): string {
  return [
    entry.cat,
    entry.time,
    entry.amount ?? "",
    entry.duration ?? "",
    entry.chip ?? "",
    entry.createdBy?.userId ?? "",
  ].join("|");
}

export function removeLegacySampleLogs(entries: BabyLogEntry[]): BabyLogEntry[] {
  return entries.filter((entry) => !LEGACY_LOG_FINGERPRINTS.has(logFingerprint(entry)));
}

export function removeLegacySampleDiaries(entries: DiaryEntry[]): DiaryEntry[] {
  return entries.filter((entry) => !LEGACY_DIARY_IDS.has(entry.id));
}

export function removeLegacySampleFamily(entries: FamilyMember[]): FamilyMember[] {
  return entries.filter((member) => {
    if (member.contact === "junho@example.com" || member.contact === "010-1234-5678") return false;
    if (member.id === "m1" && member.name === "김민지") return false;
    if (member.id === "m2" && member.name === "이준호") return false;
    if (member.id === "m3" && member.name === "박시터") return false;
    return true;
  });
}

export function containsLegacySampleDiary(entries: DiaryEntry[]): boolean {
  return entries.some((entry) => LEGACY_DIARY_IDS.has(entry.id));
}
