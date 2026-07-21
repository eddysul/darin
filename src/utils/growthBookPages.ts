import type { DiaryEntry } from "../types/babyLog";
import type {
  GrowthBookComment,
  GrowthBookEdit,
  GrowthBookLetter,
  GrowthBookPageEdit,
  PhotoLayout,
} from "../types/growthBook";
import { defaultLayoutForPhotoCount } from "../types/growthBook";
import {
  diaryBookBody,
  diaryMilestoneLabel,
  diaryPrimaryPhoto,
  sortGrowthBookEntries,
} from "./diaryModel";

export type GrowthBookPageKind = "cover" | "moment" | "photo" | "letter";

export type GrowthBookPage = {
  id: string;
  kind: GrowthBookPageKind;
  title: string;
  subtitle?: string;
  body?: string;
  /** @deprecated prefer photoUris — kept for simple single-photo spots */
  photoUri?: string | null;
  photoUris?: string[];
  layout?: PhotoLayout;
  dateLabel?: string;
  moodStamp?: string | null;
  weatherStamp?: string | null;
  milestone?: string | null;
  diaryId?: string;
  rollingComments?: GrowthBookComment[];
  letters?: GrowthBookLetter[];
  stickerIds?: string[];
};

function formatRange(entries: DiaryEntry[]): string {
  if (entries.length === 0) return "";
  const keys = entries.map((e) => e.dateKey).filter(Boolean).sort();
  const first = keys[0];
  const last = keys[keys.length - 1];
  const fmt = (k: string) => {
    const [y, m] = k.split("-");
    return `${y}.${m}`;
  };
  if (!first) return "";
  if (first === last) return fmt(first);
  return `${fmt(first)} - ${fmt(last)}`;
}

export function resolvePageEdit(
  diaryId: string,
  diary: DiaryEntry,
  edit: GrowthBookEdit | null | undefined,
): GrowthBookPageEdit {
  const existing = edit?.pages?.[diaryId];
  const photos = existing?.photos ?? diary.photos ?? [];
  return {
    diaryId,
    photos,
    layout: existing?.layout ?? defaultLayoutForPhotoCount(photos.length),
    pageComment: existing?.pageComment,
    rollingComments: existing?.rollingComments ?? [],
    stickerIds: existing?.stickerIds ?? [],
  };
}

export function resolvePagePhotos(diary: DiaryEntry, pageEdit: GrowthBookPageEdit): string[] {
  const photos = pageEdit.photos ?? diary.photos ?? [];
  return photos.filter(Boolean);
}

export function resolvePageBody(diary: DiaryEntry, pageEdit: GrowthBookPageEdit): string {
  if (pageEdit.pageComment !== undefined) return pageEdit.pageComment;
  return diaryBookBody(diary) ?? "";
}

/** Cover + one page per included diary + closing letter(s). Uses GrowthBookEdit overlay. */
export function buildGrowthBookPages(input: {
  babyName: string;
  entries: DiaryEntry[];
  edit?: GrowthBookEdit | null;
}): GrowthBookPage[] {
  const sorted = sortGrowthBookEntries(input.entries.filter((e) => e.includedInGrowthBook));
  const pages: GrowthBookPage[] = [];
  const edit = input.edit ?? null;

  const defaultCoverPhoto =
    edit?.coverPhotoUri ??
    sorted.map((e) => {
      const pe = resolvePageEdit(e.id, e, edit);
      return resolvePagePhotos(e, pe)[0] ?? diaryPrimaryPhoto(e);
    }).find(Boolean) ??
    null;

  pages.push({
    id: "cover",
    kind: "cover",
    title: edit?.coverTitle?.trim() || `${input.babyName}의 성장책`,
    subtitle: "성장책",
    photoUri: defaultCoverPhoto,
    photoUris: defaultCoverPhoto ? [defaultCoverPhoto] : [],
    dateLabel: formatRange(sorted) || `${new Date().getFullYear()}`,
  });

  for (const entry of sorted) {
    const pageEdit = resolvePageEdit(entry.id, entry, edit);
    const photos = resolvePagePhotos(entry, pageEdit);
    const milestone = diaryMilestoneLabel(entry);
    const kind: GrowthBookPageKind = photos.length > 0 && !milestone ? "photo" : "moment";
    const layout = pageEdit.layout;

    pages.push({
      id: `entry-${entry.id}`,
      kind,
      diaryId: entry.id,
      title: milestone ?? `${input.babyName}의 하루`,
      subtitle: milestone ? "성장 순간" : photos.length ? "사진" : "일기",
      body: resolvePageBody(entry, pageEdit),
      photoUri: photos[0] ?? null,
      photoUris: photos.slice(0, layout),
      layout,
      dateLabel: entry.date,
      moodStamp: entry.moodStamp,
      weatherStamp: entry.weatherStamp,
      milestone,
      rollingComments: pageEdit.rollingComments,
      stickerIds: pageEdit.stickerIds ?? [],
    });
  }

  const letters = edit?.letters ?? [];
  const letterBody =
    letters.length > 0
      ? letters
          .map(
            (letter) =>
              `${letter.authorRelationshipLabel} ${letter.authorName}가 ${input.babyName}에게\n\n${letter.text}`,
          )
          .join("\n\n————————\n\n")
      : sorted.length > 0
        ? `${input.babyName}야,\n\n이 책에 담긴 ${sorted.length}개의 순간은 우리가 함께 웃고, 울고, 성장한 날들이야.\n\n앞으로도 너의 하루하루를 소중히 남겨둘게.\n\n사랑해.`
        : `${input.babyName}야,\n\n앞으로의 소중한 순간들을 이 책에 하나씩 담아갈게.\n\n사랑해.`;

  pages.push({
    id: "letter",
    kind: "letter",
    title: "사랑하는 너에게",
    subtitle: "마지막 편지",
    body: letterBody,
    letters,
  });

  return pages;
}

export function estimateGrowthBookPageCount(entryCount: number): number {
  return Math.max(2, entryCount + 2);
}

/** Collect photo URIs already in the book (diary + edits) for cover picker. */
export function collectGrowthBookPhotoPool(
  entries: DiaryEntry[],
  edit: GrowthBookEdit | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (uri?: string | null) => {
    if (!uri || seen.has(uri)) return;
    seen.add(uri);
    out.push(uri);
  };
  if (edit?.coverPhotoUri) push(edit.coverPhotoUri);
  for (const entry of sortGrowthBookEntries(entries.filter((e) => e.includedInGrowthBook))) {
    const pe = resolvePageEdit(entry.id, entry, edit);
    for (const uri of resolvePagePhotos(entry, pe)) push(uri);
    for (const uri of entry.photos ?? []) push(uri);
  }
  return out;
}
