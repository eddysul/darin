import type { Locale } from "../i18n";
import type { ParentProfileData } from "../types/parentProfile";

const EN: ParentProfileData = {
  header: {
    name: "Jisoo Kim",
    relationship: "Emma's mom",
    location: "Seattle, Capitol Hill",
    languages: "Korean / English",
    preferredContact: "In-app chat",
  },
  careNeeds: {
    lookingFor: "Part-time bilingual nanny",
    child: "Emma, 8 months",
    schedule: "Mon–Fri, 3 PM–8 PM",
    startDate: "Next Monday",
    budget: "$18–25/hr",
    careFocus: ["Feeding", "Nap routine", "Light play", "Bilingual daily report"],
  },
  childSnapshot: {
    name: "Emma Kim",
    age: "8 months",
    allergies: ["Peanut allergy"],
    conditions: ["Mild eczema"],
    routine: ["Bottle feeding", "Nap", "Tummy time"],
  },
  communication: {
    reportLanguage: "Korean + English",
    reportFrequency: "End of day",
    updateStyle: "Warm and detailed",
    importantUpdates: ["Meals", "Sleep", "Bowel movement", "Medication", "Mood", "Photos"],
  },
  careStyle: [
    "Routine-based care",
    "Gentle interaction",
    "No screen time preferred",
    "Short stroller walks are okay",
    "Comfort method: holding, soft singing, familiar blanket",
  ],
  household: {
    neighborhood: "Capitol Hill",
    careLocation: "Family home",
    pets: "No pets",
    householdLanguage: "Korean / English",
  },
  verification: {
    phone: true,
    email: true,
    payment: true,
    profileComplete: true,
  },
};

const KO: ParentProfileData = {
  header: {
    name: "김지수",
    relationship: "엠마 엄마",
    location: "시애틀, 캐피털 힐",
    languages: "한국어 / English",
    preferredContact: "앱 내 채팅",
  },
  careNeeds: {
    lookingFor: "파트타임 이중언어 네니",
    child: "엠마, 8개월",
    schedule: "월–금, 오후 3–8시",
    startDate: "다음 주 월요일",
    budget: "$18–25/시간",
    careFocus: ["수유", "낮잠 루틴", "가벼운 놀이", "이중언어 일일 리포트"],
  },
  childSnapshot: {
    name: "엠마 김",
    age: "8개월",
    allergies: ["땅콩 알레르기"],
    conditions: ["경미한 아토피"],
    routine: ["분유 수유", "낮잠", "터미타임"],
  },
  communication: {
    reportLanguage: "한국어 + English",
    reportFrequency: "하루 종료 시",
    updateStyle: "따뜻하고 상세하게",
    importantUpdates: ["식사", "수면", "배변", "약", "기분", "사진"],
  },
  careStyle: [
    "루틴 기반 돌봄",
    "부드러운 상호작용",
    "스크린 타임 지양",
    "짧은 유모차 산책 가능",
    "안정 방법: 안아주기, 부드러운 노래, 익숙한 담요",
  ],
  household: {
    neighborhood: "캐피털 힐",
    careLocation: "가정 방문",
    pets: "반려동물 없음",
    householdLanguage: "한국어 / English",
  },
  verification: {
    phone: true,
    email: true,
    payment: true,
    profileComplete: true,
  },
};

export function getParentProfile(locale: Locale): ParentProfileData {
  return locale === "ko" ? KO : EN;
}

/** Safe summary shown to caregivers before match is confirmed */
export function getParentProfileSafeSummary(locale: Locale) {
  const p = getParentProfile(locale);
  return {
    parentName: p.header.name,
    location: p.header.location,
    lookingFor: p.careNeeds.lookingFor,
    child: p.careNeeds.child,
    schedule: p.careNeeds.schedule,
    budget: p.careNeeds.budget,
    languages: p.header.languages,
    neighborhood: p.household.neighborhood,
  };
}
