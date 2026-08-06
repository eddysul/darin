import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CustomCategory } from "../types/logCategory";
import { useApp } from "./AppContext";
import type { BabyLogActor, BabyLogEntry, ChatMessage, DiaryEntry } from "../types/babyLog";
import type { CareSetup, DefaultFeedingMethod } from "../types/careSetup";
import { relationshipToLabel } from "../types/careSetup";
import type { FamilyMember, FamilyRole } from "../types/family";
import type { QuickRecord } from "../types/quickRecord";
import { buildBabyDisplay } from "../utils/childDisplay";
import {
  getCustomCategories,
  hydrateCustomCategories,
  saveCustomCategories,
} from "../utils/customCategoriesStore";
import { getQuickRecords, hydrateQuickRecords, saveQuickRecords } from "../utils/quickRecordsStore";
import { getBabyLogs, hydrateBabyLogs, saveBabyLogs } from "../utils/babyLogsStore";
import {
  bootstrapCareLogsFromServer,
  ensureCareLogBabyId,
  syncCareLogCreate,
  syncCareLogDelete,
  syncCareLogUpdate,
} from "../utils/careLogServerSync";
import { clearSupabaseSync, getSupabaseSync, hydrateSupabaseSync } from "../utils/supabaseSyncStore";
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
import { getChatHistory, hydrateChatHistory, saveChatHistory } from "../utils/chatHistoryStore";
import { getFamilyMembers, hydrateFamilyMembers, saveFamilyMembers } from "../utils/familyMembersStore";
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
  resetBabyStickersMemory,
  saveBabyStickers,
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
  saveGrowthRecords,
} from "../utils/growthRecordsStore";
import {
  bootstrapGrowthRecordsFromServer,
  syncGrowthRecordCreate,
  syncGrowthRecordDelete,
  syncGrowthRecordUpdate,
} from "../utils/growthRecordServerSync";
import { clearGrowthRecordsMigrationState } from "../utils/growthRecordsMigrationStore";
import { formatDateKey, shiftDateKey } from "../utils/dateKey";
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
import { BabyRepository } from "../repositories/BabyRepository";
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
import {
  containsLegacySampleDiary,
  removeLegacySampleDiaries,
  removeLegacySampleFamily,
  removeLegacySampleLogs,
} from "../utils/legacySampleData";

const TODAY = formatDateKey();

function migrateActorRole(role: string): FamilyRole {
  if (role === "parent" || role === "other") return "owner";
  if (role === "owner" || role === "admin" || role === "editor" || role === "viewer" || role === "caregiver") {
    return role;
  }
  return "editor";
}

function sameLocalDataScope(left: LocalDataScope | null, right: LocalDataScope): boolean {
  return isValidLocalDataScope(left) && localDataScopeId(left) === localDataScopeId(right);
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function displayDateDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
}

const SEED_DIARY: DiaryEntry[] = [
  {
    id: "d1",
    babyId: "baby-1",
    date: displayDateDaysAgo(12),
    dateKey: shiftDateKey(12),
    photos: [],
    comment: "오늘 처음으로 욕조 목욕을 했는데 물을 튀기면서 엄청 좋아했어요. 목욕 후에 바로 잠들었네요.",
    weatherStamp: "sun",
    moodStamp: "love",
    careLogSummarySnapshot: "오늘은 수유 6회, 수면 4시간 20분, 기저귀 5회가 기록되었어요. 추가로 목욕도 했어요.",
    momentSuggestionsUsed: [],
    milestoneTag: "첫 목욕",
    customMilestoneTag: null,
    includedInGrowthBook: false,
    createdAt: isoDaysAgo(12),
    updatedAt: isoDaysAgo(12),
    source: "manual",
    draftStatus: "saved",
    createdBy: { userId: "m1", name: "김민지", role: "owner" },
  },
  {
    id: "d2",
    babyId: "baby-1",
    date: displayDateDaysAgo(14),
    dateKey: shiftDateKey(14),
    photos: [],
    comment: '낮에 옹알이가 부쩍 늘었어요. "아부부" 소리를 계속 내면서 웃는 모습이 너무 사랑스러웠던 하루.',
    weatherStamp: "cloud",
    moodStamp: "calm",
    careLogSummarySnapshot: "오늘은 수유 5회, 수면 3시간 10분, 기저귀 4회가 기록되었어요.",
    momentSuggestionsUsed: [],
    milestoneTag: null,
    customMilestoneTag: null,
    includedInGrowthBook: true,
    createdAt: isoDaysAgo(14),
    updatedAt: isoDaysAgo(14),
    source: "manual",
    draftStatus: "saved",
    createdBy: { userId: "m1", name: "김민지", role: "owner" },
  },
  {
    id: "d3",
    babyId: "baby-1",
    date: displayDateDaysAgo(16),
    dateKey: shiftDateKey(16),
    photos: [],
    comment: "낮잠이 짧아서 저녁에 보챔이 있었어요. 수유 간격은 괜찮은 편이었습니다. 뒤집기를 처음 성공한 날!",
    weatherStamp: "rain",
    moodStamp: "tired",
    careLogSummarySnapshot: "오늘은 수유 4회, 수면 2시간 40분, 기저귀 3회가 기록되었어요. 추가로 터미타임도 했어요.",
    momentSuggestionsUsed: [],
    milestoneTag: "처음 뒤집은 날",
    customMilestoneTag: null,
    includedInGrowthBook: true,
    createdAt: isoDaysAgo(16),
    updatedAt: isoDaysAgo(16),
    source: "manual",
    draftStatus: "saved",
    createdBy: { userId: "m2", name: "이준호", role: "admin" },
  },
];

function seedLogs(): Omit<BabyLogEntry, "id">[] {
  const d = (ago: number) => shiftDateKey(ago);
  const mom: BabyLogActor = { userId: "m1", name: "김민지", role: "owner" };
  const dad: BabyLogActor = { userId: "m2", name: "이준호", role: "admin" };
  const sitter: BabyLogActor = { userId: "m3", name: "박시터", role: "caregiver" };

  return [
    { cat: "formula", time: "14:10", amount: "80", dateKey: TODAY, createdBy: mom, source: "manual" },
    { cat: "sleep", time: "13:20", duration: "35", dateKey: TODAY, createdBy: mom, source: "manual" },
    { cat: "diaper", time: "12:40", chip: "소변", dateKey: TODAY, createdBy: sitter, source: "manual" },
    { cat: "breast", time: "11:30", chip: "좌측", duration: "12", dateKey: TODAY, createdBy: mom, source: "manual" },
    { cat: "diaper", time: "09:42", chip: "대변", chip2: "황금색", dateKey: TODAY, voice: true, source: "voice", createdBy: mom },
    { cat: "sleep", time: "09:28", duration: "40", dateKey: TODAY, createdBy: dad, source: "manual" },
    { cat: "diaper", time: "08:32", chip: "소변", dateKey: TODAY, createdBy: dad, source: "manual" },
    { cat: "tummy", time: "15:00", duration: "10", dateKey: TODAY, voice: true, source: "voice", createdBy: sitter },
    // Past days for weekly chart
    { cat: "formula", time: "10:00", amount: "90", dateKey: d(1), createdBy: mom, source: "manual" },
    { cat: "formula", time: "14:00", amount: "80", dateKey: d(1), createdBy: mom, source: "manual" },
    { cat: "sleep", time: "13:00", duration: "90", dateKey: d(1), createdBy: dad, source: "manual" },
    { cat: "diaper", time: "11:00", chip: "소변", dateKey: d(1), createdBy: sitter, source: "manual" },
    { cat: "diaper", time: "16:00", chip: "대변", dateKey: d(1), createdBy: mom, source: "manual" },
    { cat: "formula", time: "09:30", amount: "100", dateKey: d(2), createdBy: mom, source: "manual" },
    { cat: "sleep", time: "12:00", duration: "60", dateKey: d(2), createdBy: mom, source: "manual" },
    { cat: "diaper", time: "10:20", chip: "소변", dateKey: d(2), createdBy: dad, source: "manual" },
    { cat: "breast", time: "15:10", duration: "15", dateKey: d(3), createdBy: mom, source: "manual" },
    { cat: "sleep", time: "11:00", duration: "45", dateKey: d(3), createdBy: sitter, source: "manual" },
    { cat: "diaper", time: "13:40", chip: "대변", dateKey: d(3), createdBy: sitter, source: "manual" },
    { cat: "formula", time: "08:00", amount: "80", dateKey: d(4), createdBy: mom, source: "manual" },
    { cat: "diaper", time: "09:00", chip: "소변", dateKey: d(4), createdBy: mom, source: "manual" },
    { cat: "sleep", time: "14:00", duration: "70", dateKey: d(5), createdBy: dad, source: "manual" },
    { cat: "formula", time: "12:30", amount: "70", dateKey: d(5), createdBy: dad, source: "manual" },
    { cat: "diaper", time: "18:00", chip: "소변", dateKey: d(6), createdBy: mom, source: "manual" },
    { cat: "sleep", time: "10:00", duration: "50", dateKey: d(6), createdBy: mom, source: "manual" },
  ];
}

const SEED_FAMILY: FamilyMember[] = [
  {
    id: "m1",
    emoji: "👩",
    name: "김민지",
    role: "owner",
    relationshipLabel: "엄마",
    status: "active",
    isMe: true,
  },
  {
    id: "m2",
    emoji: "👨",
    name: "이준호",
    role: "admin",
    relationshipLabel: "아빠",
    status: "active",
    contact: "junho@example.com",
  },
  {
    id: "m3",
    emoji: "🧑‍🍼",
    name: "박시터",
    role: "caregiver",
    relationshipLabel: "시터",
    status: "active",
    contact: "010-1234-5678",
  },
];

const DEFAULT_GREETING: ChatMessage = {
  id: "greet-1",
  role: "ai",
  text: "안녕하세요! 기록을 참고해 답할게요. 무엇이든 편하게 물어보세요.",
};

type BabyLogContextValue = {
  careSetup: CareSetup;
  babyName: string;
  babyEmoji: string;
  babyBadge: string;
  babyBirthMeta: string;
  defaultFeedingMethod: DefaultFeedingMethod;
  customCategories: CustomCategory[];
  quickRecords: QuickRecord[];
  setQuickRecords: (records: QuickRecord[] | ((prev: QuickRecord[]) => QuickRecord[])) => void;
  logs: BabyLogEntry[];
  diaryEntries: DiaryEntry[];
  localDataScope: LocalDataScope | null;
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
  inviteFamilyMember: (draft: {
    name: string;
    role: FamilyRole;
    contact: string;
    relationshipLabel?: FamilyMember["relationshipLabel"];
  }) => FamilyMember;
  /** Sync the local "me" member from completed CareSetup (name + relationship). */
  applyOwnerFromSetup: (setup: CareSetup) => void;
  /** Join an existing baby via invite code (MVP mock). */
  joinWithInvite: (payload: {
    code: string;
    myName: string;
    ownerName: string;
    relationshipLabel: FamilyMember["relationshipLabel"];
    role?: FamilyRole;
  }) => void;
  updateFamilyMemberRole: (id: string, role: FamilyRole) => void;
  acceptFamilyInvite: (id: string) => void;
  setFamilyMemberStatus: (id: string, status: FamilyMember["status"]) => void;
  removeFamilyMember: (id: string) => void;
  chatHistory: ChatMessage[];
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  addLog: (entry: Omit<BabyLogEntry, "id">) => BabyLogEntry;
  addLogs: (entries: Omit<BabyLogEntry, "id">[]) => void;
  updateLog: (id: string, entry: Omit<BabyLogEntry, "id">) => void;
  deleteLog: (id: string) => void;
  logAuthor: BabyLogActor;
  addDiary: (entry: Omit<DiaryEntry, "id" | "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }) => void;
  updateDiary: (id: string, patch: Partial<Omit<DiaryEntry, "id">>) => void;
  deleteDiary: (id: string) => void;
  toggleDiaryInGrowthBook: (id: string) => void;
  pushChat: (role: "user" | "ai", text: string, stickerId?: string) => void;
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
    restoreBackupData: () => Promise<void>;
    removeQaChatTurns: () => Promise<void>;
  } | null;
};

const BabyLogContext = createContext<BabyLogContextValue | null>(null);

export function BabyLogProvider({ children }: { children: ReactNode }) {
  const { careSetup, hasSavedCareSetup } = useApp();
  const [logs, setLogs] = useState<BabyLogEntry[]>([]);
  const [logsHydrated, setLogsHydrated] = useState(false);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [diaryHydrated, setDiaryHydrated] = useState(false);
  const [localDataScope, setLocalDataScope] = useState<LocalDataScope | null>(null);
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
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([DEFAULT_GREETING]);
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
    if (isValidLocalDataScope(override)) return override;
    if (!isSupabaseConfigured()) return null;
    const session = await AuthRepository.getSession();
    if (!session) return null;

    await hydrateSupabaseSync();
    const sync = getSupabaseSync();
    if (sync.userId === session.user.id && sync.babyId) {
      return { userId: session.user.id, babyId: sync.babyId };
    }

    const babies = await BabyRepository.listMyBabies();
    if (babies[0]) return { userId: session.user.id, babyId: babies[0].id };
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
      setGrowthBookHydrated(false);
      setDiaryEntries([]);
      setGrowthBookEditState(createEmptyGrowthBookEdit({ babyId: scope?.babyId ?? "", babyName: careSetup.child.childName }));
      resetDiaryEntriesMemory();
      resetGrowthBookEditMemory();
      resetDiaryDraftMemory();
      resetBabyStickersMemory();
      localDataScopeRef.current = scope;
      setLocalDataScope(scope);
    }

    const [customOk, quickOk, logsOk, diaryOk, chatOk, familyOk, growthOk, stickersOk, growthRecordsOk, syncOk] =
      await Promise.all([
      hydrateCustomCategories(force),
      hydrateQuickRecords(force),
      hydrateBabyLogs(force),
      hydrateDiaryEntries(scope, force),
      hydrateChatHistory(force),
      hydrateFamilyMembers(force),
      hydrateGrowthBookEdit(scope, force),
      hydrateBabyStickers(scope, force),
      hydrateGrowthRecords(force),
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
        void saveBabyLogs(boot.logs);
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
      if (storedChat !== null) setChatHistory(storedChat);
      setChatHydrated(true);
    }
    if (familyOk) {
      const storedFamily = getFamilyMembers();
      if (storedFamily !== null) {
        const cleanedFamily = removeLegacySampleFamily(storedFamily);
        setFamilyMembers(cleanedFamily);
        if (cleanedFamily.length !== storedFamily.length) void saveFamilyMembers(cleanedFamily);
      }
      if (scope?.babyId && isSupabaseConfigured()) {
        try {
          const serverFamily = await FamilyRepository.listMembersAsFamily(scope.babyId);
          if (hydrationRun !== storageHydrationRunRef.current) return false;
          if (serverFamily.length) {
            setFamilyMembers(serverFamily);
            void saveFamilyMembers(serverFamily);
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
      const storedStickers = getBabyStickers();
      let nextStickers = storedStickers ?? [];
      if (scope) {
        try {
          nextStickers = await BabyStickerRepository.uploadLocalBabyStickersMigration(scope, nextStickers);
        } catch {
          // Keep the scoped local originals and retry migration on the next hydrate.
        }
      }
      if (hydrationRun !== storageHydrationRunRef.current) return false;
      setBabyStickers(nextStickers);
      void saveBabyStickers(nextStickers, scope);
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
        void saveGrowthRecords(boot.records);
      } else if (storedGrowthRecords !== null) {
        setGrowthRecords(storedGrowthRecords);
      }
      setGrowthRecordsHydrated(true);
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

  useEffect(() => {
    if (!logsHydrated) return;
    // Cache only — server is source of truth when active.
    void saveBabyLogs(logs);
  }, [logs, logsHydrated]);

  useEffect(() => {
    if (!diaryHydrated) return;
    void saveDiaryEntries(diaryEntries, localDataScope);
  }, [diaryEntries, diaryHydrated, localDataScope]);

  useEffect(() => {
    if (!chatHydrated) return;
    void saveChatHistory(chatHistory);
  }, [chatHistory, chatHydrated]);

  useEffect(() => {
    if (!familyHydrated) return;
    void saveFamilyMembers(familyMembers);
  }, [familyMembers, familyHydrated]);

  useEffect(() => {
    if (!growthBookHydrated) return;
    void saveGrowthBookEdit(growthBookEdit, localDataScope);
  }, [growthBookEdit, growthBookHydrated, localDataScope]);

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

  useEffect(() => {
    if (!stickersHydrated) return;
    void saveBabyStickers(babyStickers, localDataScope);
  }, [babyStickers, localDataScope, stickersHydrated]);

  useEffect(() => {
    if (!growthRecordsHydrated) return;
    void saveGrowthRecords(growthRecords);
  }, [growthRecords, growthRecordsHydrated]);

  const setGrowthBookEdit = useCallback(
    (edit: GrowthBookEdit | ((prev: GrowthBookEdit) => GrowthBookEdit)) => {
      growthBookDirtyRef.current = true;
      setGrowthBookEditState((prev) => (typeof edit === "function" ? edit(prev) : edit));
    },
    [],
  );

  const addBabySticker = useCallback(async (sticker: BabySticker): Promise<BabySticker> => {
    setBabyStickers((prev) => [sticker, ...prev.filter((item) => item.id !== sticker.id)]);
    const scope = localDataScopeRef.current;
    if (!scope || sticker.babyId !== scope.babyId) return sticker;
    try {
      const remote = await BabyStickerRepository.uploadSticker(sticker);
      if (sameLocalDataScope(localDataScopeRef.current, scope)) {
        setBabyStickers((prev) => [remote, ...prev.filter((item) => item.id !== remote.id)]);
      }
      return remote;
    } catch (error) {
      // Local asset remains intact and migration will retry later, but callers
      // must not treat a local-only sticker as ready for a server comment.
      throw error;
    }
  }, []);

  const deleteBabySticker = useCallback(async (id: string): Promise<void> => {
    const previous = babyStickers.find((item) => item.id === id);
    setBabyStickers((prev) => prev.filter((item) => item.id !== id));
    if (!previous?.serverBacked) return;
    try {
      await BabyStickerRepository.deleteSticker(id);
    } catch {
      if (previous) setBabyStickers((prev) => [previous, ...prev.filter((item) => item.id !== id)]);
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
    const record: GrowthRecord = {
      ...draft,
      id: createId(),
      babyId: sync.babyId ?? "baby-1",
      createdBy: sync.userId ?? logAuthor.userId,
      createdAt: now,
      updatedAt: now,
    };
    setGrowthRecords((current) => [record, ...current]);
    void syncGrowthRecordCreate(record).then((remote) => {
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
    const previous = growthRecords.find((record) => record.id === id);
    setGrowthRecords((current) => current.map((record) => record.id === id ? {
      ...record,
      ...draft,
      id,
      updatedAt: new Date().toISOString(),
    } : record));
    void syncGrowthRecordUpdate(id, draft).then((remote) => {
      if (remote) {
        setGrowthRecords((current) => current.map((record) => record.id === id ? remote : record));
      } else if (isSupabaseConfigured() && previous) {
        setGrowthRecords((current) => current.map((record) => record.id === id ? previous : record));
      }
    });
  }, [growthRecords]);

  const deleteGrowthRecord = useCallback((id: string) => {
    const previous = growthRecords.find((record) => record.id === id);
    setGrowthRecords((current) => current.filter((record) => record.id !== id));
    void syncGrowthRecordDelete(id).then((deleted) => {
      if (!deleted && isSupabaseConfigured() && previous) {
        setGrowthRecords((current) => current.some((record) => record.id === id) ? current : [previous, ...current]);
      }
    });
  }, [growthRecords]);

  const setQuickRecords = useCallback(
    (records: QuickRecord[] | ((prev: QuickRecord[]) => QuickRecord[])) => {
      setQuickRecordsState((prev) => {
        const next = typeof records === "function" ? records(prev) : records;
        void saveQuickRecords(next);
        return next;
      });
    },
    [],
  );

  const locale = careSetup.parent.preferredLanguage;
  const display = useMemo(() => buildBabyDisplay(careSetup.child, locale), [careSetup.child, locale]);

  const normalizeEntry = useCallback(
    (entry: Omit<BabyLogEntry, "id">): BabyLogEntry => {
      const createdBy = entry.createdBy ?? logAuthor;
      let source: BabyLogSource = entry.source ?? (entry.voice ? "voice" : "manual");
      if (!entry.source && !entry.voice && createdBy.role === "caregiver") source = "caregiver";
      return {
        ...entry,
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
      const next = normalizeEntry(entry);
      setLogs((prev) => [...prev, next]);
      void syncCareLogCreate(next).then((remote) => {
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

  const addLogs = useCallback(
    (entries: Omit<BabyLogEntry, "id">[]) => {
      if (!entries.length) return;
      const nextEntries = entries.map(normalizeEntry);
      setLogs((prev) => [...prev, ...nextEntries]);
      void Promise.all(nextEntries.map((entry) => syncCareLogCreate(entry))).then((remotes) => {
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
    const previous = logs.find((log) => log.id === id);
    setLogs((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...entry,
              id,
              dateKey: entry.dateKey ?? l.dateKey ?? formatDateKey(),
              createdBy: entry.createdBy ?? l.createdBy,
              source: entry.source ?? l.source,
            }
          : l,
      ),
    );
    void syncCareLogUpdate(id, entry).then((remote) => {
      if (remote) {
        setLogs((current) => current.map((log) => (log.id === id ? remote : log)));
      } else if (isSupabaseConfigured() && previous) {
        setLogs((current) => current.map((log) => (log.id === id ? previous : log)));
      }
    });
  }, [logs]);

  const deleteLog = useCallback((id: string) => {
    const previous = logs.find((log) => log.id === id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    void syncCareLogDelete(id).then((deleted) => {
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
        source: entry.source ?? "manual",
        draftStatus: "saved",
        createdAt: entry.createdAt ?? now,
        updatedAt: entry.updatedAt ?? now,
      };
      setDiaryEntries((prev) => [optimistic, ...prev]);
      void syncDiaryCreate(scope, optimistic).then((remote) => {
        if (scope && !sameLocalDataScope(localDataScopeRef.current, scope)) return;
        if (remote) {
          setDiaryEntries((current) => current.map((item) => item.id === optimistic.id ? remote : item));
        } else if (isSupabaseConfigured()) {
          setDiaryEntries((current) => current.filter((item) => item.id !== optimistic.id));
        }
      });
    },
    [localDataScope],
  );

  const updateDiary = useCallback((id: string, patch: Partial<Omit<DiaryEntry, "id">>) => {
    const now = new Date().toISOString();
    const scope = localDataScope;
    const previous = diaryEntries.find((entry) => entry.id === id);
    if (!previous) return;
    const optimistic: DiaryEntry = { ...previous, ...patch, updatedAt: patch.updatedAt ?? now };
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
    setChatHistory([]);
    setCustomCategoriesState([]);
    setQuickRecordsState([]);
    await Promise.all([
      saveBabyLogs([]),
      saveDiaryEntries([], localDataScope),
      saveFamilyMembers([]),
      saveGrowthBookEdit(emptyGrowthBook, localDataScope),
      clearDiaryDraft(localDataScope),
      saveBabyStickers([], localDataScope),
      saveGrowthRecords([]),
      clearGrowthRecordsMigrationState(),
      saveChatHistory([]),
      saveCustomCategories([]),
      saveQuickRecords([]),
      clearSupabaseSync(),
      isSupabaseConfigured() ? AuthRepository.signOut().catch(() => undefined) : Promise.resolve(),
    ]);
  }, [display.babyName, localDataScope]);

  const inviteFamilyMember = useCallback(
    (draft: {
      name: string;
      role: FamilyRole;
      contact: string;
      relationshipLabel?: FamilyMember["relationshipLabel"];
    }) => {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const relationshipLabel =
        draft.relationshipLabel ??
        (draft.role === "caregiver" ? "시터" : "가족");
      const member: FamilyMember = {
        id: createId(),
        name: draft.name.trim(),
        role: draft.role,
        relationshipLabel,
        contact: draft.contact.trim(),
        status: "pending",
        inviteCode: code,
        inviteLink: `https://darin.app/invite/${code}`,
        emoji: draft.role === "caregiver" ? "🧑‍🍼" : "👤",
      };
      setFamilyMembers((prev) => [...prev, member]);
      return member;
    },
    [],
  );

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

  const joinWithInvite = useCallback(
    (payload: {
      code: string;
      myName: string;
      ownerName: string;
      relationshipLabel: FamilyMember["relationshipLabel"];
      role?: FamilyRole;
    }) => {
      const role =
        payload.role ??
        (payload.relationshipLabel === "시터" ? "caregiver" : "editor");
      setFamilyMembers([
        {
          id: "joined-owner",
          name: payload.ownerName,
          role: "owner",
          relationshipLabel: "엄마",
          status: "active",
          emoji: "👩",
        },
        {
          id: createId(),
          name: payload.myName.trim() || "나",
          role,
          relationshipLabel: payload.relationshipLabel,
          status: "active",
          isMe: true,
          inviteCode: payload.code,
          emoji: role === "caregiver" ? "🧑‍🍼" : "👤",
        },
      ]);
    },
    [],
  );

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
      saveBabyLogs(logs),
      saveDiaryEntries(diaryEntries, localDataScope),
      saveChatHistory(chatHistory),
      saveFamilyMembers(familyMembers),
      saveGrowthBookEdit(growthBookEdit, localDataScope),
      saveBabyStickers(babyStickers, localDataScope),
      saveGrowthRecords(growthRecords),
      saveQuickRecords(quickRecords),
      saveCustomCategories(customCategories),
      saveDiaryReminder(reminder),
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
    localDataScopeRef.current = null;
    setLocalDataScope(null);
    resetDiaryEntriesMemory();
    resetGrowthBookEditMemory();
    resetDiaryDraftMemory();
    resetBabyStickersMemory();
    const emptyGrowthBook = createEmptyGrowthBookEdit({ babyId: "", babyName: "" });
    setLogs([]);
    setDiaryEntries([]);
    setFamilyMembers([]);
    setGrowthBookEditState(emptyGrowthBook);
    setBabyStickers([]);
    setGrowthRecords([]);
    setChatHistory([DEFAULT_GREETING]);
    await Promise.all([
      saveBabyLogs([]),
      saveFamilyMembers([]),
      saveGrowthRecords([]),
      saveChatHistory([DEFAULT_GREETING]),
      clearSupabaseSync(),
    ]);
  }, [careSetup.child.childName, diaryEntries, growthBookEdit]);

  const qaDebug = useMemo<BabyLogContextValue["qaDebug"]>(() => {
    if (!__DEV__) return null;

    const persistSamples = async () => {
      if (!(await hasQaBackup())) await backupQaData();
      const sampleLogs = seedLogs().map((log) => ({ ...log, id: createId() }));
      setLogs(sampleLogs);
      setDiaryEntries(SEED_DIARY);
      setChatHistory([DEFAULT_GREETING]);
      setFamilyMembers(SEED_FAMILY);
      setLogsHydrated(true);
      setDiaryHydrated(true);
      setChatHydrated(true);
      setFamilyHydrated(true);
      await Promise.all([
        saveBabyLogs(sampleLogs),
        saveDiaryEntries(SEED_DIARY, localDataScope),
        saveChatHistory([DEFAULT_GREETING]),
        saveFamilyMembers(SEED_FAMILY),
      ]);
    };

    return {
      backupCurrentData: async () => {
        await backupQaData();
      },
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
        await saveChatHistory(next);
      },
    };
  }, [chatHistory, hydrateStorageState, localDataScope]);

  const value = useMemo(
    () => ({
      careSetup,
      babyName: display.babyName,
      babyEmoji: display.babyEmoji,
      babyBadge: display.babyBadge,
      babyBirthMeta: display.babyBirthMeta,
      defaultFeedingMethod: careSetup.preferences.defaultFeedingMethod,
      customCategories,
      quickRecords,
      setQuickRecords,
      logs,
      diaryEntries,
      localDataScope,
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
      inviteFamilyMember,
      applyOwnerFromSetup,
      joinWithInvite,
      updateFamilyMemberRole,
      acceptFamilyInvite,
      setFamilyMemberStatus,
      removeFamilyMember,
      chatHistory,
      profileOpen,
      setProfileOpen,
      addLog,
      addLogs,
      updateLog,
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
      quickRecords,
      setQuickRecords,
      logs,
      diaryEntries,
      localDataScope,
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
      inviteFamilyMember,
      applyOwnerFromSetup,
      joinWithInvite,
      updateFamilyMemberRole,
      acceptFamilyInvite,
      setFamilyMemberStatus,
      removeFamilyMember,
      chatHistory,
      profileOpen,
      addLog,
      addLogs,
      updateLog,
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
