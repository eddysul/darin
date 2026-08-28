import { requireSupabase } from "../lib/supabase";
import type { DiaryEntry } from "../types/babyLog";
import type { DiaryMedia, DiaryMigrationResult } from "../types/diary";
import type { DiaryMediaRow } from "../types/database";
import { compressImageForUpload } from "../utils/compressImage";
import { bindJobsToDiaryEntry, findJobByLocalUri } from "../utils/eagerMediaUpload";
import { createId } from "../utils/id";
import { isAllowedMediaStoragePath } from "../utils/tempMediaPath";
import {
  diaryEntryColumns,
  diaryEntryRowToModel,
  diaryMediaRowToModel,
} from "../utils/diarySupabaseMappers";
import { AuthRepository } from "./AuthRepository";
import { NotificationRepository } from "./NotificationRepository";

const DIARY_MEDIA_BUCKET = "diary-media";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const DIARY_SIGNED_URL_TTL_SECONDS = 300;

export type DiaryWriteResult = {
  entry: DiaryEntry;
  photoUploadFailed: number;
};

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
  const ready = media.filter((row) => !row.upload_status || row.upload_status === "ready");
  const paths = [...new Set(ready.map((row) => row.storage_path))];
  if (!paths.length) return result;
  const { data, error } = await requireSupabase().storage
    .from(DIARY_MEDIA_BUCKET)
    .createSignedUrls(paths, DIARY_SIGNED_URL_TTL_SECONDS);
  if (error) return result;
  const urlByPath = new Map(
    (data ?? [])
      .filter((item): item is typeof item & { path: string; signedUrl: string } => (
        Boolean(item.path && item.signedUrl && !item.error)
      ))
      .map((item) => [item.path, item.signedUrl]),
  );
  for (const row of ready) {
    const url = urlByPath.get(row.storage_path);
    if (!url) continue;
    const current = result.get(row.diary_entry_id) ?? [];
    current.push(url);
    result.set(row.diary_entry_id, current);
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
      upload_status: item.uploadStatus,
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
    uploadStatus?: "uploading" | "ready" | "failed";
    width?: number;
    height?: number;
  }): Promise<DiaryMedia> {
    if (!isAllowedMediaStoragePath(input.babyId, input.diaryEntryId, input.storagePath)) {
      throw new Error("Diary storage path is not allowed for this baby.");
    }
    const sb = requireSupabase();
    const { data, error } = await sb.from("diary_media").insert({
      id: input.id ?? createId(),
      diary_entry_id: input.diaryEntryId,
      baby_id: input.babyId,
      storage_path: input.storagePath,
      media_type: "image",
      upload_status: input.uploadStatus ?? "ready",
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
    const compressed = await compressImageForUpload(input.photoUri, input.width, input.height);
    const mediaId = createId();
    const storagePath = `${input.babyId}/${input.diaryEntryId}/${mediaId}.jpg`;
    const response = await fetch(compressed.uri);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0) throw new Error("선택한 일기 사진을 읽지 못했어요.");
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("일기 사진은 25MB 이하만 올릴 수 있어요.");
    const sb = requireSupabase();
    const { error: uploadError } = await sb.storage.from(DIARY_MEDIA_BUCKET).upload(storagePath, bytes, {
      contentType: compressed.mimeType,
      upsert: false,
    });
    if (uploadError) throw uploadError;
    try {
      return await this.addMedia({
        id: mediaId,
        diaryEntryId: input.diaryEntryId,
        babyId: input.babyId,
        storagePath,
        uploadStatus: "ready",
        width: compressed.width,
        height: compressed.height,
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
    const attachedIds: string[] = [];
    for (const photoUri of entry.photos) {
      if (isRemotePhoto(photoUri)) continue;
      const job = findJobByLocalUri(photoUri);
      if (job) {
        try {
          await this.addMedia({
            id: job.id,
            diaryEntryId: created.id,
            babyId,
            storagePath: job.storagePath,
            uploadStatus: job.status === "uploaded" ? "ready" : job.status === "failed" ? "failed" : "uploading",
            width: job.width,
            height: job.height,
          });
          attachedIds.push(job.id);
          if (job.status === "failed") photoUploadFailed += 1;
        } catch {
          photoUploadFailed += 1;
        }
        continue;
      }
      try {
        await this.uploadLocalPhoto({ babyId, diaryEntryId: created.id, photoUri });
      } catch {
        photoUploadFailed += 1;
      }
    }
    bindJobsToDiaryEntry(attachedIds, created.id);
    void NotificationRepository.sendPushToBabyMembers({
      eventType: "new_diary",
      babyId,
      targetId: created.id,
      routeData: { route: "diary", babyId, diaryEntryId: created.id },
    }).catch(() => undefined);
    return { entry: { ...created, photos: entry.photos }, photoUploadFailed };
  },

  async updateWithPhotos(babyId: string, entry: DiaryEntry): Promise<DiaryWriteResult> {
    const updated = await this.update(babyId, entry.id, entry);
    const existing = await this.listMedia(entry.id);
    const desiredRemotePaths = new Set(entry.photos.map(signedDiaryStoragePath).filter((path): path is string => Boolean(path)));
    const localPhotos = entry.photos.filter((uri) => !isRemotePhoto(uri));
    const uploaded: DiaryMedia[] = [];
    const attachedIds: string[] = [];
    for (const photoUri of localPhotos) {
      const job = findJobByLocalUri(photoUri);
      if (job) {
        desiredRemotePaths.add(job.storagePath);
        if (!existing.some((media) => media.id === job.id || media.storagePath === job.storagePath)) {
          try {
            uploaded.push(await this.addMedia({
              id: job.id,
              diaryEntryId: entry.id,
              babyId,
              storagePath: job.storagePath,
              uploadStatus: job.status === "uploaded" ? "ready" : job.status === "failed" ? "failed" : "uploading",
              width: job.width,
              height: job.height,
            }));
          } catch {
            return { entry: { ...updated, photos: entry.photos }, photoUploadFailed: 1 };
          }
        }
        attachedIds.push(job.id);
        continue;
      }
      try {
        uploaded.push(await this.uploadLocalPhoto({ babyId, diaryEntryId: entry.id, photoUri }));
      } catch {
        for (const media of uploaded) {
          try { await this.deleteMedia(media.id); } catch { /* keep tracked cleanup failures */ }
        }
        return { entry: { ...updated, photos: entry.photos }, photoUploadFailed: 1 };
      }
    }
    bindJobsToDiaryEntry(attachedIds, entry.id);
    for (const media of existing) {
      if (!desiredRemotePaths.has(media.storagePath)) await this.deleteMedia(media.id);
    }
    return { entry: { ...updated, photos: entry.photos }, photoUploadFailed: 0 };
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
