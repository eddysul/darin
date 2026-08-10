import { BabyLogIcon } from "./BabyLogIcon";
import { CustomTemplateIcon } from "./CustomTemplateIcon";
import type { BabyLogCategoryId } from "../../constants/babyLogCategories";
import type { CustomCategory, LogCategoryKey } from "../../types/logCategory";
import { isCustomCategoryKey } from "../../types/logCategory";
import { resolveLogCategory } from "../../utils/resolveLogCategory";

type Props = {
  categoryKey: LogCategoryKey;
  customCategories: CustomCategory[];
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function LogCategoryIcon({
  categoryKey,
  customCategories,
  size = 20,
  color,
  strokeWidth = 1.8,
}: Props) {
  if (!isCustomCategoryKey(categoryKey)) {
    return (
      <BabyLogIcon
        catId={categoryKey as BabyLogCategoryId}
        size={size}
        color={color}
        strokeWidth={strokeWidth}
      />
    );
  }

  const resolved = resolveLogCategory(categoryKey, customCategories);
  return (
    <CustomTemplateIcon
      iconKey={resolved.iconKey ?? resolved.templateId}
      size={size}
      color={color ?? resolved.color}
      strokeWidth={strokeWidth}
    />
  );
}
