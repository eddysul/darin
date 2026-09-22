type UploadError = { statusCode?: unknown; status?: unknown; message?: unknown; originalError?: unknown };

function details(error: unknown): UploadError {
  return error !== null && typeof error === "object" ? error as UploadError : {};
}

export function mediaUploadFailureCategory(error: unknown): string {
  const item = details(error);
  const original = details(item.originalError);
  const status = Number(item.statusCode ?? item.status);
  if (status === 409) return "ALREADY_EXISTS";
  if (status === 401 || status === 403) return "ACCESS_DENIED";
  if (status === 413) return "FILE_TOO_LARGE";
  if (status >= 500 && status < 600) return "SERVER_UNAVAILABLE";
  if ([item.message, original.message].some(message => typeof message === "string"
    && /network request failed|failed to fetch|networkerror/i.test(message))) return "NETWORK_FAILED";
  return "UPLOAD_FAILED";
}

/** One retry, same immutable key. An ambiguous success must pass ownership verification. */
export async function uploadMediaWithRecovery(input: {
  upload: () => Promise<{ error: unknown }>;
  verifyOwned: () => Promise<boolean>;
  assertCurrent: () => Promise<void>;
  wait?: () => Promise<void>;
}): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await input.assertCurrent();
    let error: unknown;
    try { error = (await input.upload()).error; } catch (cause) { error = cause; }
    if (!error) return;
    const category = mediaUploadFailureCategory(error);
    if (category === "ALREADY_EXISTS") {
      await input.assertCurrent();
      if (await input.verifyOwned()) return;
      throw error;
    }
    if (attempt === 1 || (category !== "NETWORK_FAILED" && category !== "SERVER_UNAVAILABLE")) throw error;
    await (input.wait?.() ?? new Promise<void>(resolve => setTimeout(resolve, 500)));
  }
}
