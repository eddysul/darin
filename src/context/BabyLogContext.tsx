import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  resolveEnabledCategoryIds,
  sortCategoriesForFeeding,
} from "../constants/logCategoryGroups";
import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import { useApp } from "./AppContext";
import type { BabyLogEntry, CaregiverMember, ChatMessage, DiaryEntry } from "../types/babyLog";
import type { CareSetup, DefaultFeedingMethod } from "../types/careSetup";
import { buildBabyDisplay } from "../utils/childDisplay";
import { createId } from "../utils/id";

const SEED_LOGS: Omit<BabyLogEntry, "id">[] = [
  { cat: "breast", time: "07:10", chip: "좌측", duration: "12", voice: false },
  { cat: "diaper", time: "08:32", chip: "소변", voice: false },
  { cat: "sleep", time: "09:28", duration: "40", voice: false },
  { cat: "diaper", time: "09:42", chip: "대변", chip2: "황금색", voice: true },
  { cat: "formula", time: "12:10", amount: "150", voice: false },
  { cat: "diaper", time: "13:05", chip: "소변", voice: false },
  { cat: "sleep", time: "13:40", duration: "35", voice: false },
  { cat: "tummy", time: "15:00", duration: "10", voice: true },
];

const SEED_DIARY: DiaryEntry[] = [
  {
    id: "d1",
    date: "7월 5일 (일)",
    emoji: "🛁",
    comment: "오늘 처음으로 욕조 목욕을 했는데 물을 튀기면서 엄청 좋아했어요. 목욕 후에 바로 잠들었네요.",
  },
  {
    id: "d2",
    date: "7월 3일 (금)",
    emoji: "😊",
    comment: '낮에 옹알이가 부쩍 늘었어요. "아부부" 소리를 계속 내면서 웃는 모습이 너무 사랑스러웠던 하루.',
  },
];

const SEED_CAREGIVERS: CaregiverMember[] = [
  { id: "m1", emoji: "👩", name: "김민지", role: "엄마 · 관리자", badge: "나", isMe: true },
  { id: "m2", emoji: "👨", name: "이준호", role: "아빠", badge: "공유중" },
  { id: "m3", emoji: "🧑‍🍼", name: "박시터", role: "시터 · 평일 9-6시", badge: "공유중" },
];

type BabyLogContextValue = {
  careSetup: CareSetup;
  babyName: string;
  babyEmoji: string;
  babyBadge: string;
  babyBirthMeta: string;
  defaultFeedingMethod: DefaultFeedingMethod;
  enabledCategoryIds: BabyLogCategoryId[];
  logs: BabyLogEntry[];
  diaryEntries: DiaryEntry[];
  caregivers: CaregiverMember[];
  chatHistory: ChatMessage[];
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  addLog: (entry: Omit<BabyLogEntry, "id">) => void;
  updateLog: (id: string, entry: Omit<BabyLogEntry, "id">) => void;
  deleteLog: (id: string) => void;
  addDiary: (entry: Omit<DiaryEntry, "id">) => void;
  pushChat: (role: "user" | "ai", text: string) => void;
  feedCount: number;
  diaperCount: number;
  sleepMinutes: number;
};

const BabyLogContext = createContext<BabyLogContextValue | null>(null);

export function BabyLogProvider({ children }: { children: ReactNode }) {
  const { careSetup } = useApp();
  const [logs, setLogs] = useState<BabyLogEntry[]>(() => SEED_LOGS.map((l) => ({ ...l, id: createId() })));
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(SEED_DIARY);
  const [caregivers] = useState<CaregiverMember[]>(SEED_CAREGIVERS);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { id: createId(), role: "ai", text: "안녕하세요! 콩이 정보를 확인했어요. 무엇이든 편하게 물어보세요 😊" },
  ]);
  const [profileOpen, setProfileOpen] = useState(false);

  const locale = careSetup.parent.preferredLanguage;
  const display = useMemo(() => buildBabyDisplay(careSetup.child, locale), [careSetup.child, locale]);

  const enabledCategoryIds = useMemo(() => {
    const ids = resolveEnabledCategoryIds(careSetup.preferences.enabledLogCategories);
    return sortCategoriesForFeeding(ids, careSetup.preferences.defaultFeedingMethod);
  }, [careSetup.preferences.enabledLogCategories, careSetup.preferences.defaultFeedingMethod]);

  const addLog = useCallback((entry: Omit<BabyLogEntry, "id">) => {
    setLogs((prev) => [...prev, { ...entry, id: createId() }]);
  }, []);

  const updateLog = useCallback((id: string, entry: Omit<BabyLogEntry, "id">) => {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...entry, id } : l)));
  }, []);

  const deleteLog = useCallback((id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addDiary = useCallback((entry: Omit<DiaryEntry, "id">) => {
    setDiaryEntries((prev) => [{ ...entry, id: createId() }, ...prev]);
  }, []);

  const pushChat = useCallback((role: "user" | "ai", text: string) => {
    setChatHistory((prev) => [...prev, { id: createId(), role, text }]);
  }, []);

  const feedCount = useMemo(
    () => logs.filter((l) => ["breast", "formula", "food", "snack", "pump"].includes(l.cat)).length,
    [logs],
  );
  const diaperCount = useMemo(() => logs.filter((l) => l.cat === "diaper").length, [logs]);
  const sleepMinutes = useMemo(
    () => logs.filter((l) => l.cat === "sleep").reduce((sum, l) => sum + (parseInt(l.duration ?? "0", 10) || 0), 0),
    [logs],
  );

  const value = useMemo(
    () => ({
      careSetup,
      babyName: display.babyName,
      babyEmoji: display.babyEmoji,
      babyBadge: display.babyBadge,
      babyBirthMeta: display.babyBirthMeta,
      defaultFeedingMethod: careSetup.preferences.defaultFeedingMethod,
      enabledCategoryIds,
      logs,
      diaryEntries,
      caregivers,
      chatHistory,
      profileOpen,
      setProfileOpen,
      addLog,
      updateLog,
      deleteLog,
      addDiary,
      pushChat,
      feedCount,
      diaperCount,
      sleepMinutes,
    }),
    [
      careSetup,
      display,
      enabledCategoryIds,
      logs,
      diaryEntries,
      caregivers,
      chatHistory,
      profileOpen,
      addLog,
      updateLog,
      deleteLog,
      addDiary,
      pushChat,
      feedCount,
      diaperCount,
      sleepMinutes,
    ],
  );

  return <BabyLogContext.Provider value={value}>{children}</BabyLogContext.Provider>;
}

export function useBabyLog() {
  const ctx = useContext(BabyLogContext);
  if (!ctx) throw new Error("useBabyLog must be used within BabyLogProvider");
  return ctx;
}
