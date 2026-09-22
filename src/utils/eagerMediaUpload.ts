import { requireSupabase, sessionScopedSupabase } from "../lib/supabase";
import { compressImageForUpload } from "./compressImage";
import { createId } from "./id";
import { buildTempMediaPath, buildTempPosterPath } from "./tempMediaPath";
import { retireUnattachedStorageUpload } from "./privateMediaUrl";
import { isUnownedEagerMedia } from "./eagerMediaOwnership";
import {
  MEMORY_IMAGE_MAX_BYTES,
  MEMORY_VIDEO_MAX_BYTES,
  MemoryMediaUploadError,
  captureMemoryVideoThumbnail,
  extensionForMemoryAsset,
  mimeTypeForMemoryAsset,
  videoDurationExceedsLimit,
} from "./memoryVideo";
import type { MemoryMediaType } from "../types/memory";
import { normalizeMediaDimension, normalizeMemoryVideoDurationMs } from "./memoryMediaMetadata";
import { mediaUploadFailureCategory, uploadMediaWithRecovery } from "./mediaUploadRecovery";

export type MediaBucket = "memories" | "diary-media";
export type PhotoUploadStatus = "local" | "compressing" | "uploading" | "uploaded" | "failed";

export type EagerPhoto = {
  accountId: string;
  id: string;
  babyId: string;
  bucket: MediaBucket;
  sessionId: string;
  localUri: string;
  compressedUri?: string;
  storagePath: string;
  mediaType: MemoryMediaType;
  width?: number;
  height?: number;
  durationMs?: number;
  thumbnailLocalUri?: string;
  thumbnailStoragePath?: string;
  mimeType: string;
  status: PhotoUploadStatus;
  error?: string;
  memoryPostId?: string;
  diaryEntryId?: string;
};

const UPLOAD_CONCURRENCY = 3;

type Job = EagerPhoto & { generation: number };

const jobs = new Map<string, Job>();
const sessionListeners = new Map<string, Set<() => void>>();
const globalListeners = new Set<() => void>();
let activeCount = 0;
const queue: string[] = [];

export function createUploadSessionId(): string {
  return createId();
}

export function listEagerPhotos(sessionId: string): EagerPhoto[] {
  return [...jobs.values()].filter((job) => job.sessionId === sessionId).map(publicPhoto);
}

export function getEagerPhoto(id: string): EagerPhoto | undefined {
  const job = jobs.get(id);
  return job ? publicPhoto(job) : undefined;
}

export function findJobByLocalUri(localUri: string): EagerPhoto | undefined {
  for (const job of jobs.values()) {
    if (job.localUri === localUri || job.compressedUri === localUri) return publicPhoto(job);
  }
  return undefined;
}

export function getLocalUriForMedia(mediaId: string): string | undefined {
  return jobs.get(mediaId)?.localUri;
}

export function getLocalPosterUriForMedia(mediaId: string): string | undefined {
  const job = jobs.get(mediaId);
  if (!job) return undefined;
  return job.thumbnailLocalUri ?? (job.mediaType === "video" ? undefined : job.localUri);
}

export function subscribeEagerSession(sessionId: string, onChange: () => void): () => void {
  const listeners = sessionListeners.get(sessionId) ?? new Set<() => void>();
  listeners.add(onChange);
  sessionListeners.set(sessionId, listeners);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) sessionListeners.delete(sessionId);
  };
}

export function subscribeEagerUploads(onChange: () => void): () => void {
  globalListeners.add(onChange);
  return () => {
    globalListeners.delete(onChange);
  };
}

/** Waits only for photos already owned by the eager-upload queue. */
export async function waitForEagerPhotosToSettle(
  photoUris: string[],
  timeoutMs = 180_000,
): Promise<boolean> {
  const ids = photoUris
    .map((uri) => findJobByLocalUri(uri)?.id)
    .filter((id): id is string => Boolean(id));
  return waitForEagerPhotoIdsToSettle(ids, timeoutMs);
}

async function waitForEagerPhotoIdsToSettle(ids: string[], timeoutMs: number): Promise<boolean> {
  if (!ids.length) return true;

  const status = () => {
    const current = ids.map((id) => jobs.get(id));
    if (current.some((job) => !job || job.status === "failed")) return "failed" as const;
    if (current.every((job) => job?.status === "uploaded")) return "uploaded" as const;
    return "pending" as const;
  };
  const initial = status();
  if (initial !== "pending") return initial === "uploaded";

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };
    const unsubscribe = subscribeEagerUploads(() => {
      const next = status();
      if (next !== "pending") finish(next === "uploaded");
    });
    const timer = setTimeout(() => finish(false), timeoutMs);
    const afterSubscribe = status();
    if (afterSubscribe !== "pending") finish(afterSubscribe === "uploaded");
  });
}

/** Attachment is only legal after Storage has acknowledged the object. */
export async function requireCompletedEagerPhoto(id: string | undefined, expectedAccountId?: string): Promise<void> {
  const job = id ? jobs.get(id) : undefined;
  if (!job) return; // Restored uploads are independently verified by the DB trigger.
  const { data } = await requireSupabase().auth.getSession();
  if (data.session?.user.id !== job.accountId || (expectedAccountId && job.accountId !== expectedAccountId)) {
    throw new Error("Upload account changed.");
  }
  if (!await waitForEagerPhotoIdsToSettle([job.id], 180_000)) throw new Error("Photo upload is not ready.");
  const current = await requireSupabase().auth.getSession();
  if (current.data.session?.user.id !== job.accountId || (expectedAccountId && job.accountId !== expectedAccountId)) {
    throw new Error("Upload account changed.");
  }
}

export function enqueuePickedPhotos(input: {
  accountId: string;
  babyId: string;
  bucket: MediaBucket;
  sessionId: string;
  assets: Array<{
    uri: string;
    width?: number;
    height?: number;
    mediaType?: MemoryMediaType;
    durationMs?: number;
    mimeType?: string;
    thumbnailLocalUri?: string;
  }>;
}): EagerPhoto[] {
  const created: EagerPhoto[] = [];
  for (const asset of input.assets) {
    if ([...jobs.values()].some((job) => job.sessionId === input.sessionId && job.localUri === asset.uri)) {
      continue;
    }
    const id = createId();
    const mediaType: MemoryMediaType = asset.mediaType === "video" ? "video" : "image";
    const extension = extensionForMemoryAsset(mediaType, asset.mimeType, asset.uri);
    const job: Job = {
      accountId: input.accountId,
      id,
      babyId: input.babyId,
      bucket: input.bucket,
      sessionId: input.sessionId,
      localUri: asset.uri,
      storagePath: buildTempMediaPath(input.babyId, input.sessionId, id, extension),
      mediaType,
      width: normalizeMediaDimension(asset.width),
      height: normalizeMediaDimension(asset.height),
      durationMs: mediaType === "video" ? normalizeMemoryVideoDurationMs(asset.durationMs) : undefined,
      thumbnailLocalUri: mediaType === "video" ? asset.thumbnailLocalUri : undefined,
      thumbnailStoragePath: mediaType === "video" ? buildTempPosterPath(input.babyId, input.sessionId, id) : undefined,
      mimeType: mimeTypeForMemoryAsset(mediaType, asset.mimeType, asset.uri),
      status: "local",
      generation: 0,
    };
    jobs.set(id, job);
    created.push(publicPhoto(job));
    enqueue(id);
  }
  if (created.length) notify(input.sessionId);
  return created;
}

export function removeEagerPhoto(id: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.generation += 1;
  const sessionId = job.sessionId;
  const paths = [job.storagePath, job.thumbnailStoragePath].filter((path): path is string => Boolean(path));
  const bucket = job.bucket;
  jobs.delete(id);
  notify(sessionId);
  if (job.status === "uploaded" || job.status === "uploading") {
    void removeScopedPaths(job.accountId, bucket, paths);
  }
}

export async function discardSession(sessionId: string): Promise<void> {
  const sessionJobs = [...jobs.values()].filter((job) => (
    job.sessionId === sessionId && isUnownedEagerMedia(job)
  ));
  const uploadedPaths = sessionJobs
    .filter((job) => job.status === "uploaded" || job.status === "uploading")
    .flatMap((job) => [job.storagePath, job.thumbnailStoragePath].filter((path): path is string => Boolean(path)).map((path) => ({
      accountId: job.accountId,
      bucket: job.bucket,
      path,
    })));
  for (const job of sessionJobs) {
    job.generation += 1;
    jobs.delete(job.id);
  }
  notify(sessionId);
  await Promise.all(uploadedPaths.map((item) => removeScopedPaths(item.accountId, item.bucket, [item.path])));
}

async function removeScopedPaths(accountId: string, bucket: MediaBucket, paths: string[]): Promise<void> {
  try {
    const { data } = await requireSupabase().auth.getSession();
    if (data.session?.user.id !== accountId) return; // Expiry worker owns abandoned uploads.
    const scoped = sessionScopedSupabase(data.session);
    await Promise.all(paths.map((path) => retireUnattachedStorageUpload(scoped, bucket, path)));
  } catch { /* durable expiry sweep retries unclaimed uploads */ }
}

export function retryEagerPhoto(id: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "local";
  job.error = undefined;
  job.generation += 1;
  notify(job.sessionId);
  enqueue(id);
}

export function bindJobsToMemoryPost(photoIds: string[], memoryPostId: string): void {
  for (const id of photoIds) {
    const job = jobs.get(id);
    if (!job) continue;
    job.memoryPostId = memoryPostId;
    if (job.status === "uploaded") void persistMemoryStatus(job, "ready");
    else if (job.status === "failed") void persistMemoryStatus(job, "failed");
  }
}

export function bindJobsToDiaryEntry(photoIds: string[], diaryEntryId: string): void {
  for (const id of photoIds) {
    const job = jobs.get(id);
    if (!job) continue;
    job.diaryEntryId = diaryEntryId;
    if (job.status === "uploaded") void persistDiaryStatus(job, "ready");
    else if (job.status === "failed") void persistDiaryStatus(job, "failed");
  }
}

function publicPhoto(job: Job): EagerPhoto {
  const { generation: _, ...photo } = job;
  return photo;
}

function notify(sessionId: string): void {
  sessionListeners.get(sessionId)?.forEach((listener) => listener());
  globalListeners.forEach((listener) => listener());
}

function enqueue(id: string): void {
  if (!queue.includes(id)) queue.push(id);
  pump();
}

function pump(): void {
  while (activeCount < UPLOAD_CONCURRENCY && queue.length > 0) {
    const id = queue.shift();
    if (!id || !jobs.has(id)) continue;
    activeCount += 1;
    void runJob(id).finally(() => {
      activeCount -= 1;
      pump();
    });
  }
}

async function runJob(id: string): Promise<void> {
  const job = jobs.get(id);
  if (!job) return;
  const generation = job.generation;
  let stage = "prepare";
  try {
    const sb = requireSupabase();
    const { data: initial } = await sb.auth.getSession();
    if (!initial.session || initial.session.user.id !== job.accountId) throw new Error("Upload account changed.");
    job.status = "compressing";
    notify(job.sessionId);
    const prepared = job.mediaType === "video"
      ? await prepareVideoUpload(job)
      : await compressImageForUpload(job.localUri, job.width, job.height);
    if (!jobs.has(id) || jobs.get(id)?.generation !== generation) return;
    job.compressedUri = prepared.uri;
    job.width = normalizeMediaDimension(prepared.width);
    job.height = normalizeMediaDimension(prepared.height);
    job.mimeType = job.mediaType === "video" ? job.mimeType : prepared.mimeType;
    if (job.mediaType === "video" && "durationMs" in prepared && prepared.durationMs != null) {
      job.durationMs = normalizeMemoryVideoDurationMs(prepared.durationMs);
    }
    if (job.mediaType === "video" && "thumbnailUri" in prepared) {
      job.thumbnailLocalUri = prepared.thumbnailUri;
    }
    job.status = "uploading";
    notify(job.sessionId);

    stage = "read_file";
    const response = await fetch(prepared.uri);
    const bytes = await response.arrayBuffer();
    if (!jobs.has(id) || jobs.get(id)?.generation !== generation) return;
    if (bytes.byteLength === 0) throw new MemoryMediaUploadError("READ_FAILED");
    if (job.mediaType === "video") {
      if (job.durationMs == null || videoDurationExceedsLimit(job.durationMs)) {
        throw new MemoryMediaUploadError("VIDEO_TOO_LONG");
      }
      if (bytes.byteLength > MEMORY_VIDEO_MAX_BYTES) throw new MemoryMediaUploadError("VIDEO_TOO_LARGE");
    } else if (bytes.byteLength > MEMORY_IMAGE_MAX_BYTES) {
      throw new Error("사진은 25MB 이하만 올릴 수 있어요.");
    }

    const { data: current } = await sb.auth.getSession();
    if (!current.session || current.session.user.id !== job.accountId) throw new Error("Upload account changed.");
    const scoped = sessionScopedSupabase(current.session);
    const assertUploadCurrent = async () => {
      const latest = await sb.auth.getSession();
      if (latest.error || latest.data.session?.user.id !== job.accountId
        || !jobs.has(id) || jobs.get(id)?.generation !== generation) throw new Error("Upload scope changed.");
    };
    stage = "storage_upload";
    await uploadOwnedObject(scoped, job.bucket, job.storagePath, bytes, job.mimeType, assertUploadCurrent);
    if (job.thumbnailStoragePath && job.thumbnailLocalUri) {
      const poster = await fetch(job.thumbnailLocalUri).then((item) => item.arrayBuffer()).catch(() => null);
      if (poster && poster.byteLength > 0 && poster.byteLength <= MEMORY_IMAGE_MAX_BYTES) {
        await uploadOwnedObject(scoped, job.bucket, job.thumbnailStoragePath, poster, "image/jpeg", assertUploadCurrent).catch(() => {
          job.thumbnailStoragePath = undefined;
        });
      } else {
        job.thumbnailStoragePath = undefined;
      }
    }
    const { data: completed } = await sb.auth.getSession();
    if (completed.session?.user.id !== job.accountId) throw new Error("Upload account changed.");
    if (!jobs.has(id) || jobs.get(id)?.generation !== generation) {
      await removeScopedPaths(job.accountId, job.bucket, [job.storagePath, job.thumbnailStoragePath].filter((path): path is string => Boolean(path)));
      return;
    }

    job.status = "uploaded";
    notify(job.sessionId);
    if (job.memoryPostId) await persistMemoryStatus(job, "ready");
    if (job.diaryEntryId) await persistDiaryStatus(job, "ready");
  } catch (cause) {
    if (!jobs.has(id) || jobs.get(id)?.generation !== generation) return;
    if (__DEV__) console.warn("[memory-upload]", { stage, mediaType: job.mediaType, category: mediaUploadFailureCategory(cause) });
    job.status = "failed";
    job.error = cause instanceof MemoryMediaUploadError
      ? cause.code
      : cause instanceof Error ? cause.message : "사진을 올리지 못했어요.";
    notify(job.sessionId);
    if (job.memoryPostId) await persistMemoryStatus(job, "failed");
    if (job.diaryEntryId) await persistDiaryStatus(job, "failed");
  }
}

async function persistMemoryStatus(job: Job, uploadStatus: "ready" | "failed"): Promise<void> {
  if (!job.memoryPostId) return;
  try {
    const { data: sessionData } = await requireSupabase().auth.getSession();
    if (sessionData.session?.user.id !== job.accountId) return;
    const sb = sessionScopedSupabase(sessionData.session);
    await sb.from("memory_media").update({
      upload_status: uploadStatus,
      width: job.width ?? null,
      height: job.height ?? null,
      duration_ms: job.mediaType === "video" ? normalizeMemoryVideoDurationMs(job.durationMs) : null,
    }).eq("id", job.id);
    const { data } = await sb.from("memory_media").select("upload_status").eq("memory_post_id", job.memoryPostId);
    const rows = data ?? [];
    if (rows.length > 0 && !rows.some((row) => row.upload_status === "uploading")) {
      await sb.from("memory_posts").update({ status: "published" }).eq("id", job.memoryPostId);
    }
  } catch {
    // Feed retry still works from local job state if the status write races.
  }
}

async function persistDiaryStatus(job: Job, uploadStatus: "ready" | "failed"): Promise<void> {
  if (!job.diaryEntryId) return;
  try {
    const { data: sessionData } = await requireSupabase().auth.getSession();
    if (sessionData.session?.user.id !== job.accountId) return;
    const sb = sessionScopedSupabase(sessionData.session);
    await sb.from("diary_media").update({
      upload_status: uploadStatus,
      width: job.width ?? null,
      height: job.height ?? null,
    }).eq("id", job.id);
  } catch {
    // Diary text is already saved; media retry stays available in-session.
  }
}

async function prepareVideoUpload(job: Job): Promise<{
  uri: string;
  width?: number;
  height?: number;
  mimeType: string;
  durationMs?: number;
  thumbnailUri?: string;
}> {
  const durationMs = normalizeMemoryVideoDurationMs(job.durationMs);
  if (job.thumbnailLocalUri) {
    return {
      uri: job.localUri,
      width: job.width,
      height: job.height,
      mimeType: job.mimeType,
      durationMs,
      thumbnailUri: job.thumbnailLocalUri,
    };
  }
  const poster = await captureMemoryVideoThumbnail(job.localUri, { time: 0, quality: 0.7 });
  return {
    uri: job.localUri,
    width: job.width ?? poster?.width,
    height: job.height ?? poster?.height,
    mimeType: job.mimeType,
    durationMs,
    thumbnailUri: poster?.uri,
  };
}

async function uploadOwnedObject(
  client: ReturnType<typeof sessionScopedSupabase>,
  bucket: MediaBucket,
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
  assertCurrent: () => Promise<void>,
): Promise<void> {
  await uploadMediaWithRecovery({
    assertCurrent,
    upload: () => client.storage.from(bucket).upload(path, bytes, { contentType, upsert: false }),
    verifyOwned: async () => {
      const verified = await client.rpc("verify_owned_storage_upload", { p_bucket: bucket, p_path: path });
      return !verified.error && verified.data === true;
    },
  });
}
