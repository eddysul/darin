/** Diary sky (weather) & mood stamp options — ink-stamp style, not emoji. */

import type { DiaryCoverTemplateId } from "./diaryCoverTemplates";
import type { DiaryPageTemplateId } from "./diaryPageTemplates";
import type { DiaryCoverPhotoTransform } from "../types/babyLog";

export type DiarySkyId = "sun" | "cloud" | "rain" | "snow" | "night";
export type DiaryMoodId =
  | "love"
  | "proud"
  | "calm"
  | "tired"
  | "moved"
  | "worry"
  | "grateful"
  | "funny";

export type DiaryStampOption<T extends string> = {
  id: T;
  label: string;
  /** Soft ink fill */
  ink: string;
  /** Stronger ink when selected */
  inkStrong: string;
  rim: string;
};

export const DIARY_SKY_OPTIONS: readonly DiaryStampOption<DiarySkyId>[] = [
  { id: "sun", label: "햇살", ink: "#F6E7B8", inkStrong: "#E8C96A", rim: "#D4A84B" },
  { id: "cloud", label: "구름", ink: "#E8EEF2", inkStrong: "#C5D4DE", rim: "#8FA8B8" },
  { id: "rain", label: "비", ink: "#D9E8F2", inkStrong: "#A8CDE3", rim: "#6A9BB8" },
  { id: "snow", label: "눈", ink: "#EEF2F6", inkStrong: "#D0D8E4", rim: "#8B97A8" },
  { id: "night", label: "밤", ink: "#E8E0D4", inkStrong: "#C4B5A0", rim: "#8A735A" },
] as const;

export const DIARY_MOOD_OPTIONS: readonly DiaryStampOption<DiaryMoodId>[] = [
  { id: "love", label: "사랑", ink: "#F5D9D4", inkStrong: "#E8918A", rim: "#C96B64" },
  { id: "proud", label: "뿌듯", ink: "#F3E4B8", inkStrong: "#E0B23F", rim: "#C4922A" },
  { id: "calm", label: "평온", ink: "#E2EBD8", inkStrong: "#B5C9A4", rim: "#7A9470" },
  { id: "tired", label: "피곤", ink: "#E5E0EA", inkStrong: "#B8ADC8", rim: "#7D7194" },
  { id: "moved", label: "뭉클", ink: "#E8D8E6", inkStrong: "#C9A0C4", rim: "#9A6F96" },
  { id: "worry", label: "걱정", ink: "#E4E8EC", inkStrong: "#B0BCC8", rim: "#7A8794" },
  { id: "grateful", label: "감사", ink: "#F0E4D4", inkStrong: "#D4B896", rim: "#A8845C" },
  { id: "funny", label: "웃김", ink: "#F7E9C4", inkStrong: "#E8C56A", rim: "#C9A03A" },
] as const;

export const DEFAULT_DIARY_SKY: DiarySkyId = "sun";
export const DEFAULT_DIARY_MOOD: DiaryMoodId = "love";

const SKY_IDS = new Set<string>(DIARY_SKY_OPTIONS.map((o) => o.id));
const MOOD_IDS = new Set<string>(DIARY_MOOD_OPTIONS.map((o) => o.id));

const LEGACY_SKY: Record<string, DiarySkyId> = {
  "🌞": "sun",
  "☀️": "sun",
  "🌤️": "cloud",
  "⛅": "cloud",
  "☁️": "cloud",
  "🌧️": "rain",
  "🌧": "rain",
  "🌨️": "snow",
  "❄️": "snow",
  "🌙": "night",
  "🍃": "cloud",
  "🌈": "sun",
  "🌫": "cloud",
  "🌬": "cloud",
};

const LEGACY_MOOD: Record<string, DiaryMoodId> = {
  "💗": "love",
  "🥰": "love",
  "❤️": "love",
  "😌": "calm",
  "😊": "calm",
  "🥺": "moved",
  "🥹": "moved",
  "😪": "tired",
  "😴": "tired",
  "🫠": "funny",
  "😅": "funny",
  "💭": "worry",
  "😢": "worry",
  "😔": "worry",
};

export function normalizeDiarySky(value?: string | null): DiarySkyId {
  if (!value) return DEFAULT_DIARY_SKY;
  if (SKY_IDS.has(value)) return value as DiarySkyId;
  return LEGACY_SKY[value] ?? DEFAULT_DIARY_SKY;
}

export function normalizeDiaryMood(value?: string | null): DiaryMoodId {
  if (!value) return DEFAULT_DIARY_MOOD;
  if (MOOD_IDS.has(value)) return value as DiaryMoodId;
  return LEGACY_MOOD[value] ?? DEFAULT_DIARY_MOOD;
}

export function normalizeDiarySkyOptional(value?: string | null): DiarySkyId | null {
  if (value == null || value === "") return null;
  return normalizeDiarySky(value);
}

export function normalizeDiaryMoodOptional(value?: string | null): DiaryMoodId | null {
  if (value == null || value === "") return null;
  return normalizeDiaryMood(value);
}

export function getDiarySkyOption(id: string) {
  const n = normalizeDiarySky(id);
  return DIARY_SKY_OPTIONS.find((o) => o.id === n)!;
}

export function getDiaryMoodOption(id: string) {
  const n = normalizeDiaryMood(id);
  return DIARY_MOOD_OPTIONS.find((o) => o.id === n)!;
}

export const DIARY_GROWTH_MOMENTS = [
  "첫 목욕",
  "처음 뒤집은 날",
  "처음 웃은 날",
  "첫 이유식",
  "첫걸음",
  "첫 단어",
] as const;

export type DiaryComposeDraft = {
  comment: string;
  photos: string[];
  coverStyleId: DiaryCoverTemplateId;
  pageStyleId: DiaryPageTemplateId;
  coverPhotoUri: string | null;
  coverPhotoTransform: DiaryCoverPhotoTransform;
  coverTitle: string;
  stickerIds: string[];
  weatherStamp: DiarySkyId | null;
  moodStamp: DiaryMoodId | null;
  milestoneTag: string | null;
  customMilestoneTag: string | null;
  includedInGrowthBook: boolean;
  /** Frozen at save; live preview while composing */
  careLogSummarySnapshot: string;
  momentSuggestionsUsed: string[];
};
