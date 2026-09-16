import { captureSessionScope, requireSupabase, type CapturedSessionScope } from "../lib/supabase";
import type { DiaryEntry } from "../types/babyLog";
import type { DiaryMedia, DiaryMigrationResult } from "../types/diary";
import type { DiaryMediaRow } from "../types/database";
import { compressImageForUpload } from "../utils/compressImage";
import { bindJobsToDiaryEntry, findJobByLocalUri, requireCompletedEagerPhoto } from "../utils/eagerMediaUpload";
import { createId } from "../utils/id";
import { isAllowedMediaStoragePath } from "../utils/tempMediaPath";
import { createPrivateMediaSignedUrl, retireUnattachedStorageUpload } from "../utils/privateMediaUrl";
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
export const DIARY_HYDRATION_PAGE_SIZE = 100;

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
  const resolved = await Promise.all(ready.map(async (row) => ({
    row,
    url: await createPrivateMediaSignedUrl("diary_media", row.id).catch(() => undefined),
  })));
  for (const { row, url } of resolved) {
    if (!url) continue;
    const current = result.get(row.diary_entry_id) ?? [];
    current.push(url);
    result.set(row.diary_entry_id, current);
  }
  return result;
}

type AddDiaryMediaInput = {
  id?: string; diaryEntryId: string; babyId: string; storagePath: string;
  uploadStatus?: "uploading" | "ready" | "failed"; width?: number; height?: number;
};

async function addDiaryMediaScoped(input: AddDiaryMediaInput, scope: CapturedSessionScope): Promise<DiaryMedia> {
  if (!isAllowedMediaStoragePath(input.babyId, input.diaryEntryId, input.storagePath)) {
    throw new Error("Diary storage path is not allowed for this baby.");
  }
  await requireCompletedEagerPhoto(input.id, scope.accountId);
  await scope.assertCurrent();
  const { data, error } = await scope.client.from("diary_media").insert({
    id: input.id ?? createId(), diary_entry_id: input.diaryEntryId,
    baby_id: input.babyId, storage_path: input.storagePath,
    media_type: "image", upload_status: "ready",
    width: input.width ?? null, height: input.height ?? null,
  }).select("*").single();
  if (error) throw error;
  return diaryMediaRowToModel(data);
}

async function createDiaryScoped(babyId: string, entry: DiaryEntry, scope: CapturedSessionScope): Promise<DiaryEntry> {
  await scope.assertCurrent();
  const sb=scope.client;
  const existing=await sb.from("diary_entries").select("*").eq("baby_id",babyId)
    .eq("client_generated_id",entry.id).is("deleted_at",null).maybeSingle();
  if(existing.error) throw existing.error;
  if(existing.data) return diaryEntryRowToModel(existing.data);
  const inserted=await sb.from("diary_entries").insert({
    id:entry.id,baby_id:babyId,author_id:scope.accountId,client_generated_id:entry.id,
    ...diaryEntryColumns({...entry,babyId}),
  }).select("*").single();
  if(inserted.error) {
    if(inserted.error.code==="23505") {
      const raced=await sb.from("diary_entries").select("*").eq("baby_id",babyId)
        .eq("client_generated_id",entry.id).is("deleted_at",null).single();
      if(!raced.error && raced.data) return diaryEntryRowToModel(raced.data);
    }
    throw inserted.error;
  }
  return diaryEntryRowToModel(inserted.data);
}

async function updateDiaryScoped(babyId:string,diaryEntryId:string,entry:DiaryEntry,scope:CapturedSessionScope):Promise<DiaryEntry>{
  await scope.assertCurrent();
  const result=await scope.client.from("diary_entries").update(diaryEntryColumns(entry))
    .eq("baby_id",babyId).eq("id",diaryEntryId).is("deleted_at",null).select("*").single();
  if(result.error) throw result.error;
  return diaryEntryRowToModel(result.data);
}

async function uploadLocalDiaryPhoto(input:{babyId:string;diaryEntryId:string;photoUri:string;width?:number;height?:number},scope:CapturedSessionScope):Promise<DiaryMedia>{
  const compressed=await compressImageForUpload(input.photoUri,input.width,input.height);
  const mediaId=createId();
  const storagePath=`${input.babyId}/${input.diaryEntryId}/${mediaId}.jpg`;
  const response=await fetch(compressed.uri);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength===0) throw new Error("선택한 일기 사진을 읽지 못했어요.");
  if(bytes.byteLength>MAX_IMAGE_BYTES) throw new Error("일기 사진은 25MB 이하만 올릴 수 있어요.");
  await scope.assertCurrent();
  const uploaded=await scope.client.storage.from(DIARY_MEDIA_BUCKET).upload(storagePath,bytes,{contentType:compressed.mimeType,upsert:false});
  if(uploaded.error) throw uploaded.error;
  await scope.assertCurrent();
  try {
    return await addDiaryMediaScoped({id:mediaId,diaryEntryId:input.diaryEntryId,babyId:input.babyId,
      storagePath,uploadStatus:"ready",width:compressed.width,height:compressed.height},scope);
  } catch(error) {
    await retireUnattachedStorageUpload(scope.client,DIARY_MEDIA_BUCKET,storagePath);
    throw error;
  }
}

async function deleteDiaryMediaScoped(mediaId:string,scope:CapturedSessionScope):Promise<void>{
  await scope.assertCurrent();
  const existing=await scope.client.from("diary_media").select("id").eq("id",mediaId).single();
  if(existing.error) throw existing.error;
  const removed=await scope.client.from("diary_media").delete().eq("id",mediaId);
  if(removed.error) throw removed.error;
}

export const DiaryRepository = {
  async listByBabyId(babyId: string): Promise<DiaryEntry[]> {
    const sb = requireSupabase();
    const entries: DiaryEntry[] = [];
    let offset = 0;
    while (true) {
      const { data: rows, error } = await sb
        .from("diary_entries")
        .select("*")
        .eq("baby_id", babyId)
        .is("deleted_at", null)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + DIARY_HYDRATION_PAGE_SIZE - 1);
      if (error) throw error;
      const page = rows ?? [];
      if (!page.length) return entries;
      const ids = page.map((row) => row.id);
      const { data: media, error: mediaError } = await sb
        .from("diary_media")
        .select("*")
        .in("diary_entry_id", ids)
        .order("created_at", { ascending: true });
      if (mediaError) throw mediaError;
      const photos = await signedPhotos(media ?? []);
      entries.push(...page.map((row) => diaryEntryRowToModel(row, photos.get(row.id) ?? [])));
      offset += page.length;
      if (page.length < DIARY_HYDRATION_PAGE_SIZE) return entries;
    }
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
    return createDiaryScoped(babyId,entry,await captureSessionScope());
  },

  async update(babyId: string, diaryEntryId: string, entry: DiaryEntry): Promise<DiaryEntry> {
    return updateDiaryScoped(babyId,diaryEntryId,entry,await captureSessionScope());
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

  async addMedia(input: AddDiaryMediaInput): Promise<DiaryMedia> {
    return addDiaryMediaScoped(input, await captureSessionScope());
  },

  async deleteMedia(mediaId: string): Promise<void> {
    return deleteDiaryMediaScoped(mediaId,await captureSessionScope());
  },

  async createSignedUrl(storagePath: string, _expiresInSeconds = DIARY_SIGNED_URL_TTL_SECONDS): Promise<string> {
    const sb = requireSupabase();
    const { data: media, error: mediaError } = await sb
      .from("diary_media")
      .select("id, upload_status")
      .eq("storage_path", storagePath)
      .single();
    if (mediaError || !media) throw mediaError ?? new Error("Diary media not found or not accessible.");
    if (media.upload_status !== "ready") throw new Error("Diary media is not ready.");
    return createPrivateMediaSignedUrl("diary_media", media.id);
  },

  async uploadLocalPhoto(input: {
    babyId: string;
    diaryEntryId: string;
    photoUri: string;
    width?: number;
    height?: number;
  }): Promise<DiaryMedia> {
    return uploadLocalDiaryPhoto(input,await captureSessionScope());
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
    const scope=await captureSessionScope();
    const created = await createDiaryScoped(babyId, entry,scope);
    const existingMedia = await this.listMedia(created.id);
    let photoUploadFailed = 0;
    const attachedIds: string[] = [];
    for (const photoUri of entry.photos) {
      if (isRemotePhoto(photoUri)) continue;
      const job = findJobByLocalUri(photoUri);
      if (job) {
        const existing = existingMedia.find((media) => media.id === job.id || media.storagePath === job.storagePath);
        if (existing) {
          attachedIds.push(job.id);
          if (job.status === "failed") photoUploadFailed += 1;
          continue;
        }
        try {
          await addDiaryMediaScoped({
            id: job.id,
            diaryEntryId: created.id,
            babyId,
            storagePath: job.storagePath,
            uploadStatus: job.status === "uploaded" ? "ready" : job.status === "failed" ? "failed" : "uploading",
            width: job.width,
            height: job.height,
          },scope);
          attachedIds.push(job.id);
          if (job.status === "failed") photoUploadFailed += 1;
        } catch {
          photoUploadFailed += 1;
        }
        continue;
      }
      try {
        await uploadLocalDiaryPhoto({ babyId, diaryEntryId: created.id, photoUri },scope);
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
    const scope=await captureSessionScope();
    const updated = await updateDiaryScoped(babyId, entry.id, entry,scope);
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
            uploaded.push(await addDiaryMediaScoped({
              id: job.id,
              diaryEntryId: entry.id,
              babyId,
              storagePath: job.storagePath,
              uploadStatus: job.status === "uploaded" ? "ready" : job.status === "failed" ? "failed" : "uploading",
              width: job.width,
              height: job.height,
            },scope));
          } catch {
            return { entry: { ...updated, photos: entry.photos }, photoUploadFailed: 1 };
          }
        }
        attachedIds.push(job.id);
        continue;
      }
      try {
        uploaded.push(await uploadLocalDiaryPhoto({ babyId, diaryEntryId: entry.id, photoUri },scope));
      } catch {
        for (const media of uploaded) {
          try { await deleteDiaryMediaScoped(media.id,scope); } catch { /* keep tracked cleanup failures */ }
        }
        return { entry: { ...updated, photos: entry.photos }, photoUploadFailed: 1 };
      }
    }
    bindJobsToDiaryEntry(attachedIds, entry.id);
    for (const media of existing) {
      if (!desiredRemotePaths.has(media.storagePath)) await deleteDiaryMediaScoped(media.id,scope);
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
