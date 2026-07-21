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

export const QUICK_RECORD_COLORS = [
  "#E8918A",
  "#7C83FD",
  "#5CB87A",
  "#C98A54",
  "#9096A6",
  "#D4A574",
];
