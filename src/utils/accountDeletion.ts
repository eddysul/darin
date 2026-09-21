import { qaStorage } from "./qaStorage";
import { isDarinStorageKey } from "./storageKeys";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";

export type AccountDeletionResult = { serverDeleted: boolean; localOnly: boolean };
export type AccountDeletionErrorCode =
  | "INVALID_CONFIRMATION"
  | "UNAUTHORIZED"
  | "ACCOUNT_DELETION_IN_PROGRESS"
  | "ACCOUNT_DELETION_TEMPORARY_FAILURE";

export class AccountDeletionError extends Error {
  constructor(readonly code: AccountDeletionErrorCode) {
    super(code);
    this.name = "AccountDeletionError";
  }
}

async function functionErrorCode(error: unknown): Promise<AccountDeletionErrorCode> {
  const context = typeof error === "object" && error !== null && "context" in error
    ? error.context : null;
  try {
    const body = context && typeof context === "object" && "json" in context
      && typeof context.json === "function" ? await context.json() : null;
    if (body?.code === "INVALID_CONFIRMATION" || body?.code === "UNAUTHORIZED"
      || body?.code === "ACCOUNT_DELETION_IN_PROGRESS"
      || body?.code === "ACCOUNT_DELETION_TEMPORARY_FAILURE") return body.code;
  } catch { /* A network or malformed response is retryable. */ }
  return "ACCOUNT_DELETION_TEMPORARY_FAILURE";
}

export function hasAccountDeletionApi(): boolean {
  return isSupabaseConfigured() || Boolean((process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim());
}

/**
 * Delete the authenticated server account when a production API is configured.
 * Local/demo builds have no server identity, so the caller can still complete local deletion.
 */
export async function deleteServerAccount(confirmationText: string): Promise<AccountDeletionResult> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.functions.invoke<{ deleted?: boolean; code?: AccountDeletionErrorCode }>(
      "delete-account",
      { method: "POST", body: { confirmationText } },
    );
    if (error) throw new AccountDeletionError(await functionErrorCode(error));
    if (!data?.deleted) throw new AccountDeletionError(data?.code ?? "ACCOUNT_DELETION_TEMPORARY_FAILURE");
    return { serverDeleted: true, localOnly: false };
  }

  const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");
  if (!baseUrl) return { serverDeleted: false, localOnly: true };

  const response = await fetch(`${baseUrl}/v1/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new AccountDeletionError("ACCOUNT_DELETION_TEMPORARY_FAILURE");
  }
  return { serverDeleted: true, localOnly: false };
}

export async function clearLocalAppData(): Promise<void> {
  const allKeys = await qaStorage.getAllKeys();
  const ownedKeys = allKeys.filter(isDarinStorageKey);
  await qaStorage.multiRemove(ownedKeys);
}
