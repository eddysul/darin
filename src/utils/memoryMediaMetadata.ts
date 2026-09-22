/** Expo/iOS durations are fractional milliseconds; Postgres media fields are int4. */
export const MEMORY_VIDEO_MAX_DURATION_MS = 90_000;

export type MemoryUploadErrorCode =
  | "VIDEO_TOO_LONG" | "VIDEO_TOO_LARGE" | "VIDEO_DURATION_UNKNOWN"
  | "IMAGE_TOO_LARGE" | "READ_FAILED";

export class MemoryMediaUploadError extends Error {
  readonly code: MemoryUploadErrorCode;
  constructor(code: MemoryUploadErrorCode) {
    super(code);
    this.name = "MemoryMediaUploadError";
    this.code = code;
  }
}

export function normalizeMemoryVideoDurationMs(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new MemoryMediaUploadError("VIDEO_DURATION_UNKNOWN");
  }
  // Check the original value first; rounding must never admit a >90s video.
  if (value > MEMORY_VIDEO_MAX_DURATION_MS) throw new MemoryMediaUploadError("VIDEO_TOO_LONG");
  return Math.max(1, Math.round(value));
}

export function normalizeMediaDimension(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 2_147_483_647) return undefined;
  return Math.max(1, Math.round(value));
}
