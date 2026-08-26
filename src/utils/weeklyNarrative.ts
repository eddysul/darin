/**
 * 주간 리포트의 AI 해석 층.
 *
 * 원칙
 *  - AI 는 숫자를 만들지 않는다. 표에 있는 값만 골라 문장으로 옮긴다.
 *  - 출력은 반드시 검증을 통과해야 화면에 나간다. 실패하면 규칙 문장으로 대체한다.
 *  - 인과·권유·예측을 쓰지 않는다. 영유아 건강 근처라 앱이 판단하면 안 된다.
 *
 * 서버 경로는 AI 상담과 같은 /chat 을 쓴다. OpenAI 키는 클라이언트에 두지 않는다.
 */
import { callOpenAI } from "../api/openaiChat";
import type { Locale } from "../i18n";
import type { WeeklyFeatureTable } from "./weeklyFeatureTable";
import { narrativeSystemPrompt, describeTable, validateNarrative } from "./weeklyNarrativePrompt";

export type WeeklyNarrative = {
  headline: string;
  body: string;
  /** AI 응답이 검증을 통과했는지. false 면 규칙 문장으로 대체됐다는 뜻. */
  fromAI: boolean;
};

/**
 * 표를 받아 주간 해석을 만든다.
 * AI 실패·검증 실패 시 fallback 을 그대로 돌려주므로 호출부는 항상 문장을 받는다.
 */
export async function buildWeeklyNarrative(
  table: WeeklyFeatureTable,
  fallback: WeeklyNarrative,
  locale: Locale = "ko",
): Promise<WeeklyNarrative> {
  if (!table.metrics.length) return fallback;
  try {
    const reply = await callOpenAI(
      [{ role: "user", content: describeTable(table) }],
      narrativeSystemPrompt(locale),
      320,
    );
    if (!validateNarrative(reply, table)) return fallback;

    const [headline, ...rest] = reply.split("\n").map((line) => line.trim()).filter(Boolean);
    const body = rest.join(" ").trim();
    if (!headline || !body) return fallback;
    return { headline, body, fromAI: true };
  } catch {
    return fallback;
  }
}
