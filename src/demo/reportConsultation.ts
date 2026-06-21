import type { CarePlan } from "../types/careFlow";
import type { ChildProfile } from "../types/childProfile";
import type { DailyReport } from "../types/dailyReport";
import type { ReportConsultationPayload } from "../types/reportConsultation";

export function buildReportConsultationPayload(input: {
  childName: string;
  selectedReports: DailyReport[];
  childProfile?: ChildProfile;
  activeCarePlan?: CarePlan | null;
  userQuestion: string;
}): ReportConsultationPayload {
  return {
    task: "report_consultation",
    childName: input.childName,
    selectedReports: input.selectedReports,
    childProfile: input.childProfile,
    activeCarePlan: input.activeCarePlan ?? null,
    userQuestion: input.userQuestion,
  };
}

const RESPONSES = {
  sleep: {
    ko: "선택한 기록 기준으로 Emma는 낮잠을 약 1시간 정도 잤고, 일어난 뒤 기분이 안정적이었다고 기록되어 있어요. 오늘 기록만 보면 큰 걱정 신호는 보이지 않지만, 평소보다 수면이 짧아졌다면 내일도 수면 시간과 기분 변화를 함께 확인해보면 좋아요.",
    en: "Based on the selected reports, Emma napped for about an hour and seemed stable after waking. Nothing major stands out in today's notes, but if naps have been shorter than usual, it may help to track nap length and mood together tomorrow.",
  },
  meal: {
    ko: "선택한 기록에서는 점심과 간식 섭취가 기록되어 있고, 전반적으로 식사는 안정적으로 보입니다. 다만 식사량이 줄거나 특정 음식에 반응이 있었다면 다음 리포트에서도 함께 확인하는 것이 좋아요.",
    en: "Across the selected reports, lunch and snacks were recorded and meals look generally stable. If intake drops or you notice a reaction to certain foods, it would be worth watching for that in the next reports too.",
  },
  bowel: {
    ko: "선택한 기록의 배변 항목을 보면 특별히 걱정할 만한 패턴은 보이지 않아요. 횟수, 상태, 시간대가 평소와 다르게 변하면 케어기버에게 다음 기록에서도 같은 항목을 자세히 남겨달라고 요청해볼 수 있어요.",
    en: "Looking at bowel records in the selected reports, there isn't an obvious concerning pattern. If frequency, texture, or timing shifts from Emma's usual routine, you could ask the caregiver to keep noting those details in upcoming reports.",
  },
  health: {
    ko: "선택한 기록 기준으로 큰 건강 이슈는 보이지 않지만, 기침이나 컨디션 변화가 언급된 날이 있다면 저녁·밤 시간대 상태를 함께 확인하는 것이 좋아요. 증상이 반복되면 진료 기록도 함께 비교해보세요.",
    en: "Based on the selected reports, there are no major health concerns, but if cough or mood changes were mentioned on any day, it's worth checking how Emma did later that evening. If symptoms repeat, compare clinic notes across reports too.",
  },
  caregiverDraft: {
    ko: "케어기버에게 보낼 메시지 초안이에요:\n\n\"Ji-yeon님, 오늘 업데이트 감사합니다. Emma의 낮잠 시간이 평소보다 짧았는지, 그리고 일어난 뒤에 편안해 보였는지 알려주실 수 있을까요?\"",
    en: "Here's a draft message for the caregiver:\n\n\"Hi Ji-yeon, thank you for today's update. Could you let me know if Emma's nap time was shorter than usual and whether she seemed comfortable after waking up?\"",
  },
  plan: {
    ko: "선택한 기록을 보면 식사와 수면 루틴은 대체로 안정적이에요. 내일은 낮잠 후 기분 변화와 식사량을 함께 확인하고, 기록에 배변·수면·식사 항목을 꾸준히 남기도록 케어기버와 맞춰보면 좋겠어요.",
    en: "From the selected reports, meals and sleep look mostly stable. For tomorrow, it may help to track mood after naps alongside meal intake, and align with the caregiver on consistently logging bowel, sleep, and meal entries.",
  },
  default: {
    ko: "선택하신 리포트를 기준으로 Emma의 식사, 수면, 배변, 건강 기록을 함께 살펴봤어요. 더 자세히 보고 싶은 항목이 있으면 수면, 식사, 배변, 건강, 케어기버 메시지 중 하나를 골라 질문해 주세요.",
    en: "I reviewed Emma's meals, sleep, bowel, and health notes across the selected reports. If you'd like to go deeper, ask about sleep, meals, bowel patterns, health, or a caregiver message draft.",
  },
};

function matches(question: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(question));
}

export function getMockConsultationResponse(
  payload: ReportConsultationPayload,
  locale: "en" | "ko",
): string {
  const q = payload.userQuestion.trim();

  if (matches(q, [/수면|낮잠|nap|sleep/i])) {
    return RESPONSES.sleep[locale];
  }
  if (matches(q, [/식사|meal|점심|lunch|feeding/i])) {
    return RESPONSES.meal[locale];
  }
  if (matches(q, [/배변|bowel|diaper|stool/i])) {
    return RESPONSES.bowel[locale];
  }
  if (matches(q, [/건강|health|기침|cough|주의/i])) {
    return RESPONSES.health[locale];
  }
  if (matches(q, [/케어기버|caregiver|물어볼|message|draft|메시지/i])) {
    return RESPONSES.caregiverDraft[locale];
  }
  if (matches(q, [/플랜|plan|추천|tomorrow|내일/i])) {
    return RESPONSES.plan[locale];
  }

  return RESPONSES.default[locale];
}

export const REPORT_CONSULTATION_CHIPS = [
  "darinChat.chipSleep",
  "darinChat.chipMeals",
  "darinChat.chipBowel",
  "darinChat.chipHealth",
  "darinChat.chipCaregiver",
  "darinChat.chipPlan",
] as const;
