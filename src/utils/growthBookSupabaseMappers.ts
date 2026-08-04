import type {
  GrowthBookCommentRow,
  GrowthBookPageRow,
  GrowthBookRow,
  Json,
} from "../types/database";
import type {
  GrowthBookComment,
  GrowthBookEdit,
  GrowthBookLetter,
  GrowthBookPageEdit,
  GrowthBookServerBook,
  GrowthBookServerPage,
  RelationshipLabel,
} from "../types/growthBook";
import { createEmptyGrowthBookEdit } from "../types/growthBook";

export const GROWTH_BOOK_MEDIA_REF_PREFIX = "growth-book-media://";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function relationship(value: unknown): RelationshipLabel {
  const allowed: RelationshipLabel[] = ["엄마", "아빠", "보호자", "시터", "할머니", "할아버지", "가족", "기타"];
  return typeof value === "string" && allowed.includes(value as RelationshipLabel)
    ? value as RelationshipLabel
    : "가족";
}

export function growthBookRowToModel(row: GrowthBookRow): GrowthBookServerBook {
  return {
    id: row.id,
    babyId: row.baby_id,
    title: row.title,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function growthBookPageRowToModel(row: GrowthBookPageRow): GrowthBookServerPage {
  return {
    id: row.id,
    growthBookId: row.growth_book_id,
    babyId: row.baby_id,
    pageType: row.page_type,
    diaryEntryId: row.diary_entry_id,
    pageOrder: row.page_order,
    layoutType: row.layout_type,
    content: record(row.content_json),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mediaStorageRef(storagePath: string): string {
  return `${GROWTH_BOOK_MEDIA_REF_PREFIX}${storagePath}`;
}

export function mediaStoragePath(value: string | null | undefined): string | null {
  return value?.startsWith(GROWTH_BOOK_MEDIA_REF_PREFIX)
    ? value.slice(GROWTH_BOOK_MEDIA_REF_PREFIX.length)
    : null;
}

export function isLocalGrowthBookImage(uri: string | null | undefined): uri is string {
  return !!uri && !/^https?:\/\//i.test(uri) && !mediaStoragePath(uri);
}

export function coverPageContent(edit: GrowthBookEdit, coverPhotoRef: string | null): Record<string, Json> {
  return {
    schemaVersion: 1,
    coverTitle: edit.coverTitle,
    coverSubtitle: edit.coverSubtitle ?? null,
    coverDateRange: edit.coverDateRange ?? null,
    coverPhotoRef,
  };
}

export function diaryPageContent(page: GrowthBookPageEdit, photoRefs: string[]): Record<string, Json> {
  return {
    schemaVersion: 1,
    diaryId: page.diaryId,
    photos: photoRefs,
    photoLayout: page.photoLayout,
    photoLayoutTuning: (page.photoLayoutTuning ?? null) as Json,
    pageComment: page.pageComment ?? null,
    pageStickers: (page.pageStickers ?? []) as unknown as Json,
    commentStickers: (page.commentStickers ?? []) as unknown as Json,
    rollingComments: page.rollingComments as unknown as Json,
    stickerIds: (page.stickerIds ?? []) as Json,
  };
}

export function letterPageContent(letters: GrowthBookLetter[]): Record<string, Json> {
  return { schemaVersion: 1, letters: letters as unknown as Json };
}

function commentRowToRolling(row: GrowthBookCommentRow): GrowthBookComment {
  const metadata = record(row.metadata);
  return {
    id: row.id,
    pageId: stringValue(metadata.clientPageId) ?? row.diary_entry_id ?? row.page_id ?? "",
    authorId: stringValue(metadata.clientAuthorId) ?? row.author_id,
    authorName: stringValue(metadata.authorName) ?? "가족",
    authorRelationshipLabel: relationship(metadata.authorRelationshipLabel),
    text: row.body,
    stickerIds: Array.isArray(metadata.stickerIds)
      ? metadata.stickerIds.filter((item): item is string => typeof item === "string")
      : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function commentRowToLetter(row: GrowthBookCommentRow, growthBookId: string): GrowthBookLetter {
  const metadata = record(row.metadata);
  return {
    id: row.id,
    growthBookId,
    authorId: stringValue(metadata.clientAuthorId) ?? row.author_id,
    authorName: stringValue(metadata.authorName) ?? "가족",
    authorRelationshipLabel: relationship(metadata.authorRelationshipLabel),
    text: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function growthBookRowsToEdit(input: {
  book: GrowthBookRow;
  pages: GrowthBookPageRow[];
  comments: GrowthBookCommentRow[];
  babyName: string;
  signedUrlForPath: (storagePath: string) => Promise<string | null>;
}): Promise<GrowthBookEdit> {
  const edit = createEmptyGrowthBookEdit({ babyId: input.book.baby_id, babyName: input.babyName });
  edit.id = input.book.id;
  edit.updatedAt = input.book.updated_at;
  const pagesById = new Map(input.pages.map((page) => [page.id, page]));
  const cover = input.pages.find((page) => page.page_type === "cover");
  if (cover) {
    const content = record(cover.content_json);
    const savedCoverTitle = stringValue(content.coverTitle) ?? input.book.title;
    edit.coverTitle = savedCoverTitle?.trim() && savedCoverTitle.trim() !== "의 성장책"
      ? savedCoverTitle
      : `${input.babyName}의 성장책`;
    edit.coverSubtitle = stringValue(content.coverSubtitle);
    edit.coverDateRange = stringValue(content.coverDateRange);
    const ref = stringValue(content.coverPhotoRef);
    const path = mediaStoragePath(ref);
    edit.coverPhotoUri = path ? await input.signedUrlForPath(path) : ref ?? null;
  }

  for (const row of input.pages.filter((page) => page.page_type === "diary" && page.diary_entry_id)) {
    const content = record(row.content_json);
    const refs = Array.isArray(content.photos)
      ? content.photos.filter((item): item is string => typeof item === "string")
      : [];
    const photos: string[] = [];
    for (const ref of refs) {
      const path = mediaStoragePath(ref);
      const resolved = path ? await input.signedUrlForPath(path) : ref;
      if (resolved) photos.push(resolved);
    }
    const hasPhotoOverride = Array.isArray(content.photos);
    edit.pages[row.diary_entry_id!] = {
      diaryId: row.diary_entry_id!,
      photos: hasPhotoOverride ? photos : undefined,
      photoLayout: (stringValue(content.photoLayout) ?? row.layout_type ?? "single_large") as GrowthBookPageEdit["photoLayout"],
      photoLayoutTuning: record(content.photoLayoutTuning) as GrowthBookPageEdit["photoLayoutTuning"],
      pageComment: content.pageComment === null ? undefined : stringValue(content.pageComment),
      pageStickers: Array.isArray(content.pageStickers) ? content.pageStickers as unknown as GrowthBookPageEdit["pageStickers"] : [],
      commentStickers: Array.isArray(content.commentStickers) ? content.commentStickers as unknown as GrowthBookPageEdit["commentStickers"] : [],
      rollingComments: Array.isArray(content.rollingComments) ? content.rollingComments as unknown as GrowthBookComment[] : [],
      stickerIds: Array.isArray(content.stickerIds)
        ? content.stickerIds.filter((item): item is string => typeof item === "string")
        : [],
    };
  }

  const letterPage = input.pages.find((page) => page.page_type === "letter");
  if (letterPage) {
    const content = record(letterPage.content_json);
    if (Array.isArray(content.letters)) edit.letters = content.letters as unknown as GrowthBookLetter[];
  }
  for (const row of input.comments.filter((comment) => comment.deleted_at === null)) {
    if (row.comment_type === "letter") {
      const letter = commentRowToLetter(row, input.book.id);
      edit.letters = [...edit.letters.filter((item) => item.id !== letter.id), letter];
    } else if (row.comment_type === "rolling_paper" && row.diary_entry_id) {
      const page = edit.pages[row.diary_entry_id];
      if (page && pagesById.has(row.page_id ?? "")) {
        const comment = commentRowToRolling(row);
        page.rollingComments = [...page.rollingComments.filter((item) => item.id !== comment.id), comment];
      }
    }
  }
  return edit;
}
