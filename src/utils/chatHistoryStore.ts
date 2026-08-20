import type { ChatMessage } from "../types/babyLog";
import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import {
  isValidLocalDataScope,
  localDataScopeId,
  readScopedWithLegacyMigration,
  scopedStorageKey,
  type LocalDataScope,
} from "./scopedLocalStorage";

const STORAGE_KEY = STORAGE_KEYS.consultChat;

let memory: ChatMessage[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;
let activeScopeId: string | null = null;

function isMsg(item: unknown): item is ChatMessage {
  if (typeof item !== "object" || item === null) return false;
  const m = item as ChatMessage;
  return typeof m.id === "string" && (m.role === "user" || m.role === "ai") && typeof m.text === "string";
}

function parseMessages(raw: string): ChatMessage[] | null {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return null;
  return parsed.filter(isMsg);
}

function mergeMessages(scoped: ChatMessage[] | null, legacy: ChatMessage[]): ChatMessage[] {
  if (scoped && scoped.length > 0) return scoped;
  return legacy;
}

export async function hydrateChatHistory(
  scope: LocalDataScope | null,
  force = false,
): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) {
    resetChatHistoryMemory();
    return true;
  }
  const nextScopeId = localDataScopeId(scope);
  if (activeScopeId !== nextScopeId) {
    memory = null;
    hydrated = false;
    hydratePromise = null;
    activeScopeId = nextScopeId;
  }
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    const requestedScopeId = nextScopeId;
    hydratePromise = (async () => {
      try {
        const result = await readScopedWithLegacyMigration({
          baseKey: STORAGE_KEY,
          scope,
          parse: parseMessages,
          serialize: JSON.stringify,
          merge: mergeMessages,
        });
        if (activeScopeId !== requestedScopeId) return false;
        memory = result.value;
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

export async function saveChatHistory(
  messages: ChatMessage[],
  scope: LocalDataScope | null,
): Promise<void> {
  if (!isValidLocalDataScope(scope)) return;
  const scopeId = localDataScopeId(scope);
  if (!hydrated || activeScopeId !== scopeId) return;
  memory = messages;
  try {
    await qaStorage.setItem(scopedStorageKey(STORAGE_KEY, scope), JSON.stringify(messages));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}

export function resetChatHistoryMemory(): void {
  memory = null;
  hydrated = false;
  hydratePromise = null;
  activeScopeId = null;
}
