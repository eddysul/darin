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
import { aiOutputLanguageInstruction } from "./aiLocale";

/** 프롬프트나 출력 형식이 바뀌면 올린다. 캐시가 이 값으로 옛 문장을 걸러낸다. */
export const INSIGHT_PHRASE_VERSION = 2;

export const INSIGHT_SYSTEM_PROMPT = `너는 육아 기록 앱이 찾아낸 관계를 부모가 읽기 좋은 한 문장으로 다듬는다.

[네가 하는 일]
관계는 앱이 통계로 찾았다. 너는 표현만 바꾼다.
주어진 뜻을 바꾸지 마라. 없는 관계를 만들지 마라.
숫자를 새로 만들거나 고치지 마라. 주어진 숫자를 그대로 한 번만 쓴다.

[반드시 지킬 것]
- 원인이라고 쓰지 마라. "때문에", "덕분에", "탓에" 금지. 함께 나타났다는 뜻으로만 써라.
- 조언·권유·명령을 하지 마라. "~해보세요", "~하는 게 좋아요" 금지.
- 예측하지 마라.
- 아이를 평가하지 마라. "잘", "충분히", "정상" 금지.
- 다른 아기와 비교하지 마라.
- 엠대시를 절대 쓰지 마라.
- 해요체로 쓴다. "습니다" 로 끝내지 마라.

[문체]
관계마다 한 문장. 35자 내외. 아기 이름은 쓰지 마라.

[출력 형식]
관계마다 한 줄. 앞에 번호를 붙여라. 다른 말은 붙이지 마라.
1. ...
2. ...`;

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
        `관계 ${index + 1}`,
        `- 우리 문장: ${lead}${gapText} ${tail}`,
        `- 기준: ${bucketLabel}`,
        `- 결과: ${valueLabel}`,
        `- 차이: ${gapText}`,
        `- 관측: ${dist.totalDays}일`,
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
export function validateInsightPhrase(text: string, insight: Insight): boolean {
  const line = text.trim();
  // 35자 내외를 시켰으니 60자를 넘으면 지시를 벗어난 것이다. 한 줄에 안 들어간다.
  if (!line || line.length > 140) return false;
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
export function parseInsightPhrases(reply: string, insights: Insight[]): Record<string, string> {
  const lines = reply
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  const out: Record<string, string> = {};
  insights.forEach((insight, index) => {
    const line = lines[index];
    if (line && validateInsightPhrase(line, insight)) out[insightKey(insight)] = line;
  });
  return out;
}
