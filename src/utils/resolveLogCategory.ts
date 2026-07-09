import { getCategory, type BabyLogCategoryId } from "../constants/babyLogCategories";
import { getCustomCategoryTemplate } from "../constants/customCategoryTemplates";
import type { CustomCategory, LogCategoryKey, ResolvedLogCategory } from "../types/logCategory";
import { isCustomCategoryKey } from "../types/logCategory";

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
    };
  }

  const template = custom.templateId ? getCustomCategoryTemplate(custom.templateId) : null;

  return {
    key,
    label: custom.label,
    color: custom.color,
    chips: custom.chips ?? template?.chips,
    amount: custom.amount ?? template?.amount,
    duration: custom.duration ?? template?.duration,
    isCustom: true,
    templateId: custom.templateId,
  };
}
