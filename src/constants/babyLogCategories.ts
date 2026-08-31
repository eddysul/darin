import { categoryColors } from "../themePalette";

export type BornLogCategoryId =
  | "breast"
  | "formula"
  | "storedMilk"
  | "food"
  | "water"
  | "milk"
  | "diaper"
  | "sleep"
  | "pump"
  | "bath"
  | "doctor"
  | "vaccination"
  | "temp"
  | "med"
  | "snack"
  | "tummy"
  | "play"
  | "memo"
  | "other";

export type PregnancyLogCategoryId =
  | "pregMood"
  | "pregSymptom"
  | "pregWeight"
  | "pregBp"
  | "pregMed"
  | "pregKick"
  | "pregHospital"
  | "contraction";

export type BabyLogCategoryId = BornLogCategoryId | PregnancyLogCategoryId;

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
  { id: "storedMilk", label: "저장 모유 수유", emoji: "", color: categoryColors.storedMilk, amount: "ml" },
  { id: "food", label: "이유식", emoji: "🥣", color: categoryColors.food, chips: ["잘 먹음", "보통", "거부"], amount: "g" },
  { id: "water", label: "물", emoji: "", color: categoryColors.water, amount: "ml" },
  { id: "milk", label: "우유", emoji: "", color: categoryColors.milk, amount: "ml" },
  {
    id: "diaper",
    label: "기저귀",
    emoji: "🧷",
    color: categoryColors.diaper,
    chips: ["소변", "대변", "소변+대변"],
  },
  { id: "sleep", label: "수면", emoji: "😴", color: categoryColors.sleep, duration: true },
  { id: "pump", label: "유축", emoji: "🍼", color: categoryColors.pump, amount: "ml", duration: true },
  { id: "bath", label: "목욕", emoji: "🛁", color: categoryColors.bath, duration: true },
  { id: "doctor", label: "진료", emoji: "🩺", color: categoryColors.doctor },
  { id: "vaccination", label: "예방접종", emoji: "", color: categoryColors.vaccination },
  { id: "temp", label: "체온", emoji: "🌡️", color: categoryColors.temp, amount: "℃" },
  { id: "med", label: "투약", emoji: "💊", color: categoryColors.med },
  { id: "snack", label: "간식", emoji: "🍎", color: categoryColors.snack },
  { id: "tummy", label: "터미타임", emoji: "🧸", color: categoryColors.tummy, duration: true },
  { id: "play", label: "놀이", emoji: "🎈", color: categoryColors.play, duration: true },
  { id: "memo", label: "메모", emoji: "📝", color: categoryColors.memo },
  { id: "other", label: "기타", emoji: "", color: categoryColors.other },
];

/** Pregnancy-stage record categories. Stored as distinct IDs so labels stay after birth. */
export const PREGNANCY_LOG_CATEGORIES: BabyLogCategory[] = [
  { id: "pregMood", label: "컨디션", emoji: "", color: categoryColors.play, chips: ["좋음", "보통", "힘듦"] },
  { id: "pregSymptom", label: "입덧/증상", emoji: "", color: categoryColors.temp, chips: ["입덧", "두통", "부종", "피로", "기타"] },
  { id: "pregWeight", label: "체중", emoji: "", color: categoryColors.food, amount: "kg" },
  { id: "pregBp", label: "혈압", emoji: "", color: categoryColors.water, amount: "mmHg" },
  { id: "pregMed", label: "약/영양제", emoji: "", color: categoryColors.med, chips: ["영양제", "약", "기타"] },
  { id: "pregKick", label: "태동", emoji: "", color: categoryColors.tummy, chips: ["느꼈어요", "활발", "적음"] },
  { id: "pregHospital", label: "병원/진료", emoji: "", color: categoryColors.doctor, chips: ["검진", "진료", "초음파"] },
  { id: "contraction", label: "진통 주기", emoji: "", color: categoryColors.temp, chips: ["약함", "보통", "강함"], duration: true },
];

const ALL_LOG_CATEGORIES: BabyLogCategory[] = [...BABY_LOG_CATEGORIES, ...PREGNANCY_LOG_CATEGORIES];

/** Fixed main record grid categories (same order as BABY_LOG_CATEGORIES). */
export const MAIN_LOG_CATEGORY_IDS: BornLogCategoryId[] = BABY_LOG_CATEGORIES.map((c) => c.id as BornLogCategoryId);

export function isPregnancyLogCategoryId(id: string): id is PregnancyLogCategoryId {
  return PREGNANCY_LOG_CATEGORIES.some((c) => c.id === id);
}

export function getCategory(id: BabyLogCategoryId): BabyLogCategory {
  const cat = ALL_LOG_CATEGORIES.find((c) => c.id === id);
  if (!cat) throw new Error(`Unknown category: ${id}`);
  return cat;
}

/** Demo-only historical stubs — report UI no longer reads these. */
export const CAT_HISTORY: Record<BornLogCategoryId, number[]> = {
  breast: [3, 4, 3, 4, 4, 3],
  formula: [3, 3, 4, 3, 4, 4],
  storedMilk: [1, 1, 0, 1, 1, 0],
  food: [2, 2, 3, 2, 2, 3],
  water: [2, 3, 2, 3, 3, 2],
  milk: [0, 1, 1, 0, 1, 1],
  diaper: [6, 7, 6, 8, 6, 7],
  sleep: [5, 5, 4, 5, 4, 5],
  pump: [2, 3, 2, 3, 2, 2],
  bath: [1, 1, 1, 1, 1, 1],
  doctor: [0, 0, 0, 1, 0, 0],
  vaccination: [0, 0, 0, 0, 0, 0],
  temp: [0, 0, 1, 0, 0, 0],
  med: [1, 1, 1, 0, 1, 1],
  snack: [1, 2, 1, 2, 1, 1],
  tummy: [2, 3, 2, 3, 2, 2],
  play: [2, 2, 3, 2, 3, 2],
  memo: [1, 0, 1, 1, 0, 1],
  other: [0, 1, 0, 0, 1, 0],
};
