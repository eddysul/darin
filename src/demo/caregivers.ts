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
  distance: string;
  distanceMiles: number;
  price: string;
  languages: string[];
  tags: string[];
  available: string;
  img: string;
  verified: boolean;
  matchScore: number;
  matchReasons: string[];
  aiExplanationEn: string;
  aiExplanationKo: string;
  backgroundCheckStatus: BackgroundCheckStatus;
  aboutEn: string;
  aboutKo: string;
  experienceEn: string;
  experienceKo: string;
  credentials: CaregiverCredential[];
  parentReviews: ParentReview[];
  contactDraftEn: string;
  contactDraftKo: string;
};

export const CAREGIVER_MATCHES: CaregiverMatch[] = [
  {
    id: 1,
    name: "Ji-yeon Park",
    role: "Certified Nanny",
    rating: 4.9,
    reviews: 47,
    location: "Gangnam-gu",
    distance: "1.2km",
    distanceMiles: 2.1,
    price: "₩18,000/hr",
    languages: ["Korean", "English"],
    tags: ["Infant Care", "Bilingual", "First Aid"],
    available: "Mon–Fri 3pm–8pm",
    img: "photo-1544005313-94ddf0286df2",
    verified: true,
    matchScore: 94,
    matchReasons: [
      "Korean/English bilingual",
      "2.1 miles away",
      "Available weekday afternoons",
      "Newborn care experience",
      "CPR certified",
      "Background checked",
    ],
    aiExplanationEn:
      "Recommended because she speaks Korean and English, is available after 3 PM, and has newborn care experience.",
    aiExplanationKo:
      "한국어와 영어가 가능하고, 오후 3시 이후 일정이 맞으며, 신생아 돌봄 경험이 있어 추천드립니다.",
    backgroundCheckStatus: "completed",
    aboutEn:
      "Warm, patient nanny with 6 years of experience supporting bilingual families in Seoul. Ji-yeon focuses on gentle routines, clear parent communication, and age-appropriate play.",
    aboutKo:
      "서울의 이중언어 가정을 6년간 돕고 있는 따뜻하고 차분한 돌보미입니다. 부드러운 일과, 명확한 부모 소통, 연령에 맞는 놀이를 중시합니다.",
    experienceEn:
      "Specializes in newborn and infant care, nap transitions, and bilingual daily logs. Calm under pressure and proactive about health updates.",
    experienceKo:
      "신생아·영아 돌봄, 낮잠 루틴, 이중언어 일일 기록에 강점이 있습니다. 차분하고 건강 변화를 부모에게 먼저 공유합니다.",
    credentials: [
      { id: "identity", status: "verified" },
      { id: "cpr", status: "verified" },
      { id: "license", status: "verified" },
      { id: "background_check", status: "verified" },
      { id: "references", status: "verified" },
    ],
    parentReviews: [
      {
        author: "Hannah L.",
        rating: 5,
        text: "Ji-yeon sent thoughtful daily updates and Emma warmed up to her within days.",
        date: "May 2026",
      },
      {
        author: "Min-soo K.",
        rating: 5,
        text: "Reliable, bilingual, and very professional with pickup timing.",
        date: "Mar 2026",
      },
    ],
    contactDraftEn:
      "Hi Ji-yeon, I found your profile through Darin. We are looking for a bilingual nanny who is available on weekday afternoons. Would you be open to a short call this week to discuss availability and care needs?",
    contactDraftKo:
      "Ji-yeon님, Darin에서 프로필을 보고 연락드립니다. 평일 오후에 가능한 이중언어 돌보미를 찾고 있습니다. 이번 주에 짧게 통화하며 일정과 돌봄 필요를 논의할 수 있을까요?",
  },
  {
    id: 2,
    name: "Sarah Kim",
    role: "Bilingual Babysitter",
    rating: 4.8,
    reviews: 33,
    location: "Mapo-gu",
    distance: "2.4km",
    distanceMiles: 1.5,
    price: "₩15,000/hr",
    languages: ["English", "Korean", "Japanese"],
    tags: ["Toddler", "Arts & Crafts", "CPR Certified"],
    available: "Weekends & Evenings",
    img: "photo-1438761681033-6461ffad8d80",
    verified: true,
    matchScore: 88,
    matchReasons: [
      "Korean/English bilingual",
      "1.5 miles away",
      "CPR certified",
      "Toddler care specialist",
      "Flexible evening hours",
    ],
    aiExplanationEn:
      "Recommended because she is bilingual, close to your area, and experienced with toddlers Emma's age.",
    aiExplanationKo:
      "이중언어가 가능하고, 거리가 가깝으며, 엠마와 비슷한 연령대 돌봄 경험이 있어 추천드립니다.",
    backgroundCheckStatus: "pending",
    aboutEn:
      "Creative babysitter who loves art, music, and outdoor play. Sarah builds trust quickly with toddlers and keeps parents in the loop.",
    aboutKo:
      "미술, 음악, 야외 놀이를 좋아하는 창의적인 돌보미입니다. 유아와 빠르게 친밀감을 형성하고 부모와 소통을 잘합니다.",
    experienceEn:
      "4 years with toddlers ages 1–4. Strong at transitions, mealtime routines, and bilingual storytelling.",
    experienceKo:
      "1–4세 유아 4년 경력. 전환 시간, 식사 루틴, 이중언어 스토리텔링에 강합니다.",
    credentials: [
      { id: "identity", status: "verified" },
      { id: "cpr", status: "verified" },
      { id: "license", status: "pending" },
      { id: "background_check", status: "pending" },
      { id: "references", status: "verified" },
    ],
    parentReviews: [
      {
        author: "Elena R.",
        rating: 5,
        text: "Sarah is energetic and kind. Our son asks for her every weekend.",
        date: "Apr 2026",
      },
    ],
    contactDraftEn:
      "Hi Sarah, I found your profile through Darin. We are looking for a bilingual sitter for weekend and evening support. Would you be open to a quick call this week?",
    contactDraftKo:
      "Sarah님, Darin에서 프로필을 보고 연락드립니다. 주말·저녁 돌봄이 가능한 이중언어 돌보미를 찾고 있습니다. 이번 주에 짧게 통화할 수 있을까요?",
  },
  {
    id: 3,
    name: "Min-jun Lee",
    role: "Daycare Teacher",
    rating: 4.7,
    reviews: 89,
    location: "Seodaemun-gu",
    distance: "3.1km",
    distanceMiles: 1.9,
    price: "₩420,000/mo",
    languages: ["Korean"],
    tags: ["Group Care", "Montessori", "Licensed"],
    available: "Mon–Fri 8am–6pm",
    img: "photo-1472099645785-5658abf4ff4e",
    verified: true,
    matchScore: 81,
    matchReasons: [
      "Licensed daycare teacher",
      "1.9 miles away",
      "Montessori experience",
      "Full weekday availability",
      "Structured daily routines",
    ],
    aiExplanationEn:
      "Recommended for families seeking a licensed educator with structured routines and full weekday coverage.",
    aiExplanationKo:
      "자격을 갖춘 교사와 체계적인 일과를 원하는 가정에 적합해 추천드립니다.",
    backgroundCheckStatus: "not_submitted",
    aboutEn:
      "Licensed daycare teacher with Montessori training and a calm, structured approach to early childhood care.",
    aboutKo:
      "몬테소리 교육을 받은 자격증 보유 교사로, 차분하고 체계적인 영유아 돌봄을 제공합니다.",
    experienceEn:
      "8 years in group care settings. Experienced with curriculum planning, developmental milestones, and parent conferences.",
    experienceKo:
      "단체 돌봄 8년 경력. 커리큘럼 계획, 발달 이정표, 부모 상담 경험이 풍부합니다.",
    credentials: [
      { id: "identity", status: "verified" },
      { id: "cpr", status: "verified" },
      { id: "license", status: "verified" },
      { id: "background_check", status: "unavailable" },
      { id: "references", status: "pending" },
    ],
    parentReviews: [
      {
        author: "Jin H.",
        rating: 4,
        text: "Very structured and professional. Great for families who want a school-like routine.",
        date: "Feb 2026",
      },
    ],
    contactDraftEn:
      "Hi Min-jun, I found your profile through Darin. We are exploring full weekday care with a structured routine. Would you be open to discussing availability?",
    contactDraftKo:
      "Min-jun님, Darin에서 프로필을 보고 연락드립니다. 체계적인 평일 돌봄을 알아보고 있습니다. 일정을 논의할 수 있을까요?",
  },
];
