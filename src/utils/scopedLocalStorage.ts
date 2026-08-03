import { qaStorage } from "./qaStorage";

export type LocalDataScope = {
  userId: string;
  babyId: string;
};

const MIGRATION_VERSION = "v1";

function encodeScopePart(value: string): string {
  return encodeURIComponent(value.trim());
}

export function isValidLocalDataScope(scope: LocalDataScope | null | undefined): scope is LocalDataScope {
  return !!scope?.userId.trim() && !!scope?.babyId.trim();
}

export function localDataScopeId(scope: LocalDataScope): string {
  return `${encodeScopePart(scope.userId)}:${encodeScopePart(scope.babyId)}`;
}

export function scopedStorageKey(baseKey: string, scope: LocalDataScope): string {
  return `${baseKey}:${localDataScopeId(scope)}`;
}

export function scopedMigrationFlagKey(baseKey: string, scope: LocalDataScope): string {
  return `${baseKey}:scoped-migration:${MIGRATION_VERSION}:${localDataScopeId(scope)}`;
}

function legacyClaimKey(baseKey: string): string {
  return `${baseKey}:scoped-migration-claim:${MIGRATION_VERSION}`;
}

type ScopedMigrationInput<T> = {
  baseKey: string;
  scope: LocalDataScope;
  parse: (raw: string) => T | null;
  serialize: (value: T) => string;
  merge: (scoped: T | null, legacy: T) => T;
  storage?: ScopedStorageAdapter;
};

export type ScopedStorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type ScopedMigrationResult<T> = {
  value: T | null;
  migrated: boolean;
};

/**
 * Reads an account/baby-scoped value and performs a one-time legacy claim when safe.
 *
 * The claim is written before the scoped copy. If copying fails, the legacy value stays
 * intact and remains bound to the same account scope for a later retry; another account
 * can never accidentally import it.
 */
export async function readScopedWithLegacyMigration<T>(
  input: ScopedMigrationInput<T>,
): Promise<ScopedMigrationResult<T>> {
  const scopedKey = scopedStorageKey(input.baseKey, input.scope);
  const flagKey = scopedMigrationFlagKey(input.baseKey, input.scope);
  const claimKey = legacyClaimKey(input.baseKey);
  const scopeId = localDataScopeId(input.scope);
  const storage = input.storage ?? qaStorage;

  const [scopedRaw, flagRaw, claimRaw, legacyRaw] = await Promise.all([
    storage.getItem(scopedKey),
    storage.getItem(flagKey),
    storage.getItem(claimKey),
    storage.getItem(input.baseKey),
  ]);

  const scopedValue = scopedRaw ? input.parse(scopedRaw) : null;
  if (flagRaw || !legacyRaw) return { value: scopedValue, migrated: false };

  let claimedScopeId: string | null = null;
  if (claimRaw) {
    try {
      const claim = JSON.parse(claimRaw) as { scopeId?: unknown };
      claimedScopeId = typeof claim.scopeId === "string" ? claim.scopeId : null;
    } catch {
      // An unreadable claim must block migration rather than expose legacy data.
      return { value: scopedValue, migrated: false };
    }
  }
  if (claimedScopeId && claimedScopeId !== scopeId) {
    return { value: scopedValue, migrated: false };
  }

  const legacyValue = input.parse(legacyRaw);
  if (legacyValue === null) return { value: scopedValue, migrated: false };

  const merged = input.merge(scopedValue, legacyValue);
  const serialized = input.serialize(merged);
  await storage.setItem(
    claimKey,
    JSON.stringify({ scopeId, claimedAt: new Date().toISOString() }),
  );
  await storage.setItem(scopedKey, serialized);
  const verified = await storage.getItem(scopedKey);
  if (verified !== serialized) throw new Error(`Scoped local migration verification failed: ${input.baseKey}`);
  await storage.setItem(flagKey, JSON.stringify({ migratedAt: new Date().toISOString() }));
  await storage.removeItem(input.baseKey);
  return { value: merged, migrated: true };
}
