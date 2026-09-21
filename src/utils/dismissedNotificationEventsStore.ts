import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storageKeys";

const MAX_DISMISSED = 200;

function storageKey(userId: string): string {
  return `${STORAGE_KEYS.dismissedNotificationEvents}:${userId}`;
}

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0))];
  } catch {
    return [];
  }
}

export async function readDismissedNotificationEventIds(userId: string): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(storageKey(userId)).catch(() => null);
  return new Set(parseIds(raw));
}

export async function rememberDismissedNotificationEvent(userId: string, eventId: string): Promise<void> {
  const ids = [...await readDismissedNotificationEventIds(userId), eventId];
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(ids.slice(-MAX_DISMISSED)));
}
