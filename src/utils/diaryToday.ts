import type { DiaryComposeDraft } from "../constants/diaryCompose";
import type { DiaryEntry } from "../types/babyLog";
import type { DiaryDraft } from "../types/diaryReminder";
import type { TodaySummary } from "./reportAggregates";
import { buildCareLogDailySummary } from "./diaryMomentSuggestions";
import { formatDateKey } from "./dateKey";
import { DIARY_PHOTO_ONLY_COMMENT, diaryHasMilestone } from "./diaryModel";

export type DiaryComposeTarget =
  | { kind: "edit"; entry: DiaryEntry }
  | { kind: "draft"; draft: DiaryDraft }
  | { kind: "new" };

/** Most recent diary saved for the given local dateKey. */
export function findDiaryForDate(entries: DiaryEntry[], dateKey: string): DiaryEntry | undefined {
  const matches = entries.filter((d) => d.dateKey === dateKey && d.draftStatus !== "draft");
  return matches[0]; // diaryEntries are newest-first
}

export function isMeaningfulDiaryDraft(
  draft: Pick<
    DiaryComposeDraft,
    "comment" | "photos" | "milestoneTag" | "customMilestoneTag" | "includedInGrowthBook"
  >,
): boolean {
  return (
    !!draft.comment.trim() ||
    draft.photos.length > 0 ||
    !!draft.milestoneTag ||
    !!draft.customMilestoneTag ||
    !!draft.includedInGrowthBook
  );
}

export function resolveDiaryComposeTarget(input: {
  entries: DiaryEntry[];
  draft: DiaryDraft | null;
  dateKey?: string;
}): DiaryComposeTarget {
  const key = input.dateKey ?? formatDateKey();
  const saved = findDiaryForDate(input.entries, key);
  if (saved) return { kind: "edit", entry: saved };
  if (input.draft && input.draft.dateKey === key) return { kind: "draft", draft: input.draft };
  return { kind: "new" };
}

export function buildDiaryNotificationCopy(input: {
  babyName: string;
  summary: TodaySummary;
}): { title: string; body: string } {
  const { babyName, summary } = input;
  if (summary.totalCount === 0) {
    return {
      title: "오늘 하루 어땠나요?",
      body: `자기 전에 ${babyName}와의 순간을 남겨보세요 ✍️`,
    };
  }
  const snap = buildCareLogDailySummary(summary)
    .replace(/^오늘은 /, "")
    .replace(/가 기록되었어요\.$/, "가 기록됐어요.");
  return {
    title: "오늘의 육아일기를 남겨볼까요?",
    body: snap.endsWith(".") ? snap : `${snap}.`,
  };
}

export function draftToComposePrefill(draft: DiaryDraft): DiaryComposeDraft {
  const { dateKey: _dk, updatedAt: _ua, ...rest } = draft;
  return rest;
}

export function entryToComposeDraft(entry: DiaryEntry): DiaryComposeDraft {
  return {
    comment: entry.comment === DIARY_PHOTO_ONLY_COMMENT ? "" : entry.comment,
    photos: [...entry.photos],
    stickerIds: [...(entry.stickerIds ?? [])],
    weatherStamp: entry.weatherStamp,
    moodStamp: entry.moodStamp,
    milestoneTag: entry.milestoneTag,
    customMilestoneTag: entry.customMilestoneTag,
    includedInGrowthBook: entry.includedInGrowthBook,
    careLogSummarySnapshot: entry.careLogSummarySnapshot,
    momentSuggestionsUsed: [...entry.momentSuggestionsUsed],
  };
}

export function filterDiaries(
  entries: DiaryEntry[],
  filter: "all" | "growth" | "book",
): DiaryEntry[] {
  if (filter === "growth") return entries.filter(diaryHasMilestone);
  if (filter === "book") return entries.filter((d) => d.includedInGrowthBook);
  return entries;
}
