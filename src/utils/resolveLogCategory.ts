import { getCategory, type BabyLogCategoryId } from "../constants/babyLogCategories";
import type { CustomCategory, LogCategoryKey, ResolvedLogCategory } from "../types/logCategory";
import { isCustomCategoryKey, resolveCustomCategoryIconKey } from "../types/logCategory";

export function resolveLogCategory(
  key: LogCategoryKey,
  customCategories: CustomCategory[],
): ResolvedLogCategory {
  if (!isCustomCategoryKey(key)) {
    const c = getCategory(key as BabyLogCategoryId);
    return {
      key,
      label: c.label,
      color: c.color,
      chips: c.chips,
      chips2: c.chips2,
      amount: c.amount,
      duration: c.duration,
      isCustom: false,
    };
  }

  const customId = key.slice("custom:".length);
  const custom = customCategories.find((c) => c.id === customId);
  if (!custom) {
    return {
      key,
      label: "사용자 카테고리",
      color: "#9096a6",
      isCustom: true,
      inputMode: "memo",
    };
  }

  const iconKey = resolveCustomCategoryIconKey(custom);
  const inputMode = custom.inputMode ?? "memo";

  return {
    key,
    label: custom.label,
    color: custom.color,
    chips: inputMode === "check" ? ["완료", "미완료"] : undefined,
    amount: inputMode === "amount" ? (custom.amount || "회/량") : undefined,
    duration: inputMode === "duration",
    isCustom: true,
    iconKey,
    templateId: iconKey,
    inputMode,
  };
}
