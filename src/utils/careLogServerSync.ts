import type { CareSetup } from "../types/careSetup";
import type { BabyLogEntry } from "../types/babyLog";
import { AuthRepository } from "../repositories/AuthRepository";
import { BabyRepository } from "../repositories/BabyRepository";
import { CareLogRepository } from "../repositories/CareLogRepository";
import { isSupabaseConfigured } from "../lib/supabase";
import { detectLocalCareLogMigrationCandidates } from "./careLogsMigration";
import { getEffectiveCareSetup, loadCareSetup } from "./careSetupStore";
import { devLog, devWarn } from "./devLog";
import {
  getSupabaseSync,
  hydrateSupabaseSync,
  saveSupabaseSync,
} from "./supabaseSyncStore";

export type CareLogBootstrapResult = {
  usedServer: boolean;
  babyId: string | null;
  logs: BabyLogEntry[] | null;
  migrationCandidateCount: number;
  error?: string;
};

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

async function bindBaby(careSetup: CareSetup): Promise<{ userId: string; babyId: string }> {
  const session = await AuthRepository.ensureSession();
  const sync = getSupabaseSync();

  // Drop stale baby pointer from a previous auth user.
  const babyIdHint = sync.userId === session.user.id ? sync.babyId : null;

  // An existing active pointer is server-authoritative. Never overwrite a selected
  // sibling's profile with the device's previous single-baby CareSetup cache.
  const hintedBaby = babyIdHint ? await BabyRepository.getBaby(babyIdHint) : null;
  const baby = hintedBaby ?? await BabyRepository.ensureFromCareSetup(careSetup, null);
  await saveSupabaseSync({
    userId: session.user.id,
    babyId: baby.id,
    migrationCandidateCount: sync.migrationCandidateCount,
    lastHydratedAt: new Date().toISOString(),
  });
  return { userId: session.user.id, babyId: baby.id };
}

/** Always re-bind session→profile→baby so short-tap writes never use a stale babyId. */
export async function ensureCareLogBabyId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  await hydrateSupabaseSync();
  try {
    const setup = loadCareSetup() ?? getEffectiveCareSetup();
    const bound = await bindBaby(setup);
    return bound.babyId;
  } catch (e) {
    devWarn("[supabase] ensureCareLogBabyId failed:", errMsg(e));
    return null;
  }
}

/**
 * Prefer server care_logs when Supabase is configured.
 * Local AsyncStorage remains cache; migration is detection-only.
 */
export async function bootstrapCareLogsFromServer(opts: {
  careSetup: CareSetup;
  hasSavedCareSetup: boolean;
  localLogs: BabyLogEntry[] | null;
}): Promise<CareLogBootstrapResult> {
  await hydrateSupabaseSync();

  if (!isSupabaseConfigured()) {
    return {
      usedServer: false,
      babyId: getSupabaseSync().babyId,
      logs: null,
      migrationCandidateCount: 0,
    };
  }

  // Never create an auth session or baby while login or first-run UI is visible.
  // A server baby is bound only after onboarding has produced a real CareSetup.
  if (!opts.hasSavedCareSetup || !(await AuthRepository.getSession())) {
    return {
      usedServer: false,
      babyId: getSupabaseSync().babyId,
      logs: null,
      migrationCandidateCount: 0,
    };
  }

  try {
    const { babyId } = await bindBaby(opts.careSetup);
    const remote = await CareLogRepository.hydrateCareLogs(babyId);
    const candidates = detectLocalCareLogMigrationCandidates(opts.localLogs ?? [], remote);

    await saveSupabaseSync({
      ...getSupabaseSync(),
      babyId,
      migrationCandidateCount: candidates.length,
      lastHydratedAt: new Date().toISOString(),
    });

    if (remote.length > 0) {
      return {
        usedServer: true,
        babyId,
        logs: remote,
        migrationCandidateCount: candidates.length,
      };
    }

    return {
      usedServer: true,
      babyId,
      logs: opts.localLogs,
      migrationCandidateCount: candidates.length,
    };
  } catch (e) {
    const message = errMsg(e);
    devWarn("[supabase] bootstrap failed:", message);
    return {
      usedServer: false,
      babyId: getSupabaseSync().babyId,
      logs: null,
      migrationCandidateCount: 0,
      error: message,
    };
  }
}

export async function syncCareLogCreate(entry: BabyLogEntry, babyIdOverride?: string): Promise<BabyLogEntry | null> {
  if (!isSupabaseConfigured()) {
    devWarn("[supabase] skip create: not configured");
    return null;
  }
  const babyId = babyIdOverride ?? await ensureCareLogBabyId();
  if (!babyId) {
    devWarn("[supabase] skip create: no babyId (auth/bootstrap failed)");
    return null;
  }
  try {
    const remote = await CareLogRepository.createCareLog(babyId, entry, { notifyFamily: true });
    devLog("[supabase] care_log synced", remote.id, remote.cat);
    return remote;
  } catch (e) {
    devWarn("[supabase] createCareLog failed:", errMsg(e));
    return null;
  }
}

export async function syncCareLogUpdate(
  id: string,
  entry: Omit<BabyLogEntry, "id">,
  babyIdOverride?: string,
): Promise<BabyLogEntry | null> {
  if (!isSupabaseConfigured()) return null;
  const babyId = babyIdOverride ?? await ensureCareLogBabyId();
  if (!babyId) return null;
  try {
    const remote = await CareLogRepository.updateCareLog(babyId, id, entry);
    devLog("[supabase] care_log updated", remote.id);
    return remote;
  } catch (e) {
    devWarn("[supabase] updateCareLog failed:", errMsg(e));
    return null;
  }
}

export async function syncCareLogDelete(id: string, babyIdOverride?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const babyId = babyIdOverride ?? await ensureCareLogBabyId();
  if (!babyId) return false;
  try {
    await CareLogRepository.deleteCareLog(babyId, id);
    devLog("[supabase] care_log deleted", id);
    return true;
  } catch (e) {
    devWarn("[supabase] deleteCareLog failed:", errMsg(e));
    return false;
  }
}

export async function fetchCareLogsByDateRange(
  babyId: string,
  fromDateKey: string,
  toDateKey: string,
): Promise<BabyLogEntry[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    return await CareLogRepository.getCareLogsByBabyAndDateRange(babyId, fromDateKey, toDateKey);
  } catch (e) {
    devWarn("[supabase] care-log range fetch failed:", errMsg(e));
    return null;
  }
}

export async function fetchCareLogById(babyId: string, id: string): Promise<BabyLogEntry | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    return await CareLogRepository.getCareLogById(babyId, id);
  } catch (e) {
    devWarn("[supabase] care-log id fetch failed:", errMsg(e));
    return null;
  }
}
