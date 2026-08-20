import {
  DIARY_GROWTH_MOMENTS,
  normalizeDiaryMoodOptional,
  normalizeDiarySkyOptional,
} from "../constants/diaryCompose";
import { DEFAULT_DIARY_COVER_TEMPLATE_ID, isDiaryCoverTemplateId } from "../constants/diaryCoverTemplates";
import { DEFAULT_DIARY_PAGE_TEMPLATE_ID, isDiaryPageTemplateId } from "../constants/diaryPageTemplates";
import type { DiaryDraftStatus, DiaryEntry, DiarySource } from "../types/babyLog";
import { formatDateKey } from "./dateKey";

/** Stored when user saves photos without a written comment. */
export const DIARY_PHOTO_ONLY_COMMENT = "(사진만 남긴 하루)";

export function diaryPrimaryPhoto(entry: Pick<DiaryEntry, "photos" | "coverPhotoUri">): string | null {
  if (entry.coverPhotoUri && entry.photos.includes(entry.coverPhotoUri)) return entry.coverPhotoUri;
  return entry.photos[0] ?? null;
}

export function diaryCoverTitle(entry: Pick<DiaryEntry, "coverTitle" | "milestoneTag" | "customMilestoneTag" | "comment">): string {
  const explicit = entry.coverTitle?.trim();
  if (explicit) return explicit;
  const milestone = entry.milestoneTag || entry.customMilestoneTag;
  if (milestone) return milestone;
  const firstLine = entry.comment.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return firstLine && firstLine !== DIARY_PHOTO_ONLY_COMMENT ? firstLine : "우리 아기의 하루";
}

/** Soft copy for list/vault cards (never show the raw placeholder). */
export function diaryDisplayComment(entry: Pick<DiaryEntry, "comment" | "photos">): string {
  const trimmed = entry.comment.trim();
  if (!trimmed || trimmed === DIARY_PHOTO_ONLY_COMMENT) {
    return entry.photos.length > 0 ? "사진만 남긴 하루" : "짧은 하루를 남겼어요";
  }
  return trimmed;
}

/** Body text for growth-book pages — omit placeholder / empty comments. */
export function diaryBookBody(entry: Pick<DiaryEntry, "comment">): string | undefined {
  const trimmed = entry.comment.trim();
  if (!trimmed || trimmed === DIARY_PHOTO_ONLY_COMMENT) return undefined;
  return trimmed;
}

export function diaryPhotoCount(entries: Pick<DiaryEntry, "photos">[]): number {
  return entries.reduce((sum, e) => sum + e.photos.length, 0);
}

export function diaryMilestoneLabel(
  entry: Pick<DiaryEntry, "milestoneTag" | "customMilestoneTag">,
): string | null {
  return entry.milestoneTag || entry.customMilestoneTag || null;
}

export function diaryHasMilestone(
  entry: Pick<DiaryEntry, "milestoneTag" | "customMilestoneTag">,
): boolean {
  return !!diaryMilestoneLabel(entry);
}

/** Chronological (oldest → newest) for growth-book reading order. */
export function sortGrowthBookEntries(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort((a, b) => {
    const ka = a.dateKey ?? "";
    const kb = b.dateKey ?? "";
    if (ka && kb && ka !== kb) return ka < kb ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

function resolveMilestone(raw: Record<string, unknown>): {
  milestoneTag: string | null;
  customMilestoneTag: string | null;
} {
  const milestoneTag = typeof raw.milestoneTag === "string" ? raw.milestoneTag : null;
  const customMilestoneTag =
    typeof raw.customMilestoneTag === "string" ? raw.customMilestoneTag : null;
  if (milestoneTag || customMilestoneTag) {
    return { milestoneTag, customMilestoneTag };
  }
  const growth = typeof raw.growthMoment === "string" ? raw.growthMoment : null;
  if (!growth) return { milestoneTag: null, customMilestoneTag: null };
  if ((DIARY_GROWTH_MOMENTS as readonly string[]).includes(growth)) {
    return { milestoneTag: growth, customMilestoneTag: null };
  }
  return { milestoneTag: null, customMilestoneTag: growth };
}

/** Normalize any stored / legacy diary blob into the canonical DiaryEntry shape. */
export function migrateDiaryEntry(raw: unknown, fallbackBabyId = "baby-1"): DiaryEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.id !== "string") return null;

  const comment = typeof d.comment === "string" ? d.comment : "";
  const date = typeof d.date === "string" ? d.date : "";
  if (!date && !comment && !Array.isArray(d.photos) && !d.photoUri) return null;

  const photos: string[] = Array.isArray(d.photos)
    ? (d.photos as unknown[]).filter((p): p is string => typeof p === "string" && !!p)
    : typeof d.photoUri === "string" && d.photoUri
      ? [d.photoUri]
      : [];

  const weatherRaw =
    (typeof d.weatherStamp === "string" ? d.weatherStamp : null) ??
    (typeof d.weatherEmoji === "string" ? d.weatherEmoji : null);
  const moodRaw =
    (typeof d.moodStamp === "string" ? d.moodStamp : null) ??
    (typeof d.emoji === "string" ? d.emoji : null);

  const { milestoneTag, customMilestoneTag } = resolveMilestone(d);
  const now = new Date().toISOString();
  const source: DiarySource = d.source === "notification" ? "notification" : "manual";
  const draftStatus: DiaryDraftStatus = d.draftStatus === "draft" ? "draft" : "saved";

  return {
    id: d.id,
    babyId: typeof d.babyId === "string" && d.babyId ? d.babyId : fallbackBabyId,
    date: date || "날짜 없음",
    dateKey: typeof d.dateKey === "string" && d.dateKey ? d.dateKey : formatDateKey(),
    photos,
    coverStyleId: isDiaryCoverTemplateId(d.coverStyleId) ? d.coverStyleId : DEFAULT_DIARY_COVER_TEMPLATE_ID,
    pageStyleId: isDiaryPageTemplateId(d.pageStyleId) ? d.pageStyleId : DEFAULT_DIARY_PAGE_TEMPLATE_ID,
    coverPhotoUri: typeof d.coverPhotoUri === "string" && photos.includes(d.coverPhotoUri) ? d.coverPhotoUri : photos[0] ?? null,
    coverPhotoTransform: {
      scale: Math.max(1, Math.min(3, typeof (d.coverPhotoTransform as { scale?: unknown } | undefined)?.scale === "number" ? (d.coverPhotoTransform as { scale: number }).scale : 1)),
      translateX: Math.max(-1, Math.min(1, typeof (d.coverPhotoTransform as { translateX?: unknown } | undefined)?.translateX === "number" ? (d.coverPhotoTransform as { translateX: number }).translateX : 0)),
      translateY: Math.max(-1, Math.min(1, typeof (d.coverPhotoTransform as { translateY?: unknown } | undefined)?.translateY === "number" ? (d.coverPhotoTransform as { translateY: number }).translateY : 0)),
    },
    coverTitle: typeof d.coverTitle === "string" ? d.coverTitle : "",
    comment,
    weatherStamp: normalizeDiarySkyOptional(weatherRaw),
    moodStamp: normalizeDiaryMoodOptional(moodRaw),
    careLogSummarySnapshot:
      (typeof d.careLogSummarySnapshot === "string" && d.careLogSummarySnapshot) ||
      (typeof d.careLogSnapshot === "string" && d.careLogSnapshot) ||
      "",
    stageLabelSnapshot: typeof d.stageLabelSnapshot === "string" && d.stageLabelSnapshot.trim()
      ? d.stageLabelSnapshot.trim()
      : null,
    momentSuggestionsUsed: Array.isArray(d.momentSuggestionsUsed)
      ? (d.momentSuggestionsUsed as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    milestoneTag,
    customMilestoneTag,
    includedInGrowthBook: !!(d.includedInGrowthBook ?? d.inGrowthBook),
    stickerIds: Array.isArray(d.stickerIds)
      ? (d.stickerIds as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    createdBy: d.createdBy as DiaryEntry["createdBy"],
    createdAt: typeof d.createdAt === "string" ? d.createdAt : now,
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : now,
    source,
    draftStatus,
  };
}
