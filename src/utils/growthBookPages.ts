import type { DiaryEntry } from "../types/babyLog";
import type {
  GrowthBookComment,
  GrowthBookCommentSticker,
  GrowthBookEdit,
  GrowthBookLetter,
  GrowthBookPageEdit,
  GrowthBookPageSticker,
  PhotoLayout,
  PhotoLayoutTuning,
} from "../types/growthBook";
import { getPhotoLayoutCount, normalizePhotoLayout } from "./growthBookPhotoLayouts";
import {
  diaryBookBody,
  diaryMilestoneLabel,
  diaryPrimaryPhoto,
  sortGrowthBookEntries,
} from "./diaryModel";
import {
  resolveGrowthBookCoverTemplateId,
  resolveGrowthBookLetterTemplateId,
  resolveGrowthBookPageTemplateId,
} from "./growthBookTemplates";
import { formatGrowthAuthorLabel } from "../types/growthBook";
import type { Translate } from "./recordDisplay";
import type { DiaryCoverTemplateId } from "../constants/diaryCoverTemplates";
import type { DiaryPageTemplateId } from "../constants/diaryPageTemplates";

export type GrowthBookPageKind = "cover" | "moment" | "photo" | "letter";
export type GrowthBookPageType = "cover" | "diary" | "final_letter";

export type GrowthBookPageMeta = {
  id: string;
  pageType: GrowthBookPageType;
  order: number;
  linkedDiaryEntryId?: string;
  title: string;
  dataRef: string;
};

export type GrowthBookPage = {
  id: string;
  kind: GrowthBookPageKind;
  pageType: GrowthBookPageType;
  title: string;
  subtitle?: string;
  body?: string;
  /** @deprecated prefer photoUris — kept for simple single-photo spots */
  photoUri?: string | null;
  photoUris?: string[];
  photoLayout?: PhotoLayout;
  photoLayoutTuning?: PhotoLayoutTuning;
  /** @deprecated use photoLayout */
  layout?: PhotoLayout;
  dateLabel?: string;
  moodStamp?: string | null;
  weatherStamp?: string | null;
  milestone?: string | null;
  diaryId?: string;
  rollingComments?: GrowthBookComment[];
  letters?: GrowthBookLetter[];
  pageStickers?: GrowthBookPageSticker[];
  commentStickers?: GrowthBookCommentSticker[];
  stickerIds?: string[];
  coverTemplateId?: DiaryCoverTemplateId;
  pageTemplateId?: DiaryPageTemplateId;
};

function legacyPageStickers(pageId: string, stickerIds: string[]): GrowthBookPageSticker[] {
  return stickerIds.slice(0, 3).map((stickerId, index) => ({
    id: `legacy-${pageId}-${index}-${stickerId}`,
    pageId,
    stickerId,
    xRatio: 0.25 + index * 0.2,
    yRatio: 0.8,
    widthRatio: 0.16,
    zIndex: index + 1,
    createdBy: "legacy",
    createdAt: "",
  }));
}

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
  const hasExplicitPhotos = existing?.photosOverridden === true || (existing?.photos?.length ?? 0) > 0;
  const photos = hasExplicitPhotos ? existing?.photos ?? [] : diary.photos ?? [];
  const legacyStickerIds = Array.isArray(existing?.stickerIds) ? existing.stickerIds : [];
  const photoLayout = normalizePhotoLayout(existing?.photoLayout ?? existing?.layout, photos.length);
  return {
    diaryId,
    photos,
    photosOverridden: existing?.photosOverridden,
    photoLayout,
    photoLayoutTuning: existing?.photoLayoutTuning,
    layout: existing?.layout,
    pageComment: existing?.pageComment,
    pageStickers: Array.isArray(existing?.pageStickers)
      ? existing.pageStickers
      : legacyPageStickers(diaryId, legacyStickerIds),
    commentStickers: Array.isArray(existing?.commentStickers) ? existing.commentStickers : [],
    rollingComments: existing?.rollingComments ?? [],
    stickerIds: legacyStickerIds,
    pageTemplateId: resolveGrowthBookPageTemplateId(
      existing?.pageTemplateId ?? diary.pageStyleId ?? edit?.pageTemplateId,
    ),
  };
}

export function resolvePagePhotos(diary: DiaryEntry, pageEdit: GrowthBookPageEdit): string[] {
  const photos = pageEdit.photos ?? diary.photos ?? [];
  return photos.filter(Boolean);
}

export function resolveGrowthBookCoverPhoto(
  entries: DiaryEntry[],
  edit?: GrowthBookEdit | null,
): string | null {
  if (edit?.coverPhotoUri) return edit.coverPhotoUri;
  const sorted = sortGrowthBookEntries(entries.filter((entry) => entry.includedInGrowthBook));
  return (
    sorted
      .map((entry) => resolvePagePhotos(entry, resolvePageEdit(entry.id, entry, edit ?? null))[0] ?? diaryPrimaryPhoto(entry))
      .find(Boolean) ?? null
  );
}

/** Photo total for the growth book after page-level add/remove overrides are applied. */
export function growthBookPhotoCount(
  entries: DiaryEntry[],
  edit?: GrowthBookEdit | null,
): number {
  return entries
    .filter((entry) => entry.includedInGrowthBook)
    .reduce(
      (total, entry) => total + resolvePagePhotos(entry, resolvePageEdit(entry.id, entry, edit)).length,
      0,
    );
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
  t?: Translate;
}): GrowthBookPage[] {
  const sorted = sortGrowthBookEntries(input.entries.filter((e) => e.includedInGrowthBook));
  const pages: GrowthBookPage[] = [];
  const edit = input.edit ?? null;
  const t = input.t;
  const defaultKoCoverTitle = `${input.babyName}의 성장책`;

  const defaultCoverPhoto =
    edit?.coverPhotoUri ??
    sorted.map((e) => {
      const pe = resolvePageEdit(e.id, e, edit);
      return resolvePagePhotos(e, pe)[0] ?? diaryPrimaryPhoto(e);
    }).find(Boolean) ??
    null;

  const storedCoverTitle = edit?.coverTitle?.trim();
  const storedCoverSubtitle = edit?.coverSubtitle?.trim();
  pages.push({
    id: "cover",
    kind: "cover",
    pageType: "cover",
    title:
      storedCoverTitle && storedCoverTitle !== defaultKoCoverTitle
        ? storedCoverTitle
        : t
          ? t("growth.critical.139", { babyName: input.babyName })
          : storedCoverTitle || defaultKoCoverTitle,
    subtitle:
      storedCoverSubtitle && storedCoverSubtitle !== "성장책"
        ? storedCoverSubtitle
        : t
          ? t("growth.critical.013")
          : storedCoverSubtitle || "성장책",
    photoUri: defaultCoverPhoto,
    photoUris: defaultCoverPhoto ? [defaultCoverPhoto] : [],
    dateLabel: edit?.coverDateRange?.trim() || formatRange(sorted) || `${new Date().getFullYear()}`,
    coverTemplateId: resolveGrowthBookCoverTemplateId(edit?.coverTemplateId),
  });

  for (const entry of sorted) {
    const pageEdit = resolvePageEdit(entry.id, entry, edit);
    const photos = resolvePagePhotos(entry, pageEdit);
    const milestone = diaryMilestoneLabel(entry, t);
    const kind: GrowthBookPageKind = photos.length > 0 && !milestone ? "photo" : "moment";
    const photoLayout = pageEdit.photoLayout;

    pages.push({
      id: `entry-${entry.id}`,
      kind,
      pageType: "diary",
      diaryId: entry.id,
      title: milestone ?? (t ? t("growth.critical.165", { babyName: input.babyName }) : `${input.babyName}의 하루`),
      subtitle: milestone
        ? t
          ? t("growth.critical.166")
          : "성장 순간"
        : photos.length
          ? t
            ? t("growth.critical.021")
            : "사진"
          : t
            ? t("growth.critical.167")
            : "일기",
      body: resolvePageBody(entry, pageEdit),
      photoUri: photos[0] ?? null,
      photoUris: photos.slice(0, getPhotoLayoutCount(photoLayout)),
      photoLayout,
      photoLayoutTuning: pageEdit.photoLayoutTuning,
      layout: photoLayout,
      dateLabel: entry.date,
      moodStamp: entry.moodStamp,
      weatherStamp: entry.weatherStamp,
      milestone,
      rollingComments: pageEdit.rollingComments,
      pageStickers: pageEdit.pageStickers ?? [],
      commentStickers: pageEdit.commentStickers ?? [],
      stickerIds: (pageEdit.pageStickers ?? []).map((item) => item.stickerId),
      pageTemplateId: pageEdit.pageTemplateId,
    });
  }

  const letters = edit?.letters ?? [];
  const letterBody =
    letters.length > 0
      ? letters
          .map((letter) => {
            const author = formatGrowthAuthorLabel(letter.authorRelationshipLabel, letter.authorName, t);
            const heading = t
              ? t("growth.critical.057", { author, babyName: input.babyName })
              : `${letter.authorRelationshipLabel} ${letter.authorName}가 ${input.babyName}에게`;
            return `${heading}\n\n${letter.text}`;
          })
          .join("\n\n————————\n\n")
      : sorted.length > 0
        ? t
          ? t("growth.critical.172", { babyName: input.babyName, count: sorted.length })
          : `${input.babyName}야,\n\n이 책에 담긴 ${sorted.length}개의 순간은 우리가 함께 웃고, 울고, 성장한 날들이야.\n\n앞으로도 너의 하루하루를 소중히 남겨둘게.\n\n사랑해.`
        : t
          ? t("growth.critical.173", { babyName: input.babyName })
          : `${input.babyName}야,\n\n앞으로의 소중한 순간들을 이 책에 하나씩 담아갈게.\n\n사랑해.`;

  pages.push({
    id: "letter",
    kind: "letter",
    pageType: "final_letter",
    title: t ? t("growth.critical.170") : "사랑하는 너에게",
    subtitle: t ? t("growth.critical.010") : "마지막 편지",
    body: letterBody,
    letters,
    pageTemplateId: resolveGrowthBookLetterTemplateId(edit?.letterTemplateId, edit?.pageTemplateId),
  });

  return pages;
}

/** Ordered adapter used by editor navigation, preview and PDF book flow. */
export function buildGrowthBookPageMeta(pages: GrowthBookPage[], t?: Translate): GrowthBookPageMeta[] {
  let diaryNumber = 0;
  return pages.map((page, order) => {
    if (page.pageType === "diary") diaryNumber += 1;
    return {
      id: page.id,
      pageType: page.pageType,
      order,
      linkedDiaryEntryId: page.diaryId,
      title:
        page.pageType === "cover"
          ? t
            ? t("growth.critical.168")
            : "표지"
          : page.pageType === "final_letter"
            ? t
              ? t("growth.critical.169")
              : "편지"
            : `${diaryNumber}`,
      dataRef: page.diaryId ?? page.id,
    };
  });
}

export type GrowthBookPaginationItem =
  | { type: "page"; index: number; key: string }
  | { type: "ellipsis"; key: string };

/** Keeps cover/current/final-letter reachable without letting a long book dominate the screen. */
export function buildGrowthBookPaginationItems(
  pageCount: number,
  currentPageIndex: number,
  compactThreshold = 7,
): GrowthBookPaginationItem[] {
  if (pageCount <= 0) return [];
  if (pageCount <= compactThreshold) {
    return Array.from({ length: pageCount }, (_, index) => ({ type: "page" as const, index, key: `page-${index}` }));
  }

  const last = pageCount - 1;
  const current = Math.max(0, Math.min(last, currentPageIndex));
  const windowStart = Math.max(1, Math.min(current - 1, last - 3));
  const visible = new Set([0, last, windowStart, windowStart + 1, windowStart + 2]);
  const indices = [...visible].filter((index) => index >= 0 && index <= last).sort((a, b) => a - b);
  const items: GrowthBookPaginationItem[] = [];
  indices.forEach((index, itemIndex) => {
    const previous = indices[itemIndex - 1];
    if (previous !== undefined && index - previous > 1) {
      items.push({ type: "ellipsis", key: `ellipsis-${previous}-${index}` });
    }
    items.push({ type: "page", index, key: `page-${index}` });
  });
  return items;
}

export type GrowthBookSwipeDirection = "previous" | "next" | null;

/** Ignores short/vertical gestures so photo taps and vertical sheet movement stay intact. */
export function resolveGrowthBookSwipeDirection(
  dx: number,
  dy: number,
  minimumDistance = 48,
): GrowthBookSwipeDirection {
  if (Math.abs(dx) < minimumDistance || Math.abs(dx) <= Math.abs(dy) * 1.35) return null;
  return dx < 0 ? "next" : "previous";
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
