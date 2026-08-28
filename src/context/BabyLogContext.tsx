import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CustomCategory } from "../types/logCategory";
import type { CustomCategoryTemplate } from "../constants/customCategoryTemplates";
import { useApp } from "./AppContext";
import type { BabyLogActor, BabyLogEntry, ChatMessage, DiaryEntry } from "../types/babyLog";
import type { CareSetup, DefaultFeedingMethod } from "../types/careSetup";
import { relationshipToLabel } from "../types/careSetup";
import type { FamilyMember, FamilyRole } from "../types/family";
import type { QuickRecord } from "../types/quickRecord";
import { buildBabyDisplay, formatDiaryStageLabel } from "../utils/childDisplay";
import {
  getCustomCategories,
  hydrateCustomCategories,
  resetCustomCategoriesMemory,
  saveCustomCategories,
} from "../utils/customCategoriesStore";
import { getQuickRecords, hydrateQuickRecords, resetQuickRecordsMemory, saveQuickRecords } from "../utils/quickRecordsStore";
import { getBabyLogs, hydrateBabyLogs, resetBabyLogsMemory, saveBabyLogs } from "../utils/babyLogsStore";
import {
  bootstrapCareLogsFromServer,
  ensureCareLogBabyId,
  syncCareLogCreate,
  syncCareLogDelete,
  syncCareLogUpdate,
} from "../utils/careLogServerSync";
import { clearSupabaseSync, getSupabaseSync, hydrateSupabaseSync, saveSupabaseSync } from "../utils/supabaseSyncStore";
import { AuthRepository } from "../repositories/AuthRepository";
import { FamilyRepository } from "../repositories/FamilyRepository";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  getDiaryEntries,
  hydrateDiaryEntries,
  resetDiaryEntriesMemory,
  saveDiaryEntries,
} from "../utils/diaryStore";
import {
  bootstrapDiaryFromServer,
  syncDiaryCreate,
  syncDiaryDelete,
  syncDiaryUpdate,
} from "../utils/diaryServerSync";
import {
  getChatHistory,
  hydrateChatHistory,
  resetChatHistoryMemory,
  saveChatHistory,
} from "../utils/chatHistoryStore";
import {
  getFamilyMembers,
  hydrateFamilyMembers,
  resetFamilyMembersMemory,
  saveFamilyMembers,
} from "../utils/familyMembersStore";
import {
  ensureGrowthBookEdit,
  getGrowthBookEdit,
  hydrateGrowthBookEdit,
  resetGrowthBookEditMemory,
  saveGrowthBookEdit,
} from "../utils/growthBookStore";
import {
  bootstrapGrowthBookFromServer,
  syncGrowthBookEdit,
} from "../utils/growthBookServerSync";
import {
  getBabyStickers,
  hydrateBabyStickers,
  mergeBabyStickerLists,
  resetBabyStickersMemory,
  saveBabyStickers,
  withLocalStickerAssets,
} from "../utils/babyStickersStore";
import { BabyStickerRepository } from "../repositories/BabyStickerRepository";
import type { GrowthBookEdit } from "../types/growthBook";
import type { BabySticker } from "../types/babySticker";
import type { GrowthRecord, GrowthRecordDraft } from "../types/growthRecord";
import { createEmptyGrowthBookEdit } from "../types/growthBook";
import { createId } from "../utils/id";
import {
  getGrowthRecords,
  hydrateGrowthRecords,
  resetGrowthRecordsMemory,
  saveGrowthRecords,
} from "../utils/growthRecordsStore";
import {
  bootstrapGrowthRecordsFromServer,
  syncGrowthRecordCreate,
  syncGrowthRecordDelete,
  syncGrowthRecordUpdate,
} from "../utils/growthRecordServerSync";
import { clearGrowthRecordsMigrationState } from "../utils/growthRecordsMigrationStore";
import { formatDateKey } from "../utils/dateKey";
import { actorFromFamily } from "../utils/logProvenance";
import type { BabyLogSource } from "../types/babyLog";
import {
  clearDiaryDraft,
  getDiaryDraft,
  resetDiaryDraftMemory,
  saveDiaryDraft,
} from "../utils/diaryDraftStore";
import {
  isValidLocalDataScope,
  localDataScopeId,
  type LocalDataScope,
} from "../utils/scopedLocalStorage";
import { BabyRepository, type CreateBabyInput } from "../repositories/BabyRepository";
import type { BabyRow } from "../types/database";
import type { CautionFood, CautionFoodSource } from "../types/cautionFood";
import { CautionFoodRepository } from "../repositories/CautionFoodRepository";
import { loadCautionFoods, normalizeCautionFoodName, saveCautionFoods } from "../utils/cautionFoodsStore";
import { getDiaryReminder, saveDiaryReminder } from "../utils/diaryReminderStore";
import { saveCareSetup } from "../utils/careSetupStore";
import {
  clearStorageIssue,
  getStorageIssue,
  subscribeStorageIssues,
  type StorageIssue,
} from "../utils/storageIssues";
import { STORAGE_KEYS } from "../utils/storageKeys";
import {
  backupQaData,
  hasQaBackup,
  restoreQaBackup,
  switchToQaEmptyData,
} from "../utils/qaDebug";
import { buildDemoSeed } from "../utils/demoSeed";
import {
  containsLegacySampleDiary,
  removeLegacySampleDiaries,
  removeLegacySampleFamily,
  removeLegacySampleLogs,
} from "../utils/legacySampleData";
import { DEFAULT_CHAT_GREETING } from "../constants/chatDefaults";
import { migrateActorRole, sameLocalDataScope } from "./babyLogContextHelpers";
import { useBabyLogCachePersistence } from "./useBabyLogCachePersistence";

type BabyLogContextValue = {
  careSetup: CareSetup;
  babyName: string;
  babyEmoji: string;
  babyBadge: string;
  babyBirthMeta: string;
  defaultFeedingMethod: DefaultFeedingMethod;
  customCategories: CustomCategory[];
  upsertCustomCategory: (category: CustomCategory) => CustomCategory;
  addCustomFromTemplate: (template: CustomCategoryTemplate) => CustomCategory;
  addCustomByLabel: (label: string, color?: string) => CustomCategory;
  removeCustomCategory: (id: string) => void;
  quickRecords: QuickRecord[];
  setQuickRecords: (records: QuickRecord[] | ((prev: QuickRecord[]) => QuickRecord[])) => void;
  logs: BabyLogEntry[];
  diaryEntries: DiaryEntry[];
  localDataScope: LocalDataScope | null;
  babies: BabyRow[];
  activeBabyId: string | null;
  switchActiveBaby: (babyId: string) => Promise<boolean>;
  addBaby: (input: CreateBabyInput) => Promise<BabyRow>;
  refreshBabies: () => Promise<BabyRow[]>;
  cautionFoods: CautionFood[];
  addCautionFood: (foodName: string, source: CautionFoodSource) => Promise<CautionFood>;
  removeCautionFood: (id: string) => Promise<void>;
  familyMembers: FamilyMember[];
  growthBookEdit: GrowthBookEdit;
  setGrowthBookEdit: (edit: GrowthBookEdit | ((prev: GrowthBookEdit) => GrowthBookEdit)) => void;
  babyStickers: BabySticker[];
  addBabySticker: (sticker: BabySticker) => Promise<BabySticker>;
  deleteBabySticker: (id: string) => Promise<void>;
  growthRecords: GrowthRecord[];
  addGrowthRecord: (draft: GrowthRecordDraft) => GrowthRecord;
  updateGrowthRecord: (id: string, draft: GrowthRecordDraft) => void;
  deleteGrowthRecord: (id: string) => void;
  myFamilyRole: FamilyRole;
  /** Sync the local "me" member from completed CareSetup (name + relationship). */
  applyOwnerFromSetup: (setup: CareSetup) => void;
  updateFamilyMemberRole: (id: string, role: FamilyRole) => void;
  acceptFamilyInvite: (id: string) => void;
  setFamilyMemberStatus: (id: string, status: FamilyMember["status"]) => void;
  removeFamilyMember: (id: string) => void;
  chatHistory: ChatMessage[];
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  addLog: (entry: Omit<BabyLogEntry, "id">) => BabyLogEntry;
  /** Awaited variant for flows that must not discard in-progress state on a failed save. */
  addLogWithPersistence: (entry: Omit<BabyLogEntry, "id">) => Promise<BabyLogEntry | null>;
  addLogs: (entries: Omit<BabyLogEntry, "id">[]) => void;
  updateLog: (id: string, entry: Omit<BabyLogEntry, "id">) => void;
  /** Awaited variant for flows that must keep their draft active after a failed save. */
  updateLogWithPersistence: (id: string, entry: Omit<BabyLogEntry, "id">) => Promise<BabyLogEntry | null>;
  deleteLog: (id: string) => void;
  logAuthor: BabyLogActor;
  addDiary: (entry: Omit<DiaryEntry, "id" | "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }) => void;
  updateDiary: (id: string, patch: Partial<Omit<DiaryEntry, "id">>) => void;
  deleteDiary: (id: string) => void;
  toggleDiaryInGrowthBook: (id: string) => void;
  pushChat: (role: "user" | "ai", text: string, stickerId?: string) => void;
  /** True after the active baby’s consult history has been loaded (or reset). */
  chatHydrated: boolean;
  /** True after AsyncStorage hydrate finishes (2.7). */
  storageReady: boolean;
  storageIssue: StorageIssue | null;
  retryPersistence: () => Promise<void>;
  rehydrateFromServer: (scope?: LocalDataScope) => Promise<void>;
  prepareForLogout: () => Promise<void>;
  dismissStorageIssue: () => void;
  clearAllUserData: () => Promise<void>;
  qaDebug: {
    backupCurrentData: () => Promise<void>;
    useEmptyData: () => Promise<void>;
    restoreSampleData: () => Promise<void>;
    /** Fills 한눈에 cards with enough days of logs and growth records. */
    fillDemoData: () => Promise<void>;
    restoreBackupData: () => Promise<void>;
    removeQaChatTurns: () => Promise<void>;
  } | null;
};

const BabyLogContext = createContext<BabyLogContextValue | null>(null);

export function BabyLogProvider({ children }: { children: ReactNode }) {
  const { careSetup, hasSavedCareSetup, setCareSetup } = useApp();
  const [logs, setLogs] = useState<BabyLogEntry[]>([]);
  const [logsHydrated, setLogsHydrated] = useState(false);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [diaryHydrated, setDiaryHydrated] = useState(false);
  const [localDataScope, setLocalDataScope] = useState<LocalDataScope | null>(null);
  const [babies, setBabies] = useState<BabyRow[]>([]);
  const [cautionFoods, setCautionFoods] = useState<CautionFood[]>([]);
  const localDataScopeRef = useRef<LocalDataScope | null>(null);
  const storageHydrationRunRef = useRef(0);
  const growthBookDirtyRef = useRef(false);
  const growthBookSyncRunRef = useRef(0);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [familyHydrated, setFamilyHydrated] = useState(false);
  const [growthBookEdit, setGrowthBookEditState] = useState<GrowthBookEdit>(() =>
    createEmptyGrowthBookEdit({ babyId: "", babyName: "" }),
  );
  const [growthBookHydrated, setGrowthBookHydrated] = useState(false);
  const [babyStickers, setBabyStickers] = useState<BabySticker[]>([]);
  const [stickersHydrated, setStickersHydrated] = useState(false);
  const [growthRecords, setGrowthRecords] = useState<GrowthRecord[]>([]);
  const [growthRecordsHydrated, setGrowthRecordsHydrated] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([DEFAULT_CHAT_GREETING]);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageIssue, setStorageIssue] = useState<StorageIssue | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [customCategories, setCustomCategoriesState] = useState<CustomCategory[]>(getCustomCategories);
  const [quickRecords, setQuickRecordsState] = useState<QuickRecord[]>(getQuickRecords);

  useEffect(() => subscribeStorageIssues(setStorageIssue), []);

  const resolveLocalDataScope = useCallback(async (
    override?: LocalDataScope,
  ): Promise<LocalDataScope | null> => {
    if (!isSupabaseConfigured()) return null;
    const session = await AuthRepository.getSession();
    if (!session) return null;

    await hydrateSupabaseSync();
    const sync = getSupabaseSync();
    const accessibleBabies = await BabyRepository.listMyBabies();
    setBabies(accessibleBabies);
    const requested = isValidLocalDataScope(override) && override.userId === session.user.id
      ? accessibleBabies.find((baby) => baby.id === override.babyId)
      : null;
    const persisted = requested ?? (sync.userId === session.user.id
      ? accessibleBabies.find((baby) => baby.id === sync.babyId)
      : null);
    if (persisted) {
      if (sync.userId !== session.user.id || sync.babyId !== persisted.id) {
        await saveSupabaseSync({
          userId: session.user.id,
          babyId: persisted.id,
          migrationCandidateCount: 0,
          lastHydratedAt: new Date().toISOString(),
        });
      }
      return { userId: session.user.id, babyId: persisted.id };
    }
    if (accessibleBabies[0]) {
      await saveSupabaseSync({
        userId: session.user.id,
        babyId: accessibleBabies[0].id,
        migrationCandidateCount: 0,
        lastHydratedAt: new Date().toISOString(),
      });
      return { userId: session.user.id, babyId: accessibleBabies[0].id };
    }
    if (!hasSavedCareSetup) return null;
    const babyId = await ensureCareLogBabyId();
    return babyId ? { userId: session.user.id, babyId } : null;
  }, [hasSavedCareSetup]);

  const hydrateStorageState = useCallback(async (force = false, scopeOverride?: LocalDataScope) => {
    const hydrationRun = ++storageHydrationRunRef.current;
    let scope: LocalDataScope | null = null;
    try {
      scope = await resolveLocalDataScope(scopeOverride);
    } catch {
      // Without a verified auth+baby scope, account data must remain hidden.
      scope = null;
    }
    if (hydrationRun !== storageHydrationRunRef.current) return false;

    const previousScope = localDataScopeRef.current;
    const previousScopeId = previousScope ? localDataScopeId(previousScope) : null;
    const nextScopeId = scope ? localDataScopeId(scope) : null;
    if (previousScopeId !== nextScopeId) {
      growthBookDirtyRef.current = false;
      growthBookSyncRunRef.current += 1;
      setDiaryHydrated(false);
      setLogsHydrated(false);
      setFamilyHydrated(false);
      setStickersHydrated(false);
      setGrowthRecordsHydrated(false);
      setGrowthBookHydrated(false);
      setChatHydrated(false);
      setStorageReady(false);
      setDiaryEntries([]);
      setLogs([]);
      setGrowthRecords([]);
      setCautionFoods([]);
      setFamilyMembers([]);
      setBabyStickers([]);
      setChatHistory([DEFAULT_CHAT_GREETING]);
      setGrowthBookEditState(createEmptyGrowthBookEdit({ babyId: scope?.babyId ?? "", babyName: careSetup.child.childName }));
      resetDiaryEntriesMemory();
      resetBabyLogsMemory();
      resetGrowthBookEditMemory();
      resetDiaryDraftMemory();
      resetBabyStickersMemory();
      resetGrowthRecordsMemory();
      resetFamilyMembersMemory();
      resetCustomCategoriesMemory();
      resetQuickRecordsMemory();
      resetChatHistoryMemory();
      setCustomCategoriesState([]);
      setQuickRecordsState(getQuickRecords());
      localDataScopeRef.current = scope;
      setLocalDataScope(scope);
    }

    const [customOk, quickOk, logsOk, diaryOk, chatOk, familyOk, growthOk, stickersOk, growthRecordsOk, syncOk] =
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
      hydrateSupabaseSync(force),
    ]);
    if (hydrationRun !== storageHydrationRunRef.current) return false;
    void syncOk;

    if (customOk) setCustomCategoriesState(getCustomCategories());
    if (quickOk) setQuickRecordsState(getQuickRecords());
    if (logsOk) {
      const storedLogs = getBabyLogs();
      let nextLogs: BabyLogEntry[] | null = null;
      if (storedLogs !== null) {
        const today = formatDateKey();
        nextLogs = removeLegacySampleLogs(storedLogs).map((l) => ({
          ...l,
          dateKey: l.dateKey ?? today,
          createdBy: l.createdBy
            ? {
                ...l.createdBy,
                role: migrateActorRole(l.createdBy.role as string),
              }
            : l.createdBy,
          source: l.source ?? (l.voice ? "voice" : "manual"),
        }));
      }

      const boot = await bootstrapCareLogsFromServer({
        careSetup,
        hasSavedCareSetup,
        localLogs: nextLogs,
      });
      if (hydrationRun !== storageHydrationRunRef.current) return false;

      if (boot.usedServer && boot.logs !== null) {
        setLogs(boot.logs);
        void saveBabyLogs(boot.logs, scope);
      } else if (boot.usedServer && boot.logs === null && nextLogs !== null) {
        // Server bound but empty — keep local cache (migration pending).
        setLogs(nextLogs);
      } else if (nextLogs !== null) {
        setLogs(nextLogs);
      }
      setLogsHydrated(true);
    }
    if (diaryOk) {
      const storedDiary = getDiaryEntries();
      const localDiary = storedDiary === null ? [] : removeLegacySampleDiaries(storedDiary);
      if (storedDiary !== null && localDiary.length !== storedDiary.length) {
        void saveDiaryEntries(localDiary, scope);
      }
      const boot = await bootstrapDiaryFromServer(scope, localDiary);
      if (hydrationRun !== storageHydrationRunRef.current) return false;
      if (boot.usedServer && boot.entries !== null) {
        setDiaryEntries(boot.entries);
        void saveDiaryEntries(boot.entries, scope);
      } else if (storedDiary !== null) {
        setDiaryEntries(localDiary);
      }
      setDiaryHydrated(!!scope);
    }
    if (chatOk) {
      const storedChat = getChatHistory();
      setChatHistory(storedChat && storedChat.length > 0 ? storedChat : [DEFAULT_CHAT_GREETING]);
    } else {
      setChatHistory([DEFAULT_CHAT_GREETING]);
    }
    setChatHydrated(true);
    if (familyOk) {
      const storedFamily = getFamilyMembers();
      if (storedFamily !== null) {
        const cleanedFamily = removeLegacySampleFamily(storedFamily);
        setFamilyMembers(cleanedFamily);
        if (cleanedFamily.length !== storedFamily.length) void saveFamilyMembers(cleanedFamily, scope);
      }
      if (scope?.babyId && isSupabaseConfigured()) {
        try {
          const serverFamily = await FamilyRepository.listMembersAsFamily(scope.babyId);
          if (hydrationRun !== storageHydrationRunRef.current) return false;
          if (serverFamily.length) {
            setFamilyMembers(serverFamily);
            void saveFamilyMembers(serverFamily, scope);
          }
        } catch {
          // Keep local family cache when co-member profile join is unavailable.
        }
      }
      setFamilyHydrated(true);
    }
    if (growthOk) {
      const storedEdit = getGrowthBookEdit();
      const storedDiary = getDiaryEntries();
      const localEdit = storedDiary && containsLegacySampleDiary(storedDiary)
        ? createEmptyGrowthBookEdit({ babyId: scope?.babyId ?? "", babyName: careSetup.child.childName })
        : ensureGrowthBookEdit({
            babyId: scope?.babyId ?? "",
            babyName: careSetup.child.childName,
            existing: storedEdit,
          });
      const growthBookBoot = await bootstrapGrowthBookFromServer({
        scope,
        babyName: careSetup.child.childName,
        localEdit,
        diaryOrder: (getDiaryEntries() ?? []).filter((entry) => entry.includedInGrowthBook).map((entry) => entry.id),
      });
      if (hydrationRun !== storageHydrationRunRef.current) return false;
      const nextEdit = growthBookBoot.usedServer && growthBookBoot.edit ? growthBookBoot.edit : localEdit;
      setGrowthBookEditState(nextEdit);
      void saveGrowthBookEdit(nextEdit, scope);
      growthBookDirtyRef.current = growthBookBoot.mediaFailed > 0;
      setGrowthBookHydrated(!!scope);
    }
    if (stickersOk) {
      const storedStickers = getBabyStickers() ?? [];
      let nextStickers = storedStickers;
      if (scope) {
        try {
          nextStickers = await BabyStickerRepository.uploadLocalBabyStickersMigration(scope, storedStickers);
        } catch {
          // Keep the scoped local originals and retry migration on the next hydrate.
        }
      }
      if (hydrationRun !== storageHydrationRunRef.current) return false;
      setBabyStickers((prev) => {
        const merged = mergeBabyStickerLists(nextStickers, prev);
        void saveBabyStickers(merged, scope);
        return merged;
      });
      setStickersHydrated(!!scope);
    }
    if (growthRecordsOk) {
      const storedGrowthRecords = getGrowthRecords();
      const localGrowthRecords = storedGrowthRecords ?? [];
      const boot = hasSavedCareSetup
        ? await bootstrapGrowthRecordsFromServer(localGrowthRecords)
        : { usedServer: false, records: null, migrated: 0, migrationFailed: 0 };
      if (hydrationRun !== storageHydrationRunRef.current) return false;
      if (boot.usedServer && boot.records !== null) {
        setGrowthRecords(boot.records);
        void saveGrowthRecords(boot.records, scope);
      } else if (storedGrowthRecords !== null) {
        setGrowthRecords(storedGrowthRecords);
      }
      setGrowthRecordsHydrated(true);
    }
    if (scope) {
      const localCautionFoods = await loadCautionFoods(scope);
      let nextCautionFoods = localCautionFoods;
      if (isSupabaseConfigured()) {
        try {
          const serverFoods = await CautionFoodRepository.list(scope.babyId);
          const merged = [...serverFoods];
          const serverNames = new Set(serverFoods.map((food) => food.normalizedFoodName));
          for (const localFood of localCautionFoods) {
            if (serverNames.has(localFood.normalizedFoodName)) continue;
            try {
              const migrated = await CautionFoodRepository.add(scope.babyId, localFood.foodName, localFood.source);
              merged.push(migrated);
              serverNames.add(migrated.normalizedFoodName);
            } catch {
              // Keep an unsynced local item visible and retry on the next hydration.
              merged.push(localFood);
            }
          }
          nextCautionFoods = merged;
        } catch {
          // Migration may not be applied yet; keep the baby-scoped device cache.
        }
      }
      if (hydrationRun !== storageHydrationRunRef.current) return false;
      setCautionFoods(nextCautionFoods);
      void saveCautionFoods(scope, nextCautionFoods);
    }
    const allLoaded =
      customOk && quickOk && logsOk && diaryOk && chatOk && familyOk && growthOk && stickersOk && growthRecordsOk;
    if (!allLoaded) {
      const issue = getStorageIssue();
      if (issue) setStorageIssue(issue);
    }
    setStorageReady(true);
    return allLoaded;
  }, [careSetup, hasSavedCareSetup, resolveLocalDataScope]);

  useEffect(() => {
    void hydrateStorageState();
  }, [hydrateStorageState]);

  useBabyLogCachePersistence({
    scope: localDataScope,
    logs: { value: logs, hydrated: logsHydrated },
    diaryEntries: { value: diaryEntries, hydrated: diaryHydrated },
    chatHistory: { value: chatHistory, hydrated: chatHydrated },
    familyMembers: { value: familyMembers, hydrated: familyHydrated },
    growthBookEdit: { value: growthBookEdit, hydrated: growthBookHydrated },
    babyStickers: { value: babyStickers, hydrated: stickersHydrated },
    growthRecords: { value: growthRecords, hydrated: growthRecordsHydrated },
  });

  useEffect(() => {
    if (!growthBookHydrated || !growthBookDirtyRef.current || !localDataScope) return;
    const run = ++growthBookSyncRunRef.current;
    const timer = setTimeout(() => {
      void syncGrowthBookEdit({
        scope: localDataScope,
        babyName: careSetup.child.childName,
        edit: growthBookEdit,
        diaryOrder: diaryEntries.filter((entry) => entry.includedInGrowthBook).map((entry) => entry.id),
      }).then((saved) => {
        if (run !== growthBookSyncRunRef.current) return;
        if (saved) {
          growthBookDirtyRef.current = false;
          return;
        }
        // Server sync failure is not a device AsyncStorage failure — keep dirty for retry
        // and avoid the global "기기에 저장하지 못했어요" banner.
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[BabyLogContext] growth book server sync deferred; will retry while dirty");
        }
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [careSetup.child.childName, diaryEntries, growthBookEdit, growthBookHydrated, localDataScope]);

  const setGrowthBookEdit = useCallback(
    (edit: GrowthBookEdit | ((prev: GrowthBookEdit) => GrowthBookEdit)) => {
      growthBookDirtyRef.current = true;
      setGrowthBookEditState((prev) => (typeof edit === "function" ? edit(prev) : edit));
    },
    [],
  );

  const addBabySticker = useCallback(async (sticker: BabySticker): Promise<BabySticker> => {
    const scope = localDataScopeRef.current;
    if (!scope || sticker.babyId !== scope.babyId) {
      throw new Error("현재 선택된 아기의 스티커만 저장할 수 있어요.");
    }
    setBabyStickers((prev) => {
      const next = [sticker, ...prev.filter((item) => item.id !== sticker.id)];
      void saveBabyStickers(next, scope);
      return next;
    });
    try {
      const remote = withLocalStickerAssets(
        await BabyStickerRepository.uploadSticker(sticker),
        sticker,
      );
      if (sameLocalDataScope(localDataScopeRef.current, scope)) {
        setBabyStickers((prev) => {
          const next = [remote, ...prev.filter((item) => item.id !== remote.id)];
          void saveBabyStickers(next, scope);
          return next;
        });
      }
      return remote;
    } catch (error) {
      // Local file is already in the vault cache. Hydrate must merge, not replace,
      // so a later server list cannot wipe an unsynced sticker.
      throw error;
    }
  }, []);

  const deleteBabySticker = useCallback(async (id: string): Promise<void> => {
    const scope = localDataScopeRef.current;
    const previous = babyStickers.find((item) => item.id === id);
    if (!scope || (previous && previous.babyId !== scope.babyId)) return;
    setBabyStickers((prev) => prev.filter((item) => item.id !== id));
    if (!previous?.serverBacked) return;
    try {
      await BabyStickerRepository.deleteSticker(id);
    } catch {
      if (previous && sameLocalDataScope(localDataScopeRef.current, scope)) {
        setBabyStickers((prev) => [previous, ...prev.filter((item) => item.id !== id)]);
      }
    }
  }, [babyStickers]);

  const me = useMemo(() => familyMembers.find((m) => m.isMe) ?? familyMembers[0], [familyMembers]);
  const myFamilyRole: FamilyRole = me?.role ?? "owner";

  const logAuthor = useMemo<BabyLogActor>(() => {
    const name = careSetup.parent.parentName.trim() || me?.name || "나";
    if (me) return { ...actorFromFamily(me), name };
    return { userId: "local-me", name, role: "owner" };
  }, [careSetup.parent.parentName, me]);

  const addGrowthRecord = useCallback((draft: GrowthRecordDraft) => {
    const now = new Date().toISOString();
    const sync = getSupabaseSync();
    const scope = localDataScopeRef.current;
    if (isSupabaseConfigured() && !scope) {
      throw new Error("현재 선택된 아기가 없어 성장 기록을 저장할 수 없어요.");
    }
    const record: GrowthRecord = {
      ...draft,
      id: createId(),
      babyId: scope?.babyId ?? sync.babyId ?? "baby-1",
      createdBy: sync.userId ?? logAuthor.userId,
      createdAt: now,
      updatedAt: now,
    };
    setGrowthRecords((current) => [record, ...current]);
    void syncGrowthRecordCreate(record, scope?.babyId).then((remote) => {
      if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return;
      if (remote) {
        setGrowthRecords((current) => current.map((item) => item.id === record.id ? remote : item));
      } else if (isSupabaseConfigured()) {
        // RLS/network failure: server is source of truth, so remove the optimistic cache row.
        setGrowthRecords((current) => current.filter((item) => item.id !== record.id));
      }
    });
    return record;
  }, [logAuthor.userId]);

  const updateGrowthRecord = useCallback((id: string, draft: GrowthRecordDraft) => {
    const scope = localDataScopeRef.current;
    const previous = growthRecords.find((record) => record.id === id);
    setGrowthRecords((current) => current.map((record) => record.id === id ? {
      ...record,
      ...draft,
      id,
      updatedAt: new Date().toISOString(),
    } : record));
    void syncGrowthRecordUpdate(id, draft, scope?.babyId).then((remote) => {
      if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return;
      if (remote) {
        setGrowthRecords((current) => current.map((record) => record.id === id ? remote : record));
      } else if (isSupabaseConfigured() && previous) {
        setGrowthRecords((current) => current.map((record) => record.id === id ? previous : record));
      }
    });
  }, [growthRecords]);

  const deleteGrowthRecord = useCallback((id: string) => {
    const scope = localDataScopeRef.current;
    const previous = growthRecords.find((record) => record.id === id);
    setGrowthRecords((current) => current.filter((record) => record.id !== id));
    void syncGrowthRecordDelete(id, scope?.babyId).then((deleted) => {
      if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return;
      if (!deleted && isSupabaseConfigured() && previous) {
        setGrowthRecords((current) => current.some((record) => record.id === id) ? current : [previous, ...current]);
      }
    });
  }, [growthRecords]);

  const setQuickRecords = useCallback(
    (records: QuickRecord[] | ((prev: QuickRecord[]) => QuickRecord[])) => {
      setQuickRecordsState((prev) => {
        const next = typeof records === "function" ? records(prev) : records;
        void saveQuickRecords(next, localDataScopeRef.current);
        return next;
      });
    },
    [],
  );

  const upsertCustomCategory = useCallback((category: CustomCategory) => {
    const now = new Date().toISOString();
    const normalized: CustomCategory = {
      ...category,
      kind: "custom",
      inputMode: category.inputMode ?? "memo",
      isEnabled: category.isEnabled !== false,
      iconKey: category.iconKey ?? category.templateId,
      templateId: category.templateId ?? category.iconKey,
      createdAt: category.createdAt ?? now,
      updatedAt: now,
    };
    setCustomCategoriesState((prev) => {
      const exists = prev.some((item) => item.id === normalized.id);
      const next = exists
        ? prev.map((item) => (item.id === normalized.id ? { ...normalized, createdAt: item.createdAt ?? now } : item))
        : [...prev, normalized];
      void saveCustomCategories(next, localDataScopeRef.current);
      return next;
    });
    return normalized;
  }, []);

  const addCustomFromTemplate = useCallback(
    (template: CustomCategoryTemplate): CustomCategory => {
      const existing = customCategories.find(
        (item) => (item.iconKey ?? item.templateId) === template.templateId,
      );
      if (existing) return existing;
      const category: CustomCategory = {
        id: createId(),
        label: template.label,
        color: template.color,
        iconKey: template.templateId,
        templateId: template.templateId,
        kind: "custom",
        inputMode: "memo",
        isEnabled: true,
      };
      return upsertCustomCategory(category);
    },
    [customCategories, upsertCustomCategory],
  );

  const addCustomByLabel = useCallback(
    (label: string, color = "#9096a6"): CustomCategory => {
      const trimmed = label.trim();
      const existing = customCategories.find(
        (item) => item.label.trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing;
      return upsertCustomCategory({
        id: createId(),
        label: trimmed,
        color,
        kind: "custom",
        inputMode: "memo",
        isEnabled: true,
      });
    },
    [customCategories, upsertCustomCategory],
  );

  const removeCustomCategory = useCallback((id: string) => {
    setCustomCategoriesState((prev) => {
      const next = prev.filter((item) => item.id !== id);
      void saveCustomCategories(next, localDataScopeRef.current);
      return next;
    });
  }, []);

  const locale = careSetup.parent.preferredLanguage;
  const display = useMemo(() => buildBabyDisplay(careSetup.child, locale), [careSetup.child, locale]);

  const normalizeEntry = useCallback(
    (entry: Omit<BabyLogEntry, "id">): BabyLogEntry => {
      const activeBabyId = localDataScopeRef.current?.babyId;
      if (isSupabaseConfigured() && !activeBabyId) {
        throw new Error("현재 선택된 아기가 없어 기록을 저장할 수 없어요.");
      }
      const createdBy = entry.createdBy ?? logAuthor;
      let source: BabyLogSource = entry.source ?? (entry.voice ? "voice" : "manual");
      if (!entry.source && !entry.voice && createdBy.role === "caregiver") source = "caregiver";
      return {
        ...entry,
        babyId: activeBabyId ?? entry.babyId,
        source,
        createdBy,
        dateKey: entry.dateKey ?? formatDateKey(),
        id: createId(),
      };
    },
    [logAuthor],
  );

  const addLog = useCallback(
    (entry: Omit<BabyLogEntry, "id">) => {
      const scope = localDataScopeRef.current;
      const next = normalizeEntry(entry);
      setLogs((prev) => [...prev, next]);
      void syncCareLogCreate(next, scope?.babyId).then((remote) => {
        if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return;
        if (remote) {
          setLogs((prev) => prev.map((log) => (log.id === next.id ? remote : log)));
        } else if (isSupabaseConfigured()) {
          // Server is authoritative when configured. Do not leave a record that
          // appears saved locally but disappears on the next hydrate.
          setLogs((prev) => prev.filter((log) => log.id !== next.id));
        }
      });
      return next;
    },
    [normalizeEntry],
  );

  const addLogWithPersistence = useCallback(
    async (entry: Omit<BabyLogEntry, "id">): Promise<BabyLogEntry | null> => {
      const scope = localDataScopeRef.current;
      const next = normalizeEntry(entry);
      setLogs((prev) => [...prev, next]);
      const remote = await syncCareLogCreate(next, scope?.babyId);
      if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return remote ?? null;
      if (remote) {
        setLogs((prev) => prev.map((log) => (log.id === next.id ? remote : log)));
        return remote;
      }
      if (isSupabaseConfigured()) {
        setLogs((prev) => prev.filter((log) => log.id !== next.id));
        return null;
      }
      return next;
    },
    [normalizeEntry],
  );

  const addLogs = useCallback(
    (entries: Omit<BabyLogEntry, "id">[]) => {
      if (!entries.length) return;
      const scope = localDataScopeRef.current;
      const nextEntries = entries.map(normalizeEntry);
      setLogs((prev) => [...prev, ...nextEntries]);
      void Promise.all(nextEntries.map((entry) => syncCareLogCreate(entry, scope?.babyId))).then((remotes) => {
        if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return;
        const resultsByLocalId = new Map(
          nextEntries.map((entry, index) => [entry.id, remotes[index]] as const),
        );
        setLogs((prev) =>
          prev.flatMap((local) => {
            if (!resultsByLocalId.has(local.id)) return [local];
            const remote = resultsByLocalId.get(local.id);
            if (remote) return [remote];
            return isSupabaseConfigured() ? [] : [local];
          }),
        );
      });
    },
    [normalizeEntry],
  );

  const updateLog = useCallback((id: string, entry: Omit<BabyLogEntry, "id">) => {
    const scope = localDataScopeRef.current;
    const previous = logs.find((log) => log.id === id);
    setLogs((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...entry,
              id,
              babyId: entry.babyId ?? l.babyId ?? scope?.babyId,
              dateKey: entry.dateKey ?? l.dateKey ?? formatDateKey(),
              createdBy: entry.createdBy ?? l.createdBy,
              source: entry.source ?? l.source,
            }
          : l,
      ),
    );
    void syncCareLogUpdate(id, entry, scope?.babyId).then((remote) => {
      if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return;
      if (remote) {
        setLogs((current) => current.map((log) => (log.id === id ? remote : log)));
      } else if (isSupabaseConfigured() && previous) {
        setLogs((current) => current.map((log) => (log.id === id ? previous : log)));
      }
    });
  }, [logs]);

  const updateLogWithPersistence = useCallback(
    async (id: string, entry: Omit<BabyLogEntry, "id">): Promise<BabyLogEntry | null> => {
      const scope = localDataScopeRef.current;
      const previous = logs.find((log) => log.id === id);
      if (!previous) return null;
      const next: BabyLogEntry = {
        ...entry,
        id,
        babyId: entry.babyId ?? previous.babyId ?? scope?.babyId,
        dateKey: entry.dateKey ?? previous.dateKey ?? formatDateKey(),
        createdBy: entry.createdBy ?? previous.createdBy,
        source: entry.source ?? previous.source,
      };
      setLogs((current) => current.map((log) => (log.id === id ? next : log)));
      const remote = await syncCareLogUpdate(id, entry, scope?.babyId);
      if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return remote ?? null;
      if (remote) {
        setLogs((current) => current.map((log) => (log.id === id ? remote : log)));
        return remote;
      }
      if (isSupabaseConfigured()) {
        setLogs((current) => current.map((log) => (log.id === id ? previous : log)));
        return null;
      }
      return next;
    },
    [logs],
  );

  const deleteLog = useCallback((id: string) => {
    const scope = localDataScopeRef.current;
    const previous = logs.find((log) => log.id === id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    void syncCareLogDelete(id, scope?.babyId).then((deleted) => {
      if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return;
      if (!deleted && isSupabaseConfigured() && previous) {
        setLogs((current) => current.some((log) => log.id === id) ? current : [...current, previous]);
      }
    });
  }, [logs]);

  const addDiary = useCallback(
    (entry: Omit<DiaryEntry, "id" | "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }) => {
      const now = new Date().toISOString();
      const scope = localDataScope;
      const optimistic: DiaryEntry = {
        ...entry,
        id: createId(),
        babyId: scope?.babyId ?? entry.babyId,
        dateKey: entry.dateKey || formatDateKey(),
        photos: entry.photos ?? [],
        includedInGrowthBook: entry.includedInGrowthBook ?? false,
        stickerIds: entry.stickerIds ?? [],
        momentSuggestionsUsed: entry.momentSuggestionsUsed ?? [],
        weatherStamp: entry.weatherStamp ?? null,
        moodStamp: entry.moodStamp ?? null,
        milestoneTag: entry.milestoneTag ?? null,
        customMilestoneTag: entry.customMilestoneTag ?? null,
        careLogSummarySnapshot: entry.careLogSummarySnapshot ?? "",
        stageLabelSnapshot: entry.stageLabelSnapshot
          ?? formatDiaryStageLabel(careSetup.child, entry.dateKey || formatDateKey()),
        source: entry.source ?? "manual",
        draftStatus: "saved",
        createdAt: entry.createdAt ?? now,
        updatedAt: entry.updatedAt ?? now,
      };
      setDiaryEntries((prev) => [optimistic, ...prev]);
      void syncDiaryCreate(scope, optimistic).then((remote) => {
        if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return;
        if (remote) {
          setDiaryEntries((current) => current.map((item) => (
            item.id === optimistic.id
              ? { ...remote, photos: remote.photos.length ? remote.photos : item.photos }
              : item
          )));
        } else if (isSupabaseConfigured()) {
          setDiaryEntries((current) => current.filter((item) => item.id !== optimistic.id));
        }
      });
    },
    [localDataScope, careSetup.child],
  );

  const updateDiary = useCallback((id: string, patch: Partial<Omit<DiaryEntry, "id">>) => {
    const now = new Date().toISOString();
    const scope = localDataScope;
    const previous = diaryEntries.find((entry) => entry.id === id);
    if (!previous) return;
    const optimistic: DiaryEntry = {
      ...previous,
      ...patch,
      stageLabelSnapshot: patch.stageLabelSnapshot
        ?? previous.stageLabelSnapshot
        ?? formatDiaryStageLabel(careSetup.child, patch.dateKey ?? previous.dateKey),
      updatedAt: patch.updatedAt ?? now,
    };
    setDiaryEntries((current) => current.map((entry) => entry.id === id ? optimistic : entry));
    void syncDiaryUpdate(scope, optimistic).then((remote) => {
      if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return;
      if (remote) {
        setDiaryEntries((current) => current.map((entry) => (
          entry.id === id
            ? { ...remote, photos: remote.photos.length ? remote.photos : entry.photos }
            : entry
        )));
      } else if (isSupabaseConfigured()) {
        setDiaryEntries((current) => current.map((entry) => entry.id === id ? previous : entry));
      }
    });
  }, [diaryEntries, localDataScope, careSetup.child]);

  const deleteDiary = useCallback((id: string) => {
    const scope = localDataScope;
    const index = diaryEntries.findIndex((entry) => entry.id === id);
    const previous = index >= 0 ? diaryEntries[index] : undefined;
    if (!previous) return;
    setDiaryEntries((current) => current.filter((entry) => entry.id !== id));
    void syncDiaryDelete(scope, id).then((deleted) => {
      if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return;
      if (!deleted && isSupabaseConfigured()) {
        setDiaryEntries((current) => {
          if (current.some((entry) => entry.id === id)) return current;
          const restored = [...current];
          restored.splice(Math.min(index, restored.length), 0, previous);
          return restored;
        });
      }
    });
  }, [diaryEntries, localDataScope]);

  const toggleDiaryInGrowthBook = useCallback((id: string) => {
    const scope = localDataScope;
    const previous = diaryEntries.find((entry) => entry.id === id);
    if (!previous) return;
    const optimistic: DiaryEntry = {
      ...previous,
      includedInGrowthBook: !previous.includedInGrowthBook,
      updatedAt: new Date().toISOString(),
    };
    setDiaryEntries((current) => current.map((entry) => entry.id === id ? optimistic : entry));
    void syncDiaryUpdate(scope, optimistic).then((remote) => {
      if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return;
      if (remote) {
        setDiaryEntries((current) => current.map((entry) => entry.id === id ? remote : entry));
      } else if (isSupabaseConfigured()) {
        setDiaryEntries((current) => current.map((entry) => entry.id === id ? previous : entry));
      }
    });
  }, [diaryEntries, localDataScope]);

  const pushChat = useCallback((role: "user" | "ai", text: string, stickerId?: string) => {
    setChatHistory((prev) => [...prev, { id: createId(), role, text, stickerId }]);
  }, []);

  const clearAllUserData = useCallback(async () => {
    const emptyGrowthBook = createEmptyGrowthBookEdit({
      babyId: localDataScope?.babyId ?? "",
      babyName: display.babyName,
    });
    setLogs([]);
    setDiaryEntries([]);
    setFamilyMembers([]);
    setGrowthBookEditState(emptyGrowthBook);
    setBabyStickers([]);
    setGrowthRecords([]);
    setBabies([]);
    setCautionFoods([]);
    setChatHistory([]);
    setCustomCategoriesState([]);
    setQuickRecordsState([]);
    await Promise.all([
      saveBabyLogs([], localDataScope),
      saveDiaryEntries([], localDataScope),
      saveFamilyMembers([], localDataScope),
      saveGrowthBookEdit(emptyGrowthBook, localDataScope),
      clearDiaryDraft(localDataScope),
      saveBabyStickers([], localDataScope),
      saveGrowthRecords([], localDataScope),
      clearGrowthRecordsMigrationState(),
      saveChatHistory([], localDataScope),
      saveCustomCategories([], localDataScope),
      saveQuickRecords([], localDataScope),
      clearSupabaseSync(),
      isSupabaseConfigured() ? AuthRepository.signOut().catch(() => undefined) : Promise.resolve(),
    ]);
  }, [display.babyName, localDataScope]);

  const applyOwnerFromSetup = useCallback((setup: CareSetup) => {
    const name = setup.parent.parentName.trim() || "나";
    const label = relationshipToLabel(setup.parent.relationshipToChild);
    setFamilyMembers((prev) => {
      const hasMe = prev.some((m) => m.isMe);
      if (hasMe) {
        return prev.map((m) =>
          m.isMe
            ? {
                ...m,
                name,
                relationshipLabel: label,
                role: "owner",
                status: "active" as const,
              }
            : m,
        );
      }
      return [
        {
          id: createId(),
          name,
          role: "owner" as const,
          relationshipLabel: label,
          status: "active" as const,
          isMe: true,
          emoji: "👤",
        },
        ...prev,
      ];
    });
  }, []);

  const updateFamilyMemberRole = useCallback((id: string, role: FamilyRole) => {
    setFamilyMembers((prev) => prev.map((m) => (m.id === id && !m.isMe ? { ...m, role } : m)));
  }, []);

  const acceptFamilyInvite = useCallback((id: string) => {
    setFamilyMembers((prev) =>
      prev.map((m) => (m.id === id && !m.isMe ? { ...m, status: "active" as const } : m)),
    );
  }, []);

  const setFamilyMemberStatus = useCallback((id: string, status: FamilyMember["status"]) => {
    setFamilyMembers((prev) => prev.map((m) => (m.id === id && !m.isMe ? { ...m, status } : m)));
  }, []);

  const removeFamilyMember = useCallback((id: string) => {
    setFamilyMembers((prev) => prev.filter((m) => m.id !== id || m.isMe));
  }, []);

  const retryPersistence = useCallback(async () => {
    const issue = storageIssue;
    clearStorageIssue();
    if (issue?.operation === "load") {
      await hydrateStorageState(true);
      return;
    }
    const draft = getDiaryDraft();
    const reminder = getDiaryReminder();
    await Promise.all([
      saveCareSetup(careSetup),
      saveBabyLogs(logs, localDataScope),
      saveDiaryEntries(diaryEntries, localDataScope),
      saveChatHistory(chatHistory, localDataScope),
      saveFamilyMembers(familyMembers, localDataScope),
      saveGrowthBookEdit(growthBookEdit, localDataScope),
      saveBabyStickers(babyStickers, localDataScope),
      saveGrowthRecords(growthRecords, localDataScope),
      saveQuickRecords(quickRecords, localDataScope),
      saveCustomCategories(customCategories, localDataScope),
      saveDiaryReminder(reminder, localDataScope),
      ...(draft ? [saveDiaryDraft(draft, localDataScope)] : []),
    ]);
  }, [
    careSetup,
    chatHistory,
    customCategories,
    diaryEntries,
    familyMembers,
    growthBookEdit,
    hydrateStorageState,
    logs,
    localDataScope,
    babyStickers,
    growthRecords,
    quickRecords,
    storageIssue,
  ]);

  const rehydrateFromServer = useCallback(async (scope?: LocalDataScope) => {
    await hydrateStorageState(true, scope);
  }, [hydrateStorageState]);

  const applyBabyRowToLocalProfile = useCallback((baby: BabyRow) => {
    setCareSetup({
      ...careSetup,
      child: {
        ...careSetup.child,
        childName: baby.name,
        nickname: baby.nickname ?? undefined,
        birthDate: baby.birth_date ?? undefined,
        dueDate: baby.due_date ?? undefined,
        childStatus: ["unborn", "newborn", "infant"].includes(baby.child_status)
          ? (baby.child_status as "unborn" | "newborn" | "infant")
          : baby.birth_date
            ? "newborn"
            : careSetup.child.childStatus,
        gender: baby.gender === "girl" || baby.gender === "boy" ? baby.gender : "unknown",
        photoUri: baby.photo_url ?? undefined,
        birthWeight: baby.birth_weight ?? undefined,
        specialNotes: baby.special_notes ?? undefined,
      },
    });
  }, [careSetup, setCareSetup]);

  const refreshBabies = useCallback(async (): Promise<BabyRow[]> => {
    if (!isSupabaseConfigured()) return babies;
    const next = await BabyRepository.listMyBabies();
    setBabies(next);
    return next;
  }, [babies]);

  const switchActiveBaby = useCallback(async (babyId: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;
    const session = await AuthRepository.getSession();
    if (!session) return false;
    const available = await BabyRepository.listMyBabies();
    setBabies(available);
    const selected = available.find((baby) => baby.id === babyId);
    if (!selected) {
      const fallback = available[0];
      if (!fallback) return false;
      await saveSupabaseSync({
        userId: session.user.id,
        babyId: fallback.id,
        migrationCandidateCount: 0,
        lastHydratedAt: new Date().toISOString(),
      });
      applyBabyRowToLocalProfile(fallback);
      await hydrateStorageState(true, { userId: session.user.id, babyId: fallback.id });
      return false;
    }
    await saveSupabaseSync({
      userId: session.user.id,
      babyId: selected.id,
      migrationCandidateCount: 0,
      lastHydratedAt: new Date().toISOString(),
    });
    applyBabyRowToLocalProfile(selected);
    await hydrateStorageState(true, { userId: session.user.id, babyId: selected.id });
    return true;
  }, [applyBabyRowToLocalProfile, hydrateStorageState]);

  const addBaby = useCallback(async (input: CreateBabyInput): Promise<BabyRow> => {
    if (!input.name.trim()) throw new Error("아기 이름을 입력해 주세요.");
    const created = await BabyRepository.createBaby(input);
    setBabies((current) => [...current.filter((baby) => baby.id !== created.id), created]);
    await switchActiveBaby(created.id);
    return created;
  }, [switchActiveBaby]);

  const addCautionFood = useCallback(async (foodName: string, source: CautionFoodSource): Promise<CautionFood> => {
    const scope = localDataScopeRef.current;
    if (!scope) throw new Error("현재 선택된 아기가 없어요.");
    const trimmed = foodName.trim().replace(/\s+/g, " ").slice(0, 40);
    const normalized = normalizeCautionFoodName(trimmed);
    if (!normalized) throw new Error("주의 식품 이름을 입력해 주세요.");
    if (cautionFoods.some((food) => food.normalizedFoodName === normalized && !food.archivedAt)) {
      throw new Error("이미 등록된 주의 식품이에요.");
    }
    let created: CautionFood = {
      id: createId(), babyId: scope.babyId, foodName: trimmed, normalizedFoodName: normalized,
      source, createdAt: new Date().toISOString(),
    };
    if (isSupabaseConfigured()) {
      try { created = await CautionFoodRepository.add(scope.babyId, trimmed, source); } catch { /* pending migration: local fallback */ }
    }
    if (!sameLocalDataScope(localDataScopeRef.current, scope)) return created;
    const next = [...cautionFoods, created];
    setCautionFoods(next);
    await saveCautionFoods(scope, next);
    return created;
  }, [cautionFoods]);

  const removeCautionFood = useCallback(async (id: string): Promise<void> => {
    const scope = localDataScopeRef.current;
    if (!scope) return;
    const current = cautionFoods.find((food) => food.id === id);
    if (current?.createdBy && isSupabaseConfigured()) {
      await CautionFoodRepository.archive(id, scope.babyId);
    }
    if (!sameLocalDataScope(localDataScopeRef.current, scope)) return;
    const next = cautionFoods.filter((food) => food.id !== id);
    setCautionFoods(next);
    await saveCautionFoods(scope, next);
  }, [cautionFoods]);

  const prepareForLogout = useCallback(async () => {
    storageHydrationRunRef.current += 1;
    // Preserve account-scoped Diary/Growth Book data. Only clear their in-memory view;
    // the next authenticated account hydrates its own user+baby keys.
    const scope = localDataScopeRef.current;
    if (scope) {
      await Promise.all([
        saveDiaryEntries(diaryEntries, scope),
        saveGrowthBookEdit(growthBookEdit, scope),
        ...(growthBookDirtyRef.current ? [syncGrowthBookEdit({
          scope,
          babyName: careSetup.child.childName,
          edit: growthBookEdit,
          diaryOrder: diaryEntries.filter((entry) => entry.includedInGrowthBook).map((entry) => entry.id),
        })] : []),
      ]);
    }
    growthBookDirtyRef.current = false;
    growthBookSyncRunRef.current += 1;
    setDiaryHydrated(false);
    setGrowthBookHydrated(false);
    setChatHydrated(false);
    if (scope) {
      await saveChatHistory(chatHistory, scope);
    }
    localDataScopeRef.current = null;
    setLocalDataScope(null);
    resetDiaryEntriesMemory();
    resetBabyLogsMemory();
    resetGrowthBookEditMemory();
    resetDiaryDraftMemory();
    resetBabyStickersMemory();
    resetGrowthRecordsMemory();
    resetFamilyMembersMemory();
    resetCustomCategoriesMemory();
    resetQuickRecordsMemory();
    resetChatHistoryMemory();
    const emptyGrowthBook = createEmptyGrowthBookEdit({ babyId: "", babyName: "" });
    setLogs([]);
    setDiaryEntries([]);
    setFamilyMembers([]);
    setGrowthBookEditState(emptyGrowthBook);
    setBabyStickers([]);
    setGrowthRecords([]);
    setCustomCategoriesState([]);
    setQuickRecordsState(getQuickRecords());
    setBabies([]);
    setCautionFoods([]);
    setChatHistory([DEFAULT_CHAT_GREETING]);
    await Promise.all([
      saveBabyLogs([], scope),
      saveFamilyMembers([], scope),
      saveGrowthRecords([], scope),
      clearSupabaseSync(),
    ]);
  }, [careSetup.child.childName, chatHistory, diaryEntries, growthBookEdit]);

  const qaDebug = useMemo<BabyLogContextValue["qaDebug"]>(() => {
    if (!__DEV__) return null;

    const persistSamples = async () => {
      if (!(await hasQaBackup())) await backupQaData();
      const { createLegacyBabyLogSample } = await import("../demo/legacyBabyLogSeed");
      const sample = createLegacyBabyLogSample();
      const sampleLogs = sample.logs.map((log) => ({ ...log, id: createId() }));
      const babyId = localDataScope?.babyId ?? "baby-1";
      const sampleBook = {
        ...createEmptyGrowthBookEdit({
          babyId,
          babyName: careSetup.child.childName || "아기",
        }),
        coverTemplateId: "cloud_sky" as const,
        pageTemplateId: "basic_line" as const,
      };
      setLogs(sampleLogs);
      setDiaryEntries(sample.diaryEntries);
      setChatHistory([DEFAULT_CHAT_GREETING]);
      setFamilyMembers(sample.familyMembers);
      setGrowthBookEditState(sampleBook);
      setLogsHydrated(true);
      setDiaryHydrated(true);
      setChatHydrated(true);
      setFamilyHydrated(true);
      await Promise.all([
        saveBabyLogs(sampleLogs, localDataScope),
        saveDiaryEntries(sample.diaryEntries, localDataScope),
        saveChatHistory([DEFAULT_CHAT_GREETING], localDataScope),
        saveFamilyMembers(sample.familyMembers, localDataScope),
        saveGrowthBookEdit(sampleBook, localDataScope),
      ]);
    };

    const fillDemoData = async () => {
      if (!(await hasQaBackup())) await backupQaData();
      const seed = buildDemoSeed({
        careSetup,
        actor: logAuthor,
        babyId: localDataScope?.babyId ?? "baby-1",
        userId: localDataScope?.userId ?? logAuthor.userId,
      });
      const demoLogs = seed.logs.map((log) => ({ ...log, id: createId() }));
      setLogs(demoLogs);
      setGrowthRecords(seed.growthRecords);
      setLogsHydrated(true);
      setGrowthRecordsHydrated(true);
      await Promise.all([
        saveBabyLogs(demoLogs, localDataScope),
        saveGrowthRecords(seed.growthRecords, localDataScope),
      ]);
    };

    return {
      backupCurrentData: async () => {
        await backupQaData();
      },
      fillDemoData,
      useEmptyData: async () => {
        await switchToQaEmptyData();
        await hydrateStorageState(true);
      },
      restoreSampleData: persistSamples,
      restoreBackupData: async () => {
        await restoreQaBackup();
        await hydrateStorageState(true);
      },
      removeQaChatTurns: async () => {
        const next = chatHistory.filter((message, index, messages) => {
          if (message.role === "user" && message.text.startsWith("QA ")) return false;
          const previous = messages[index - 1];
          return !(message.role === "ai" && previous?.role === "user" && previous.text.startsWith("QA "));
        });
        setChatHistory(next);
        await saveChatHistory(next, localDataScope);
      },
    };
  }, [careSetup, chatHistory, hydrateStorageState, localDataScope, logAuthor]);

  const value = useMemo(
    () => ({
      careSetup,
      babyName: display.babyName,
      babyEmoji: display.babyEmoji,
      babyBadge: display.babyBadge,
      babyBirthMeta: display.babyBirthMeta,
      defaultFeedingMethod: careSetup.preferences.defaultFeedingMethod,
      customCategories,
      upsertCustomCategory,
      addCustomFromTemplate,
      addCustomByLabel,
      removeCustomCategory,
      quickRecords,
      setQuickRecords,
      logs,
      diaryEntries,
      localDataScope,
      babies,
      activeBabyId: localDataScope?.babyId ?? null,
      switchActiveBaby,
      addBaby,
      refreshBabies,
      cautionFoods,
      addCautionFood,
      removeCautionFood,
      familyMembers,
      growthBookEdit,
      setGrowthBookEdit,
      babyStickers,
      addBabySticker,
      deleteBabySticker,
      growthRecords,
      addGrowthRecord,
      updateGrowthRecord,
      deleteGrowthRecord,
      myFamilyRole,
      applyOwnerFromSetup,
      updateFamilyMemberRole,
      acceptFamilyInvite,
      setFamilyMemberStatus,
      removeFamilyMember,
      chatHistory,
      chatHydrated,
      profileOpen,
      setProfileOpen,
      addLog,
      addLogWithPersistence,
      addLogs,
      updateLog,
      updateLogWithPersistence,
      deleteLog,
      logAuthor,
      addDiary,
      updateDiary,
      deleteDiary,
      toggleDiaryInGrowthBook,
      pushChat,
      storageReady,
      storageIssue,
      retryPersistence,
      rehydrateFromServer,
      prepareForLogout,
      dismissStorageIssue: clearStorageIssue,
      clearAllUserData,
      qaDebug,
    }),
    [
      careSetup,
      display,
      customCategories,
      upsertCustomCategory,
      addCustomFromTemplate,
      addCustomByLabel,
      removeCustomCategory,
      quickRecords,
      setQuickRecords,
      logs,
      diaryEntries,
      localDataScope,
      babies,
      switchActiveBaby,
      addBaby,
      refreshBabies,
      cautionFoods,
      addCautionFood,
      removeCautionFood,
      familyMembers,
      growthBookEdit,
      setGrowthBookEdit,
      babyStickers,
      addBabySticker,
      deleteBabySticker,
      growthRecords,
      addGrowthRecord,
      updateGrowthRecord,
      deleteGrowthRecord,
      myFamilyRole,
      applyOwnerFromSetup,
      updateFamilyMemberRole,
      acceptFamilyInvite,
      setFamilyMemberStatus,
      removeFamilyMember,
      chatHistory,
      chatHydrated,
      profileOpen,
      addLog,
      addLogWithPersistence,
      addLogs,
      updateLog,
      updateLogWithPersistence,
      deleteLog,
      logAuthor,
      addDiary,
      updateDiary,
      deleteDiary,
      toggleDiaryInGrowthBook,
      pushChat,
      storageReady,
      storageIssue,
      retryPersistence,
      rehydrateFromServer,
      prepareForLogout,
      clearAllUserData,
      qaDebug,
    ],
  );

  return <BabyLogContext.Provider value={value}>{children}</BabyLogContext.Provider>;
}

export function useBabyLog() {
  const ctx = useContext(BabyLogContext);
  if (!ctx) throw new Error("useBabyLog must be used within BabyLogProvider");
  return ctx;
}

/** @deprecated use entryDateKey from reportAggregates */
export { entryDateKey } from "../utils/reportAggregates";
