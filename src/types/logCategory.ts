import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import type { CustomCategoryIconKey, CustomCategoryTemplateId } from "../constants/customCategoryTemplates";

export type CustomCategoryInputMode = "memo" | "duration" | "amount" | "check";

export const CUSTOM_CATEGORY_INPUT_MODES: Array<{
  id: CustomCategoryInputMode;
  label: string;
  hint: string;
}> = [
  { id: "memo", label: "메모형", hint: "시간 + 메모" },
  { id: "duration", label: "시간형", hint: "시작 시간 + 종료 시간 + 총 시간" },
  { id: "amount", label: "수량형", hint: "시간 + 양" },
  { id: "check", label: "체크형", hint: "시간 + 완료 여부" },
];

export function isCustomCategoryInputMode(value: unknown): value is CustomCategoryInputMode {
  return value === "memo" || value === "duration" || value === "amount" || value === "check";
}

export type CustomCategory = {
  id: string;
  label: string;
  color: string;
  /** Primary icon key for picker + rendering. */
  iconKey?: CustomCategoryIconKey;
  /** Legacy field; treated as iconKey when iconKey is missing. */
  templateId?: CustomCategoryTemplateId;
  kind?: "custom";
  inputMode?: CustomCategoryInputMode;
  isEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  chips?: string[];
  duration?: boolean;
  amount?: string;
};

export type LogCategoryKey = BabyLogCategoryId | `custom:${string}`;

export type ResolvedLogCategory = {
  key: LogCategoryKey;
  label: string;
  color: string;
  chips?: string[];
  chips2?: string[];
  amount?: string;
  duration?: boolean;
  isCustom: boolean;
  iconKey?: CustomCategoryIconKey;
  templateId?: CustomCategoryTemplateId;
  inputMode?: CustomCategoryInputMode;
};

export function isCustomCategoryKey(key: string): key is `custom:${string}` {
  return key.startsWith("custom:");
}

export function customCategoryKey(id: string): LogCategoryKey {
  return `custom:${id}`;
}

export function parseCustomCategoryId(key: LogCategoryKey): string | null {
  return isCustomCategoryKey(key) ? key.slice("custom:".length) : null;
}

export function resolveCustomCategoryIconKey(
  category: Pick<CustomCategory, "iconKey" | "templateId">,
): CustomCategoryIconKey | undefined {
  return category.iconKey ?? category.templateId;
}
