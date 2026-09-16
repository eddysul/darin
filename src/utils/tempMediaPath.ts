const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildTempMediaPath(babyId: string, sessionId: string, mediaId: string): string {
  if (![babyId, sessionId, mediaId].every((id) => UUID_PATTERN.test(id))) throw new Error("Invalid media identifier");
  return `${babyId}/temp/${sessionId}/${mediaId}.jpg`;
}

export function isCanonicalMediaPath(path: string): boolean {
  return path.length <= 512 && /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|heic|heif|webp)$/.test(path);
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
