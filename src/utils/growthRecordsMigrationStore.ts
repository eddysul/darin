import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";

type MigrationState = { completed: string[] };

function key(userId: string, babyId: string): string {
  return `${userId}:${babyId}`;
}

async function read(): Promise<MigrationState> {
  try {
    const raw = await qaStorage.getItem(STORAGE_KEYS.growthRecordsMigration);
    if (!raw) return { completed: [] };
    const parsed = JSON.parse(raw) as Partial<MigrationState>;
    return { completed: Array.isArray(parsed.completed) ? parsed.completed.filter((v): v is string => typeof v === "string") : [] };
  } catch {
    reportStorageIssue("load", STORAGE_KEYS.growthRecordsMigration);
    return { completed: [] };
  }
}

export async function isGrowthRecordsMigrationComplete(userId: string, babyId: string): Promise<boolean> {
  return (await read()).completed.includes(key(userId, babyId));
}

export async function markGrowthRecordsMigrationComplete(userId: string, babyId: string): Promise<void> {
  const state = await read();
  const next = key(userId, babyId);
  if (state.completed.includes(next)) return;
  try {
    await qaStorage.setItem(
      STORAGE_KEYS.growthRecordsMigration,
      JSON.stringify({ completed: [...state.completed, next] }),
    );
  } catch {
    reportStorageIssue("save", STORAGE_KEYS.growthRecordsMigration);
  }
}

export async function clearGrowthRecordsMigrationState(): Promise<void> {
  try {
    await qaStorage.removeItem(STORAGE_KEYS.growthRecordsMigration);
  } catch {
    reportStorageIssue("save", STORAGE_KEYS.growthRecordsMigration);
  }
}
