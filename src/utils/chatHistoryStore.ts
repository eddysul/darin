import type { ChatMessage } from "../types/babyLog";
import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";

const STORAGE_KEY = STORAGE_KEYS.consultChat;

let memory: ChatMessage[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

function isMsg(item: unknown): item is ChatMessage {
  if (typeof item !== "object" || item === null) return false;
  const m = item as ChatMessage;
  return typeof m.id === "string" && (m.role === "user" || m.role === "ai") && typeof m.text === "string";
}

export async function hydrateChatHistory(force = false): Promise<boolean> {
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(STORAGE_KEY);
        memory = raw ? (JSON.parse(raw) as unknown[]).filter(isMsg) : null;
        hydrated = true;
        return true;
      } catch {
        reportStorageIssue("load", STORAGE_KEY);
        return false;
      }
    })();
  }
  return hydratePromise;
}

export function getChatHistory(): ChatMessage[] | null {
  return memory;
}

export async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  memory = messages;
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}
