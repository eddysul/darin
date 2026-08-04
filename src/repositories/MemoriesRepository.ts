import { requireSupabase } from "../lib/supabase";
import type {
  MemoryCommentRow,
  MemoryMediaRow,
  MemoryPostRow,
  MemoryReactionRow,
  MemorySelectedPersonRow,
  MemoryTagRow,
} from "../types/database";
import type {
  AddMemoryCommentInput,
  AddMemoryMediaInput,
  CreateMemoryPostInput,
  CreateMemoryWithImageInput,
  MemoryCard,
  MemoryComment,
  MemoryMedia,
  MemoryPost,
  MemoryPostBundle,
  MemoryReaction,
  MemoryTag,
  MemoryTagDraft,
  SetMemoryReactionInput,
  UpdateMemoryPostInput,
} from "../types/memory";
import { createId } from "../utils/id";
import { AuthRepository } from "./AuthRepository";
import { NotificationRepository } from "./NotificationRepository";

const MEMORIES_BUCKET = "memories";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const CAPTION_MAX_LENGTH = 1200;
const COMMENT_MAX_LENGTH = 500;
/** Short TTL so revoked viewers lose access soon. Known limitation: old URLs work until expiry. */
export const MEMORY_SIGNED_URL_TTL_SECONDS = 180;

export function memoryPostRowToModel(row: MemoryPostRow): MemoryPost {
  return {
    id: row.id,
    babyId: row.baby_id,
    authorId: row.author_id,
    caption: row.caption ?? undefined,
    privacyType: row.privacy_type,
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
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    createdAt: row.created_at,
  };
}

export function memoryCommentRowToModel(row: MemoryCommentRow): MemoryComment {
  return {
    id: row.id,
    memoryPostId: row.memory_post_id,
    authorId: row.author_id,
    body: row.body,
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
    createdBy: row.created_by,
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

function imageExtension(mimeType?: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/heic" || mimeType === "image/heif") return "heic";
  return "jpg";
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
    const expectedPrefix = `${input.babyId}/${input.memoryPostId}/`;
    if (!input.storagePath.startsWith(expectedPrefix)) {
      throw new Error(`Memory storage path must start with ${expectedPrefix}`);
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
    return (data ?? []).map(memoryCommentRowToModel);
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
  ): Promise<string> {
    const sb = requireSupabase();
    // Gate on memory_media SELECT RLS (can_view_memory_post) before minting a URL.
    const { data: media, error: mediaError } = await sb
      .from("memory_media")
      .select("id")
      .eq("storage_path", storagePath)
      .single();
    if (mediaError || !media) {
      throw mediaError ?? new Error("Memory media not found or not accessible.");
    }

    const { data, error } = await sb.storage
      .from(MEMORIES_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
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
    const posts = await this.listByBabyId(babyId);
    return Promise.all(posts.map(async (post) => {
      const [media, tags, comments, reactions] = await Promise.all([
        this.listMedia(post.id),
        this.listTags(post.id),
        this.listComments(post.id),
        this.listReactions(post.id),
      ]);
      const coverMedia = media[0];
      const coverUrl = coverMedia ? await this.createSignedUrl(coverMedia.storagePath) : undefined;
      return {
        post,
        coverMedia,
        coverUrl,
        tags,
        commentCount: comments.length,
        reactionCount: reactions.length,
      };
    }));
  },

  async createMemoryWithImage(input: CreateMemoryWithImageInput): Promise<MemoryPostBundle> {
    if (input.imageSizeBytes !== undefined && input.imageSizeBytes > MAX_IMAGE_BYTES) {
      throw new Error("사진은 25MB 이하만 올릴 수 있어요.");
    }
    const postId = createId();
    const mediaId = createId();
    const storagePath = `${input.babyId}/${postId}/${mediaId}.${imageExtension(input.mimeType)}`;
    const sb = requireSupabase();
    let objectUploaded = false;
    let postCreated = false;
    try {
      await this.createMemoryPost({
        id: postId,
        babyId: input.babyId,
        caption: input.caption,
        privacyType: input.privacyType,
        selectedUserIds: input.selectedUserIds,
      });
      postCreated = true;
      const response = await fetch(input.imageUri);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength === 0) throw new Error("선택한 사진을 읽지 못했어요.");
      if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("사진은 25MB 이하만 올릴 수 있어요.");
      const { error: uploadError } = await sb.storage.from(MEMORIES_BUCKET).upload(storagePath, bytes, {
        contentType: input.mimeType ?? "image/jpeg",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      objectUploaded = true;
      await this.addMedia({
        id: mediaId,
        memoryPostId: postId,
        babyId: input.babyId,
        storagePath,
        mediaType: "image",
        width: input.width,
        height: input.height,
      });
      await replaceTags(postId, input.tags ?? [{ tagType: "baby", babyId: input.babyId }]);
      const bundle = await this.getBundleById(postId);
      if (!bundle) throw new Error("업로드한 추억을 다시 불러오지 못했어요.");
      return bundle;
    } catch (error) {
      if (objectUploaded) await sb.storage.from(MEMORIES_BUCKET).remove([storagePath]);
      if (postCreated) await sb.from("memory_posts").delete().eq("id", postId);
      throw error;
    }
  },
};
