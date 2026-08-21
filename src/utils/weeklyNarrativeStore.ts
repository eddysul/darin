/**
 * 주간 해석 캐시.
 *
 * AI 호출은 주 1회면 충분하다. 매번 부르면 비용도 들고, 같은 데이터인데
 * 카드를 열 때마다 문장이 바뀌어 사용자가 혼란스럽다.
 * 기간 표기가 바뀌면(= 새 주가 되면) 다시 부른다.
 */
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import { qaStorage } from "./qaStorage";
import { NARRATIVE_VERSION } from "./weeklyNarrativePrompt";

export type CachedNarrative = {
  /** 어느 주의 해석인지. WeeklyFeatureTable.meta.periodLabel 과 같은 값. */
  periodLabel: string;
  headline: string;
  body: string;
  fromAI: boolean;
  /** 어느 프롬프트로 만든 문장인지. 없으면 버전 개념이 생기기 전의 캐시다. */
  version?: number;
};

const STORAGE_KEY = STORAGE_KEYS.weeklyNarrative;

let memory: CachedNarrative | null = null;
let hydrated = false;

export async function hydrateWeeklyNarrative(force = false): Promise<void> {
  if (hydrated && !force) return;
  try {
    const raw = await qaStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CachedNarrative) : null;
    memory =
      parsed && typeof parsed.periodLabel === "string" && typeof parsed.headline === "string"
        ? parsed
        : null;
    hydrated = true;
  } catch {
    reportStorageIssue("load", STORAGE_KEY);
  }
}

/**
 * 요청한 주의 캐시만 돌려준다. 주가 바뀌면 null 이라 새로 부르게 된다.
 * 프롬프트가 바뀌었을 때도 null 이다. 옛 형식 문장을 그 주 내내 붙들고 있지 않기 위해서다.
 */
export function getWeeklyNarrative(periodLabel: string): CachedNarrative | null {
  if (!memory || memory.periodLabel !== periodLabel) return null;
  return memory.version === NARRATIVE_VERSION ? memory : null;
}

export async function saveWeeklyNarrative(value: CachedNarrative): Promise<void> {
  const stamped = { ...value, version: NARRATIVE_VERSION };
  memory = stamped;
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}
