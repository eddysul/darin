import type { DiaryComposeDraft } from "../constants/diaryCompose";
import { normalizeDiaryMoodOptional, normalizeDiarySkyOptional } from "../constants/diaryCompose";
import { isDiaryCoverTemplateId } from "../constants/diaryCoverTemplates";
import { isDiaryPageTemplateId } from "../constants/diaryPageTemplates";
import type { DiaryDraft } from "../types/diaryReminder";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import { qaStorage } from "./qaStorage";
import { createKeyedAsyncQueue } from "./keyedAsyncQueue";
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
let memoryRevision = 0;
const storageMutations = createKeyedAsyncQueue();

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
    coverStyleId: isDiaryCoverTemplateId(d.coverStyleId) ? d.coverStyleId : "cloud_sky",
    pageStyleId: isDiaryPageTemplateId(d.pageStyleId) ? d.pageStyleId : "basic_line",
    coverPhotoUri: typeof d.coverPhotoUri === "string" && photos.includes(d.coverPhotoUri) ? d.coverPhotoUri : photos[0] ?? null,
    coverPhotoTransform: {
      scale: Math.max(1, Math.min(3, typeof (d.coverPhotoTransform as { scale?: unknown } | undefined)?.scale === "number" ? (d.coverPhotoTransform as { scale: number }).scale : 1)),
      translateX: Math.max(-1, Math.min(1, typeof (d.coverPhotoTransform as { translateX?: unknown } | undefined)?.translateX === "number" ? (d.coverPhotoTransform as { translateX: number }).translateX : 0)),
      translateY: Math.max(-1, Math.min(1, typeof (d.coverPhotoTransform as { translateY?: unknown } | undefined)?.translateY === "number" ? (d.coverPhotoTransform as { translateY: number }).translateY : 0)),
    },
    coverTitle: typeof d.coverTitle === "string" ? d.coverTitle : "",
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
    targetDiaryId: typeof d.targetDiaryId === "string" ? d.targetDiaryId : undefined,
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
    memoryRevision += 1;
    hydrated = false;
    hydratePromise = null;
    activeScopeId = nextScopeId;
  }
  if (force) {
    memoryRevision += 1;
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return;
  if (!hydratePromise) {
    const requestedScopeId = nextScopeId;
    const requestedMemoryRevision = memoryRevision;
    hydratePromise = (async () => {
      try {
        const result = await readScopedWithLegacyMigration({
          baseKey: KEY,
          scope,
          parse: parseDraft,
          serialize: JSON.stringify,
          merge: latestDraft,
        });
        if (activeScopeId !== requestedScopeId || memoryRevision !== requestedMemoryRevision) return;
        memory = result.value;
      } catch {
        if (activeScopeId !== requestedScopeId || memoryRevision !== requestedMemoryRevision) return;
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
  memoryRevision += 1;
  hydrated = true;
  const key = scopedStorageKey(KEY, scope);
  try {
    await storageMutations.run(key, () => qaStorage.setItem(key, JSON.stringify(draft)));
  } catch {
    reportStorageIssue("save", KEY);
  }
}

export type DiaryDraftIdentity = Pick<DiaryDraft, "dateKey" | "updatedAt">;

function matchesDraftIdentity(
  draft: DiaryDraft | null,
  expected: DiaryDraftIdentity,
): boolean {
  return !!draft
    && draft.dateKey === expected.dateKey
    && draft.updatedAt === expected.updatedAt;
}

export async function clearDiaryDraft(
  scope: LocalDataScope | null,
  expected?: string | DiaryDraftIdentity,
): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) {
    resetDiaryDraftMemory();
    return false;
  }
  const scopeId = localDataScopeId(scope);
  const key = scopedStorageKey(KEY, scope);
  try {
    return await storageMutations.run(key, async () => {
      const storedRaw = await qaStorage.getItem(key);
      const stored = storedRaw ? parseDraft(storedRaw) : null;
      const scopedMemory = activeScopeId === scopeId ? memory : null;
      if (typeof expected === "string") {
        if ((scopedMemory && scopedMemory.dateKey !== expected) || (stored && stored.dateKey !== expected)) return false;
      } else if (expected) {
        if ((scopedMemory && !matchesDraftIdentity(scopedMemory, expected)) || !matchesDraftIdentity(stored, expected)) return false;
      }
      await qaStorage.removeItem(key);
      if (activeScopeId === scopeId) {
        const canClearMemory = typeof expected === "string"
          ? !memory || memory.dateKey === expected
          : expected
            ? !memory || matchesDraftIdentity(memory, expected)
            : true;
        if (canClearMemory) {
          memory = null;
          memoryRevision += 1;
        } else {
          return false;
        }
      }
      return true;
    });
  } catch {
    reportStorageIssue("delete", KEY);
    return false;
  }
}

export function resetDiaryDraftMemory(): void {
  memory = null;
  memoryRevision += 1;
  hydrated = false;
  hydratePromise = null;
  activeScopeId = null;
}
