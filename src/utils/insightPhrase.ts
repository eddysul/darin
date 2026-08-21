/**
 * 발견 문장의 AI 다듬기 층 + 캐시.
 *
 * 세 발견을 한 번에 보낸다. 호출이 하나면 비용도 캐시도 단순하다.
 * 검증을 통과한 줄만 남기므로, 일부만 통과하면 나머지는 우리 문장이 그대로 쓰인다.
 */
import { callOpenAI } from "../api/openaiChat";
import type { Insight } from "./careInsights";
import {
  INSIGHT_PHRASE_VERSION,
  INSIGHT_SYSTEM_PROMPT,
  describeInsights,
  parseInsightPhrases,
} from "./insightPhrasePrompt";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import { qaStorage } from "./qaStorage";

/** 발견 키 → 다듬은 문장. */
export type InsightPhrases = Record<string, string>;

type Cached = {
  periodLabel: string;
  version: number;
  phrases: InsightPhrases;
};

const STORAGE_KEY = STORAGE_KEYS.insightPhrases;

let memory: Cached | null = null;
let hydrated = false;

export async function hydrateInsightPhrases(force = false): Promise<void> {
  if (hydrated && !force) return;
  try {
    const raw = await qaStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Cached) : null;
    memory = parsed && typeof parsed.periodLabel === "string" && parsed.phrases ? parsed : null;
    hydrated = true;
  } catch {
    reportStorageIssue("load", STORAGE_KEY);
  }
}

/** 이번 주의, 지금 프롬프트로 만든 문장만 돌려준다. */
export function getInsightPhrases(periodLabel: string): InsightPhrases | null {
  if (!memory || memory.periodLabel !== periodLabel) return null;
  return memory.version === INSIGHT_PHRASE_VERSION ? memory.phrases : null;
}

async function saveInsightPhrases(periodLabel: string, phrases: InsightPhrases): Promise<void> {
  const stamped: Cached = { periodLabel, version: INSIGHT_PHRASE_VERSION, phrases };
  memory = stamped;
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}

/**
 * 발견 문장을 다듬어 돌려준다.
 * 실패하면 빈 객체라서 호출부는 우리 문장을 그대로 쓰게 된다.
 */
export async function buildInsightPhrases(
  insights: Insight[],
  periodLabel: string,
): Promise<InsightPhrases> {
  if (!insights.length) return {};
  try {
    const reply = await callOpenAI(
      [{ role: "user", content: describeInsights(insights) }],
      INSIGHT_SYSTEM_PROMPT,
      300,
    );
    const phrases = parseInsightPhrases(reply, insights);
    if (Object.keys(phrases).length) void saveInsightPhrases(periodLabel, phrases);
    return phrases;
  } catch {
    return {};
  }
}
