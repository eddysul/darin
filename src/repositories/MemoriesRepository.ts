import { requireSupabase } from "../lib/supabase";
import type {
  MemoryCommentRow,
  MemoryMediaRow,
  MemoryPostRow,
  MemoryReactionRow,
} from "../types/database";
import type {
  AddMemoryCommentInput,
  AddMemoryMediaInput,
  CreateMemoryPostInput,
  MemoryComment,
  MemoryMedia,
  MemoryPost,
  MemoryReaction,
  SetMemoryReactionInput,
  UpdateMemoryPostInput,
} from "../types/memory";
import { createId } from "../utils/id";
import { AuthRepository } from "./AuthRepository";

const MEMORIES_BUCKET = "memories";

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
        caption: input.caption ?? null,
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
    if (input.caption !== undefined) changes.caption = input.caption;
    if (input.privacyType !== undefined) changes.privacy_type = input.privacyType;
    if (Object.keys(changes).length === 0) {
      const existing = await this.getById(input.memoryPostId);
      if (!existing) throw new Error("Memory post not found or not accessible.");
      return existing;
    }

    const sb = requireSupabase();
    const { data, error } = await sb
      .from("memory_posts")
      .update(changes)
      .eq("id", input.memoryPostId)
      .select("*")
      .single();
    if (error) throw error;
    return memoryPostRowToModel(data);
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
    const sb = requireSupabase();
    const authorId = await requireUserId();
    const { data, error } = await sb
      .from("memory_comments")
      .insert({
        id: input.id ?? createId(),
        memory_post_id: input.memoryPostId,
        author_id: authorId,
        body: input.body,
      })
      .select("*")
      .single();
    if (error) throw error;
    return memoryCommentRowToModel(data);
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
    return memoryReactionRowToModel(data);
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

  async createSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
    const sb = requireSupabase();
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
};
