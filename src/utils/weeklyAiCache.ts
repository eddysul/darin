import type { Locale } from "../i18n";

export const WEEKLY_AI_CACHE_FORMAT_VERSION = 1;

export type WeeklyAiCacheOperation = "weekly_narrative" | "insight_phrase";

export type WeeklyAiCacheScope = {
  userId: string;
  babyId: string;
};

export type WeeklyAiCacheIdentity = {
  cacheFormatVersion: typeof WEEKLY_AI_CACHE_FORMAT_VERSION;
  operation: WeeklyAiCacheOperation;
  userId: string;
  babyId: string;
  fromDateKey: string;
  toDateKey: string;
  locale: Locale;
  inputFingerprint: string;
  inputSchemaVersion: number;
  promptVersion: number;
};

/** An AI result may be rendered only while this complete cache identity is current. */
export type WeeklyAiDisplayState<T> = {
  identity: WeeklyAiCacheIdentity;
  value: T;
};

export type WeeklyAiCacheStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

type PersistedEntry<T> = {
  identity: WeeklyAiCacheIdentity;
  value: T;
  cachedAt: string;
};

type PersistedCache<T> = {
  cacheFormatVersion: typeof WEEKLY_AI_CACHE_FORMAT_VERSION;
  entries: PersistedEntry<T>[];
};

type StorageOperation = "load" | "save" | "delete";

type CacheStoreOptions<T> = {
  baseKey: string;
  isValue: (value: unknown) => value is T;
  maxEntries?: number;
  onStorageError?: (operation: StorageOperation) => void;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const inFlightRequests = new Map<string, Promise<unknown>>();

function validScope(scope: WeeklyAiCacheScope | null | undefined): scope is WeeklyAiCacheScope {
  return Boolean(scope?.userId.trim() && scope?.babyId.trim());
}

function encodeScopePart(value: string): string {
  return encodeURIComponent(value.trim());
}

export function weeklyAiCacheScopeId(scope: WeeklyAiCacheScope): string {
  return `${encodeScopePart(scope.userId)}:${encodeScopePart(scope.babyId)}`;
}

export function weeklyAiCacheStorageKey(baseKey: string, scope: WeeklyAiCacheScope): string {
  return `${baseKey}:${weeklyAiCacheScopeId(scope)}`;
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const item = record[key];
    if (item === undefined || typeof item === "function" || typeof item === "symbol") continue;
    out[key] = canonicalize(item);
  }
  return out;
}

/** Stable and collision-free for the canonical JSON facts used by these small prompts. */
export function weeklyAiInputFingerprint(inputFacts: unknown): string {
  const canonical = JSON.stringify(canonicalize(inputFacts));
  return `json-v1:${canonical}`;
}

export function createWeeklyAiCacheIdentity(input: {
  operation: WeeklyAiCacheOperation;
  scope: WeeklyAiCacheScope | null | undefined;
  fromDateKey: string;
  toDateKey: string;
  locale: Locale;
  inputFacts: unknown;
  inputSchemaVersion: number;
  promptVersion: number;
}): WeeklyAiCacheIdentity | null {
  if (!validScope(input.scope)) return null;
  if (!DATE_KEY_PATTERN.test(input.fromDateKey) || !DATE_KEY_PATTERN.test(input.toDateKey)) return null;
  if (input.fromDateKey > input.toDateKey) return null;
  if (!Number.isInteger(input.inputSchemaVersion) || input.inputSchemaVersion < 1) return null;
  if (!Number.isInteger(input.promptVersion) || input.promptVersion < 1) return null;
  return {
    cacheFormatVersion: WEEKLY_AI_CACHE_FORMAT_VERSION,
    operation: input.operation,
    userId: input.scope.userId.trim(),
    babyId: input.scope.babyId.trim(),
    fromDateKey: input.fromDateKey,
    toDateKey: input.toDateKey,
    locale: input.locale,
    inputFingerprint: weeklyAiInputFingerprint(input.inputFacts),
    inputSchemaVersion: input.inputSchemaVersion,
    promptVersion: input.promptVersion,
  };
}

export function isWeeklyAiCacheIdentity(value: unknown): value is WeeklyAiCacheIdentity {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WeeklyAiCacheIdentity>;
  return item.cacheFormatVersion === WEEKLY_AI_CACHE_FORMAT_VERSION
    && (item.operation === "weekly_narrative" || item.operation === "insight_phrase")
    && typeof item.userId === "string" && Boolean(item.userId.trim())
    && typeof item.babyId === "string" && Boolean(item.babyId.trim())
    && typeof item.fromDateKey === "string" && DATE_KEY_PATTERN.test(item.fromDateKey)
    && typeof item.toDateKey === "string" && DATE_KEY_PATTERN.test(item.toDateKey)
    && item.fromDateKey <= item.toDateKey
    && ["ko", "en", "ja", "es", "zh-CN"].includes(item.locale ?? "")
    && typeof item.inputFingerprint === "string" && Boolean(item.inputFingerprint)
    && Number.isInteger(item.inputSchemaVersion) && (item.inputSchemaVersion ?? 0) >= 1
    && Number.isInteger(item.promptVersion) && (item.promptVersion ?? 0) >= 1;
}

export function weeklyAiCacheIdentityKey(identity: WeeklyAiCacheIdentity): string {
  return JSON.stringify([
    identity.cacheFormatVersion,
    identity.operation,
    identity.userId,
    identity.babyId,
    identity.fromDateKey,
    identity.toDateKey,
    identity.locale,
    identity.inputFingerprint,
    identity.inputSchemaVersion,
    identity.promptVersion,
  ]);
}

export function createWeeklyAiDisplayState<T>(
  identity: WeeklyAiCacheIdentity,
  value: T,
): WeeklyAiDisplayState<T> {
  return { identity, value };
}

/** Returns null for a result produced by any other account, baby, period, locale, facts, or version. */
export function getCurrentWeeklyAiDisplayValue<T>(
  currentIdentity: WeeklyAiCacheIdentity | null | undefined,
  displayState: WeeklyAiDisplayState<T> | null | undefined,
): T | null {
  if (!currentIdentity || !displayState) return null;
  return weeklyAiCacheIdentityKey(currentIdentity) === weeklyAiCacheIdentityKey(displayState.identity)
    ? displayState.value
    : null;
}

function parsePersistedCache<T>(
  raw: string | null,
  scope: WeeklyAiCacheScope,
  isValue: (value: unknown) => value is T,
): Map<string, PersistedEntry<T>> {
  if (!raw) return new Map();
  let parsed: Partial<PersistedCache<unknown>>;
  try {
    parsed = JSON.parse(raw) as Partial<PersistedCache<unknown>>;
  } catch {
    return new Map();
  }
  if (parsed.cacheFormatVersion !== WEEKLY_AI_CACHE_FORMAT_VERSION || !Array.isArray(parsed.entries)) {
    return new Map();
  }
  const entries = new Map<string, PersistedEntry<T>>();
  for (const candidate of parsed.entries) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Partial<PersistedEntry<unknown>>;
    if (!isWeeklyAiCacheIdentity(entry.identity) || !isValue(entry.value)) continue;
    if (entry.identity.userId !== scope.userId || entry.identity.babyId !== scope.babyId) continue;
    if (typeof entry.cachedAt !== "string") continue;
    entries.set(weeklyAiCacheIdentityKey(entry.identity), {
      identity: entry.identity,
      value: entry.value,
      cachedAt: entry.cachedAt,
    });
  }
  return entries;
}

/**
 * Account+baby scoped cache with stale-hydration rejection.
 * Legacy unscoped data is deleted, never claimed by the first account that opens the screen.
 */
export function createScopedWeeklyAiCacheStore<T>(options: CacheStoreOptions<T>) {
  const maxEntries = Math.max(1, options.maxEntries ?? 8);
  let activeScopeId: string | null = null;
  let entries = new Map<string, PersistedEntry<T>>();
  let hydrated = false;
  let hydrationRun = 0;
  let hydrationPromise: Promise<boolean> | null = null;
  let writeQueue: Promise<void> = Promise.resolve();

  const reset = () => {
    activeScopeId = null;
    entries = new Map();
    hydrated = false;
    hydrationRun += 1;
    hydrationPromise = null;
  };

  const selectScope = (scope: WeeklyAiCacheScope) => {
    const nextScopeId = weeklyAiCacheScopeId(scope);
    if (activeScopeId === nextScopeId) return;
    activeScopeId = nextScopeId;
    entries = new Map();
    hydrated = false;
    hydrationRun += 1;
    hydrationPromise = null;
  };

  const hydrate = async (
    scope: WeeklyAiCacheScope | null | undefined,
    storage: WeeklyAiCacheStorage,
    force = false,
  ): Promise<boolean> => {
    if (!validScope(scope)) {
      reset();
      return false;
    }
    selectScope(scope);
    if (force) {
      entries = new Map();
      hydrated = false;
      hydrationRun += 1;
      hydrationPromise = null;
    }
    if (hydrated) return true;
    if (!hydrationPromise) {
      const requestedScopeId = weeklyAiCacheScopeId(scope);
      const requestedRun = hydrationRun;
      hydrationPromise = (async () => {
        try {
          const [raw] = await Promise.all([
            storage.getItem(weeklyAiCacheStorageKey(options.baseKey, scope)),
            storage.removeItem(options.baseKey).catch(() => options.onStorageError?.("delete")),
          ]);
          if (activeScopeId !== requestedScopeId || hydrationRun !== requestedRun) return false;
          entries = parsePersistedCache(raw, scope, options.isValue);
          hydrated = true;
          return true;
        } catch {
          options.onStorageError?.("load");
          return false;
        } finally {
          if (activeScopeId === requestedScopeId && hydrationRun === requestedRun) hydrationPromise = null;
        }
      })();
    }
    return hydrationPromise;
  };

  const get = (identity: WeeklyAiCacheIdentity | null | undefined): T | null => {
    if (!identity || !hydrated) return null;
    if (activeScopeId !== weeklyAiCacheScopeId(identity)) return null;
    return entries.get(weeklyAiCacheIdentityKey(identity))?.value ?? null;
  };

  const save = async (
    identity: WeeklyAiCacheIdentity,
    value: T,
    storage: WeeklyAiCacheStorage,
  ): Promise<boolean> => {
    if (!hydrated || !options.isValue(value)) return false;
    const scopeId = weeklyAiCacheScopeId(identity);
    if (activeScopeId !== scopeId) return false;

    const key = weeklyAiCacheIdentityKey(identity);
    entries.delete(key);
    entries.set(key, { identity, value, cachedAt: new Date().toISOString() });
    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      entries.delete(oldestKey);
    }

    const persisted: PersistedCache<T> = {
      cacheFormatVersion: WEEKLY_AI_CACHE_FORMAT_VERSION,
      entries: [...entries.values()],
    };
    const storageKey = weeklyAiCacheStorageKey(options.baseKey, identity);
    const serialized = JSON.stringify(persisted);
    let persistedSuccessfully = true;
    writeQueue = writeQueue
      .catch(() => undefined)
      .then(() => storage.setItem(storageKey, serialized))
      .catch(() => {
        persistedSuccessfully = false;
        options.onStorageError?.("save");
      });
    await writeQueue;
    return persistedSuccessfully;
  };

  return { hydrate, get, save, reset };
}

/** Shares one network request for an identical account+baby+facts identity. */
export function runWeeklyAiRequestOnce<T>(
  identity: WeeklyAiCacheIdentity,
  task: () => Promise<T>,
): Promise<T> {
  const key = weeklyAiCacheIdentityKey(identity);
  const current = inFlightRequests.get(key) as Promise<T> | undefined;
  if (current) return current;
  const next = task().finally(() => {
    if (inFlightRequests.get(key) === next) inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, next);
  return next;
}
