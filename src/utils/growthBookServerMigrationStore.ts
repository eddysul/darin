import { qaStorage } from "./qaStorage";
import { isValidLocalDataScope, localDataScopeId, type LocalDataScope } from "./scopedLocalStorage";

const PREFIX = "darin:growth-book-server-migrated";

export function growthBookServerMigrationFlagKey(scope: LocalDataScope): string {
  return `${PREFIX}:${localDataScopeId(scope)}`;
}

export async function isGrowthBookServerMigrationComplete(scope: LocalDataScope): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) return false;
  return !!(await qaStorage.getItem(growthBookServerMigrationFlagKey(scope)));
}

export async function markGrowthBookServerMigrationComplete(scope: LocalDataScope): Promise<void> {
  if (!isValidLocalDataScope(scope)) return;
  await qaStorage.setItem(
    growthBookServerMigrationFlagKey(scope),
    JSON.stringify({ completedAt: new Date().toISOString() }),
  );
}
