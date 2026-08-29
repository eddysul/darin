import { isSupabaseConfigured } from "../lib/supabase";
import { AuthRepository } from "../repositories/AuthRepository";
import { BabyRepository } from "../repositories/BabyRepository";
import type { BabyLogEntry } from "../types/babyLog";
import type { CareSetup } from "../types/careSetup";
import type { BabyRow } from "../types/database";
import { hydrateBabyLogs } from "../utils/babyLogsStore";
import {
  getCareLogCacheMetadata,
  hydrateCareLogCacheMetadata,
} from "../utils/careLogCacheMetadataStore";
import {
  resolveCareLogBootstrapPolicy,
  type CareLogHistoryCoverage,
} from "../utils/careLogHistory";
import { hydrateBabyStickers } from "../utils/babyStickersStore";
import { bootstrapCareLogsFromServer, ensureCareLogBabyId } from "../utils/careLogServerSync";
import { hydrateChatHistory } from "../utils/chatHistoryStore";
import { hydrateCustomCategories } from "../utils/customCategoriesStore";
import { formatDateKey } from "../utils/dateKey";
import { hydrateDiaryEntries } from "../utils/diaryStore";
import { hydrateFamilyMembers } from "../utils/familyMembersStore";
import { hydrateGrowthBookEdit } from "../utils/growthBookStore";
import { hydrateGrowthRecords } from "../utils/growthRecordsStore";
import { removeLegacySampleLogs } from "../utils/legacySampleData";
import { hydrateQuickRecords } from "../utils/quickRecordsStore";
import { isValidLocalDataScope, type LocalDataScope } from "../utils/scopedLocalStorage";
import { getSupabaseSync, hydrateSupabaseSync, saveSupabaseSync } from "../utils/supabaseSyncStore";
import { migrateActorRole } from "./babyLogContextHelpers";

export type BabyLogScopeResolution = {
  scope: LocalDataScope | null;
  babies: BabyRow[];
};

export type BabyLogCacheHydration = {
  customOk: boolean;
  quickOk: boolean;
  logsOk: boolean;
  diaryOk: boolean;
  chatOk: boolean;
  familyOk: boolean;
  growthOk: boolean;
  stickersOk: boolean;
  growthRecordsOk: boolean;
  careLogMetadataOk: boolean;
  allLoaded: boolean;
};

export async function resolveBabyLogDataScope(input: {
  override?: LocalDataScope;
  hasSavedCareSetup: boolean;
}): Promise<BabyLogScopeResolution> {
  if (!isSupabaseConfigured()) return { scope: null, babies: [] };
  const session = await AuthRepository.getSession();
  if (!session) return { scope: null, babies: [] };

  await hydrateSupabaseSync();
  const sync = getSupabaseSync();
  const babies = await BabyRepository.listMyBabies();
  const requested = isValidLocalDataScope(input.override) && input.override.userId === session.user.id
    ? babies.find((baby) => baby.id === input.override?.babyId)
    : null;
  const persisted = requested ?? (sync.userId === session.user.id
    ? babies.find((baby) => baby.id === sync.babyId)
    : null);
  const selected = persisted ?? babies[0] ?? null;
  if (selected) {
    if (sync.userId !== session.user.id || sync.babyId !== selected.id) {
      await saveSupabaseSync({
        userId: session.user.id,
        babyId: selected.id,
        migrationCandidateCount: 0,
        lastHydratedAt: new Date().toISOString(),
      });
    }
    return { scope: { userId: session.user.id, babyId: selected.id }, babies };
  }
  if (!input.hasSavedCareSetup) return { scope: null, babies };
  const babyId = await ensureCareLogBabyId();
  return {
    scope: babyId ? { userId: session.user.id, babyId } : null,
    babies: babyId ? await BabyRepository.listMyBabies() : babies,
  };
}

export async function hydrateBabyLogCaches(
  scope: LocalDataScope | null,
  force: boolean,
): Promise<BabyLogCacheHydration> {
  const [customOk, quickOk, logsOk, diaryOk, chatOk, familyOk, growthOk, stickersOk, growthRecordsOk, careLogMetadataOk] =
    await Promise.all([
      hydrateCustomCategories(scope, force),
      hydrateQuickRecords(scope, force),
      hydrateBabyLogs(scope, force),
      hydrateDiaryEntries(scope, force),
      hydrateChatHistory(scope, force),
      hydrateFamilyMembers(scope, force),
      hydrateGrowthBookEdit(scope, force),
      hydrateBabyStickers(scope, force),
      hydrateGrowthRecords(scope, force),
      hydrateCareLogCacheMetadata(scope),
      hydrateSupabaseSync(force),
    ]);
  return {
    customOk,
    quickOk,
    logsOk,
    diaryOk,
    chatOk,
    familyOk,
    growthOk,
    stickersOk,
    growthRecordsOk,
    careLogMetadataOk,
    allLoaded: customOk && quickOk && logsOk && diaryOk && chatOk
      && familyOk && growthOk && stickersOk && growthRecordsOk && careLogMetadataOk,
  };
}

export function normalizeCachedCareLogs(storedLogs: BabyLogEntry[] | null): BabyLogEntry[] | null {
  if (storedLogs === null) return null;
  const today = formatDateKey();
  return removeLegacySampleLogs(storedLogs).map((log) => ({
    ...log,
    dateKey: log.dateKey ?? today,
    createdBy: log.createdBy
      ? { ...log.createdBy, role: migrateActorRole(log.createdBy.role as string) }
      : log.createdBy,
    source: log.source ?? (log.voice ? "voice" : "manual"),
  }));
}

export async function resolveHydratedCareLogs(input: {
  careSetup: CareSetup;
  hasSavedCareSetup: boolean;
  storedLogs: BabyLogEntry[] | null;
}): Promise<{
  logs: BabyLogEntry[] | null;
  serverAuthoritative: boolean;
  coverage: CareLogHistoryCoverage | null;
  migrationCandidateCount: number;
}> {
  const localLogs = normalizeCachedCareLogs(input.storedLogs);
  const metadata = getCareLogCacheMetadata();
  const sync = getSupabaseSync();
  const bootstrapPolicy = resolveCareLogBootstrapPolicy({
    coverage: metadata.coverage,
    verifiedAt: metadata.verifiedAt,
    migrationCandidateCount: Math.max(
      metadata.migrationCandidateCount,
      sync.migrationCandidateCount,
    ),
  });
  const knownMigrationCandidateCount = Math.max(
    metadata.migrationCandidateCount,
    sync.migrationCandidateCount,
  );
  const boot = await bootstrapCareLogsFromServer({
    careSetup: input.careSetup,
    hasSavedCareSetup: input.hasSavedCareSetup,
    localLogs,
    ...bootstrapPolicy,
    knownMigrationCandidateCount,
  });
  if (boot.usedServer && boot.logs !== null) {
    return {
      logs: boot.logs,
      serverAuthoritative: true,
      coverage: boot.coverage,
      migrationCandidateCount: boot.migrationCandidateCount,
    };
  }
  return {
    logs: localLogs,
    serverAuthoritative: false,
    coverage: metadata.coverage,
    migrationCandidateCount: metadata.migrationCandidateCount,
  };
}
