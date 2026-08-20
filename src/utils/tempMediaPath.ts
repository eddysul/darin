const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildTempMediaPath(babyId: string, sessionId: string, mediaId: string): string {
  return `${babyId}/temp/${sessionId}/${mediaId}.jpg`;
}

export function isTempMediaPath(babyId: string, path: string): boolean {
  if (path.includes("..")) return false;
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
  return !path.includes("..") && path.startsWith(`${babyId}/${ownerId}/`);
}

export function isAllowedMediaStoragePath(babyId: string, ownerId: string, path: string): boolean {
  return isOwnedMediaPath(babyId, ownerId, path) || isTempMediaPath(babyId, path);
}
