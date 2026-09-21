import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storageKeys";

const BIO_MAX = 60;

function keyFor(userId: string) {
  return `${STORAGE_KEYS.profileBio}:${userId}`;
}

export function clampProfileBio(value: string): string {
  return Array.from(value).slice(0, BIO_MAX).join("");
}

export async function readProfileBio(userId: string): Promise<string> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  return raw?.trim() ? clampProfileBio(raw) : "";
}

export async function writeProfileBio(userId: string, value: string): Promise<void> {
  const next = clampProfileBio(value).trim();
  if (!next) {
    await AsyncStorage.removeItem(keyFor(userId));
    return;
  }
  await AsyncStorage.setItem(keyFor(userId), next);
}
