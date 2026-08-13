import { requireSupabase } from "../lib/supabase";
import type { DiaryEntry } from "../types/babyLog";
import type { DiaryMedia, DiaryMigrationResult } from "../types/diary";
import type { DiaryMediaRow } from "../types/database";
import { createId } from "../utils/id";
import {
  diaryEntryColumns,
  diaryEntryRowToModel,
  diaryMediaRowToModel,
} from "../utils/diarySupabaseMappers";
import { AuthRepository } from "./AuthRepository";

const DIARY_MEDIA_BUCKET = "diary-media";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const DIARY_SIGNED_URL_TTL_SECONDS = 300;

export type DiaryWriteResult = {
  entry: DiaryEntry;
  photoUploadFailed: number;
};

function imageContentType(uri: string): string {
  const normalized = uri.toLowerCase().split("?")[0];
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".heic")) return "image/heic";
  if (normalized.endsWith(".heif")) return "image/heif";
  if (normalized.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function imageExtension(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/heic") return "heic";
  if (contentType === "image/heif") return "heif";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function isRemotePhoto(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

function signedDiaryStoragePath(uri: string): string | null {
  if (!isRemotePhoto(uri)) return null;
  try {
    const marker = `/${DIARY_MEDIA_BUCKET}/`;
    const pathname = decodeURIComponent(new URL(uri).pathname);
    const markerIndex = pathname.indexOf(marker);
    return markerIndex >= 0 ? pathname.slice(markerIndex + marker.length) : null;
  } catch {
    return null;
  }
}

async function requireUserId(): Promise<string> {
  const user = await AuthRepository.getUser();
  if (!user) throw new Error("Diary requires an authenticated user.");
  return user.id;
}

async function signedPhotos(media: DiaryMediaRow[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (const row of media) {
    try {
      const url = await DiaryRepository.createSignedUrl(row.storage_path);
      const current = result.get(row.diary_entry_id) ?? [];
      current.push(url);
      result.set(row.diary_entry_id, current);
    } catch {
      // A broken or concurrently deleted photo must not hide the diary text.
    }
  }
  return result;
}

export const DiaryRepository = {
  async listByBabyId(babyId: string): Promise<DiaryEntry[]> {
    const sb = requireSupabase();
    const { data: rows, error } = await sb
      .from("diary_entries")
      .select("*")
      .eq("baby_id", babyId)
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!rows?.length) return [];
    const ids = rows.map((row) => row.id);
    const { data: media, error: mediaError } = await sb
      .from("diary_media")
      .select("*")
      .in("diary_entry_id", ids)
      .order("created_at", { ascending: true });
    if (mediaError) throw mediaError;
    const photos = await signedPhotos(media ?? []);
    return rows.map((row) => diaryEntryRowToModel(row, photos.get(row.id) ?? []));
  },

  async getById(diaryEntryId: string): Promise<DiaryEntry | null> {
    const sb = requireSupabase();
    const { data: row, error } = await sb
      .from("diary_entries")
      .select("*")
      .eq("id", diaryEntryId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    const media = await this.listMedia(diaryEntryId);
    const photos = await signedPhotos(media.map((item) => ({
      id: item.id,
      diary_entry_id: item.diaryEntryId,
      baby_id: item.babyId,
      storage_path: item.storagePath,
      media_type: item.mediaType,
      width: item.width ?? null,
      height: item.height ?? null,
      created_at: item.createdAt,
    })));
    return diaryEntryRowToModel(row, photos.get(row.id) ?? []);
  },

  async create(babyId: string, entry: DiaryEntry): Promise<DiaryEntry> {
    const sb = requireSupabase();
    const authorId = await requireUserId();
    const { data: existing, error: lookupError } = await sb
      .from("diary_entries")
      .select("*")
      .eq("baby_id", babyId)
      .eq("client_generated_id", entry.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return diaryEntryRowToModel(existing);
    const insertRow = {
        id: entry.id,
        baby_id: babyId,
        author_id: authorId,
        client_generated_id: entry.id,
        ...diaryEntryColumns({ ...entry, babyId }),
      };
    const { data, error } = await sb
      .from("diary_entries")
      .insert(insertRow)
      .select("*")
      .single();
    if (error) {
      // A concurrent/retried local migration may win the partial unique index race.
      if (error.code === "23505") {
        const { data: raced, error: racedError } = await sb
          .from("diary_entries")
          .select("*")
          .eq("baby_id", babyId)
          .eq("client_generated_id", entry.id)
          .is("deleted_at", null)
          .single();
        if (!racedError && raced) return diaryEntryRowToModel(raced);
      }
      throw error;
    }
    return diaryEntryRowToModel(data);
  },

  async update(babyId: string, diaryEntryId: string, entry: DiaryEntry): Promise<DiaryEntry> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("diary_entries")
      .update(diaryEntryColumns(entry))
      .eq("baby_id", babyId)
      .eq("id", diaryEntryId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) throw error;
    return diaryEntryRowToModel(data);
  },

  async softDelete(diaryEntryId: string): Promise<void> {
    const sb = requireSupabase();
    const { error } = await sb.rpc("soft_delete_diary_entry", { p_diary_entry_id: diaryEntryId });
    if (error) throw error;
  },

  async listMedia(diaryEntryId: string): Promise<DiaryMedia[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("diary_media")
      .select("*")
      .eq("diary_entry_id", diaryEntryId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(diaryMediaRowToModel);
  },

  async addMedia(input: {
    id?: string;
    diaryEntryId: string;
    babyId: string;
    storagePath: string;
    width?: number;
    height?: number;
  }): Promise<DiaryMedia> {
    const expectedPrefix = `${input.babyId}/${input.diaryEntryId}/`;
    if (!input.storagePath.startsWith(expectedPrefix)) {
      throw new Error(`Diary storage path must start with ${expectedPrefix}`);
    }
    const sb = requireSupabase();
    const { data, error } = await sb.from("diary_media").insert({
      id: input.id ?? createId(),
      diary_entry_id: input.diaryEntryId,
      baby_id: input.babyId,
      storage_path: input.storagePath,
      media_type: "image",
      width: input.width ?? null,
      height: input.height ?? null,
    }).select("*").single();
    if (error) throw error;
    return diaryMediaRowToModel(data);
  },

  async deleteMedia(mediaId: string): Promise<void> {
    const sb = requireSupabase();
    const { data, error } = await sb.from("diary_media").select("*").eq("id", mediaId).single();
    if (error) throw error;
    const { error: removeError } = await sb.storage.from(DIARY_MEDIA_BUCKET).remove([data.storage_path]);
    if (removeError) throw removeError;
    const { error: rowError } = await sb.from("diary_media").delete().eq("id", mediaId);
    if (rowError) throw rowError;
  },

  async createSignedUrl(storagePath: string, expiresInSeconds = DIARY_SIGNED_URL_TTL_SECONDS): Promise<string> {
    const sb = requireSupabase();
    const { data: media, error: mediaError } = await sb
      .from("diary_media")
      .select("id")
      .eq("storage_path", storagePath)
      .single();
    if (mediaError || !media) throw mediaError ?? new Error("Diary media not found or not accessible.");
    const { data, error } = await sb.storage.from(DIARY_MEDIA_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  },

  async uploadLocalPhoto(input: {
    babyId: string;
    diaryEntryId: string;
    photoUri: string;
    width?: number;
    height?: number;
  }): Promise<DiaryMedia> {
    const contentType = imageContentType(input.photoUri);
    const mediaId = createId();
    const storagePath = `${input.babyId}/${input.diaryEntryId}/${mediaId}.${imageExtension(contentType)}`;
    const response = await fetch(input.photoUri);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0) throw new Error("선택한 일기 사진을 읽지 못했어요.");
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("일기 사진은 25MB 이하만 올릴 수 있어요.");
    const sb = requireSupabase();
    const { error: uploadError } = await sb.storage.from(DIARY_MEDIA_BUCKET).upload(storagePath, bytes, {
      contentType,
      upsert: false,
    });
    if (uploadError) throw uploadError;
    try {
      return await this.addMedia({
        id: mediaId,
        diaryEntryId: input.diaryEntryId,
        babyId: input.babyId,
        storagePath,
        width: input.width,
        height: input.height,
      });
    } catch (error) {
      await sb.storage.from(DIARY_MEDIA_BUCKET).remove([storagePath]);
      throw error;
    }
  },

  async replacePhotos(babyId: string, diaryEntryId: string, photoUris: string[]): Promise<number> {
    const existing = await this.listMedia(diaryEntryId);
    if (photoUris.length === 0) {
      for (const media of existing) await this.deleteMedia(media.id);
      return 0;
    }
    const uploaded: DiaryMedia[] = [];
    for (const photoUri of photoUris) {
      try {
        uploaded.push(await this.uploadLocalPhoto({ babyId, diaryEntryId, photoUri }));
      } catch {
        // Keep the previous photo set intact when a replacement upload is incomplete.
        for (const media of uploaded) {
          try {
            await this.deleteMedia(media.id);
          } catch {
            // The DB row still links any cleanup failure, avoiding an untracked object.
          }
        }
        return 1;
      }
    }
    for (const media of existing) await this.deleteMedia(media.id);
    return 0;
  },

  async createWithPhotos(babyId: string, entry: DiaryEntry): Promise<DiaryWriteResult> {
    const created = await this.create(babyId, entry);
    let photoUploadFailed = 0;
    for (const photoUri of entry.photos) {
      try {
        await this.uploadLocalPhoto({ babyId, diaryEntryId: created.id, photoUri });
      } catch {
        photoUploadFailed += 1;
      }
    }
    return { entry: (await this.getById(created.id)) ?? created, photoUploadFailed };
  },

  async updateWithPhotos(babyId: string, entry: DiaryEntry): Promise<DiaryWriteResult> {
    const updated = await this.update(babyId, entry.id, entry);
    const existing = await this.listMedia(entry.id);
    const desiredRemotePaths = new Set(entry.photos.map(signedDiaryStoragePath).filter((path): path is string => Boolean(path)));
    const localPhotos = entry.photos.filter((uri) => !isRemotePhoto(uri));
    const uploaded: DiaryMedia[] = [];
    for (const photoUri of localPhotos) {
      try {
        uploaded.push(await this.uploadLocalPhoto({ babyId, diaryEntryId: entry.id, photoUri }));
      } catch {
        for (const media of uploaded) {
          try { await this.deleteMedia(media.id); } catch { /* keep tracked cleanup failures */ }
        }
        return { entry: (await this.getById(updated.id)) ?? updated, photoUploadFailed: 1 };
      }
    }
    for (const media of existing) {
      if (!desiredRemotePaths.has(media.storagePath)) await this.deleteMedia(media.id);
    }
    return { entry: (await this.getById(updated.id)) ?? updated, photoUploadFailed: 0 };
  },

  async hydrate(babyId: string): Promise<DiaryEntry[]> {
    return this.listByBabyId(babyId);
  },

  async uploadLocalDiaryEntriesMigration(babyId: string, entries: DiaryEntry[]): Promise<DiaryMigrationResult> {
    let uploaded = 0;
    let failed = 0;
    let photoFailed = 0;
    for (const entry of entries) {
      try {
        const created = await this.create(babyId, { ...entry, babyId });
        const existingMedia = await this.listMedia(created.id);
        if (existingMedia.length === 0) {
          for (const photoUri of entry.photos) {
            try {
              await this.uploadLocalPhoto({ babyId, diaryEntryId: created.id, photoUri });
            } catch {
              photoFailed += 1;
            }
          }
        }
        uploaded += 1;
      } catch {
        failed += 1;
      }
    }
    return { uploaded, failed, photoFailed };
  },
};
