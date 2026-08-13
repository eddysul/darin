import type { ActiveTimer } from "../types/activeTimer";
import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import { isValidLocalDataScope, localDataScopeId, scopedStorageKey, type LocalDataScope } from "./scopedLocalStorage";

const STORAGE_KEY = STORAGE_KEYS.activeTimers;

let memory: ActiveTimer[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;
let activeScopeId: string | null = null;

function isTimer(item: unknown): item is ActiveTimer {
  if (typeof item !== "object" || item === null) return false;
  const t = item as ActiveTimer;
  return (
    typeof t.id === "string" &&
    typeof t.kind === "string" &&
    typeof t.action === "string" &&
    typeof t.startTime === "string" &&
    typeof t.segmentStartedAt === "string"
  );
}

function normalize(raw: unknown): ActiveTimer[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isTimer).map((t) => ({
    ...t,
    accumulatedMs: t.accumulatedMs ?? 0,
    leftMs: t.leftMs ?? 0,
    rightMs: t.rightMs ?? 0,
    status: t.status === "paused" ? "paused" : "running",
  }));
}

export async function hydrateActiveTimers(scope: LocalDataScope | null, force = false): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) { memory = []; hydrated = true; activeScopeId = null; return true; }
  const scopeId = localDataScopeId(scope);
  if (activeScopeId !== scopeId) { memory = null; hydrated = false; hydratePromise = null; activeScopeId = scopeId; }
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(scopedStorageKey(STORAGE_KEY, scope));
        memory = raw ? normalize(JSON.parse(raw)) : null;
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

export function getActiveTimers(): ActiveTimer[] | null {
  return memory;
}

export async function saveActiveTimers(timers: ActiveTimer[], scope: LocalDataScope | null): Promise<void> {
  if (!isValidLocalDataScope(scope) || activeScopeId !== localDataScopeId(scope)) return;
  memory = timers;
  hydrated = true;
  try {
    await qaStorage.setItem(scopedStorageKey(STORAGE_KEY, scope), JSON.stringify(timers));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}
