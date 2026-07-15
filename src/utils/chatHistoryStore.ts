import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChatMessage } from "../types/babyLog";
import { STORAGE_KEYS } from "./storageKeys";

const STORAGE_KEY = STORAGE_KEYS.consultChat;

let memory: ChatMessage[] | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function isMsg(item: unknown): item is ChatMessage {
  if (typeof item !== "object" || item === null) return false;
  const m = item as ChatMessage;
  return typeof m.id === "string" && (m.role === "user" || m.role === "ai") && typeof m.text === "string";
}

export async function hydrateChatHistory(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        memory = raw ? (JSON.parse(raw) as unknown[]).filter(isMsg) : null;
      } catch {
        memory = null;
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
}

export function getChatHistory(): ChatMessage[] | null {
  return memory;
}

export async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  memory = messages;
  hydrated = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore
  }
}
