import type { IncomingRequest } from "../types/interview";
import type { LogEntry } from "../types/log";

export type ParentListing = {
  id: string;
  name: string;
  nameKo: string;
  avatar: string;
  location: string;
  locationKo: string;
  dueDate: string;
  dueDateKo: string;
  budget: string;
  liveIn: boolean;
  breastfeeding: boolean;
  languages: string[];
  notes: string;
  notesKo: string;
  matchScore: number;
};

export const PARENT_LISTINGS: ParentListing[] = [
  {
    id: "p1",
    name: "Sarah & James Park",
    nameKo: "박지연·박제임스",
    avatar: "photo-1529626455594-4ff0802cfb7e",
    location: "Capitol Hill, Seattle, WA",
    locationKo: "시애틀 캐피톨힐",
    dueDate: "Aug 15, 2026",
    dueDateKo: "2026년 8월 15일",
    budget: "$1,800–$2,200/wk",
    liveIn: true,
    breastfeeding: true,
    languages: ["Korean", "English"],
    notes: "First-time parents expecting a baby girl. Mom plans to breastfeed and would love support during the first 4 weeks.",
    notesKo: "첫째 아이를 기다리는 예비 부모입니다. 모유수유를 계획 중이며 첫 4주간 도움을 원합니다.",
    matchScore: 97,
  },
  {
    id: "p2",
    name: "Mina Cho",
    nameKo: "조미나",
    avatar: "photo-1544005313-94ddf0286df2",
    location: "Bellevue, WA",
    locationKo: "벨뷰, WA",
    dueDate: "Sep 3, 2026",
    dueDateKo: "2026년 9월 3일",
    budget: "$1,500–$1,800/wk",
    liveIn: false,
    breastfeeding: false,
    languages: ["Korean", "English"],
    notes: "Second child. Looking for an experienced caregiver for weekday live-out care. Baby boy, formula feeding.",
    notesKo: "둘째 아이입니다. 평일 출퇴근 케어를 원하며 분유 수유 예정입니다.",
    matchScore: 91,
  },
  {
    id: "p3",
    name: "Jennifer & Daniel Lee",
    nameKo: "이지수·이다니엘",
    avatar: "photo-1438761681033-6461ffad8d80",
    location: "Redmond, WA",
    locationKo: "레드몬드, WA",
    dueDate: "Oct 10, 2026",
    dueDateKo: "2026년 10월 10일",
    budget: "$2,000–$2,500/wk",
    liveIn: true,
    breastfeeding: true,
    languages: ["English"],
    notes: "Twin pregnancy! Need an experienced caregiver with twin experience. Live-in preferred, bilingual a plus.",
    notesKo: "쌍둥이 임신 중입니다! 쌍둥이 경험 있는 분을 찾습니다. 입주 선호, 이중언어 가능자 우대.",
    matchScore: 88,
  },
];

// Seeded log entries — pre-populated demo data for today
const today = new Date();
const ts = (h: number, m = 0) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m).toISOString();

export const DEMO_LOG_ENTRIES: LogEntry[] = [
  {
    id: "log-1",
    category: "meal",
    timestamp: ts(7, 30),
    rawText: "모유 수유 120ml 완료했어요.",
    summary: "모유 수유 120ml",
    data: { amountMl: 120 },
  },
  {
    id: "log-2",
    category: "diaper",
    timestamp: ts(8, 10),
    rawText: "배변 색이 노란색이었어요. 정상적으로 보여요.",
    summary: "배변 노란색 (정상)",
    data: { color: "노란색" },
  },
  {
    id: "log-3",
    category: "sleep",
    timestamp: ts(9, 0),
    rawText: "오전 9시에 낮잠 시작했어요.",
    summary: "낮잠 시작",
    data: {},
  },
  {
    id: "log-4",
    category: "sleep",
    timestamp: ts(10, 30),
    rawText: "낮잠 1시간 30분 자고 일어났어요.",
    summary: "낮잠 종료 (1.5시간)",
    data: { durationMin: 90 },
  },
  {
    id: "log-5",
    category: "meal",
    timestamp: ts(11, 0),
    rawText: "분유 100ml 먹었어요.",
    summary: "분유 100ml",
    data: { amountMl: 100 },
  },
];

// Seeded incoming requests for caregiver demo
export const DEMO_INCOMING_REQUESTS: IncomingRequest[] = [
  {
    id: "req-p1",
    parentId: "p1",
    parentName: "Sarah & James Park",
    parentAvatar: "photo-1529626455594-4ff0802cfb7e",
    parentLocation: "Capitol Hill, Seattle, WA",
    dueDate: "Aug 15, 2026",
    budget: "$1,800–$2,200/wk",
    liveIn: true,
    breastfeeding: true,
    notes: "First-time parents expecting a baby girl. Mom plans to breastfeed and would love support during the first 4 weeks.",
    slotLabelEn: "Sat, Jul 12 · 2:00 PM",
    slotLabelKo: "7월 12일 (토) 오후 2:00",
    status: "pending",
  },
  {
    id: "req-p2",
    parentId: "p2",
    parentName: "Mina Cho",
    parentAvatar: "photo-1544005313-94ddf0286df2",
    parentLocation: "Bellevue, WA",
    dueDate: "Sep 3, 2026",
    budget: "$1,500–$1,800/wk",
    liveIn: false,
    breastfeeding: false,
    notes: "Weekday live-out. Formula feeding.",
    slotLabelEn: "Mon, Jul 14 · 10:00 AM",
    slotLabelKo: "7월 14일 (월) 오전 10:00",
    status: "accepted",
    contractFields: {
      startDate: "Sep 10, 2026",
      weeklyPay: "$1,650/wk",
      liveIn: false,
      workHours: "Mon–Fri · 8am–6pm",
      specialTerms: "Formula feeding only. 2-week trial period.",
    },
    parentSignature: "Mina Cho",
    parentSignedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
];
