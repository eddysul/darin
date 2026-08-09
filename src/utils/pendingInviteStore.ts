import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storageKeys";
import { normalizeInviteCode } from "./inviteCode";

export { parseInviteCodeFromUrl } from "./inviteCode";

let pendingCode: string | null = null;
let hydrated = false;

export async function hydratePendingInvite(): Promise<string | null> {
  if (!hydrated) {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.pendingInvite).catch(() => null);
    pendingCode = stored ? normalizeInviteCode(stored) : null;
    hydrated = true;
  }
  return pendingCode;
}

export async function savePendingInvite(code: string): Promise<string | null> {
  pendingCode = normalizeInviteCode(code);
  hydrated = true;
  if (pendingCode) await AsyncStorage.setItem(STORAGE_KEYS.pendingInvite, pendingCode);
  else await AsyncStorage.removeItem(STORAGE_KEYS.pendingInvite);
  return pendingCode;
}

export async function clearPendingInvite(): Promise<void> {
  pendingCode = null;
  hydrated = true;
  await AsyncStorage.removeItem(STORAGE_KEYS.pendingInvite);
}
