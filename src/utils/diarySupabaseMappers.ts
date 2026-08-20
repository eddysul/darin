import type { BabyLogActor, DiaryEntry } from "../types/babyLog";
import type { DiaryMedia } from "../types/diary";
import type { DiaryEntryRow, DiaryMediaRow, Json } from "../types/database";
import type { FamilyRole } from "../types/family";
import { migrateDiaryEntry } from "./diaryModel";

type DiaryMetadata = {
  dateLabel?: string;
  careLogSummarySnapshot?: string;
  stageLabelSnapshot?: string | null;
  momentSuggestionsUsed?: string[];
  milestoneTag?: string | null;
  customMilestoneTag?: string | null;
  stickerIds?: string[];
  source?: DiaryEntry["source"];
  draftStatus?: DiaryEntry["draftStatus"];
  authorName?: string;
  authorRole?: FamilyRole;
};

function metadataObject(value: Json): DiaryMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as DiaryMetadata;
}

function validRole(value: unknown): value is FamilyRole {
  return value === "owner" || value === "admin" || value === "editor" || value === "viewer" || value === "caregiver";
}

function entryMetadata(entry: DiaryEntry): Json {
  const metadata: Record<string, Json> = {
    dateLabel: entry.date,
    careLogSummarySnapshot: entry.careLogSummarySnapshot,
    stageLabelSnapshot: entry.stageLabelSnapshot ?? null,
    momentSuggestionsUsed: entry.momentSuggestionsUsed,
    milestoneTag: entry.milestoneTag,
    customMilestoneTag: entry.customMilestoneTag,
    stickerIds: entry.stickerIds ?? [],
    source: entry.source,
    draftStatus: "saved",
  };
  if (entry.createdBy) {
    metadata.authorName = entry.createdBy.name;
    metadata.authorRole = entry.createdBy.role;
  }
  return metadata;
}

export function diaryEntryColumns(entry: DiaryEntry) {
  return {
    entry_date: entry.dateKey,
    title: null,
    body: entry.comment || null,
    mood: entry.moodStamp,
    weather: entry.weatherStamp,
    tags: [entry.milestoneTag, entry.customMilestoneTag].filter((tag): tag is string => !!tag),
    included_in_growth_book: entry.includedInGrowthBook,
    metadata: entryMetadata(entry),
  };
}

function fallbackDateLabel(dateKey: string): string {
  const parts = dateKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return dateKey;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${parts[1]}월 ${parts[2]}일 (${weekdays[date.getDay()]})`;
}

export function diaryEntryRowToModel(row: DiaryEntryRow, photos: string[] = []): DiaryEntry {
  const metadata = metadataObject(row.metadata);
  const createdBy: BabyLogActor = {
    userId: row.author_id ?? "deleted-user",
    name: row.author_id === null
      ? "탈퇴한 사용자"
      : typeof metadata.authorName === "string" && metadata.authorName.trim() ? metadata.authorName : "가족",
    role: validRole(metadata.authorRole) ? metadata.authorRole : "editor",
  };
  const migrated = migrateDiaryEntry({
    id: row.id,
    babyId: row.baby_id,
    date: typeof metadata.dateLabel === "string" ? metadata.dateLabel : fallbackDateLabel(row.entry_date),
    dateKey: row.entry_date,
    photos,
    comment: row.body ?? "",
    weatherStamp: row.weather,
    moodStamp: row.mood,
    careLogSummarySnapshot: typeof metadata.careLogSummarySnapshot === "string" ? metadata.careLogSummarySnapshot : "",
    stageLabelSnapshot: typeof metadata.stageLabelSnapshot === "string" && metadata.stageLabelSnapshot.trim()
      ? metadata.stageLabelSnapshot.trim()
      : null,
    momentSuggestionsUsed: Array.isArray(metadata.momentSuggestionsUsed) ? metadata.momentSuggestionsUsed : [],
    milestoneTag: typeof metadata.milestoneTag === "string" ? metadata.milestoneTag : row.tags[0] ?? null,
    customMilestoneTag: typeof metadata.customMilestoneTag === "string" ? metadata.customMilestoneTag : null,
    includedInGrowthBook: row.included_in_growth_book,
    stickerIds: Array.isArray(metadata.stickerIds) ? metadata.stickerIds : [],
    createdBy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: metadata.source === "notification" ? "notification" : "manual",
    draftStatus: "saved",
  }, row.baby_id);
  if (!migrated) throw new Error(`Invalid diary row: ${row.id}`);
  return migrated;
}

export function diaryMediaRowToModel(row: DiaryMediaRow): DiaryMedia {
  return {
    id: row.id,
    diaryEntryId: row.diary_entry_id,
    babyId: row.baby_id,
    storagePath: row.storage_path,
    mediaType: row.media_type,
    uploadStatus: row.upload_status ?? "ready",
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    createdAt: row.created_at,
  };
}
