import type { BabyLogCategoryId } from "./babyLogCategories";

export type OneTouchAction =
  | "breastfeeding"
  | "formula"
  | "diaper"
  | "sleep"
  | "pump"
  | "storedMilk"
  | "food"
  | "water"
  | "snack"
  | "milk"
  | "tummy"
  | "bath"
  | "play"
  | "temp"
  | "med"
  | "doctor"
  | "memo"
  | "other";

export type QuickRecordActionDefinition = {
  id: OneTouchAction;
  label: string;
  cat: BabyLogCategoryId;
  chip?: string;
  core: boolean;
};

export const QUICK_RECORD_ACTIONS: QuickRecordActionDefinition[] = [
  { id: "breastfeeding", label: "모유수유", cat: "breast", core: true },
  { id: "formula", label: "분유", cat: "formula", core: true },
  { id: "diaper", label: "기저귀", cat: "diaper", core: true },
  { id: "sleep", label: "수면", cat: "sleep", core: true },
  { id: "pump", label: "유축", cat: "pump", core: true },
  { id: "storedMilk", label: "저장 모유 수유", cat: "storedMilk", core: true },
  { id: "food", label: "이유식", cat: "food", core: false },
  { id: "water", label: "물", cat: "water", core: false },
  { id: "snack", label: "간식", cat: "snack", core: false },
  { id: "milk", label: "우유", cat: "milk", core: false },
  { id: "tummy", label: "터미타임", cat: "tummy", core: false },
  { id: "bath", label: "목욕", cat: "bath", core: false },
  { id: "play", label: "놀이", cat: "play", core: false },
  { id: "temp", label: "체온", cat: "temp", core: false },
  { id: "med", label: "약", cat: "med", core: false },
  { id: "doctor", label: "진료", cat: "doctor", core: false },
  { id: "memo", label: "빠른 메모", cat: "memo", core: false },
  { id: "other", label: "기타", cat: "other", core: false },
];
