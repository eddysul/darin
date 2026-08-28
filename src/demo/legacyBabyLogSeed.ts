import type { BabyLogActor, BabyLogEntry, DiaryEntry } from "../types/babyLog";
import type { FamilyMember } from "../types/family";
import { formatDateKey, shiftDateKey } from "../utils/dateKey";

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function displayDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
}

function sampleDiaryEntries(): DiaryEntry[] {
  return [
    {
      id: "d1", babyId: "baby-1", date: displayDateDaysAgo(12), dateKey: shiftDateKey(12), photos: [],
      coverStyleId: "pink_heart", pageStyleId: "pink_heart", coverTitle: "첫 목욕",
      comment: "오늘 처음으로 욕조 목욕을 했는데 물을 튀기면서 엄청 좋아했어요. 목욕 후에 바로 잠들었네요.",
      weatherStamp: "sun", moodStamp: "love",
      careLogSummarySnapshot: "오늘은 수유 6회, 수면 4시간 20분, 기저귀 5회가 기록되었어요. 추가로 목욕도 했어요.",
      momentSuggestionsUsed: [], milestoneTag: "첫 목욕", customMilestoneTag: null,
      includedInGrowthBook: true, createdAt: isoDaysAgo(12), updatedAt: isoDaysAgo(12),
      source: "manual", draftStatus: "saved", createdBy: { userId: "m1", name: "김민지", role: "owner" },
    },
    {
      id: "d2", babyId: "baby-1", date: displayDateDaysAgo(14), dateKey: shiftDateKey(14), photos: [],
      coverStyleId: "cloud_sky", pageStyleId: "blue_cloud", coverTitle: "옹알이 많은 날",
      comment: '낮에 옹알이가 부쩍 늘었어요. "아부부" 소리를 계속 내면서 웃는 모습이 너무 사랑스러웠던 하루.',
      weatherStamp: "cloud", moodStamp: "calm",
      careLogSummarySnapshot: "오늘은 수유 5회, 수면 3시간 10분, 기저귀 4회가 기록되었어요.",
      momentSuggestionsUsed: [], milestoneTag: null, customMilestoneTag: null,
      includedInGrowthBook: true, createdAt: isoDaysAgo(14), updatedAt: isoDaysAgo(14),
      source: "manual", draftStatus: "saved", createdBy: { userId: "m1", name: "김민지", role: "owner" },
    },
    {
      id: "d3", babyId: "baby-1", date: displayDateDaysAgo(16), dateKey: shiftDateKey(16), photos: [],
      coverStyleId: "beige_paper", pageStyleId: "beige_paper", coverTitle: "처음 뒤집은 날",
      comment: "낮잠이 짧아서 저녁에 보챔이 있었어요. 수유 간격은 괜찮은 편이었습니다. 뒤집기를 처음 성공한 날!",
      weatherStamp: "rain", moodStamp: "tired",
      careLogSummarySnapshot: "오늘은 수유 4회, 수면 2시간 40분, 기저귀 3회가 기록되었어요. 추가로 터미타임도 했어요.",
      momentSuggestionsUsed: [], milestoneTag: "처음 뒤집은 날", customMilestoneTag: null,
      includedInGrowthBook: true, createdAt: isoDaysAgo(16), updatedAt: isoDaysAgo(16),
      source: "manual", draftStatus: "saved", createdBy: { userId: "m2", name: "이준호", role: "admin" },
    },
  ];
}

function sampleLogs(): Omit<BabyLogEntry, "id">[] {
  const today = formatDateKey();
  const day = (ago: number) => shiftDateKey(ago);
  const mom: BabyLogActor = { userId: "m1", name: "김민지", role: "owner" };
  const dad: BabyLogActor = { userId: "m2", name: "이준호", role: "admin" };
  const sitter: BabyLogActor = { userId: "m3", name: "박시터", role: "caregiver" };
  return [
    { cat: "formula", time: "14:10", amount: "80", dateKey: today, createdBy: mom, source: "manual" },
    { cat: "sleep", time: "13:20", duration: "35", dateKey: today, createdBy: mom, source: "manual" },
    { cat: "diaper", time: "12:40", chip: "소변", dateKey: today, createdBy: sitter, source: "manual" },
    { cat: "breast", time: "11:30", chip: "좌측", duration: "12", dateKey: today, createdBy: mom, source: "manual" },
    { cat: "diaper", time: "09:42", chip: "대변", chip2: "황금색", dateKey: today, voice: true, source: "voice", createdBy: mom },
    { cat: "sleep", time: "09:28", duration: "40", dateKey: today, createdBy: dad, source: "manual" },
    { cat: "diaper", time: "08:32", chip: "소변", dateKey: today, createdBy: dad, source: "manual" },
    { cat: "tummy", time: "15:00", duration: "10", dateKey: today, voice: true, source: "voice", createdBy: sitter },
    { cat: "formula", time: "10:00", amount: "90", dateKey: day(1), createdBy: mom, source: "manual" },
    { cat: "formula", time: "14:00", amount: "80", dateKey: day(1), createdBy: mom, source: "manual" },
    { cat: "sleep", time: "13:00", duration: "90", dateKey: day(1), createdBy: dad, source: "manual" },
    { cat: "diaper", time: "11:00", chip: "소변", dateKey: day(1), createdBy: sitter, source: "manual" },
    { cat: "diaper", time: "16:00", chip: "대변", dateKey: day(1), createdBy: mom, source: "manual" },
    { cat: "formula", time: "09:30", amount: "100", dateKey: day(2), createdBy: mom, source: "manual" },
    { cat: "sleep", time: "12:00", duration: "60", dateKey: day(2), createdBy: mom, source: "manual" },
    { cat: "diaper", time: "10:20", chip: "소변", dateKey: day(2), createdBy: dad, source: "manual" },
    { cat: "breast", time: "15:10", duration: "15", dateKey: day(3), createdBy: mom, source: "manual" },
    { cat: "sleep", time: "11:00", duration: "45", dateKey: day(3), createdBy: sitter, source: "manual" },
    { cat: "diaper", time: "13:40", chip: "대변", dateKey: day(3), createdBy: sitter, source: "manual" },
    { cat: "formula", time: "08:00", amount: "80", dateKey: day(4), createdBy: mom, source: "manual" },
    { cat: "diaper", time: "09:00", chip: "소변", dateKey: day(4), createdBy: mom, source: "manual" },
    { cat: "sleep", time: "14:00", duration: "70", dateKey: day(5), createdBy: dad, source: "manual" },
    { cat: "formula", time: "12:30", amount: "70", dateKey: day(5), createdBy: dad, source: "manual" },
    { cat: "diaper", time: "18:00", chip: "소변", dateKey: day(6), createdBy: mom, source: "manual" },
    { cat: "sleep", time: "10:00", duration: "50", dateKey: day(6), createdBy: mom, source: "manual" },
  ];
}

const SAMPLE_FAMILY: FamilyMember[] = [
  { id: "m1", emoji: "👩", name: "김민지", role: "owner", relationshipLabel: "엄마", status: "active", isMe: true },
  { id: "m2", emoji: "👨", name: "이준호", role: "admin", relationshipLabel: "아빠", status: "active", contact: "junho@example.com" },
  { id: "m3", emoji: "🧑‍🍼", name: "박시터", role: "caregiver", relationshipLabel: "시터", status: "active", contact: "010-1234-5678" },
];

export function createLegacyBabyLogSample() {
  return {
    logs: sampleLogs(),
    diaryEntries: sampleDiaryEntries(),
    familyMembers: SAMPLE_FAMILY.map((member) => ({ ...member })),
  };
}

