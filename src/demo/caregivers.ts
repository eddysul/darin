export type BackgroundCheckStatus = "completed" | "pending" | "not_submitted" | "expired";

export type CredentialStatus = "verified" | "pending" | "unavailable";

export type CaregiverCredential = {
  id: "identity" | "cpr" | "license" | "background_check" | "references";
  status: CredentialStatus;
};

export type ParentReview = {
  author: string;
  rating: number;
  text: string;
  date: string;
};

export type CaregiverMatch = {
  id: number;
  name: string;
  role: string;
  rating: number;
  reviews: number;
  location: string;
  locationKo: string;
  distance: string;
  distanceMiles: number;
  weeklyPay: string;
  languages: string[];
  tags: string[];
  available: string;
  availableKo: string;
  img: string;
  verified: boolean;
  matchScore: number;
  matchReasons: string[];
  matchReasonsKo: string[];
  aiExplanationEn: string;
  aiExplanationKo: string;
  experienceEn: string;
  experienceKo: string;
  certificationsEn: string[];
  certificationsKo: string[];
  strengthsEn: string[];
  strengthsKo: string[];
  aboutEn?: string;
  aboutKo?: string;
  backgroundCheckStatus?: BackgroundCheckStatus;
  credentials?: CaregiverCredential[];
  parentReviews?: ParentReview[];
  price?: string;
  contactDraftEn?: string;
  contactDraftKo?: string;
};

export const CAREGIVER_MATCHES: CaregiverMatch[] = [
  {
    id: 1,
    name: "Ji-yeon Park",
    role: "Certified Nanny",
    rating: 4.9,
    reviews: 47,
    location: "Capitol Hill, Seattle",
    locationKo: "시애틀 캐피털 힐",
    distance: "0.8 mi",
    distanceMiles: 0.8,
    weeklyPay: "$2,800/wk",
    languages: ["Korean", "English"],
    tags: ["Newborn Care", "Bilingual", "First Aid"],
    available: "Mon–Fri · Live-in or 8am–6pm",
    availableKo: "월–금 · 상주 또는 오전 8시–오후 6시",
    img: "photo-1544005313-94ddf0286df2",
    verified: true,
    matchScore: 94,
    matchReasons: [
      "Korean/English bilingual",
      "0.8 miles away",
      "Live-in available",
      "Newborn & postpartum care",
      "CPR certified",
      "Background checked",
    ],
    matchReasonsKo: [
      "한국어/영어 이중언어",
      "0.8마일 거리",
      "상주 가능",
      "신생아·산후 돌봄",
      "CPR 자격",
    ],
    aiExplanationEn:
      "Recommended because she speaks Korean and English, offers live-in care, and specializes in newborn and postpartum support near Capitol Hill.",
    aiExplanationKo:
      "한국어와 영어가 가능하고, 상주 돌봄을 제공하며, 캐피털 힐 인근에서 신생아·산후 돌봄 전문이라 추천드립니다.",
    experienceEn: "8+ years newborn & postpartum care · Former NICU nurse aide",
    experienceKo: "신생아·산후 돌봄 8년 이상 · 전 NICU 간호 보조",
    certificationsEn: ["CPR & First Aid", "Newborn Care Specialist", "WA State Background Check"],
    certificationsKo: ["CPR 및 응급처치", "신생아 돌봄 전문가", "워싱턴 주 신원 조회 완료"],
    strengthsEn: [
      "Breastfeeding support",
      "Overnight newborn routines",
      "Bilingual family communication",
    ],
    strengthsKo: ["모유수유 지원", "신생아 야간 루틴", "이중언어 가족 소통"],
  },
  {
    id: 2,
    name: "Sarah Kim",
    role: "Bilingual Postpartum Doula",
    rating: 4.8,
    reviews: 33,
    location: "Ballard, Seattle",
    locationKo: "시애틀 발라드",
    distance: "2.1 mi",
    distanceMiles: 2.1,
    weeklyPay: "$2,400/wk",
    languages: ["English", "Korean"],
    tags: ["Postpartum", "Doula", "CPR Certified"],
    available: "Mon–Sat · Flexible hours",
    availableKo: "월–토 · 유연한 시간",
    img: "photo-1438761681033-6461ffad8d80",
    verified: true,
    matchScore: 88,
    matchReasons: [
      "Korean/English bilingual",
      "2.1 miles away",
      "Postpartum doula certified",
      "Flexible scheduling",
      "Meal prep & recovery support",
    ],
    matchReasonsKo: [
      "한국어/영어 이중언어",
      "2.1마일 거리",
      "산후 doula 자격",
      "유연한 일정",
      "식사·회복 지원",
    ],
    aiExplanationEn:
      "Recommended for first-time parents seeking flexible, bilingual postpartum support with doula certification.",
    aiExplanationKo:
      "유연한 이중언어 산후 지원과 doula 자격을 원하는 초보 부모에게 적합해 추천드립니다.",
    experienceEn: "6 years postpartum doula · 40+ families supported",
    experienceKo: "산후 doula 6년 · 40가구 이상 지원",
    certificationsEn: ["DONA Postpartum Doula", "CPR Certified", "Lactation Support Trained"],
    certificationsKo: ["DONA 산후 doula", "CPR 자격", "수유 지원 교육"],
    strengthsEn: [
      "Emotional support for new parents",
      "Recovery meal planning",
      "Light housekeeping",
    ],
    strengthsKo: ["초보 부모 정서 지원", "회복 식단 계획", "가벼운 가사"],
  },
  {
    id: 3,
    name: "Min-jun Lee",
    role: "Licensed Postpartum Specialist",
    rating: 4.7,
    reviews: 89,
    location: "Queen Anne, Seattle",
    locationKo: "시애틀 퀸 앤",
    distance: "1.5 mi",
    distanceMiles: 1.5,
    weeklyPay: "$3,000/wk",
    languages: ["Korean", "English"],
    tags: ["Live-in", "Licensed", "Traditional Care"],
    available: "Mon–Sun · Live-in preferred",
    availableKo: "월–일 · 상주 선호",
    img: "photo-1472099645785-5658abf4ff4e",
    verified: true,
    matchScore: 81,
    matchReasons: [
      "Licensed specialist",
      "1.5 miles away",
      "Live-in available",
      "Traditional Korean postpartum care",
      "Full-week coverage",
    ],
    matchReasonsKo: [
      "면허 전문가",
      "1.5마일 거리",
      "상주 가능",
      "한국 전통 산후 돌봄",
      "주 7일 커버",
    ],
    aiExplanationEn:
      "Recommended for families seeking a licensed live-in specialist with traditional Korean postpartum expertise.",
    aiExplanationKo:
      "한국 전통 산후 돌봄 경험을 갖춘 면허 상주 전문가를 원하는 가족에게 적합해 추천드립니다.",
    experienceEn: "12 years postpartum specialist · Licensed live-in caregiver",
    experienceKo: "산후 전문가 12년 · 면허 상주 돌보미",
    certificationsEn: ["WA Licensed Caregiver", "Postpartum Specialist License", "CPR & First Aid"],
    certificationsKo: ["워싱턴 주 돌보미 면허", "산후 전문가 면허", "CPR 및 응급처치"],
    strengthsEn: [
      "Traditional Korean postpartum meals",
      "24/7 newborn monitoring",
      "Structured recovery routines",
    ],
    strengthsKo: ["한국 전통 산후식", "24시간 신생아 모니터링", "체계적인 회복 루틴"],
  },
];

export function getCaregiverById(id: number): CaregiverMatch | undefined {
  return CAREGIVER_MATCHES.find((c) => c.id === id);
}
