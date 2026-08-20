import { requireSupabase } from "../lib/supabase";
import { compressImageForUpload } from "./compressImage";
import { createId } from "./id";
import { buildTempMediaPath } from "./tempMediaPath";

export type MediaBucket = "memories" | "diary-media";
export type PhotoUploadStatus = "local" | "compressing" | "uploading" | "uploaded" | "failed";

export type EagerPhoto = {
  id: string;
  babyId: string;
  bucket: MediaBucket;
  sessionId: string;
  localUri: string;
  compressedUri?: string;
  storagePath: string;
  width?: number;
  height?: number;
  mimeType: string;
  status: PhotoUploadStatus;
  error?: string;
  memoryPostId?: string;
  diaryEntryId?: string;
};

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
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

export function enqueuePickedPhotos(input: {
  babyId: string;
  bucket: MediaBucket;
  sessionId: string;
  assets: Array<{ uri: string; width?: number; height?: number }>;
}): EagerPhoto[] {
  const created: EagerPhoto[] = [];
  for (const asset of input.assets) {
    if ([...jobs.values()].some((job) => job.sessionId === input.sessionId && job.localUri === asset.uri)) {
      continue;
    }
    const id = createId();
    const job: Job = {
      id,
      babyId: input.babyId,
      bucket: input.bucket,
      sessionId: input.sessionId,
      localUri: asset.uri,
      storagePath: buildTempMediaPath(input.babyId, input.sessionId, id),
      width: asset.width,
      height: asset.height,
      mimeType: "image/jpeg",
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
  const path = job.storagePath;
  const bucket = job.bucket;
  jobs.delete(id);
  notify(sessionId);
  if (job.status === "uploaded" || job.status === "uploading") {
    void requireSupabase().storage.from(bucket).remove([path]).catch(() => undefined);
  }
}

export async function discardSession(sessionId: string): Promise<void> {
  const sessionJobs = [...jobs.values()].filter((job) => job.sessionId === sessionId);
  const uploadedPaths = sessionJobs
    .filter((job) => job.status === "uploaded" || job.status === "uploading")
    .map((job) => ({ bucket: job.bucket, path: job.storagePath }));
  for (const job of sessionJobs) {
    job.generation += 1;
    jobs.delete(job.id);
  }
  notify(sessionId);
  const byBucket = new Map<MediaBucket, string[]>();
  for (const item of uploadedPaths) {
    const paths = byBucket.get(item.bucket) ?? [];
    paths.push(item.path);
    byBucket.set(item.bucket, paths);
  }
  const sb = requireSupabase();
  await Promise.all([...byBucket.entries()].map(([bucket, paths]) => sb.storage.from(bucket).remove(paths).catch(() => undefined)));
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
  try {
    job.status = "compressing";
    notify(job.sessionId);
    const compressed = await compressImageForUpload(job.localUri, job.width, job.height);
    if (!jobs.has(id) || jobs.get(id)?.generation !== generation) return;
    job.compressedUri = compressed.uri;
    job.width = compressed.width;
    job.height = compressed.height;
    job.mimeType = compressed.mimeType;
    job.status = "uploading";
    notify(job.sessionId);

    const response = await fetch(compressed.uri);
    const bytes = await response.arrayBuffer();
    if (!jobs.has(id) || jobs.get(id)?.generation !== generation) return;
    if (bytes.byteLength === 0) throw new Error("선택한 사진을 읽지 못했어요.");
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("사진은 25MB 이하만 올릴 수 있어요.");

    const sb = requireSupabase();
    await sb.storage.from(job.bucket).remove([job.storagePath]).catch(() => undefined);
    const { error } = await sb.storage.from(job.bucket).upload(job.storagePath, bytes, {
      contentType: job.mimeType,
      upsert: false,
    });
    if (error) throw error;
    if (!jobs.has(id) || jobs.get(id)?.generation !== generation) {
      // The compose session was discarded while the upload request was in
      // flight. A pre-upload remove can race and finish first, so clean up once
      // more after the upload has definitely completed.
      await sb.storage.from(job.bucket).remove([job.storagePath]).catch(() => undefined);
      return;
    }

    job.status = "uploaded";
    notify(job.sessionId);
    if (job.memoryPostId) await persistMemoryStatus(job, "ready");
    if (job.diaryEntryId) await persistDiaryStatus(job, "ready");
  } catch (cause) {
    if (!jobs.has(id) || jobs.get(id)?.generation !== generation) return;
    job.status = "failed";
    job.error = cause instanceof Error ? cause.message : "사진을 올리지 못했어요.";
    notify(job.sessionId);
    if (job.memoryPostId) await persistMemoryStatus(job, "failed");
    if (job.diaryEntryId) await persistDiaryStatus(job, "failed");
  }
}

async function persistMemoryStatus(job: Job, uploadStatus: "ready" | "failed"): Promise<void> {
  if (!job.memoryPostId) return;
  try {
    const sb = requireSupabase();
    await sb.from("memory_media").update({
      upload_status: uploadStatus,
      width: job.width ?? null,
      height: job.height ?? null,
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
    const sb = requireSupabase();
    await sb.from("diary_media").update({
      upload_status: uploadStatus,
      width: job.width ?? null,
      height: job.height ?? null,
    }).eq("id", job.id);
  } catch {
    // Diary text is already saved; media retry stays available in-session.
  }
}
