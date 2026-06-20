export type ParentProfile = {
  id: number;
  name: { en: string; ko: string };
  avatar: string;
  location: string;
  languages: string[];
  verified: boolean;
  dueDate: { en: string; ko: string };
  liveIn: boolean;
  budget: string;
  newbornExp: boolean;
  nonSmoker: boolean;
  breastfeeding: boolean;
  notes: { en: string; ko: string };
};

export const PARENTS: ParentProfile[] = [
  {
    id: 1,
    name: { en: 'Jieun Kim', ko: '김지은' },
    avatar: '👩',
    location: 'Capitol Hill, Seattle',
    languages: ['Korean', 'English'],
    verified: true,
    dueDate: { en: 'Aug 15, 2026', ko: '2026년 8월 15일' },
    liveIn: true,
    budget: '$1,500 – $2,000 / wk',
    newbornExp: true,
    nonSmoker: true,
    breastfeeding: true,
    notes: {
      en: 'First-time parents expecting our first baby. Looking for someone experienced with newborns who can also support breastfeeding.',
      ko: '첫째 아이입니다. 신생아 경험이 풍부하고 모유수유를 도와줄 수 있는 분을 찾습니다.',
    },
  },
  {
    id: 2,
    name: { en: 'Soyeon Park', ko: '박소연' },
    avatar: '👩‍👦',
    location: 'Bellevue, WA',
    languages: ['Korean'],
    verified: true,
    dueDate: { en: 'Sep 3, 2026', ko: '2026년 9월 3일' },
    liveIn: false,
    budget: '$1,200 – $1,500 / wk',
    newbornExp: true,
    nonSmoker: true,
    breastfeeding: false,
    notes: {
      en: 'Second-time mom, looking for weekday daytime care. Korean-speaking preferred.',
      ko: '둘째 아이입니다. 주중 낮 시간 돌봄을 원합니다. 한국어 가능하신 분 선호합니다.',
    },
  },
  {
    id: 3,
    name: { en: 'Minjung Lee', ko: '이민정' },
    avatar: '🤰',
    location: 'Redmond, WA',
    languages: ['Korean', 'English'],
    verified: false,
    dueDate: { en: 'Oct 20, 2026', ko: '2026년 10월 20일' },
    liveIn: true,
    budget: '$2,000 – $2,500 / wk',
    newbornExp: false,
    nonSmoker: true,
    breastfeeding: true,
    notes: {
      en: 'Twins expected! Looking for someone patient and energetic. Live-in required.',
      ko: '쌍둥이 출산 예정입니다! 인내심 있고 활동적인 분을 찾습니다. 입주 필수입니다.',
    },
  },
];
