export type DeleteAudioFile = (
  uri: string,
  options: { idempotent: boolean },
) => Promise<void>;

export function isDisposableAudioUri(uri: string | null | undefined): uri is string {
  return typeof uri === "string" && uri.startsWith("file://");
}

export async function discardAudioFile(
  uri: string | null | undefined,
  deleteFile: DeleteAudioFile,
): Promise<boolean> {
  if (!isDisposableAudioUri(uri)) return false;
  try {
    await deleteFile(uri, { idempotent: true });
    return true;
  } catch {
    // State invalidation must not be blocked by best-effort temp-file cleanup.
    return false;
  }
}
