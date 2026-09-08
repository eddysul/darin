/**
 * 발견 문장의 AI 다듬기 층 + 캐시.
 *
 * 세 발견을 한 번에 보낸다. 호출이 하나면 비용도 캐시도 단순하다.
 * 검증을 통과한 줄만 남기므로, 일부만 통과하면 나머지는 우리 문장이 그대로 쓰인다.
 */
import { callOpenAI } from "../api/openaiChat";
import type { Locale } from "../i18n";
import type { Insight } from "./careInsights";
import { localizeInsight } from "./insightDisplay";
import {
  insightSystemPrompt,
  describeInsights,
  parseInsightPhrases,
} from "./insightPhrasePrompt";
import type { Translate } from "./recordDisplay";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import { qaStorage } from "./qaStorage";
import {
  createScopedWeeklyAiCacheStore,
  type WeeklyAiCacheIdentity,
  type WeeklyAiCacheScope,
} from "./weeklyAiCache";

/** 발견 키 → 다듬은 문장. */
export type InsightPhrases = Record<string, string>;

const STORAGE_KEY = STORAGE_KEYS.insightPhrases;

function isInsightPhrases(value: unknown): value is InsightPhrases {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const phrases = Object.values(value as Record<string, unknown>);
  return phrases.length > 0
    && phrases.every((item) => typeof item === "string" && Boolean(item.trim()));
}

const cache = createScopedWeeklyAiCacheStore<InsightPhrases>({
  baseKey: STORAGE_KEY,
  isValue: isInsightPhrases,
  onStorageError: (operation) => reportStorageIssue(operation, STORAGE_KEY),
});

export function hydrateInsightPhrases(
  scope: WeeklyAiCacheScope | null,
  force = false,
): Promise<boolean> {
  return cache.hydrate(scope, qaStorage, force);
}

export function getInsightPhrases(identity: WeeklyAiCacheIdentity): InsightPhrases | null {
  return cache.get(identity);
}

export function saveInsightPhrases(
  identity: WeeklyAiCacheIdentity,
  phrases: InsightPhrases,
): Promise<boolean> {
  return cache.save(identity, phrases, qaStorage);
}

export function resetInsightPhrasesMemory(): void {
  cache.reset();
}

/** Exact localized facts string used both for the request and its fingerprint. */
export function buildInsightPhraseInput(
  insights: Insight[],
  locale: Locale = "ko",
  t?: Translate,
): string {
  const localized = t ? insights.map((insight) => localizeInsight(insight, t, locale)) : undefined;
  return describeInsights(insights, localized);
}

/**
 * 발견 문장을 다듬어 돌려준다.
 * 실패하면 빈 객체라서 호출부는 우리 문장을 그대로 쓰게 된다.
 */
export async function buildInsightPhrases(
  insights: Insight[],
  promptInput: string,
  locale: Locale = "ko",
): Promise<InsightPhrases> {
  if (!insights.length) return {};
  try {
    const reply = await callOpenAI(
      [{ role: "user", content: promptInput }],
      insightSystemPrompt(locale),
      300,
    );
    return parseInsightPhrases(reply, insights, locale);
  } catch {
    return {};
  }
}
