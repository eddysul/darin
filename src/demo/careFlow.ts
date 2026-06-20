import type {
  AgreementTerms,
  CarePlan,
  CarePlanAdjustForm,
  CarePlanDraft,
  CarePlanUpdatePayload,
  CareProposal,
  CareRequestForm,
  ChatMessage,
  NegotiationChatItem,
} from "../types/careFlow";

export const DEFAULT_CARE_REQUEST: CareRequestForm = {
  childName: "Emma",
  childAge: "8 months",
  location: "Seattle, Capitol Hill",
  schedule: "Mon–Fri, 3 PM–8 PM",
  preferredLanguage: "Korean/English",
  careNeeds: "feeding, nap routine, light play, bilingual daily report",
  budgetRange: "$18–25/hr",
  startDate: "Next Monday",
  specialNotes: "Slight cough recently, parent prefers daily bilingual updates.",
};

export const DEFAULT_AGREEMENT_TERMS: AgreementTerms = {
  schedule: "agreed",
  careScope: "agreed",
  dailyReportLanguage: "agreed",
  rate: "discussing",
  trialSession: "needs_confirmation",
};

export const DEFAULT_CARE_NEEDS_LIST = [
  "feeding",
  "nap routine",
  "light play",
  "bilingual daily reports",
];

export function buildDefaultCarePlanDraft(caregiverName: string, rate = "$22/hr"): CarePlanDraft {
  return {
    childName: "Emma",
    caregiverName,
    schedule: "Mon–Fri, 3 PM–8 PM",
    rate,
    startDate: "Next Monday",
    careNeeds: [...DEFAULT_CARE_NEEDS_LIST],
    trialSession: null,
    dailyReportIncluded: true,
  };
}

export const DEFAULT_CARE_PLAN_ADJUST: CarePlanAdjustForm = {
  schedule: "Mon–Fri, 3 PM–8 PM",
  rate: "$21/hr",
  trialSession: "Friday 4 PM",
  startDate: "Next Monday",
  careNeeds: {
    feeding: true,
    napRoutine: true,
    lightPlay: true,
    bilingualReports: true,
    lightHousekeeping: false,
  },
  message: "Would this updated care plan work for you?",
};

export function careNeedsFromAdjustForm(form: CarePlanAdjustForm): string[] {
  const needs: string[] = [];
  if (form.careNeeds.feeding) needs.push("feeding");
  if (form.careNeeds.napRoutine) needs.push("nap routine");
  if (form.careNeeds.lightPlay) needs.push("light play");
  if (form.careNeeds.bilingualReports) needs.push("bilingual daily reports");
  if (form.careNeeds.lightHousekeeping) needs.push("light housekeeping");
  return needs;
}

export function buildCarePlanUpdatePayload(form: CarePlanAdjustForm): CarePlanUpdatePayload {
  return {
    schedule: form.schedule,
    rate: form.rate,
    trialSession: form.trialSession,
    startDate: form.startDate,
    careNeeds: careNeedsFromAdjustForm(form),
    message: form.message,
    status: "pending",
  };
}

export function buildAiAgreementSummaryEn(draft: CarePlanDraft): { agreed: string[]; pending: string[] } {
  return {
    agreed: [
      draft.schedule,
      draft.careNeeds.slice(0, 3).join(", "),
      "Korean/English daily reports",
    ],
    pending: ["Final match confirmation from both sides"],
  };
}

export function buildAiAgreementSummaryKo(draft: CarePlanDraft): { agreed: string[]; pending: string[] } {
  return {
    agreed: [
      draft.schedule,
      draft.careNeeds.slice(0, 3).join(", "),
      "한/영 일일 리포트",
    ],
    pending: ["양측 최종 매칭 확정"],
  };
}

export const CARE_PROPOSALS: CareProposal[] = [
  {
    caregiverId: 1,
    matchScore: 94,
    rate: "$22/hr",
    availability: "Mon–Fri, 3 PM–8 PM",
    languages: "Korean/English",
    careStyleEn: "Calm, warm, routine-based",
    careStyleKo: "차분하고 따뜻한 루틴 중심",
    trustSummaryEn: "Background check completed, CPR certified, childcare license uploaded",
    trustSummaryKo: "신원 조회 완료, CPR 인증, 보육 자격증 업로드",
    highlights: [
      "Newborn care experience",
      "Background check completed",
      "CPR certified",
    ],
    backgroundCheckStatus: "completed",
    proposalMessageEn:
      "I can support Emma's afternoon routine, including feeding, nap transition, light play, and bilingual Korean/English updates. I can start next Monday.",
    proposalMessageKo:
      "엠마의 오후 루틴(수유, 낮잠 전환, 가벼운 놀이, 한/영 일일 업데이트)을 도와드릴 수 있습니다. 다음 주 월요일부터 시작 가능합니다.",
  },
  {
    caregiverId: 2,
    matchScore: 91,
    rate: "$20/hr",
    availability: "Tue–Fri, 2 PM–7 PM",
    languages: "Korean/English",
    careStyleEn: "Play-based, gentle, flexible",
    careStyleKo: "놀이 중심, 부드럽고 유연한",
    trustSummaryEn: "Background check completed, CPR certified",
    trustSummaryKo: "신원 조회 완료, CPR 인증",
    highlights: [
      "Toddler and infant experience",
      "Background check completed",
      "CPR certified",
    ],
    backgroundCheckStatus: "completed",
    proposalMessageEn:
      "I would be happy to help with Emma's care and provide daily updates. I am available most weekday afternoons except Monday.",
    proposalMessageKo:
      "엠마 돌봄과 일일 업데이트를 기쁜 마음으로 도와드리겠습니다. 월요일을 제외한 평일 오후 대부분 가능합니다.",
  },
  {
    caregiverId: 3,
    matchScore: 87,
    rate: "$24/hr",
    availability: "Weekends and evenings",
    languages: "English/Korean",
    careStyleEn: "Active play, bilingual family experience",
    careStyleKo: "활동적 놀이, 이중언어 가정 경험",
    trustSummaryEn: "CPR certified, background check pending",
    trustSummaryKo: "CPR 인증, 신원 조회 진행 중",
    highlights: ["CPR certified", "Background check pending"],
    backgroundCheckStatus: "pending",
    proposalMessageEn:
      "I have experience with bilingual families and can support evening or weekend care.",
    proposalMessageKo:
      "이중언어 가정 경험이 있으며, 저녁 또는 주말 돌봄을 지원할 수 있습니다.",
  },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    role: "parent",
    textEn: "Hi Ji-yeon, thank you for your proposal.",
    textKo: "Ji-yeon님, 제안해 주셔서 감사합니다.",
  },
  {
    id: "2",
    role: "caregiver",
    textEn:
      "Hi, thank you for reaching out. I'm available Mon–Fri from 3 PM to 8 PM and can provide bilingual daily updates.",
    textKo:
      "안녕하세요, 연락 주셔서 감사합니다. 월–금 오후 3시–8시 가능하며 이중언어 일일 업데이트를 제공할 수 있습니다.",
  },
  {
    id: "3",
    role: "ai",
    textEn:
      "Suggested questions: Ask about newborn experience, nap routine, background check, trial session availability, and daily report language preference.",
    textKo:
      "추천 질문: 신생아 경험, 낮잠 루틴, 신원 조회, 시범 세션 가능 여부, 일일 리포트 언어 선호를 물어보세요.",
  },
];

export const AI_SUGGESTED_MESSAGE = {
  en: "Thank you for your proposal. Do you have experience with babies under 1 year old, and would you be available for a short trial session this week?",
  ko: "제안 감사합니다. 1세 미만 아기 경험이 있으신가요? 이번 주 짧은 시범 세션이 가능할까요?",
};

export const AI_DRAFT_MESSAGE = {
  en: "Hi Ji-yeon, thank you for your proposal. We are looking for someone who can support Emma's afternoon feeding, nap routine, and bilingual daily updates. Would you be available for a short trial session this week?",
  ko: "Ji-yeon님, 제안 감사합니다. 엠마의 오후 수유, 낮잠 루틴, 이중언어 일일 업데이트를 도와주실 분을 찾고 있습니다. 이번 주 짧은 시범 세션이 가능할까요?",
};

export const AI_TRANSLATE_DEMO = {
  inputKo: "이번 주에 짧게 만나볼 수 있는지 물어봐줘.",
  outputEn: "Would you be available for a short trial meeting sometime this week?",
};

export const AI_COMPARISON_SUMMARY = {
  en: "Ji-yeon is the strongest match because she meets the language requirement, has newborn care experience, fully matches the weekday afternoon schedule, and has completed background verification. Sarah is slightly more affordable but has limited availability.",
  ko: "Ji-yeon님이 가장 강력한 매칭입니다. 언어 요건, 신생아 돌봄 경험, 평일 오후 일정, 신원 조회 완료가 모두 충족됩니다. Sarah는 조금 더 저렴하지만 가용 시간이 제한적입니다.",
};

export function buildCarePlan(caregiverName: string, rate = "$22/hr", schedule = "Mon–Fri, 3 PM–8 PM"): CarePlan {
  return {
    childName: "Emma",
    caregiverName,
    schedule,
    rate,
    startDate: "Next Monday",
    languages: "Korean/English",
    dailyReportEnabled: true,
    careNeeds: [...DEFAULT_CARE_NEEDS_LIST],
    safetyItems: [
      "Background check completed",
      "CPR certified",
      "Childcare license uploaded",
    ],
  };
}
