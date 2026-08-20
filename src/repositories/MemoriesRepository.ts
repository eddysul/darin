import { requireSupabase } from "../lib/supabase";
import type {
  MemoryCommentRow,
  MemoryMediaRow,
  MemoryPostRow,
  MemoryReactionRow,
  MemorySelectedPersonRow,
  MemorySaveRow,
  MemoryTagRow,
} from "../types/database";
import type {
  AddMemoryCommentInput,
  AddMemoryStickerCommentInput,
  AddMemoryMediaInput,
  CreateMemoryPostInput,
  CreateMemoryWithImageInput,
  CreateMemoryWithImagesInput,
  MemoryCard,
  MemoryComment,
  MemoryMedia,
  MemoryPost,
  MemoryPostBundle,
  MemoryReaction,
  MemoryTag,
  MemoryTagDraft,
  SetMemoryReactionInput,
  PublishEagerMemoryInput,
  UpdateMemoryPostInput,
} from "../types/memory";
import { compressImageForUpload } from "../utils/compressImage";
import { bindJobsToMemoryPost, retryEagerPhoto } from "../utils/eagerMediaUpload";
import { createId } from "../utils/id";
import { isAllowedMediaStoragePath } from "../utils/tempMediaPath";
import { AuthRepository } from "./AuthRepository";
import { BabyStickerRepository } from "./BabyStickerRepository";
import { NotificationRepository } from "./NotificationRepository";

const MEMORIES_BUCKET = "memories";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const CAPTION_MAX_LENGTH = 1200;
const COMMENT_MAX_LENGTH = 500;
const UPLOAD_CONCURRENCY = 3;
export const MEMORY_FEED_IMAGE_WIDTH = 800;
export const MEMORY_DETAIL_IMAGE_WIDTH = 1400;
/** Short TTL so revoked viewers lose access soon. Known limitation: old URLs work until expiry. */
export const MEMORY_SIGNED_URL_TTL_SECONDS = 180;

type SignedUrlCacheEntry = { url: string; expiresAt: number };
const signedUrlCache = new Map<string, SignedUrlCacheEntry>();

export function memoryPostRowToModel(row: MemoryPostRow): MemoryPost {
  return {
    id: row.id,
    babyId: row.baby_id,
    authorId: row.author_id ?? "deleted-user",
    caption: row.caption ?? undefined,
    privacyType: row.privacy_type,
    isFamilyMoment: row.is_family_moment ?? false,
    status: row.status ?? "published",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
  };
}

export function memoryMediaRowToModel(row: MemoryMediaRow): MemoryMedia {
  return {
    id: row.id,
    memoryPostId: row.memory_post_id,
    babyId: row.baby_id,
    storagePath: row.storage_path,
    mediaType: row.media_type,
    uploadStatus: row.upload_status ?? "ready",
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    createdAt: row.created_at,
  };
}

export function memoryCommentRowToModel(row: MemoryCommentRow): MemoryComment {
  return {
    id: row.id,
    memoryPostId: row.memory_post_id,
    authorId: row.author_id ?? "deleted-user",
    body: row.body,
    commentType: row.comment_type ?? "text",
    stickerId: row.sticker_id ?? undefined,
    stickerLabel: row.sticker_label ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
  };
}

export function memoryReactionRowToModel(row: MemoryReactionRow): MemoryReaction {
  return {
    id: row.id,
    memoryPostId: row.memory_post_id,
    authorId: row.author_id,
    reactionType: row.reaction_type,
    createdAt: row.created_at,
  };
}

export function memoryTagRowToModel(row: MemoryTagRow): MemoryTag {
  return {
    id: row.id,
    memoryPostId: row.memory_post_id,
    tagType: row.tag_type,
    babyId: row.baby_id ?? undefined,
    taggedUserId: row.tagged_user_id ?? undefined,
    taggedBabyId: row.tagged_baby_id ?? undefined,
    manualLabel: row.manual_label ?? undefined,
    status: row.status,
    createdBy: row.created_by ?? "deleted-user",
    createdAt: row.created_at,
  };
}

function normalizeCaption(caption?: string | null): string | null {
  const value = caption?.trim() ?? "";
  if (value.length > CAPTION_MAX_LENGTH) {
    throw new Error(`설명은 ${CAPTION_MAX_LENGTH}자 이하로 입력해주세요.`);
  }
  return value || null;
}

async function replaceSelectedPeople(memoryPostId: string, userIds: string[]): Promise<void> {
  const sb = requireSupabase();
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const { error: deleteError } = await sb
    .from("memory_selected_people")
    .delete()
    .eq("memory_post_id", memoryPostId);
  if (deleteError) throw deleteError;
  if (uniqueIds.length === 0) return;
  const { error } = await sb.from("memory_selected_people").insert(
    uniqueIds.map((userId) => ({ memory_post_id: memoryPostId, user_id: userId })),
  );
  if (error) throw error;
}

async function replaceTags(memoryPostId: string, tags: MemoryTagDraft[]): Promise<void> {
  const sb = requireSupabase();
  const createdBy = await requireUserId();
  const { error: deleteError } = await sb.from("memory_tags").delete().eq("memory_post_id", memoryPostId);
  if (deleteError) throw deleteError;
  if (tags.length === 0) return;
  const rows = tags.map((tag) => ({
    memory_post_id: memoryPostId,
    tag_type: tag.tagType,
    baby_id: tag.tagType === "baby" ? tag.babyId : null,
    tagged_user_id: tag.tagType === "family_member" ? tag.taggedUserId : null,
    tagged_baby_id: null,
    manual_label: tag.tagType === "manual_guest" ? tag.manualLabel.trim() : null,
    status: "approved" as const,
    created_by: createdBy,
  }));
  const { error } = await sb.from("memory_tags").insert(rows);
  if (error) throw error;
}

async function requireUserId(): Promise<string> {
  const user = await AuthRepository.getUser();
  if (!user) throw new Error("Memories requires an authenticated user.");
  return user.id;
}

async function mapPool<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  }));
  return results;
}

async function uploadMemoryImage(input: {
  memoryPostId: string;
  babyId: string;
  image: CreateMemoryWithImagesInput["images"][number];
}): Promise<MemoryMedia> {
  if (input.image.fileSize !== undefined && input.image.fileSize > MAX_IMAGE_BYTES) {
    throw new Error("사진은 25MB 이하만 올릴 수 있어요.");
  }
  const compressed = await compressImageForUpload(input.image.uri, input.image.width, input.image.height);
  const mediaId = createId();
  const storagePath = `${input.babyId}/${input.memoryPostId}/${mediaId}.jpg`;
  const response = await fetch(compressed.uri);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error("선택한 사진을 읽지 못했어요.");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("사진은 25MB 이하만 올릴 수 있어요.");
  const sb = requireSupabase();
  const { error: uploadError } = await sb.storage.from(MEMORIES_BUCKET).upload(storagePath, bytes, {
    contentType: compressed.mimeType,
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { data, error } = await sb.from("memory_media").insert({
    id: mediaId,
    memory_post_id: input.memoryPostId,
    baby_id: input.babyId,
    storage_path: storagePath,
    media_type: "image",
    upload_status: "ready",
    width: compressed.width,
    height: compressed.height,
  }).select("*").single();
  if (error) {
    await sb.storage.from(MEMORIES_BUCKET).remove([storagePath]);
    throw error;
  }
  return memoryMediaRowToModel(data);
}

async function removeMemoryMedia(media: MemoryMedia): Promise<void> {
  const sb = requireSupabase();
  const { error: storageError } = await sb.storage.from(MEMORIES_BUCKET).remove([media.storagePath]);
  if (storageError) throw storageError;
  const { error: rowError } = await sb.from("memory_media").delete().eq("id", media.id);
  if (rowError) throw rowError;
}

export const MemoriesRepository = {
  async listByBabyId(babyId: string): Promise<MemoryPost[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("memory_posts")
      .select("*")
      .eq("baby_id", babyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(memoryPostRowToModel);
  },

  async getById(memoryPostId: string): Promise<MemoryPost | null> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("memory_posts")
      .select("*")
      .eq("id", memoryPostId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? memoryPostRowToModel(data) : null;
  },

  async createMemoryPost(input: CreateMemoryPostInput): Promise<MemoryPost> {
    const sb = requireSupabase();
    const authorId = await requireUserId();
    const postId = input.id ?? createId();
    const { data, error } = await sb
      .from("memory_posts")
      .insert({
        id: postId,
        baby_id: input.babyId,
        author_id: authorId,
        caption: normalizeCaption(input.caption),
        privacy_type: input.privacyType,
        is_family_moment: input.isFamilyMoment ?? false,
        status: input.status ?? "published",
      })
      .select("*")
      .single();
    if (error) throw error;

    const selectedUserIds = [...new Set(input.selectedUserIds ?? [])];
    if (selectedUserIds.length > 0) {
      const { error: peopleError } = await sb.from("memory_selected_people").insert(
        selectedUserIds.map((userId) => ({
          memory_post_id: postId,
          user_id: userId,
        })),
      );
      if (peopleError) {
        await sb.from("memory_posts").delete().eq("id", postId);
        throw peopleError;
      }
    }

    return memoryPostRowToModel(data);
  },

  async addMedia(input: AddMemoryMediaInput): Promise<MemoryMedia> {
    if (!isAllowedMediaStoragePath(input.babyId, input.memoryPostId, input.storagePath)) {
      throw new Error("Memory storage path is not allowed for this baby.");
    }
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("memory_media")
      .insert({
        id: input.id ?? createId(),
        memory_post_id: input.memoryPostId,
        baby_id: input.babyId,
        storage_path: input.storagePath,
        media_type: input.mediaType ?? "image",
        upload_status: input.uploadStatus ?? "ready",
        width: input.width ?? null,
        height: input.height ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return memoryMediaRowToModel(data);
  },

  async updateMemoryPost(input: UpdateMemoryPostInput): Promise<MemoryPost> {
    const changes: { caption?: string | null; privacy_type?: UpdateMemoryPostInput["privacyType"] } = {};
    if (input.caption !== undefined) changes.caption = normalizeCaption(input.caption);
    if (input.privacyType !== undefined) changes.privacy_type = input.privacyType;
    let post: MemoryPost | null = null;
    if (Object.keys(changes).length > 0) {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("memory_posts")
        .update(changes)
        .eq("id", input.memoryPostId)
        .select("*")
        .single();
      if (error) throw error;
      post = memoryPostRowToModel(data);
    }
    if (input.selectedUserIds !== undefined) {
      await replaceSelectedPeople(input.memoryPostId, input.selectedUserIds);
    }
    if (input.tags !== undefined) {
      await replaceTags(input.memoryPostId, input.tags);
    }
    if (!post) post = await this.getById(input.memoryPostId);
    if (!post) throw new Error("Memory post not found or not accessible.");
    return post;
  },

  async softDeleteMemoryPost(memoryPostId: string): Promise<void> {
    const sb = requireSupabase();
    const { error } = await sb.rpc("soft_delete_memory_post", {
      p_memory_post_id: memoryPostId,
    });
    if (error) throw error;
  },

  async listComments(memoryPostId: string): Promise<MemoryComment[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("memory_comments")
      .select("*")
      .eq("memory_post_id", memoryPostId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const comments = (data ?? []).map(memoryCommentRowToModel);
    const stickerIds = comments.flatMap((comment) => comment.commentType === "sticker" && comment.stickerId ? [comment.stickerId] : []);
    if (!stickerIds.length) return comments;
    try {
      const stickers = await BabyStickerRepository.listByIds(stickerIds);
      const imageById = new Map(stickers.map((sticker) => [sticker.id, sticker.finalStickerImageUri]));
      return comments.map((comment) => comment.stickerId
        ? { ...comment, stickerImageUrl: imageById.get(comment.stickerId) }
        : comment);
    } catch {
      // Text comments and sticker labels stay usable if an image URL refresh fails.
      return comments;
    }
  },

  async addComment(input: AddMemoryCommentInput): Promise<MemoryComment> {
    const body = input.body.trim();
    if (!body) throw new Error("댓글을 입력해주세요.");
    if (body.length > COMMENT_MAX_LENGTH) throw new Error(`댓글은 ${COMMENT_MAX_LENGTH}자 이하로 입력해주세요.`);
    const sb = requireSupabase();
    const authorId = await requireUserId();
    const { data, error } = await sb
      .from("memory_comments")
      .insert({
        id: input.id ?? createId(),
        memory_post_id: input.memoryPostId,
        author_id: authorId,
        body,
        comment_type: "text",
        sticker_id: null,
        sticker_label: null,
      })
      .select("*")
      .single();
    if (error) throw error;
    const comment = memoryCommentRowToModel(data);
    void this.getById(input.memoryPostId).then((post) => post && NotificationRepository.sendPushToBabyMembers({
      eventType: "memory_comment",
      babyId: post.babyId,
      targetId: comment.id,
      routeData: { route: "memory", memoryPostId: input.memoryPostId, babyId: post.babyId },
    })).catch(() => undefined);
    return comment;
  },

  async addStickerComment(input: AddMemoryStickerCommentInput): Promise<MemoryComment> {
    const stickerLabel = input.stickerLabel.trim() || "아기 스티커";
    const sb = requireSupabase();
    const authorId = await requireUserId();
    const { data, error } = await sb.from("memory_comments").insert({
      id: input.id ?? createId(),
      memory_post_id: input.memoryPostId,
      author_id: authorId,
      body: stickerLabel,
      comment_type: "sticker",
      sticker_id: input.stickerId,
      sticker_label: stickerLabel,
    }).select("*").single();
    if (error) throw error;
    const comment = memoryCommentRowToModel(data);
    void this.getById(input.memoryPostId).then((post) => post && NotificationRepository.sendPushToBabyMembers({
      eventType: "memory_comment",
      babyId: post.babyId,
      targetId: comment.id,
      routeData: { route: "memory", memoryPostId: input.memoryPostId, babyId: post.babyId },
    })).catch(() => undefined);
    return comment;
  },

  async saveMemoryPost(memoryPostId: string): Promise<void> {
    const sb = requireSupabase();
    const userId = await requireUserId();
    const post = await this.getById(memoryPostId);
    if (!post) throw new Error("저장할 수 없는 추억이에요.");
    const { error } = await sb.from("memory_saves").insert({
      memory_post_id: memoryPostId,
      baby_id: post.babyId,
      user_id: userId,
    });
    // Saves are immutable under RLS (insert/delete only). Treat a duplicate
    // self-save as idempotent without requiring an UPDATE policy.
    if (error && error.code !== "23505") throw error;
  },

  async unsaveMemoryPost(memoryPostId: string): Promise<void> {
    const sb = requireSupabase();
    const userId = await requireUserId();
    const { error } = await sb.from("memory_saves").delete().eq("memory_post_id", memoryPostId).eq("user_id", userId);
    if (error) throw error;
  },

  async listSavedPostIds(babyId: string): Promise<string[]> {
    const sb = requireSupabase();
    const userId = await requireUserId();
    const { data, error } = await sb.from("memory_saves").select("memory_post_id").eq("baby_id", babyId).eq("user_id", userId);
    if (error) throw error;
    return ((data ?? []) as Pick<MemorySaveRow, "memory_post_id">[]).map((row) => row.memory_post_id);
  },

  async listSavedMemoryPosts(babyId: string): Promise<MemoryPost[]> {
    const savedIds = await this.listSavedPostIds(babyId);
    if (!savedIds.length) return [];
    const sb = requireSupabase();
    const { data, error } = await sb.from("memory_posts").select("*").eq("baby_id", babyId).in("id", savedIds).is("deleted_at", null).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(memoryPostRowToModel);
  },

  async isSaved(memoryPostId: string): Promise<boolean> {
    const sb = requireSupabase();
    const userId = await requireUserId();
    const { data, error } = await sb.from("memory_saves").select("id").eq("memory_post_id", memoryPostId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return Boolean(data);
  },

  async deleteComment(commentId: string): Promise<void> {
    const sb = requireSupabase();
    const { error } = await sb
      .from("memory_comments")
      .delete()
      .eq("id", commentId)
      .select("id")
      .single();
    if (error) throw error;
  },

  async setReaction(input: SetMemoryReactionInput): Promise<MemoryReaction> {
    const sb = requireSupabase();
    const authorId = await requireUserId();
    const { data, error } = await sb
      .from("memory_reactions")
      .upsert(
        {
          memory_post_id: input.memoryPostId,
          author_id: authorId,
          reaction_type: input.reactionType,
        },
        { onConflict: "memory_post_id,author_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    const reaction = memoryReactionRowToModel(data);
    void this.getById(input.memoryPostId).then((post) => post && NotificationRepository.sendPushToBabyMembers({
      eventType: "memory_reaction",
      babyId: post.babyId,
      targetId: `${input.memoryPostId}:${authorId}:${input.reactionType}`,
      routeData: { route: "memory", memoryPostId: input.memoryPostId, babyId: post.babyId },
    })).catch(() => undefined);
    return reaction;
  },

  async removeReaction(memoryPostId: string): Promise<void> {
    const sb = requireSupabase();
    const authorId = await requireUserId();
    const { error } = await sb
      .from("memory_reactions")
      .delete()
      .eq("memory_post_id", memoryPostId)
      .eq("author_id", authorId);
    if (error) throw error;
  },

  async createSignedUrl(
    storagePath: string,
    expiresInSeconds = MEMORY_SIGNED_URL_TTL_SECONDS,
    options?: { width?: number },
  ): Promise<string> {
    const cacheKey = `${storagePath}:${options?.width ?? "full"}`;
    const cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.url;

    const sb = requireSupabase();
    // Gate on memory_media SELECT RLS (can_view_memory_post) before minting a URL.
    const { data: media, error: mediaError } = await sb
      .from("memory_media")
      .select("id, upload_status")
      .eq("storage_path", storagePath)
      .single();
    if (mediaError || !media) {
      throw mediaError ?? new Error("Memory media not found or not accessible.");
    }
    if (media.upload_status && media.upload_status !== "ready") {
      throw new Error("Memory media is not ready.");
    }

    const mint = async (width?: number) => {
      const { data, error } = await sb.storage.from(MEMORIES_BUCKET).createSignedUrl(
        storagePath,
        expiresInSeconds,
        width ? { transform: { width, quality: 75, resize: "contain" } } : undefined,
      );
      if (error || !data?.signedUrl) throw error ?? new Error("Signed URL missing.");
      return data.signedUrl;
    };

    let url: string;
    try {
      url = await mint(options?.width);
    } catch (error) {
      if (!options?.width) throw error;
      url = await mint();
    }
    signedUrlCache.set(cacheKey, {
      url,
      expiresAt: Date.now() + Math.max(20, expiresInSeconds - 20) * 1000,
    });
    return url;
  },

  async listMedia(memoryPostId: string): Promise<MemoryMedia[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("memory_media")
      .select("*")
      .eq("memory_post_id", memoryPostId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(memoryMediaRowToModel);
  },

  async updateMemoryMedia(input: {
    memoryPostId: string;
    babyId: string;
    retainedMediaIds: string[];
    newImages: CreateMemoryWithImagesInput["images"];
  }): Promise<MemoryMedia[]> {
    const existing = await this.listMedia(input.memoryPostId);
    const retained = new Set(input.retainedMediaIds);
    if (retained.size + input.newImages.length === 0) throw new Error("사진을 한 장 이상 추가해 주세요.");
    if (retained.size + input.newImages.length > 5) throw new Error("사진은 최대 5장까지 추가할 수 있어요.");
    const uploaded: MemoryMedia[] = [];
    try {
      for (const image of input.newImages) {
        uploaded.push(await uploadMemoryImage({ memoryPostId: input.memoryPostId, babyId: input.babyId, image }));
      }
    } catch (error) {
      for (const media of uploaded) {
        try { await removeMemoryMedia(media); } catch { /* leave tracked cleanup failures for server cleanup */ }
      }
      throw new Error("새 사진 업로드를 완료하지 못했어요. 기존 사진은 유지했어요.", { cause: error });
    }
    try {
      for (const media of existing) {
        if (!retained.has(media.id)) await removeMemoryMedia(media);
      }
    } catch (error) {
      throw new Error("새 사진은 저장됐지만 일부 사진 삭제를 완료하지 못했어요. 다시 열어 확인해 주세요.", { cause: error });
    }
    return this.listMedia(input.memoryPostId);
  },

  async listTags(memoryPostId: string): Promise<MemoryTag[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("memory_tags")
      .select("*")
      .eq("memory_post_id", memoryPostId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(memoryTagRowToModel);
  },

  async listReactions(memoryPostId: string): Promise<MemoryReaction[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("memory_reactions")
      .select("*")
      .eq("memory_post_id", memoryPostId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(memoryReactionRowToModel);
  },

  async listSelectedPeople(memoryPostId: string): Promise<string[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("memory_selected_people")
      .select("*")
      .eq("memory_post_id", memoryPostId);
    if (error) throw error;
    return ((data ?? []) as MemorySelectedPersonRow[]).map((row) => row.user_id);
  },

  async getBundleById(memoryPostId: string): Promise<MemoryPostBundle | null> {
    const post = await this.getById(memoryPostId);
    if (!post) return null;
    const [media, tags, comments, reactions, selectedUserIds] = await Promise.all([
      this.listMedia(memoryPostId),
      this.listTags(memoryPostId),
      this.listComments(memoryPostId),
      this.listReactions(memoryPostId),
      this.listSelectedPeople(memoryPostId),
    ]);
    return { post, media, tags, comments, reactions, selectedUserIds };
  },

  async listCardsByBabyId(babyId: string): Promise<MemoryCard[]> {
    const [posts, savedPostIds, userId] = await Promise.all([
      this.listByBabyId(babyId),
      this.listSavedPostIds(babyId),
      requireUserId(),
    ]);
    const saved = new Set(savedPostIds);
    return Promise.all(posts.map(async (post) => {
      const [media, tags, comments, reactions] = await Promise.all([
        this.listMedia(post.id),
        this.listTags(post.id),
        this.listComments(post.id),
        this.listReactions(post.id),
      ]);
      const coverMedia = media[0];
      const coverUrl = coverMedia?.uploadStatus === "ready"
        ? await this.createSignedUrl(coverMedia.storagePath, MEMORY_SIGNED_URL_TTL_SECONDS, { width: MEMORY_FEED_IMAGE_WIDTH }).catch(() => undefined)
        : undefined;
      return {
        post,
        coverMedia,
        coverUrl,
        mediaCount: media.length,
        tags,
        commentCount: comments.length,
        reactionCount: reactions.length,
        isLiked: reactions.some((reaction) => reaction.authorId === userId),
        isSaved: saved.has(post.id),
        hasFailedMedia: media.some((item) => item.uploadStatus === "failed"),
      };
    }));
  },

  async createMemoryWithImages(input: CreateMemoryWithImagesInput): Promise<MemoryPostBundle> {
    if (input.images.length === 0) throw new Error("사진을 한 장 이상 추가해 주세요.");
    if (input.images.length > 5) throw new Error("사진은 최대 5장까지 추가할 수 있어요.");
    const postId = createId();
    const sb = requireSupabase();
    const uploaded: MemoryMedia[] = [];
    let postCreated = false;
    try {
      await this.createMemoryPost({
        id: postId,
        babyId: input.babyId,
        caption: input.caption,
        privacyType: input.privacyType,
        isFamilyMoment: input.isFamilyMoment,
        selectedUserIds: input.selectedUserIds,
      });
      postCreated = true;
      await mapPool(input.images, UPLOAD_CONCURRENCY, async (image) => {
        const media = await uploadMemoryImage({ memoryPostId: postId, babyId: input.babyId, image });
        uploaded.push(media);
        return media;
      });
      await replaceTags(postId, input.tags ?? [{ tagType: "baby", babyId: input.babyId }]);
      const bundle = await this.getBundleById(postId);
      if (!bundle) throw new Error("업로드한 추억을 다시 불러오지 못했어요.");
      return bundle;
    } catch (error) {
      for (const media of uploaded) await sb.storage.from(MEMORIES_BUCKET).remove([media.storagePath]);
      if (postCreated) await sb.from("memory_posts").delete().eq("id", postId);
      throw error;
    }
  },

  async publishEagerMemory(input: PublishEagerMemoryInput): Promise<MemoryPostBundle> {
    if (input.photos.length === 0) throw new Error("사진을 한 장 이상 추가해 주세요.");
    if (input.photos.length > 5) throw new Error("사진은 최대 5장까지 추가할 수 있어요.");
    const uploading = input.photos.some((photo) => photo.uploadStatus === "uploading");
    const sb = requireSupabase();
    const post = await this.createMemoryPost({
      id: input.id,
      babyId: input.babyId,
      caption: input.caption,
      privacyType: input.privacyType,
      isFamilyMoment: input.isFamilyMoment,
      selectedUserIds: input.selectedUserIds,
      status: uploading ? "posting" : "published",
    });
    try {
      for (const photo of input.photos) {
        await this.addMedia({
          id: photo.id,
          memoryPostId: post.id,
          babyId: input.babyId,
          storagePath: photo.storagePath,
          uploadStatus: photo.uploadStatus,
          width: photo.width,
          height: photo.height,
        });
      }
      await replaceTags(post.id, input.tags ?? [{ tagType: "baby", babyId: input.babyId }]);
      bindJobsToMemoryPost(input.photos.map((photo) => photo.id), post.id);
    } catch (error) {
      // Drop the half-linked post so the feed never shows a photoless memory and
      // so a retry can reuse the same client id. The storage objects stay put:
      // the retry republishes the very same eager photos.
      try {
        await sb.from("memory_posts").delete().eq("id", post.id);
      } catch {
        // Report the original failure rather than the cleanup failure.
      }
      throw error instanceof Error ? error : new Error("추억 사진을 연결하지 못했어요.");
    }
    const bundle = await this.getBundleById(post.id);
    if (!bundle) throw new Error("올린 추억을 다시 불러오지 못했어요.");
    return bundle;
  },

  async retryFailedMedia(memoryPostId: string): Promise<void> {
    const media = await this.listMedia(memoryPostId);
    for (const item of media) {
      if (item.uploadStatus === "failed") retryEagerPhoto(item.id);
    }
  },

  async cleanupOrphanTempMedia(): Promise<void> {
    try {
      await requireSupabase().rpc("cleanup_orphan_temp_media");
    } catch {
      // Maintenance must not block the feed.
    }
  },

  async createMemoryWithImage(input: CreateMemoryWithImageInput): Promise<MemoryPostBundle> {
    return this.createMemoryWithImages({
      babyId: input.babyId,
      images: [{ uri: input.imageUri, fileSize: input.imageSizeBytes, mimeType: input.mimeType, width: input.width, height: input.height }],
      caption: input.caption,
      privacyType: input.privacyType,
      isFamilyMoment: input.isFamilyMoment,
      selectedUserIds: input.selectedUserIds,
      tags: input.tags,
    });
  },
};
