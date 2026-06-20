export type CaregiverMatch = {
  id: number;
  name: string;
  role: string;
  roleKo: string;
  rating: number;
  reviews: number;
  location: string;
  price: string;
  languages: string[];
  tags: string[];
  available: string;
  avatar: string;
  verified: boolean;
  matchScore: number;
  matchReasons: string[];
  aiExplanationEn: string;
  aiExplanationKo: string;
};

export const CAREGIVER_MATCHES: CaregiverMatch[] = [
  {
    id: 1,
    name: 'Ji-yeon Park',
    role: 'Postpartum Specialist',
    roleKo: '산후조리사',
    rating: 4.9,
    reviews: 47,
    location: 'Capitol Hill, Seattle',
    price: '$1,800/wk',
    languages: ['Korean', 'English'],
    tags: ['Newborn Care', 'Bilingual', 'First Aid'],
    available: 'Aug 10 – Available',
    avatar: '👩‍⚕️',
    verified: true,
    matchScore: 94,
    matchReasons: ['Korean/English bilingual', 'Newborn care experience', 'CPR certified', 'Live-in available', '5+ years experience'],
    aiExplanationEn: 'Recommended because she is bilingual, has extensive newborn care experience, and is available for your due date.',
    aiExplanationKo: '이중언어가 가능하고, 신생아 돌봄 경험이 풍부하며, 출산 예정일에 맞춰 일정을 조율할 수 있어 추천드립니다.',
  },
  {
    id: 2,
    name: 'Sarah Kim',
    role: 'Certified Nanny',
    roleKo: '전문 보모',
    rating: 4.8,
    reviews: 33,
    location: 'Bellevue, WA',
    price: '$1,600/wk',
    languages: ['English', 'Korean'],
    tags: ['Infant Care', 'Breastfeeding Coach', 'CPR Certified'],
    available: 'Flexible start date',
    avatar: '👩',
    verified: true,
    matchScore: 88,
    matchReasons: ['Breastfeeding coach certified', 'Flexible schedule', 'Live-out preferred', 'Korean American background'],
    aiExplanationEn: 'Recommended for her breastfeeding coaching certification and flexibility with your schedule.',
    aiExplanationKo: '모유수유 코칭 자격증 보유 및 유연한 일정으로 추천드립니다.',
  },
  {
    id: 3,
    name: 'Min-jun Lee',
    role: 'Postpartum Specialist',
    roleKo: '산후조리사',
    rating: 4.7,
    reviews: 89,
    location: 'Redmond, WA',
    price: '$2,000/wk',
    languages: ['Korean'],
    tags: ['Postpartum Recovery', 'Korean Cuisine', 'Licensed'],
    available: 'Aug 15 – Available',
    avatar: '👨‍⚕️',
    verified: true,
    matchScore: 81,
    matchReasons: ['Licensed postpartum specialist', 'Korean traditional care', 'Structured daily routines', 'Full-time live-in'],
    aiExplanationEn: 'Ideal for families seeking traditional Korean postpartum care with a licensed specialist.',
    aiExplanationKo: '자격을 갖춘 전문가와 함께 전통 한국식 산후조리를 원하는 가정에 적합합니다.',
  },
];
