import { isSupabaseConfigured } from "../lib/supabase";
import { AuthRepository } from "../repositories/AuthRepository";
import { DiaryRepository } from "../repositories/DiaryRepository";
import type { DiaryEntry } from "../types/babyLog";
import {
  isDiaryServerMigrationComplete,
  markDiaryServerMigrationComplete,
} from "./diaryServerMigrationStore";
import { isValidLocalDataScope, type LocalDataScope } from "./scopedLocalStorage";

export type DiaryBootstrapResult = {
  usedServer: boolean;
  entries: DiaryEntry[] | null;
  migrated: number;
  migrationFailed: number;
  photoMigrationFailed: number;
  error?: string;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function mergePendingDiary(remote: DiaryEntry[], local: DiaryEntry[]): DiaryEntry[] {
  const byId = new Map(remote.map((entry) => [entry.id, entry]));
  // Local wins while migration is incomplete so a failed local photo upload is never discarded.
  for (const entry of local) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function authenticatedScope(scope: LocalDataScope): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) return false;
  const user = await AuthRepository.getUser();
  return user?.id === scope.userId;
}

export async function bootstrapDiaryFromServer(
  scope: LocalDataScope | null,
  localEntries: DiaryEntry[],
): Promise<DiaryBootstrapResult> {
  const empty = {
    usedServer: false,
    entries: null,
    migrated: 0,
    migrationFailed: 0,
    photoMigrationFailed: 0,
  };
  if (!isSupabaseConfigured() || !isValidLocalDataScope(scope)) return empty;
  if (!(await authenticatedScope(scope))) return empty;
  try {
    let remote = await DiaryRepository.hydrate(scope.babyId);
    if (await isDiaryServerMigrationComplete(scope)) {
      return { ...empty, usedServer: true, entries: remote };
    }

    const migration = await DiaryRepository.uploadLocalDiaryEntriesMigration(scope.babyId, localEntries);
    if (migration.failed === 0 && migration.photoFailed === 0) {
      await markDiaryServerMigrationComplete(scope);
      remote = await DiaryRepository.hydrate(scope.babyId);
      return {
        ...empty,
        usedServer: true,
        entries: remote,
        migrated: migration.uploaded,
      };
    }

    return {
      ...empty,
      usedServer: true,
      entries: mergePendingDiary(remote, localEntries),
      migrated: migration.uploaded,
      migrationFailed: migration.failed,
      photoMigrationFailed: migration.photoFailed,
    };
  } catch (error) {
    const message = errorMessage(error);
    console.warn("[supabase] diary bootstrap failed:", message);
    return { ...empty, error: message };
  }
}

export async function syncDiaryCreate(
  scope: LocalDataScope | null,
  entry: DiaryEntry,
): Promise<DiaryEntry | null> {
  if (!isSupabaseConfigured() || !isValidLocalDataScope(scope) || !(await authenticatedScope(scope))) return null;
  try {
    const result = await DiaryRepository.createWithPhotos(scope.babyId, entry);
    if (result.photoUploadFailed > 0) {
      console.warn(`[supabase] ${result.photoUploadFailed} diary photo upload(s) failed; text was preserved.`);
    }
    return result.entry;
  } catch (error) {
    console.warn("[supabase] diary create failed:", errorMessage(error));
    return null;
  }
}

export async function syncDiaryUpdate(
  scope: LocalDataScope | null,
  entry: DiaryEntry,
): Promise<DiaryEntry | null> {
  if (!isSupabaseConfigured() || !isValidLocalDataScope(scope) || !(await authenticatedScope(scope))) return null;
  try {
    const result = await DiaryRepository.updateWithPhotos(scope.babyId, entry);
    if (result.photoUploadFailed > 0) {
      console.warn(`[supabase] ${result.photoUploadFailed} diary photo upload(s) failed; text was preserved.`);
    }
    return result.entry;
  } catch (error) {
    console.warn("[supabase] diary update failed:", errorMessage(error));
    return null;
  }
}

export async function syncDiaryDelete(
  scope: LocalDataScope | null,
  diaryEntryId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured() || !isValidLocalDataScope(scope) || !(await authenticatedScope(scope))) return false;
  try {
    await DiaryRepository.softDelete(diaryEntryId);
    return true;
  } catch (error) {
    console.warn("[supabase] diary delete failed:", errorMessage(error));
    return false;
  }
}
