import { requireSupabase } from "../lib/supabase";
import type { GrowthBookCommentRow, GrowthBookPageRow, Json } from "../types/database";
import type {
  GrowthBookComment,
  GrowthBookEdit,
  GrowthBookLetter,
  GrowthBookMigrationResult,
  GrowthBookServerBook,
  GrowthBookServerMedia,
  GrowthBookServerPage,
} from "../types/growthBook";
import { createId } from "../utils/id";
import {
  coverPageContent,
  diaryPageContent,
  growthBookPageRowToModel,
  growthBookRowToModel,
  growthBookRowsToEdit,
  isLocalGrowthBookImage,
  letterPageContent,
  mediaStoragePath,
  mediaStorageRef,
} from "../utils/growthBookSupabaseMappers";
import { AuthRepository } from "./AuthRepository";

const BUCKET = "growth-book-media";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const GROWTH_BOOK_SIGNED_URL_TTL_SECONDS = 600;

type UpsertPageInput = {
  id?: string;
  growthBookId: string;
  babyId: string;
  pageType: GrowthBookPageRow["page_type"];
  diaryEntryId?: string | null;
  pageOrder: number;
  layoutType?: string | null;
  content: Record<string, Json>;
};

type SaveEditResult = GrowthBookMigrationResult & { edit: GrowthBookEdit };

function asRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function clientCommentId(row: GrowthBookCommentRow): string {
  const metadata = asRecord(row.metadata);
  return typeof metadata.clientId === "string" ? metadata.clientId : row.id;
}

function contentType(uri: string): string {
  const path = uri.toLowerCase().split("?")[0];
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".heic")) return "image/heic";
  if (path.endsWith(".heif")) return "image/heif";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function extension(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/heic") return "heic";
  if (type === "image/heif") return "heif";
  if (type === "image/webp") return "webp";
  return "jpg";
}

async function userId(): Promise<string> {
  const user = await AuthRepository.getUser();
  if (!user) throw new Error("Growth Book requires an authenticated user.");
  return user.id;
}

async function existingPageRefs(page: GrowthBookPageRow | undefined): Promise<string[]> {
  if (!page) return [];
  const content = asRecord(page.content_json);
  return Array.isArray(content.photos)
    ? content.photos.filter((item): item is string => typeof item === "string")
    : [];
}

export const GrowthBookRepository = {
  async getBookByBabyId(babyId: string): Promise<GrowthBookServerBook | null> {
    const { data, error } = await requireSupabase().from("growth_books").select("*")
      .eq("baby_id", babyId).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    return data ? growthBookRowToModel(data) : null;
  },

  async getOrCreateBookByBabyId(babyId: string, title?: string): Promise<GrowthBookServerBook> {
    const existing = await this.getBookByBabyId(babyId);
    if (existing) return existing;
    const createdBy = await userId();
    const { data, error } = await requireSupabase().from("growth_books").insert({
      baby_id: babyId,
      title: title ?? null,
      status: "draft",
      created_by: createdBy,
    }).select("*").single();
    if (error) {
      if (error.code === "23505") {
        const raced = await this.getBookByBabyId(babyId);
        if (raced) return raced;
      }
      throw error;
    }
    return growthBookRowToModel(data);
  },

  async listPages(growthBookId: string): Promise<GrowthBookServerPage[]> {
    const { data, error } = await requireSupabase().from("growth_book_pages").select("*")
      .eq("growth_book_id", growthBookId).is("deleted_at", null).order("page_order");
    if (error) throw error;
    return (data ?? []).map(growthBookPageRowToModel);
  },

  async listPageRows(growthBookId: string): Promise<GrowthBookPageRow[]> {
    const { data, error } = await requireSupabase().from("growth_book_pages").select("*")
      .eq("growth_book_id", growthBookId).is("deleted_at", null).order("page_order");
    if (error) throw error;
    return data ?? [];
  },

  async upsertPage(input: UpsertPageInput): Promise<GrowthBookServerPage> {
    const sb = requireSupabase();
    const createdBy = await userId();
    let existing: GrowthBookPageRow | null = null;
    if (input.id) {
      const result = await sb.from("growth_book_pages").select("*").eq("id", input.id)
        .is("deleted_at", null).maybeSingle();
      if (result.error) throw result.error;
      existing = result.data;
    } else if (input.pageType === "diary" && input.diaryEntryId) {
      const result = await sb.from("growth_book_pages").select("*")
        .eq("growth_book_id", input.growthBookId).eq("diary_entry_id", input.diaryEntryId)
        .is("deleted_at", null).maybeSingle();
      if (result.error) throw result.error;
      existing = result.data;
    } else {
      const result = await sb.from("growth_book_pages").select("*")
        .eq("growth_book_id", input.growthBookId).eq("page_type", input.pageType)
        .is("deleted_at", null).maybeSingle();
      if (result.error) throw result.error;
      existing = result.data;
    }
    const columns = {
      page_type: input.pageType,
      diary_entry_id: input.diaryEntryId ?? null,
      page_order: input.pageOrder,
      layout_type: input.layoutType ?? null,
      content_json: input.content,
    };
    const result = existing
      ? await sb.from("growth_book_pages").update(columns).eq("id", existing.id).select("*").single()
      : await sb.from("growth_book_pages").insert({
          id: input.id ?? createId(), growth_book_id: input.growthBookId, baby_id: input.babyId,
          created_by: createdBy, ...columns,
        }).select("*").single();
    if (result.error) throw result.error;
    return growthBookPageRowToModel(result.data);
  },

  async updatePageContent(input: { pageId: string; layoutType?: string | null; content: Record<string, Json> }): Promise<GrowthBookServerPage> {
    const { data, error } = await requireSupabase().from("growth_book_pages").update({
      layout_type: input.layoutType ?? null,
      content_json: input.content,
    }).eq("id", input.pageId).is("deleted_at", null).select("*").single();
    if (error) throw error;
    return growthBookPageRowToModel(data);
  },

  async reorderPages(input: { growthBookId: string; pageIds: string[] }): Promise<void> {
    const sb = requireSupabase();
    const existing = await this.listPageRows(input.growthBookId);
    for (const page of existing) {
      const { error } = await sb.from("growth_book_pages").update({ page_order: page.page_order + 10000 })
        .eq("id", page.id);
      if (error) throw error;
    }
    for (const [pageOrder, pageId] of input.pageIds.entries()) {
      const { error } = await sb.from("growth_book_pages").update({ page_order: pageOrder }).eq("id", pageId);
      if (error) throw error;
    }
  },

  async softDeletePage(pageId: string): Promise<void> {
    const { error } = await requireSupabase().rpc("soft_delete_growth_book_page", { p_page_id: pageId });
    if (error) throw error;
  },

  async addMedia(input: {
    id?: string; growthBookId: string; pageId: string; babyId: string; storagePath: string;
    width?: number; height?: number;
  }): Promise<GrowthBookServerMedia> {
    const expected = `${input.babyId}/${input.growthBookId}/${input.pageId}/`;
    if (!input.storagePath.startsWith(expected)) throw new Error(`Growth Book media path must start with ${expected}`);
    const createdBy = await userId();
    const { data, error } = await requireSupabase().from("growth_book_media").insert({
      id: input.id ?? createId(), growth_book_id: input.growthBookId, page_id: input.pageId,
      baby_id: input.babyId, storage_path: input.storagePath, media_type: "image",
      width: input.width ?? null, height: input.height ?? null, created_by: createdBy,
    }).select("*").single();
    if (error) throw error;
    return {
      id: data.id, growthBookId: data.growth_book_id, pageId: data.page_id!, babyId: data.baby_id,
      storagePath: data.storage_path, width: data.width ?? undefined, height: data.height ?? undefined,
      createdBy: data.created_by, createdAt: data.created_at,
    };
  },

  async uploadGrowthBookMedia(input: {
    growthBookId: string; pageId: string; babyId: string; uri: string; width?: number; height?: number;
  }): Promise<GrowthBookServerMedia> {
    const type = contentType(input.uri);
    const id = createId();
    const storagePath = `${input.babyId}/${input.growthBookId}/${input.pageId}/${id}.${extension(type)}`;
    const response = await fetch(input.uri);
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) throw new Error("선택한 성장책 사진을 읽지 못했어요.");
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("성장책 사진은 25MB 이하만 올릴 수 있어요.");
    const sb = requireSupabase();
    const { error: uploadError } = await sb.storage.from(BUCKET).upload(storagePath, bytes, { contentType: type, upsert: false });
    if (uploadError) throw uploadError;
    try {
      return await this.addMedia({ ...input, id, storagePath });
    } catch (error) {
      await sb.storage.from(BUCKET).remove([storagePath]);
      throw error;
    }
  },

  async createSignedUrl(storagePath: string, expiresIn = GROWTH_BOOK_SIGNED_URL_TTL_SECONDS): Promise<string> {
    const sb = requireSupabase();
    const { data: media, error: mediaError } = await sb.from("growth_book_media").select("id")
      .eq("storage_path", storagePath).single();
    if (mediaError || !media) throw mediaError ?? new Error("Growth Book media not found or not accessible.");
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async listComments(growthBookId: string): Promise<GrowthBookCommentRow[]> {
    const { data, error } = await requireSupabase().from("growth_book_comments").select("*")
      .eq("growth_book_id", growthBookId).is("deleted_at", null).order("created_at");
    if (error) throw error;
    return data ?? [];
  },

  async addComment(input: {
    id?: string; growthBookId: string; pageId?: string | null; diaryEntryId?: string | null;
    babyId: string; body: string; commentType: GrowthBookCommentRow["comment_type"];
    metadata?: Record<string, Json>;
  }): Promise<GrowthBookCommentRow> {
    const authorId = await userId();
    const { data, error } = await requireSupabase().from("growth_book_comments").insert({
      id: input.id ?? createId(), growth_book_id: input.growthBookId, page_id: input.pageId ?? null,
      diary_entry_id: input.diaryEntryId ?? null, baby_id: input.babyId, author_id: authorId,
      body: input.body.trim(), comment_type: input.commentType, metadata: input.metadata ?? {},
    }).select("*").single();
    if (error) throw error;
    return data;
  },

  async deleteComment(commentId: string): Promise<void> {
    const { error } = await requireSupabase().from("growth_book_comments")
      .update({ deleted_at: new Date().toISOString() }).eq("id", commentId);
    if (error) throw error;
  },

  async softDeleteBook(growthBookId: string): Promise<void> {
    const { error } = await requireSupabase().rpc("soft_delete_growth_book", { p_growth_book_id: growthBookId });
    if (error) throw error;
  },

  async hydrate(babyId: string, babyName: string): Promise<GrowthBookEdit | null> {
    const book = await this.getBookByBabyId(babyId);
    if (!book) return null;
    const [pages, comments] = await Promise.all([this.listPageRows(book.id), this.listComments(book.id)]);
    const row = {
      id: book.id, baby_id: book.babyId, title: book.title, status: book.status,
      created_by: book.createdBy, created_at: book.createdAt, updated_at: book.updatedAt, deleted_at: null,
    };
    return growthBookRowsToEdit({
      book: row, pages, comments, babyName,
      signedUrlForPath: async (path) => {
        try { return await this.createSignedUrl(path); } catch { return null; }
      },
    });
  },

  async saveEdit(input: {
    babyId: string; babyName: string; edit: GrowthBookEdit; diaryOrder: string[];
  }): Promise<SaveEditResult> {
    const book = await this.getOrCreateBookByBabyId(input.babyId, input.edit.coverTitle);
    const existing = await this.listPageRows(book.id);
    const sb = requireSupabase();
    const { data: canEdit, error: permissionError } = await sb.rpc("can_edit_growth_book", {
      p_growth_book_id: book.id,
    });
    if (permissionError) throw permissionError;
    if (!canEdit) {
      await this.syncComments(book.id, input.babyId, existing, input.edit);
      const edit = (await this.hydrate(input.babyId, input.babyName)) ?? input.edit;
      return { migrated: true, pagesUploaded: 0, mediaUploaded: 0, mediaFailed: 0, edit };
    }
    for (const page of existing) {
      const { error } = await sb.from("growth_book_pages").update({ page_order: page.page_order + 10000 }).eq("id", page.id);
      if (error) throw error;
    }
    let mediaUploaded = 0;
    let mediaFailed = 0;
    const retainedPageIds = new Set<string>();

    const existingCover = existing.find((page) => page.page_type === "cover");
    const cover = await this.upsertPage({
      id: existingCover?.id, growthBookId: book.id, babyId: input.babyId, pageType: "cover", pageOrder: 0,
      content: coverPageContent(input.edit, null),
    });
    retainedPageIds.add(cover.id);
    let coverRef: string | null = null;
    const oldCover = existingCover ? asRecord(existingCover.content_json) : {};
    const oldCoverRef = typeof oldCover.coverPhotoRef === "string" ? oldCover.coverPhotoRef : null;
    if (input.edit.coverPhotoUri) {
      if (isLocalGrowthBookImage(input.edit.coverPhotoUri)) {
        try {
          const media = await this.uploadGrowthBookMedia({ growthBookId: book.id, pageId: cover.id, babyId: input.babyId, uri: input.edit.coverPhotoUri });
          coverRef = mediaStorageRef(media.storagePath); mediaUploaded += 1;
        } catch { coverRef = oldCoverRef; mediaFailed += 1; }
      } else coverRef = mediaStoragePath(oldCoverRef) ? oldCoverRef : input.edit.coverPhotoUri;
    }
    await this.updatePageContent({ pageId: cover.id, content: coverPageContent(input.edit, coverRef) });

    const orderedDiaryIds = [...input.diaryOrder.filter((id) => input.edit.pages[id]),
      ...Object.keys(input.edit.pages).filter((id) => !input.diaryOrder.includes(id))];
    const diaryPageByEntry = new Map(existing.filter((page) => page.page_type === "diary" && page.diary_entry_id)
      .map((page) => [page.diary_entry_id!, page]));
    for (const [offset, diaryId] of orderedDiaryIds.entries()) {
      const pageEdit = input.edit.pages[diaryId];
      if (!pageEdit) continue;
      const old = diaryPageByEntry.get(diaryId);
      const oldRefs = await existingPageRefs(old);
      const page = await this.upsertPage({
        id: old?.id, growthBookId: book.id, babyId: input.babyId, pageType: "diary",
        diaryEntryId: diaryId, pageOrder: offset + 1, layoutType: pageEdit.photoLayout,
        content: diaryPageContent(pageEdit, []),
      });
      retainedPageIds.add(page.id);
      const refs: string[] = [];
      for (const [index, uri] of (pageEdit.photos ?? []).entries()) {
        if (isLocalGrowthBookImage(uri)) {
          try {
            const media = await this.uploadGrowthBookMedia({ growthBookId: book.id, pageId: page.id, babyId: input.babyId, uri });
            refs.push(mediaStorageRef(media.storagePath)); mediaUploaded += 1;
          } catch {
            if (oldRefs[index]) refs.push(oldRefs[index]);
            mediaFailed += 1;
          }
        } else if (oldRefs[index] && mediaStoragePath(oldRefs[index])) refs.push(oldRefs[index]);
        else refs.push(uri);
      }
      await this.updatePageContent({ pageId: page.id, layoutType: pageEdit.photoLayout, content: diaryPageContent(pageEdit, refs) });
    }

    const existingLetter = existing.find((page) => page.page_type === "letter");
    const letterPage = await this.upsertPage({
      id: existingLetter?.id, growthBookId: book.id, babyId: input.babyId, pageType: "letter",
      pageOrder: orderedDiaryIds.length + 1, content: letterPageContent(input.edit.letters),
    });
    retainedPageIds.add(letterPage.id);
    for (const page of existing) if (!retainedPageIds.has(page.id)) await this.softDeletePage(page.id);

    await this.syncComments(book.id, input.babyId, await this.listPageRows(book.id), input.edit);
    const edit = (await this.hydrate(input.babyId, input.babyName)) ?? input.edit;
    return { migrated: true, pagesUploaded: retainedPageIds.size, mediaUploaded, mediaFailed, edit };
  },

  async syncComments(growthBookId: string, babyId: string, pages: GrowthBookPageRow[], edit: GrowthBookEdit): Promise<void> {
    const remote = await this.listComments(growthBookId);
    const remoteByClientId = new Map(remote.map((row) => [clientCommentId(row), row]));
    const desired: Array<{
      clientId: string; pageId: string | null; diaryId: string | null; type: "rolling_paper" | "letter";
      body: string; value: GrowthBookComment | GrowthBookLetter;
    }> = [];
    const pageByDiary = new Map(pages.filter((page) => page.diary_entry_id).map((page) => [page.diary_entry_id!, page]));
    for (const [diaryId, pageEdit] of Object.entries(edit.pages)) {
      for (const comment of pageEdit.rollingComments) desired.push({
        clientId: comment.id, pageId: pageByDiary.get(diaryId)?.id ?? null, diaryId,
        type: "rolling_paper", body: comment.text, value: comment,
      });
    }
    const letterPage = pages.find((page) => page.page_type === "letter");
    for (const letter of edit.letters) desired.push({
      clientId: letter.id, pageId: letterPage?.id ?? null, diaryId: null,
      type: "letter", body: letter.text, value: letter,
    });
    for (const item of desired) {
      if (!item.body.trim()) continue;
      const current = remoteByClientId.get(item.clientId);
      const metadata = {
        clientId: item.clientId,
        clientAuthorId: item.value.authorId,
        authorName: item.value.authorName,
        authorRelationshipLabel: item.value.authorRelationshipLabel,
        ...(item.type === "rolling_paper" && "stickerIds" in item.value ? { stickerIds: item.value.stickerIds ?? [] } : {}),
      } as Record<string, Json>;
      if (!current) {
        await this.addComment({ growthBookId, babyId, pageId: item.pageId, diaryEntryId: item.diaryId,
          body: item.body, commentType: item.type, metadata });
      } else if (current.body !== item.body || JSON.stringify(current.metadata) !== JSON.stringify(metadata)) {
        const { error } = await requireSupabase().from("growth_book_comments").update({ body: item.body, metadata })
          .eq("id", current.id);
        if (error) throw error;
      }
    }
    const desiredIds = new Set(desired.map((item) => item.clientId));
    for (const row of remote) {
      if (!desiredIds.has(clientCommentId(row))) {
        try {
          await this.deleteComment(row.id);
        } catch {
          // RLS intentionally keeps another member's comment unless the current user is admin.
        }
      }
    }
  },

  async migrateLocalGrowthBook(input: {
    babyId: string; babyName: string; edit: GrowthBookEdit; diaryOrder: string[];
  }): Promise<GrowthBookMigrationResult> {
    const result = await this.saveEdit(input);
    return {
      migrated: result.migrated,
      pagesUploaded: result.pagesUploaded,
      mediaUploaded: result.mediaUploaded,
      mediaFailed: result.mediaFailed,
    };
  },
};
