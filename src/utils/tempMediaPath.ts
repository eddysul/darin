const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEDIA_EXTENSION = "jpg|jpeg|png|heic|heif|webp|mp4|mov|m4v";
const CANONICAL_MEDIA_PATH = new RegExp(
  `^[A-Za-z0-9_-]+(?:\\/[A-Za-z0-9_-]+)*\\/[A-Za-z0-9_-]+\\.(?:${MEDIA_EXTENSION})$`,
  "i",
);

function assertMediaExtension(extension: string): string {
  const normalized = extension.trim().replace(/^\./, "").toLowerCase();
  if (!new RegExp(`^(?:${MEDIA_EXTENSION})$`).test(normalized)) throw new Error("Invalid media identifier");
  return normalized;
}

export function buildTempMediaPath(
  babyId: string,
  sessionId: string,
  mediaId: string,
  extension = "jpg",
): string {
  if (![babyId, sessionId, mediaId].every((id) => UUID_PATTERN.test(id))) throw new Error("Invalid media identifier");
  return `${babyId}/temp/${sessionId}/${mediaId}.${assertMediaExtension(extension)}`;
}

export function buildTempPosterPath(babyId: string, sessionId: string, mediaId: string): string {
  if (![babyId, sessionId, mediaId].every((id) => UUID_PATTERN.test(id))) throw new Error("Invalid media identifier");
  return `${babyId}/temp/${sessionId}/${mediaId}-poster.jpg`;
}

export function buildOwnedMediaPath(babyId: string, ownerId: string, mediaId: string, extension = "jpg"): string {
  if (![babyId, ownerId, mediaId].every((id) => UUID_PATTERN.test(id))) throw new Error("Invalid media identifier");
  return `${babyId}/${ownerId}/${mediaId}.${assertMediaExtension(extension)}`;
}

export function buildOwnedPosterPath(babyId: string, ownerId: string, mediaId: string): string {
  if (![babyId, ownerId, mediaId].every((id) => UUID_PATTERN.test(id))) throw new Error("Invalid media identifier");
  return `${babyId}/${ownerId}/${mediaId}-poster.jpg`;
}

export function isCanonicalMediaPath(path: string): boolean {
  return path.length <= 512 && CANONICAL_MEDIA_PATH.test(path);
}

export function isTempMediaPath(babyId: string, path: string): boolean {
  if (!isCanonicalMediaPath(path) || !UUID_PATTERN.test(babyId)) return false;
  const parts = path.split("/");
  return (
    parts.length === 4
    && parts[0] === babyId
    && parts[1] === "temp"
    && UUID_PATTERN.test(parts[2] ?? "")
    && Boolean(parts[3])
  );
}

export function isOwnedMediaPath(babyId: string, ownerId: string, path: string): boolean {
  return UUID_PATTERN.test(babyId) && UUID_PATTERN.test(ownerId)
    && isCanonicalMediaPath(path) && path.split("/").length === 3
    && path.startsWith(`${babyId}/${ownerId}/`);
}

export function isAllowedMediaStoragePath(babyId: string, ownerId: string, path: string): boolean {
  return isOwnedMediaPath(babyId, ownerId, path) || isTempMediaPath(babyId, path);
}
