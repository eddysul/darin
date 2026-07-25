import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";

export type AccountDeletionResult = { serverDeleted: boolean; localOnly: boolean };

export function hasAccountDeletionApi(): boolean {
  return Boolean((process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim());
}

/**
 * Delete the authenticated server account when a production API is configured.
 * Local/demo builds have no server identity, so the caller can still complete local deletion.
 */
export async function deleteServerAccount(): Promise<AccountDeletionResult> {
  const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");
  if (!baseUrl) return { serverDeleted: false, localOnly: true };

  const response = await fetch(`${baseUrl}/v1/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`계정 삭제 요청 실패 (${response.status})`);
  }
  return { serverDeleted: true, localOnly: false };
}

export async function clearLocalAppData(): Promise<void> {
  await Promise.all(Object.values(STORAGE_KEYS).map((key) => qaStorage.removeItem(key)));
}
