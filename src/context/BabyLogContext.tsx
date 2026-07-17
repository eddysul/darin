import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CustomCategory } from "../types/logCategory";
import { useApp } from "./AppContext";
import type { BabyLogActor, BabyLogEntry, ChatMessage, DiaryEntry } from "../types/babyLog";
import type { CareSetup, DefaultFeedingMethod } from "../types/careSetup";
import type { FamilyMember, FamilyRole } from "../types/family";
import type { QuickRecord } from "../types/quickRecord";
import { buildBabyDisplay } from "../utils/childDisplay";
import {
  getCustomCategories,
  hydrateCustomCategories,
} from "../utils/customCategoriesStore";
import { getQuickRecords, hydrateQuickRecords, saveQuickRecords } from "../utils/quickRecordsStore";
import { getBabyLogs, hydrateBabyLogs, saveBabyLogs } from "../utils/babyLogsStore";
import { getDiaryEntries, hydrateDiaryEntries, saveDiaryEntries } from "../utils/diaryStore";
import { getChatHistory, hydrateChatHistory, saveChatHistory } from "../utils/chatHistoryStore";
import { getFamilyMembers, hydrateFamilyMembers, saveFamilyMembers } from "../utils/familyMembersStore";
import { createId } from "../utils/id";
import { formatDateKey, shiftDateKey } from "../utils/dateKey";
import { actorFromFamily } from "../utils/logProvenance";
import type { BabyLogSource } from "../types/babyLog";

const TODAY = formatDateKey();

function migrateActorRole(role: string): FamilyRole {
  if (role === "parent" || role === "other") return "owner";
  if (role === "owner" || role === "admin" || role === "editor" || role === "viewer" || role === "caregiver") {
    return role;
  }
  return "editor";
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
  { id: "m1", emoji: "👩", name: "김민지", role: "owner", status: "active", isMe: true },
  { id: "m2", emoji: "👨", name: "이준호", role: "admin", status: "active", contact: "junho@example.com" },
  { id: "m3", emoji: "🧑‍🍼", name: "박시터", role: "caregiver", status: "active", contact: "010-1234-5678" },
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
  setQuickRecords: (records: QuickRecord[]) => void;
  logs: BabyLogEntry[];
  diaryEntries: DiaryEntry[];
  familyMembers: FamilyMember[];
  myFamilyRole: FamilyRole;
  inviteFamilyMember: (draft: { name: string; role: FamilyRole; contact: string }) => FamilyMember;
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
  pushChat: (role: "user" | "ai", text: string) => void;
  /** True after AsyncStorage hydrate finishes (2.7). */
  storageReady: boolean;
};

const BabyLogContext = createContext<BabyLogContextValue | null>(null);

export function BabyLogProvider({ children }: { children: ReactNode }) {
  const { careSetup } = useApp();
  const [logs, setLogs] = useState<BabyLogEntry[]>(() => seedLogs().map((l) => ({ ...l, id: createId() })));
  const [logsHydrated, setLogsHydrated] = useState(false);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(SEED_DIARY);
  const [diaryHydrated, setDiaryHydrated] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(SEED_FAMILY);
  const [familyHydrated, setFamilyHydrated] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([DEFAULT_GREETING]);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [customCategories, setCustomCategoriesState] = useState<CustomCategory[]>(getCustomCategories);
  const [quickRecords, setQuickRecordsState] = useState<QuickRecord[]>(getQuickRecords);

  useEffect(() => {
    void Promise.all([
      hydrateCustomCategories(),
      hydrateQuickRecords(),
      hydrateBabyLogs(),
      hydrateDiaryEntries(),
      hydrateChatHistory(),
      hydrateFamilyMembers(),
    ]).then(() => {
      setCustomCategoriesState(getCustomCategories());
      setQuickRecordsState(getQuickRecords());
      const storedLogs = getBabyLogs();
      if (storedLogs !== null) {
        const today = formatDateKey();
        setLogs(
          storedLogs.map((l) => ({
            ...l,
            dateKey: l.dateKey ?? today,
            createdBy: l.createdBy
              ? {
                  ...l.createdBy,
                  role: migrateActorRole(l.createdBy.role as string),
                }
              : l.createdBy,
            source: l.source ?? (l.voice ? "voice" : "manual"),
          })),
        );
      }
      setLogsHydrated(true);
      const storedDiary = getDiaryEntries();
      if (storedDiary !== null) {
        setDiaryEntries(storedDiary);
      }
      setDiaryHydrated(true);
      const storedChat = getChatHistory();
      if (storedChat !== null) setChatHistory(storedChat);
      setChatHydrated(true);
      const storedFamily = getFamilyMembers();
      if (storedFamily !== null) setFamilyMembers(storedFamily);
      setFamilyHydrated(true);
      setStorageReady(true);
    });
  }, []);

  useEffect(() => {
    if (!logsHydrated) return;
    void saveBabyLogs(logs);
  }, [logs, logsHydrated]);

  useEffect(() => {
    if (!diaryHydrated) return;
    void saveDiaryEntries(diaryEntries);
  }, [diaryEntries, diaryHydrated]);

  useEffect(() => {
    if (!chatHydrated) return;
    void saveChatHistory(chatHistory);
  }, [chatHistory, chatHydrated]);

  useEffect(() => {
    if (!familyHydrated) return;
    void saveFamilyMembers(familyMembers);
  }, [familyMembers, familyHydrated]);

  const me = useMemo(() => familyMembers.find((m) => m.isMe) ?? familyMembers[0], [familyMembers]);
  const myFamilyRole: FamilyRole = me?.role ?? "owner";

  const logAuthor = useMemo<BabyLogActor>(() => {
    const name = careSetup.parent.parentName.trim() || me?.name || "나";
    if (me) return { ...actorFromFamily(me), name };
    return { userId: "local-me", name, role: "owner" };
  }, [careSetup.parent.parentName, me]);

  const setQuickRecords = useCallback((records: QuickRecord[]) => {
    setQuickRecordsState(records);
    void saveQuickRecords(records);
  }, []);

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
      return next;
    },
    [normalizeEntry],
  );

  const addLogs = useCallback(
    (entries: Omit<BabyLogEntry, "id">[]) => {
      if (!entries.length) return;
      setLogs((prev) => [...prev, ...entries.map(normalizeEntry)]);
    },
    [normalizeEntry],
  );

  const updateLog = useCallback((id: string, entry: Omit<BabyLogEntry, "id">) => {
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
  }, []);

  const deleteLog = useCallback((id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addDiary = useCallback(
    (entry: Omit<DiaryEntry, "id" | "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }) => {
      const now = new Date().toISOString();
      setDiaryEntries((prev) => [
        {
          ...entry,
          id: createId(),
          babyId: entry.babyId || "baby-1",
          dateKey: entry.dateKey || formatDateKey(),
          photos: entry.photos ?? [],
          includedInGrowthBook: entry.includedInGrowthBook ?? false,
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
        },
        ...prev,
      ]);
    },
    [],
  );

  const updateDiary = useCallback((id: string, patch: Partial<Omit<DiaryEntry, "id">>) => {
    const now = new Date().toISOString();
    setDiaryEntries((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: patch.updatedAt ?? now } : d)),
    );
  }, []);

  const deleteDiary = useCallback((id: string) => {
    setDiaryEntries((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const toggleDiaryInGrowthBook = useCallback((id: string) => {
    setDiaryEntries((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, includedInGrowthBook: !d.includedInGrowthBook, updatedAt: new Date().toISOString() }
          : d,
      ),
    );
  }, []);

  const pushChat = useCallback((role: "user" | "ai", text: string) => {
    setChatHistory((prev) => [...prev, { id: createId(), role, text }]);
  }, []);

  const inviteFamilyMember = useCallback(
    (draft: { name: string; role: FamilyRole; contact: string }) => {
      const code = createId().slice(0, 6).toUpperCase();
      const member: FamilyMember = {
        id: createId(),
        name: draft.name.trim(),
        role: draft.role,
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
      familyMembers,
      myFamilyRole,
      inviteFamilyMember,
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
    }),
    [
      careSetup,
      display,
      customCategories,
      quickRecords,
      setQuickRecords,
      logs,
      diaryEntries,
      familyMembers,
      myFamilyRole,
      inviteFamilyMember,
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
