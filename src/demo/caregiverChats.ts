export type ChatMessage = {
  id: string;
  from: "parent" | "caregiver";
  textEn: string;
  textKo: string;
  time: string;
};

const JIYEON_THREAD: ChatMessage[] = [
  {
    id: "j1",
    from: "parent",
    textEn: "Hi Ji-yeon! We're expecting in August and looking for live-in postpartum support.",
    textKo: "안녕하세요 지연 님! 8월 출산 예정이고 상주 산후 돌봄을 찾고 있어요.",
    time: "10:12 AM",
  },
  {
    id: "j2",
    from: "caregiver",
    textEn: "Hello Jisoo! Congratulations 🎉 I have live-in availability and specialize in newborn care near Capitol Hill.",
    textKo: "안녕하세요 지수 님! 축하드려요 🎉 캐피털 힐 인근에서 상주 가능하며 신생아 돌봄 전문입니다.",
    time: "10:18 AM",
  },
  {
    id: "j3",
    from: "parent",
    textEn: "That's great. Do you have experience with first-time parents and breastfeeding support?",
    textKo: "좋네요. 초보 부모와 모유수유 지원 경험이 있으신가요?",
    time: "10:22 AM",
  },
  {
    id: "j4",
    from: "caregiver",
    textEn: "Yes, absolutely. I've supported many first-time families and can help with latching, schedules, and overnight routines.",
    textKo: "네, 물론이에요. 초보 가족을 많이 도왔고 수유, 일정, 야간 루틴까지 지원해 드릴 수 있어요.",
    time: "10:25 AM",
  },
];

const SARAH_THREAD: ChatMessage[] = [
  {
    id: "s1",
    from: "parent",
    textEn: "Hi Sarah, I saw your profile. We're looking for flexible postpartum help in Ballard.",
    textKo: "안녕하세요 Sarah 님, 프로필 봤어요. 발라드에서 유연한 산후 도움을 찾고 있어요.",
    time: "2:05 PM",
  },
  {
    id: "s2",
    from: "caregiver",
    textEn: "Hi Jisoo! I'd love to help. I offer flexible hours Mon–Sat and doula-certified postpartum support.",
    textKo: "안녕하세요 지수 님! 기꺼이 도와드릴게요. 월–토 유연한 시간과 doula 자격 산후 지원을 제공합니다.",
    time: "2:11 PM",
  },
  {
    id: "s3",
    from: "parent",
    textEn: "What does a typical day look like when you visit?",
    textKo: "방문하실 때 하루 일과가 어떻게 되나요?",
    time: "2:14 PM",
  },
  {
    id: "s4",
    from: "caregiver",
    textEn: "I usually start with a check-in, help with feeding, light meal prep, and emotional support for new parents.",
    textKo: "보통 안부 확인 후 수유 도움, 간단한 식사 준비, 초보 부모 정서 지원으로 시작해요.",
    time: "2:17 PM",
  },
];

const MINJUN_THREAD: ChatMessage[] = [
  {
    id: "m1",
    from: "parent",
    textEn: "Hello Min-jun, we're interested in traditional Korean postpartum care with live-in option.",
    textKo: "안녕하세요 Min-jun 님, 상주 가능한 한국 전통 산후 돌봄에 관심 있어요.",
    time: "4:30 PM",
  },
  {
    id: "m2",
    from: "caregiver",
    textEn: "Hello Jisoo. I provide licensed live-in care with traditional Korean postpartum meals and 24/7 newborn support.",
    textKo: "안녕하세요 지수 님. 면허 상주 돌봄과 한국 전통 산후식, 24시간 신생아 지원을 제공합니다.",
    time: "4:38 PM",
  },
  {
    id: "m3",
    from: "parent",
    textEn: "Our budget is around $1,500–$2,000/week. Would that work for live-in?",
    textKo: "예산은 주당 $1,500–$2,000 정도예요. 상주로 가능할까요?",
    time: "4:42 PM",
  },
  {
    id: "m4",
    from: "caregiver",
    textEn: "Let's discuss details on a call — I can tailor a plan within your range depending on hours and live-in needs.",
    textKo: "통화로 자세히 논의해요 — 시간과 상주 필요에 따라 예산 범위 내 맞춤 플랜을 제안드릴 수 있어요.",
    time: "4:45 PM",
  },
];

const AUTO_REPLIES: Record<number, { textEn: string; textKo: string }> = {
  1: {
    textEn: "Of course! Feel free to schedule an interview — I'd be happy to meet your family.",
    textKo: "물론이에요! 면접 일정 잡아 주세요 — 가족분들 뵙고 싶어요.",
  },
  2: {
    textEn: "Thank you for reaching out! I'm available this week if you'd like to chat more.",
    textKo: "연락 주셔서 감사해요! 이번 주에 더 이야기 나눌 수 있어요.",
  },
  3: {
    textEn: "Thank you, Jisoo. I look forward to speaking with you soon.",
    textKo: "감사합니다 지수 님. 곧 이야기 나눌 수 있기를 기대해요.",
  },
};

export function getCaregiverChatThread(caregiverId: number): ChatMessage[] {
  switch (caregiverId) {
    case 1:
      return [...JIYEON_THREAD];
    case 2:
      return [...SARAH_THREAD];
    case 3:
      return [...MINJUN_THREAD];
    default:
      return [];
  }
}

export function getCaregiverAutoReply(caregiverId: number): { textEn: string; textKo: string } {
  return AUTO_REPLIES[caregiverId] ?? {
    textEn: "Thank you for your message! I'll get back to you soon.",
    textKo: "메시지 감사합니다! 곧 답변드릴게요.",
  };
}
