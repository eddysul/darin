import {
  DEFAULT_DIARY_COVER_TEMPLATE_ID,
  isDiaryCoverTemplateId,
  type DiaryCoverTemplateId,
} from "../constants/diaryCoverTemplates";
import {
  DEFAULT_DIARY_PAGE_TEMPLATE_ID,
  isDiaryPageTemplateId,
  type DiaryPageTemplateId,
} from "../constants/diaryPageTemplates";

export function resolveGrowthBookCoverTemplateId(value: unknown): DiaryCoverTemplateId {
  return isDiaryCoverTemplateId(value) ? value : DEFAULT_DIARY_COVER_TEMPLATE_ID;
}

export function resolveGrowthBookPageTemplateId(value: unknown): DiaryPageTemplateId {
  return isDiaryPageTemplateId(value) ? value : DEFAULT_DIARY_PAGE_TEMPLATE_ID;
}

export function resolveGrowthBookLetterTemplateId(
  letterValue: unknown,
  pageValue?: unknown,
): DiaryPageTemplateId {
  if (isDiaryPageTemplateId(letterValue)) return letterValue;
  return resolveGrowthBookPageTemplateId(pageValue);
}
