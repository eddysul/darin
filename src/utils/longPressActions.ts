import type { OneTouchAction } from "../constants/quickRecordActions";
import { QUICK_RECORD_ACTIONS } from "../constants/quickRecordActions";
import type { LogCategoryKey } from "../types/logCategory";
import type { RecordSheetPrefill } from "../components/babylog/RecordDetailSheet";
import { isTimerAction } from "../types/activeTimer";
import { nowTime } from "./formatLog";
import { formatDateKey } from "./dateKey";

export type LongPressMode = "timer" | "sheet";

export function longPressModeFor(action: OneTouchAction): LongPressMode {
  if (isTimerAction(action)) return "timer";
  return "sheet";
}

export function actionToCategory(action: OneTouchAction): LogCategoryKey {
  const def = QUICK_RECORD_ACTIONS.find((item) => item.id === action);
  return def?.cat ?? "other";
}

/** Prefill for long-press detail sheets (no auto-create). */
export function longPressSheetPrefill(action: OneTouchAction): RecordSheetPrefill {
  const time = nowTime();
  const dateKey = formatDateKey();
  const base = { time, dateKey, source: "manual" as const };

  switch (action) {
    case "formula":
    case "storedMilk":
    case "water":
    case "milk":
      return { ...base, cat: actionToCategory(action), amount: "" };
    case "bowel":
      return { ...base, cat: "diaper", chip: "대변" };
    case "urine":
      return { ...base, cat: "diaper", chip: "소변" };
    case "food":
    case "snack":
      return { ...base, cat: actionToCategory(action) };
    case "temp":
      return { ...base, cat: "temp", amount: "" };
    case "med":
      return { ...base, cat: "med" };
    case "doctor":
      return { ...base, cat: "doctor" };
    case "memo":
      return { ...base, cat: "memo" };
    case "other":
      return { ...base, cat: "other", title: "" };
    case "bath":
      return { ...base, cat: "bath" };
    default:
      return { ...base, cat: actionToCategory(action) };
  }
}

export const ML_SUGGESTIONS = ["60", "80", "100", "120", "150", "180"] as const;
