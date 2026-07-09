import { categoryColors } from "../theme";

export type BabyLogCategoryId =
  | "breast"
  | "formula"
  | "food"
  | "diaper"
  | "sleep"
  | "pump"
  | "bath"
  | "doctor"
  | "temp"
  | "med"
  | "snack"
  | "tummy"
  | "play"
  | "memo";

export type BabyLogCategory = {
  id: BabyLogCategoryId;
  label: string;
  emoji: string;
  color: string;
  chips?: string[];
  chips2?: string[];
  amount?: string;
  duration?: boolean;
};

export const BABY_LOG_CATEGORIES: BabyLogCategory[] = [
  { id: "breast", label: "모유수유", emoji: "🤱", color: categoryColors.breast, chips: ["좌측", "우측", "양쪽"], duration: true },
  { id: "formula", label: "분유", emoji: "🍼", color: categoryColors.formula, amount: "ml" },
  { id: "food", label: "이유식", emoji: "🥣", color: categoryColors.food, chips: ["잘 먹음", "보통", "거부"], amount: "g" },
  {
    id: "diaper",
    label: "배변",
    emoji: "🧷",
    color: categoryColors.diaper,
    chips: ["소변", "대변", "둘다"],
    chips2: ["황금색", "녹색", "갈색", "검정", "설사", "변비"],
  },
  { id: "sleep", label: "수면", emoji: "😴", color: categoryColors.sleep, duration: true },
  { id: "pump", label: "유축", emoji: "🍼", color: categoryColors.pump, amount: "ml" },
  { id: "bath", label: "목욕", emoji: "🛁", color: categoryColors.bath },
  { id: "doctor", label: "진료", emoji: "🩺", color: categoryColors.doctor },
  { id: "temp", label: "체온", emoji: "🌡️", color: categoryColors.temp, amount: "℃" },
  { id: "med", label: "투약", emoji: "💊", color: categoryColors.med },
  { id: "snack", label: "간식", emoji: "🍎", color: categoryColors.snack },
  { id: "tummy", label: "터미타임", emoji: "🧸", color: categoryColors.tummy, duration: true },
  { id: "play", label: "놀이", emoji: "🎈", color: categoryColors.play, duration: true },
  { id: "memo", label: "메모", emoji: "📝", color: categoryColors.memo },
];

export function getCategory(id: BabyLogCategoryId): BabyLogCategory {
  const cat = BABY_LOG_CATEGORIES.find((c) => c.id === id);
  if (!cat) throw new Error(`Unknown category: ${id}`);
  return cat;
}

export const CAT_HISTORY: Record<BabyLogCategoryId, number[]> = {
  breast: [3, 4, 3, 4, 4, 3],
  formula: [3, 3, 4, 3, 4, 4],
  food: [2, 2, 3, 2, 2, 3],
  diaper: [6, 7, 6, 8, 6, 7],
  sleep: [5, 5, 4, 5, 4, 5],
  pump: [2, 3, 2, 3, 2, 2],
  bath: [1, 1, 1, 1, 1, 1],
  doctor: [0, 0, 0, 1, 0, 0],
  temp: [0, 0, 1, 0, 0, 0],
  med: [1, 1, 1, 0, 1, 1],
  snack: [1, 2, 1, 2, 1, 1],
  tummy: [2, 3, 2, 3, 2, 2],
  play: [2, 2, 3, 2, 3, 2],
  memo: [1, 0, 1, 1, 0, 1],
};

export const HISTORY_DAYS = ["월", "화", "수", "목", "금", "토"];

export function formatLogMeta(entry: {
  cat: BabyLogCategoryId;
  chip?: string;
  chip2?: string;
  amount?: string;
  duration?: string;
  notes?: string;
}): string {
  const c = getCategory(entry.cat);
  const parts: string[] = [];
  if (entry.chip) parts.push(entry.chip);
  if (entry.chip2) parts.push(entry.chip2);
  if (entry.amount) parts.push(`${entry.amount}${c.amount ?? ""}`);
  if (entry.duration) parts.push(`${entry.duration}분`);
  if (entry.notes) parts.push(entry.notes.length > 16 ? `${entry.notes.slice(0, 16)}…` : entry.notes);
  return parts.join(" · ") || "기록됨";
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
