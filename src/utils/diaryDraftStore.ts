import type { DiaryComposeDraft } from "../constants/diaryCompose";
import { normalizeDiaryMoodOptional, normalizeDiarySkyOptional } from "../constants/diaryCompose";
import type { DiaryDraft } from "../types/diaryReminder";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import { qaStorage } from "./qaStorage";
import {
  isValidLocalDataScope,
  localDataScopeId,
  readScopedWithLegacyMigration,
  scopedStorageKey,
  type LocalDataScope,
} from "./scopedLocalStorage";

const KEY = STORAGE_KEYS.diaryDraft;

let memory: DiaryDraft | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let activeScopeId: string | null = null;

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

function parseDraft(raw: string): DiaryDraft | null {
  return migrateDraft(JSON.parse(raw) as unknown);
}

function latestDraft(scoped: DiaryDraft | null, legacy: DiaryDraft): DiaryDraft {
  if (!scoped) return legacy;
  return scoped.updatedAt >= legacy.updatedAt ? scoped : legacy;
}

export async function hydrateDiaryDraft(
  scope: LocalDataScope | null,
  force = false,
): Promise<void> {
  if (!isValidLocalDataScope(scope)) {
    resetDiaryDraftMemory();
    return;
  }
  const nextScopeId = localDataScopeId(scope);
  if (activeScopeId !== nextScopeId) {
    memory = null;
    hydrated = false;
    hydratePromise = null;
    activeScopeId = nextScopeId;
  }
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return;
  if (!hydratePromise) {
    const requestedScopeId = nextScopeId;
    hydratePromise = (async () => {
      try {
        const result = await readScopedWithLegacyMigration({
          baseKey: KEY,
          scope,
          parse: parseDraft,
          serialize: JSON.stringify,
          merge: latestDraft,
        });
        if (activeScopeId !== requestedScopeId) return;
        memory = result.value;
      } catch {
        if (activeScopeId !== requestedScopeId) return;
        memory = null;
        reportStorageIssue("load", KEY);
      }
      if (activeScopeId === requestedScopeId) hydrated = true;
    })();
  }
  await hydratePromise;
}

export function getDiaryDraft(): DiaryDraft | null {
  return memory;
}

export async function saveDiaryDraft(
  draft: DiaryDraft,
  scope: LocalDataScope | null,
): Promise<void> {
  if (!isValidLocalDataScope(scope)) return;
  const scopeId = localDataScopeId(scope);
  if (activeScopeId !== scopeId) return;
  memory = draft;
  hydrated = true;
  try {
    await qaStorage.setItem(scopedStorageKey(KEY, scope), JSON.stringify(draft));
  } catch {
    reportStorageIssue("save", KEY);
  }
}

export async function clearDiaryDraft(
  scope: LocalDataScope | null,
  dateKey?: string,
): Promise<void> {
  if (!isValidLocalDataScope(scope)) {
    resetDiaryDraftMemory();
    return;
  }
  if (dateKey && memory && memory.dateKey !== dateKey) return;
  memory = null;
  try {
    await qaStorage.removeItem(scopedStorageKey(KEY, scope));
  } catch {
    reportStorageIssue("delete", KEY);
  }
}

export function resetDiaryDraftMemory(): void {
  memory = null;
  hydrated = false;
  hydratePromise = null;
  activeScopeId = null;
}
