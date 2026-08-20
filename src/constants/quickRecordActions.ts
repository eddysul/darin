import type { BabyLogCategoryId, PregnancyLogCategoryId } from "./babyLogCategories";

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
  | "vaccination"
  | "memo"
  | "other"
  | PregnancyLogCategoryId;

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
  { id: "vaccination", label: "예방접종", cat: "vaccination", core: false },
  { id: "memo", label: "빠른 메모", cat: "memo", core: false },
  { id: "other", label: "기타", cat: "other", core: false },
];

export const PREGNANCY_QUICK_RECORD_ACTIONS: QuickRecordActionDefinition[] = [
  { id: "pregMood", label: "컨디션", cat: "pregMood", core: true },
  { id: "pregSymptom", label: "입덧/증상", cat: "pregSymptom", core: true },
  { id: "pregWeight", label: "체중", cat: "pregWeight", core: true },
  { id: "pregBp", label: "혈압", cat: "pregBp", core: true },
  { id: "pregMed", label: "약/영양제", cat: "pregMed", core: true },
  { id: "pregKick", label: "태동", cat: "pregKick", core: true },
  { id: "pregHospital", label: "병원/진료", cat: "pregHospital", core: false },
];

export const PREGNANCY_QUICK_ACTION_IDS: OneTouchAction[] = PREGNANCY_QUICK_RECORD_ACTIONS.map(
  (action) => action.id,
);

const ALL_QUICK_RECORD_ACTIONS = [...QUICK_RECORD_ACTIONS, ...PREGNANCY_QUICK_RECORD_ACTIONS];

export function getQuickRecordAction(id: OneTouchAction): QuickRecordActionDefinition | undefined {
  return ALL_QUICK_RECORD_ACTIONS.find((action) => action.id === id);
}
