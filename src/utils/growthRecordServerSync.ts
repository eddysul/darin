import { isSupabaseConfigured } from "../lib/supabase";
import { AuthRepository } from "../repositories/AuthRepository";
import { GrowthRecordRepository } from "../repositories/GrowthRecordRepository";
import type { GrowthRecord, GrowthRecordDraft } from "../types/growthRecord";
import { ensureCareLogBabyId } from "./careLogServerSync";
import {
  isGrowthRecordsMigrationComplete,
  markGrowthRecordsMigrationComplete,
} from "./growthRecordsMigrationStore";
import {
  detectLocalGrowthRecordMigrationCandidates,
  mergePendingGrowthRecords,
} from "./growthRecordsMigration";

export type GrowthRecordsBootstrapResult = {
  usedServer: boolean;
  records: GrowthRecord[] | null;
  migrated: number;
  migrationFailed: number;
  error?: string;
};

function errMsg(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

export async function bootstrapGrowthRecordsFromServer(localRecords: GrowthRecord[]): Promise<GrowthRecordsBootstrapResult> {
  if (!isSupabaseConfigured()) {
    return { usedServer: false, records: null, migrated: 0, migrationFailed: 0 };
  }
  if (!(await AuthRepository.getSession())) {
    return { usedServer: false, records: null, migrated: 0, migrationFailed: 0 };
  }
  try {
    const babyId = await ensureCareLogBabyId();
    const user = await AuthRepository.getUser();
    if (!babyId || !user) throw new Error("No authenticated baby binding for growth records.");

    let remote = await GrowthRecordRepository.hydrate(babyId);
    const complete = await isGrowthRecordsMigrationComplete(user.id, babyId);
    let migrated = 0;
    let migrationFailed = 0;

    if (!complete) {
      const candidates = detectLocalGrowthRecordMigrationCandidates(localRecords, remote);
      const result = await GrowthRecordRepository.uploadLocalGrowthRecordsMigration(babyId, candidates);
      migrated = result.uploaded;
      migrationFailed = result.failed;
      if (migrationFailed === 0) {
        await markGrowthRecordsMigrationComplete(user.id, babyId);
        remote = await GrowthRecordRepository.hydrate(babyId);
      } else {
        remote = mergePendingGrowthRecords(remote, candidates);
      }
    }

    return { usedServer: true, records: remote, migrated, migrationFailed };
  } catch (error) {
    const message = errMsg(error);
    console.warn("[supabase] growth_records bootstrap failed:", message);
    return { usedServer: false, records: null, migrated: 0, migrationFailed: 0, error: message };
  }
}

export async function syncGrowthRecordCreate(record: GrowthRecord, babyIdOverride?: string): Promise<GrowthRecord | null> {
  if (!isSupabaseConfigured()) return null;
  const babyId = babyIdOverride ?? await ensureCareLogBabyId();
  if (!babyId) return null;
  try {
    const remote = await GrowthRecordRepository.create(babyId, record);
    console.log("[supabase] growth_record synced", remote.id);
    return remote;
  } catch (error) {
    console.warn("[supabase] growth_record create failed:", errMsg(error));
    return null;
  }
}

export async function syncGrowthRecordUpdate(id: string, draft: GrowthRecordDraft, babyIdOverride?: string): Promise<GrowthRecord | null> {
  if (!isSupabaseConfigured()) return null;
  const babyId = babyIdOverride ?? await ensureCareLogBabyId();
  if (!babyId) return null;
  try {
    const remote = await GrowthRecordRepository.update(babyId, id, draft);
    console.log("[supabase] growth_record updated", remote.id);
    return remote;
  } catch (error) {
    console.warn("[supabase] growth_record update failed:", errMsg(error));
    return null;
  }
}

export async function syncGrowthRecordDelete(id: string, babyIdOverride?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const babyId = babyIdOverride ?? await ensureCareLogBabyId();
  if (!babyId) return false;
  try {
    await GrowthRecordRepository.delete(babyId, id);
    console.log("[supabase] growth_record deleted", id);
    return true;
  } catch (error) {
    console.warn("[supabase] growth_record delete failed:", errMsg(error));
    return false;
  }
}
