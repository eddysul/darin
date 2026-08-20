import { isPregnancyLogCategoryId } from "./babyLogCategories";
import type { QuickRecord } from "../types/quickRecord";

export const DEFAULT_QUICK_RECORDS: QuickRecord[] = [
  {
    id: "qr-formula-120",
    label: "분유 120ml",
    color: "#E8918A",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "formula", amount: "120" },
  },
  {
    id: "qr-sleep-start",
    label: "낮잠 시작",
    color: "#7C83FD",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "sleep", sleepAction: "start", chip: "낮잠" },
  },
  {
    id: "qr-diaper-pee",
    label: "기저귀 소변",
    color: "#5CB87A",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "diaper", chip: "소변" },
  },
];

export const DEFAULT_PREGNANCY_QUICK_RECORDS: QuickRecord[] = [
  {
    id: "qr-preg-mood-ok",
    label: "컨디션 좋음",
    color: "#E8918A",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "pregMood", chip: "좋음" },
  },
  {
    id: "qr-preg-symptom-nausea",
    label: "입덧",
    color: "#C98A54",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "pregSymptom", chip: "입덧" },
  },
  {
    id: "qr-preg-med-vitamin",
    label: "영양제",
    color: "#7C83FD",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "pregMed", chip: "영양제" },
  },
  {
    id: "qr-preg-kick",
    label: "태동 느꼈어요",
    color: "#5CB87A",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "pregKick", chip: "느꼈어요" },
  },
];

export const ALL_DEFAULT_QUICK_RECORDS: QuickRecord[] = [
  ...DEFAULT_QUICK_RECORDS,
  ...DEFAULT_PREGNANCY_QUICK_RECORDS,
];

export function quickRecordsForStage(records: QuickRecord[], pregnancy: boolean): QuickRecord[] {
  return records.filter((record) =>
    pregnancy ? isPregnancyLogCategoryId(record.defaults.cat) : !isPregnancyLogCategoryId(record.defaults.cat),
  );
}

export const QUICK_RECORD_COLORS = [
  "#E8918A",
  "#7C83FD",
  "#5CB87A",
  "#C98A54",
  "#9096A6",
  "#D4A574",
];
