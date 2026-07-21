import type { DiaryComposeDraft } from "../constants/diaryCompose";
import { normalizeDiaryMoodOptional, normalizeDiarySkyOptional } from "../constants/diaryCompose";
import type { DiaryDraft } from "../types/diaryReminder";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import { qaStorage } from "./qaStorage";

const KEY = STORAGE_KEYS.diaryDraft;

let memory: DiaryDraft | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function migrateDraft(raw: unknown): DiaryDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.dateKey !== "string") return null;

  const photos: string[] = Array.isArray(d.photos)
    ? (d.photos as unknown[]).filter((p): p is string => typeof p === "string" && !!p)
    : typeof d.photoUri === "string" && d.photoUri
      ? [d.photoUri]
      : [];

  const comment = typeof d.comment === "string" ? d.comment : "";
  const draft: DiaryComposeDraft = {
    comment,
    photos,
    stickerIds: Array.isArray(d.stickerIds)
      ? (d.stickerIds as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    weatherStamp: normalizeDiarySkyOptional(
      (typeof d.weatherStamp === "string" ? d.weatherStamp : null) ??
        (typeof d.weatherEmoji === "string" ? d.weatherEmoji : null),
    ),
    moodStamp: normalizeDiaryMoodOptional(
      (typeof d.moodStamp === "string" ? d.moodStamp : null) ??
        (typeof d.emotionEmoji === "string" ? d.emotionEmoji : null),
    ),
    milestoneTag:
      (typeof d.milestoneTag === "string" ? d.milestoneTag : null) ??
      (typeof d.growthMoment === "string" ? d.growthMoment : null),
    customMilestoneTag: typeof d.customMilestoneTag === "string" ? d.customMilestoneTag : null,
    includedInGrowthBook: !!(d.includedInGrowthBook ?? d.inGrowthBook),
    careLogSummarySnapshot:
      (typeof d.careLogSummarySnapshot === "string" && d.careLogSummarySnapshot) ||
      (typeof d.careLogSnapshot === "string" && d.careLogSnapshot) ||
      "",
    momentSuggestionsUsed: Array.isArray(d.momentSuggestionsUsed)
      ? (d.momentSuggestionsUsed as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
  };

  return {
    ...draft,
    dateKey: d.dateKey,
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : new Date().toISOString(),
  };
}

export async function hydrateDiaryDraft(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(KEY);
        memory = raw ? migrateDraft(JSON.parse(raw) as unknown) : null;
      } catch {
        memory = null;
        reportStorageIssue("load", KEY);
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
}

export function getDiaryDraft(): DiaryDraft | null {
  return memory;
}

export async function saveDiaryDraft(draft: DiaryDraft): Promise<void> {
  memory = draft;
  hydrated = true;
  try {
    await qaStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    reportStorageIssue("save", KEY);
  }
}

export async function clearDiaryDraft(dateKey?: string): Promise<void> {
  if (dateKey && memory && memory.dateKey !== dateKey) return;
  memory = null;
  try {
    await qaStorage.removeItem(KEY);
  } catch {
    reportStorageIssue("delete", KEY);
  }
}
