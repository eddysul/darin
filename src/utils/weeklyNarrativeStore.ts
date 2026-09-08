/** Account+baby scoped cache for validated weekly narrative copy. */
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import { qaStorage } from "./qaStorage";
import {
  createScopedWeeklyAiCacheStore,
  type WeeklyAiCacheIdentity,
  type WeeklyAiCacheScope,
} from "./weeklyAiCache";

export type CachedNarrative = {
  headline: string;
  body: string;
  fromAI: boolean;
};

const STORAGE_KEY = STORAGE_KEYS.weeklyNarrative;

function isCachedNarrative(value: unknown): value is CachedNarrative {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CachedNarrative>;
  return typeof item.headline === "string" && Boolean(item.headline.trim())
    && typeof item.body === "string" && Boolean(item.body.trim())
    && typeof item.fromAI === "boolean";
}

const cache = createScopedWeeklyAiCacheStore<CachedNarrative>({
  baseKey: STORAGE_KEY,
  isValue: isCachedNarrative,
  onStorageError: (operation) => reportStorageIssue(operation, STORAGE_KEY),
});

export function hydrateWeeklyNarrative(
  scope: WeeklyAiCacheScope | null,
  force = false,
): Promise<boolean> {
  return cache.hydrate(scope, qaStorage, force);
}

export function getWeeklyNarrative(identity: WeeklyAiCacheIdentity): CachedNarrative | null {
  return cache.get(identity);
}

export function saveWeeklyNarrative(
  identity: WeeklyAiCacheIdentity,
  value: CachedNarrative,
): Promise<boolean> {
  return cache.save(identity, value, qaStorage);
}

export function resetWeeklyNarrativeMemory(): void {
  cache.reset();
}
