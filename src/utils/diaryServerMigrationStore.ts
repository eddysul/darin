import { qaStorage } from "./qaStorage";
import { isValidLocalDataScope, localDataScopeId, type LocalDataScope } from "./scopedLocalStorage";

const DIARY_SERVER_MIGRATION_PREFIX = "darin:diary-server-migrated";

export function diaryServerMigrationFlagKey(scope: LocalDataScope): string {
  return `${DIARY_SERVER_MIGRATION_PREFIX}:${localDataScopeId(scope)}`;
}

export async function isDiaryServerMigrationComplete(scope: LocalDataScope): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) return false;
  return !!(await qaStorage.getItem(diaryServerMigrationFlagKey(scope)));
}

export async function markDiaryServerMigrationComplete(scope: LocalDataScope): Promise<void> {
  if (!isValidLocalDataScope(scope)) return;
  await qaStorage.setItem(
    diaryServerMigrationFlagKey(scope),
    JSON.stringify({ completedAt: new Date().toISOString() }),
  );
}
