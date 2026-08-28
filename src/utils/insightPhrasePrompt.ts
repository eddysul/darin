/**
 * 발견 문장을 AI 로 다듬을 때의 순수 로직 — 프롬프트, 입력 직렬화, 검증.
 *
 * 역할을 확실히 나눠 둔다.
 *   상관을 찾는 것   우리 통계 (Spearman + BH 보정). AI 는 관여하지 않는다.
 *   문장을 쓰는 것   AI. 뜻은 그대로 두고 표현만 바꾼다.
 *
 * 그래서 AI 가 실패해도 잃는 건 문장의 매끄러움뿐이고, 발견 자체는 그대로 남는다.
 * react-native 를 끌고 들어오지 않으므로 검증을 스크립트로 돌려볼 수 있다.
 */
import type { Insight } from "./careInsights";
import { BANNED_PHRASES } from "./weeklyNarrativePrompt";
import type { Locale } from "../i18n";
import { aiOutputLanguageInstruction, isAiOutputLocaleSafe } from "./aiLocale";

/** 프롬프트나 출력 형식이 바뀌면 올린다. 캐시가 이 값으로 옛 문장을 걸러낸다. */
export const INSIGHT_PHRASE_VERSION = 3;

export const INSIGHT_SYSTEM_PROMPT = `You rewrite statistical observations from a childcare log into concise parent-facing sentences.

[Task]
- Preserve the supplied meaning exactly. The app already found the association; you only improve the wording.
- Keep every supplied number unchanged and use it no more than once.
- Describe association only, never causation.

[Safety]
- Do not add advice, recommendations, commands, predictions, diagnoses, or medical judgments.
- Do not evaluate the child or compare the child with other children.
- Do not use an em dash or the child's name.

[Format]
- Return one short sentence per observation, one line each.
- Prefix lines with 1., 2., and so on.
- Return no introduction, explanation, or markdown.`;

export function insightSystemPrompt(locale: Locale): string {
  return `${INSIGHT_SYSTEM_PROMPT}

[Language]
${aiOutputLanguageInstruction(locale)}`;
}

/** 발견 하나를 가리키는 키. 캐시와 응답 짝맞춤에 쓴다. */
export function insightKey(insight: Insight): string {
  return `${insight.input}-${insight.output}`;
}

/** AI 에게 줄 입력. 원본 기록은 나가지 않고 이미 만들어진 문장과 조각만 나간다. */
export function describeInsights(
  insights: Insight[],
  localized?: Array<{ lead: string; gapText: string; tail: string; bucketLabel: string; valueLabel: string }>,
): string {
  return insights
    .map((insight, index) => {
      const copy = localized?.[index];
      const lead = copy?.lead ?? insight.lead;
      const gapText = copy?.gapText ?? insight.gapText;
      const tail = copy?.tail ?? insight.tail;
      const dist = insight.distribution;
      const bucketLabel = copy?.bucketLabel ?? dist.bucketLabel;
      const valueLabel = copy?.valueLabel ?? dist.valueLabel;
      return [
        `Observation ${index + 1}`,
        `- Source sentence: ${lead}${gapText} ${tail}`,
        `- Segment: ${bucketLabel}`,
        `- Outcome: ${valueLabel}`,
        `- Difference: ${gapText}`,
        `- Sample days: ${dist.totalDays}`,
      ].join("\n");
    })
    .join("\n\n");
}

/** 문장 속 수를 모은다. */
function numbersIn(text: string): string[] {
  return text.match(/\d+(\.\d+)?/g) ?? [];
}

/**
 * 다듬은 문장이 원래 뜻의 범위 안에 있는지 확인한다.
 * 금지 표현이 있거나, 원래 문장에 없던 수가 등장하면 폐기하고 우리 문장을 쓴다.
 */
export function validateInsightPhrase(text: string, insight: Insight, locale: Locale = "ko"): boolean {
  const line = text.trim();
  // 35자 내외를 시켰으니 60자를 넘으면 지시를 벗어난 것이다. 한 줄에 안 들어간다.
  if (!line || line.length > 140) return false;
  if (!isAiOutputLocaleSafe(line, locale)) return false;
  for (const word of BANNED_PHRASES) {
    if (line.includes(word)) return false;
  }
  const allowed = new Set([
    ...numbersIn(`${insight.lead}${insight.gapText} ${insight.tail}`),
    ...numbersIn(String(insight.distribution.totalDays)),
  ]);
  return numbersIn(line).every((value) => allowed.has(value));
}

/** 번호가 붙은 응답을 관계 순서대로 가른다. 줄 수가 모자라면 그만큼만 채워진다. */
export function parseInsightPhrases(reply: string, insights: Insight[], locale: Locale = "ko"): Record<string, string> {
  const lines = reply
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  const out: Record<string, string> = {};
  insights.forEach((insight, index) => {
    const line = lines[index];
    if (line && validateInsightPhrase(line, insight, locale)) out[insightKey(insight)] = line;
  });
  return out;
}
