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
    ],
    aiExplanationEn:
      "Recommended because she speaks Korean and English, is available after 3 PM, and has newborn care experience.",
    aiExplanationKo:
      "한국어와 영어가 가능하고, 오후 3시 이후 일정이 맞으며, 신생아 돌봄 경험이 있어 추천드립니다.",
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
      "이중언어가 가능하고, 거리가 가깝며, 엠마와 비슷한 연령대 돌봄 경험이 있어 추천드립니다.",
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
  },
];
