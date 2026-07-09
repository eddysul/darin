import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import type { CustomCategoryTemplateId } from "../constants/customCategoryTemplates";

export type CustomCategory = {
  id: string;
  label: string;
  color: string;
  templateId?: CustomCategoryTemplateId;
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
  templateId?: CustomCategoryTemplateId;
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
