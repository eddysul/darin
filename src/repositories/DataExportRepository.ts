import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { requireSupabase } from "../lib/supabase";
import { AuthRepository } from "./AuthRepository";

type ExportPayload = {
  schemaVersion: 1;
  exportedAt: string;
  mediaFilesIncluded: false;
  babyId: string;
  data: Record<string, unknown>;
};

function sanitizeUserIdentifiers(value: unknown, currentUserId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeUserIdentifiers(item, currentUserId));
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (["user_id", "author_id", "created_by", "recipient_id", "actor_id", "tagged_user_id"].includes(key)) {
      result[key] = item === null ? null : item === currentUserId ? "self" : "family-member";
    } else {
      result[key] = sanitizeUserIdentifiers(item, currentUserId);
    }
  }
  return result;
}

async function rows(table: string, babyId: string) {
  const { data, error } = await requireSupabase().from(table as never).select("*").eq("baby_id", babyId);
  if (error) throw error;
  return data ?? [];
}

export const DataExportRepository = {
  async buildExport(babyId: string): Promise<ExportPayload> {
    const user = await AuthRepository.getUser();
    if (!user) throw new Error("로그인이 필요해요.");
    const sb = requireSupabase();
    const { data: baby, error: babyError } = await sb.from("babies").select("*").eq("id", babyId).maybeSingle();
    if (babyError) throw babyError;
    if (!baby) throw new Error("내보낼 수 있는 아기 기록이 없어요.");

    const [profileResult, membersResult, careLogs, growthRecords, diaryEntries, diaryMedia,
      growthBooks, growthBookPages, growthBookMedia, growthBookComments, memoryPosts,
      memoryMedia, notificationSettings] = await Promise.all([
      sb.from("profiles").select("id,display_name,avatar_url,preferred_language,created_at,updated_at").eq("id", user.id).maybeSingle(),
      sb.from("baby_members").select("permission_role,relationship_label,status,created_at").eq("baby_id", babyId),
      rows("care_logs", babyId), rows("growth_records", babyId), rows("diary_entries", babyId),
      rows("diary_media", babyId), rows("growth_books", babyId), rows("growth_book_pages", babyId),
      rows("growth_book_media", babyId), rows("growth_book_comments", babyId), rows("memory_posts", babyId),
      rows("memory_media", babyId),
      sb.from("notification_settings").select("*").eq("user_id", user.id).eq("baby_id", babyId),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (membersResult.error) throw membersResult.error;
    if (notificationSettings.error) throw notificationSettings.error;

    const memoryIds = (memoryPosts as Array<{ id: string }>).map((post) => post.id);
    const related = async (table: "memory_tags" | "memory_comments" | "memory_reactions") => {
      if (!memoryIds.length) return [];
      const { data, error } = await sb.from(table).select("*").in("memory_post_id", memoryIds);
      if (error) throw error;
      return data ?? [];
    };
    const [memoryTags, memoryComments, memoryReactions] = await Promise.all([
      related("memory_tags"), related("memory_comments"), related("memory_reactions"),
    ]);

    const payload: ExportPayload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      mediaFilesIncluded: false,
      babyId,
      data: {
        profile: profileResult.data,
        baby,
        familyMembers: membersResult.data ?? [],
        careLogs,
        growthRecords,
        diaryEntries,
        diaryMediaMetadata: diaryMedia,
        growthBooks,
        growthBookPages,
        growthBookMediaMetadata: growthBookMedia,
        growthBookComments,
        memories: memoryPosts,
        memoryMediaMetadata: memoryMedia,
        memoryTags,
        memoryComments,
        memoryReactions,
        notificationSettings: notificationSettings.data ?? [],
      },
    };
    return sanitizeUserIdentifiers(payload, user.id) as ExportPayload;
  },

  async exportAndShare(babyId: string): Promise<string> {
    const payload = await this.buildExport(babyId);
    if (!FileSystem.cacheDirectory) throw new Error("내보내기 파일을 만들 수 없어요.");
    const date = payload.exportedAt.slice(0, 10);
    const uri = `${FileSystem.cacheDirectory}darin-data-${date}.json`;
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (!(await Sharing.isAvailableAsync())) throw new Error("이 기기에서는 공유 기능을 사용할 수 없어요.");
    await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "Darin 데이터 내보내기" });
    return uri;
  },
};
