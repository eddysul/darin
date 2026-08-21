/**
 * 기록 카테고리를 그림에 올릴 때의 공통 규칙.
 *
 * 오늘의 리듬(원)과 주간 스트립(가로)이 같은 색·같은 묶음을 쓰도록 한 곳에 둔다.
 * 두 그림에서 같은 기록이 다른 색으로 보이면 읽는 사람이 헷갈린다.
 */
import { getCategory, type BabyLogCategoryId } from "../constants/babyLogCategories";
import { isCustomCategoryKey } from "../types/logCategory";
import { colors } from "../theme";

/** 그림에서 뺄 카테고리. 하루 리듬과 무관하거나 색으로 구분할 값이 아니다. */
export const DIAL_EXCLUDED: BabyLogCategoryId[] = ["other", "memo", "temp"];

/** 모유·분유·저장 모유는 부모에게 "수유" 한 가지다. */
export const FEED_GROUP: BabyLogCategoryId[] = ["breast", "formula", "storedMilk", "milk"];
export const FEED_KEY = "feed";

/** 그림에 올릴 대상인지. 커스텀 카테고리는 고유 색이 없어 제외한다. */
export function isDisplayableCat(cat: string): boolean {
  if (isCustomCategoryKey(cat)) return false;
  return !DIAL_EXCLUDED.includes(cat as BabyLogCategoryId);
}

/** 카테고리를 그림에서 쓰는 키로. 수유 계열은 하나로 묶인다. */
export function displayKey(cat: string): string {
  return FEED_GROUP.includes(cat as BabyLogCategoryId) ? FEED_KEY : cat;
}

export function displayMeta(key: string): { label: string; color: string } {
  if (key === FEED_KEY) return { label: "수유", color: colors.amber };
  const meta = getCategory(key as BabyLogCategoryId);
  return { label: meta.label, color: meta.color };
}

/** 지속 시간이 있는 기록인지. 있으면 막대·호로, 없으면 점으로 그린다. */
export function hasDuration(cat: string): boolean {
  if (isCustomCategoryKey(cat)) return false;
  return Boolean(getCategory(cat as BabyLogCategoryId).duration);
}
