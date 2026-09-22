import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import type { ImagePickerAsset } from "expo-image-picker";
import type { MemoryMediaType } from "../types/memory";
import { MEMORY_VIDEO_MAX_DURATION_MS, MemoryMediaUploadError, normalizeMediaDimension, normalizeMemoryVideoDurationMs, type MemoryUploadErrorCode } from "./memoryMediaMetadata";
export { MEMORY_VIDEO_MAX_DURATION_MS, MemoryMediaUploadError, normalizeMemoryVideoDurationMs, type MemoryUploadErrorCode } from "./memoryMediaMetadata";

/** Inclusive ceiling: 90.000s is allowed, anything above is rejected. */
export const MEMORY_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const MEMORY_IMAGE_MAX_BYTES = 25 * 1024 * 1024;
export const MEMORY_MEDIA_MAX_ITEMS = 5;

export type MemoryPickedAsset = {
  uri: string;
  mediaType: MemoryMediaType;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
  durationMs?: number;
};

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v"]);

export function videoDurationExceedsLimit(durationMs: number): boolean {
  return durationMs > MEMORY_VIDEO_MAX_DURATION_MS;
}

export function isMemoryVideoAsset(asset: Pick<ImagePickerAsset, "type" | "mimeType" | "uri" | "fileName">): boolean {
  if (asset.type === "video") return true;
  if (asset.mimeType?.toLowerCase().startsWith("video/")) return true;
  const name = `${asset.fileName ?? ""} ${asset.uri}`.toLowerCase();
  return VIDEO_EXTENSIONS.has(extensionFromName(name));
}

export function extensionForMemoryAsset(mediaType: MemoryMediaType, mimeType?: string, uri?: string): string {
  if (mediaType !== "video") return "jpg";
  const mime = mimeType?.toLowerCase() ?? "";
  if (mime.includes("quicktime") || uri?.toLowerCase().includes(".mov")) return "mov";
  if (mime.includes("m4v") || uri?.toLowerCase().includes(".m4v")) return "m4v";
  return "mp4";
}

export function mimeTypeForMemoryAsset(mediaType: MemoryMediaType, mimeType?: string, uri?: string): string {
  if (mediaType !== "video") return mimeType?.startsWith("image/") ? mimeType : "image/jpeg";
  if (mimeType?.toLowerCase().startsWith("video/")) return mimeType;
  const ext = extensionForMemoryAsset("video", mimeType, uri);
  if (ext === "mov") return "video/quicktime";
  if (ext === "m4v") return "video/x-m4v";
  return "video/mp4";
}

export function formatMemoryVideoDuration(durationMs: number): string {
  const totalSeconds = Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs / 1000)) : 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function isLocalMediaUri(uri?: string): boolean {
  if (!uri) return false;
  return /^(file:|ph:|assets-library:|content:|data:)/i.test(uri) || uri.startsWith("/");
}

function extensionFromName(value: string): string {
  const match = value.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return match?.[1]?.toLowerCase() ?? "";
}

async function probeVideoDurationMs(uri: string): Promise<number | undefined> {
  const created = await Audio.Sound.createAsync({ uri }, { shouldPlay: false }, undefined, false);
  try {
    const status = created.status.isLoaded ? created.status : await created.sound.getStatusAsync();
    if (status.isLoaded && typeof status.durationMillis === "number" && Number.isFinite(status.durationMillis) && status.durationMillis > 0) {
      return status.durationMillis;
    }
  } finally {
    await created.sound.unloadAsync().catch(() => undefined);
  }
  return undefined;
}

async function fileSizeBytes(uri: string, reported?: number): Promise<number | undefined> {
  if (typeof reported === "number" && reported > 0) return reported;
  const info = await FileSystem.getInfoAsync(uri).catch(() => null);
  if (info?.exists && "size" in info && typeof info.size === "number") return info.size;
  return undefined;
}

export async function inspectPickedMemoryAsset(asset: ImagePickerAsset): Promise<MemoryPickedAsset> {
  const mediaType: MemoryMediaType = isMemoryVideoAsset(asset) ? "video" : "image";
  if (mediaType === "image") {
    if (asset.fileSize !== undefined && asset.fileSize > MEMORY_IMAGE_MAX_BYTES) {
      throw new MemoryMediaUploadError("IMAGE_TOO_LARGE");
    }
    return {
      uri: asset.uri,
      mediaType,
      width: normalizeMediaDimension(asset.width),
      height: normalizeMediaDimension(asset.height),
      fileSize: asset.fileSize,
      mimeType: mimeTypeForMemoryAsset("image", asset.mimeType, asset.uri),
    };
  }

  const pickerDuration = typeof asset.duration === "number" && Number.isFinite(asset.duration) && asset.duration > 0 ? asset.duration : undefined;
  let durationMs = pickerDuration;
  // ImagePicker reports milliseconds on both platforms, including clips <180ms.
  if (durationMs == null) {
    durationMs = await probeVideoDurationMs(asset.uri).catch(() => undefined);
  }
  durationMs = normalizeMemoryVideoDurationMs(durationMs);

  const fileSize = await fileSizeBytes(asset.uri, asset.fileSize);
  if (fileSize !== undefined && fileSize > MEMORY_VIDEO_MAX_BYTES) {
    throw new MemoryMediaUploadError("VIDEO_TOO_LARGE");
  }

  return {
    uri: asset.uri,
    mediaType: "video",
    width: normalizeMediaDimension(asset.width),
    height: normalizeMediaDimension(asset.height),
    fileSize,
    mimeType: mimeTypeForMemoryAsset("video", asset.mimeType, asset.uri),
    durationMs,
  };
}

type MemoryVideoThumbnail = { uri: string; width?: number; height?: number };

let videoThumbnailsMissing = false;

function isMissingVideoThumbnailsModule(error: unknown): boolean {
  return error instanceof Error && /Cannot find native module ['"]ExpoVideoThumbnails['"]/i.test(error.message);
}

function nativeVideoThumbnailsAvailable(): boolean {
  const expo = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo;
  return Boolean(expo?.modules?.ExpoVideoThumbnails);
}

/**
 * Poster frames need a native rebuild (`expo-video-thumbnails`).
 * Probe the native module first so binaries without it do not throw on import.
 */
export async function captureMemoryVideoThumbnail(
  uri: string,
  options?: { time?: number; quality?: number },
): Promise<MemoryVideoThumbnail | null> {
  if (videoThumbnailsMissing || !nativeVideoThumbnailsAvailable()) {
    videoThumbnailsMissing = true;
    return null;
  }
  try {
    const VideoThumbnails = await import("expo-video-thumbnails");
    const poster = await VideoThumbnails.getThumbnailAsync(uri, {
      time: options?.time ?? 0,
      quality: options?.quality ?? 0.7,
    });
    return { uri: poster.uri, width: normalizeMediaDimension(poster.width), height: normalizeMediaDimension(poster.height) };
  } catch (error) {
    if (isMissingVideoThumbnailsModule(error)) videoThumbnailsMissing = true;
    return null;
  }
}

export function memoryUploadErrorMessageKey(error: unknown): "memory.critical.115" | "memory.critical.190" | "memory.critical.201" | "memory.critical.206" | "memory.critical.099" {
  const code = error instanceof MemoryMediaUploadError
    ? error.code
    : error instanceof Error && /^(VIDEO_TOO_LONG|VIDEO_TOO_LARGE|VIDEO_DURATION_UNKNOWN|IMAGE_TOO_LARGE)$/.test(error.message)
      ? error.message as MemoryUploadErrorCode
      : undefined;
  if (code === "VIDEO_TOO_LONG") return "memory.critical.190";
  if (code === "VIDEO_TOO_LARGE") return "memory.critical.201";
  if (code === "VIDEO_DURATION_UNKNOWN") return "memory.critical.206";
  if (code === "IMAGE_TOO_LARGE") return "memory.critical.115";
  return "memory.critical.099";
}
