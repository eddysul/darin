import { isPregnancyLogCategoryId } from "./babyLogCategories";
import type { QuickRecord } from "../types/quickRecord";
import { DEFAULT_QUICK_RECORD_VALUES, RECORD_VALUE } from "./recordInternalValues";

export const DEFAULT_QUICK_RECORDS: QuickRecord[] = [
  {
    id: "qr-formula-120",
    label: DEFAULT_QUICK_RECORD_VALUES.formulaLabel,
    color: "#E8918A",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "formula", amount: "120" },
  },
  {
    id: "qr-sleep-start",
    label: DEFAULT_QUICK_RECORD_VALUES.sleepLabel,
    color: "#7C83FD",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "sleep", sleepAction: "start", chip: RECORD_VALUE.nap },
  },
  {
    id: "qr-diaper-pee",
    label: DEFAULT_QUICK_RECORD_VALUES.diaperLabel,
    color: "#5CB87A",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "diaper", chip: RECORD_VALUE.diaperUrine },
  },
];

export const DEFAULT_PREGNANCY_QUICK_RECORDS: QuickRecord[] = [
  {
    id: "qr-preg-mood-ok",
    label: DEFAULT_QUICK_RECORD_VALUES.pregnancyMoodLabel,
    color: "#E8918A",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "pregMood", chip: DEFAULT_QUICK_RECORD_VALUES.pregnancyMoodChip },
  },
  {
    id: "qr-preg-symptom-nausea",
    label: DEFAULT_QUICK_RECORD_VALUES.pregnancySymptomLabel,
    color: "#C98A54",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "pregSymptom", chip: DEFAULT_QUICK_RECORD_VALUES.pregnancySymptomLabel },
  },
  {
    id: "qr-preg-med-vitamin",
    label: DEFAULT_QUICK_RECORD_VALUES.pregnancyMedicationLabel,
    color: "#7C83FD",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "pregMed", chip: DEFAULT_QUICK_RECORD_VALUES.pregnancyMedicationLabel },
  },
  {
    id: "qr-preg-kick",
    label: DEFAULT_QUICK_RECORD_VALUES.pregnancyKickLabel,
    color: "#5CB87A",
    icon: "",
    pinned: true,
    isCustom: false,
    defaults: { cat: "pregKick", chip: DEFAULT_QUICK_RECORD_VALUES.pregnancyKickChip },
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
