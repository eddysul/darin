/**
 * Stable legacy/storage values used by existing care logs.
 * These values are deliberately not localized; only their UI labels are translated.
 */
export const RECORD_VALUE = {
  diaperLegacyBoth: "둘다",
  diaperLegacyBothSpaced: "둘 다",
  diaperUrine: "소변",
  diaperStool: "대변",
  diaperBoth: "소변+대변",
  nap: "낮잠",
  nightSleep: "밤잠",
  medicineSupplement: "영양제",
  medicineOintment: "연고",
  medicineEyeDrop: "안약",
  medicationGiven: "복용 완료",
  medicationPartial: "일부 복용",
  medicationSkipped: "건너뜀",
  medicationRefused: "복용 안 함",
  done: "완료",
  notDone: "미완료",
  countOrAmount: "회/량",
  spitUpYes: "있었어요",
  spitUpNo: "없었어요",
  burpedYes: "했어요",
  burpedNo: "안 했어요",
} as const;

export const STARTER_FOOD_INGREDIENTS = ["쌀미음", "소고기", "애호박", "바나나", "고구마", "사과"] as const;
export const LEGACY_MEDICATION_DOSE_UNITS = ["방울", "포", "정", "회", "스푼"] as const;

export const RECORD_STORED_OPTIONS = {
  sleep: [RECORD_VALUE.nap, RECORD_VALUE.nightSleep],
  diaperType: [RECORD_VALUE.diaperUrine, RECORD_VALUE.diaperStool, RECORD_VALUE.diaperBoth],
  amount: ["적음", "보통", "많음"],
  stool: ["보통", "묽음", "딱딱함", "설사", "기타"],
  feedingNote: ["졸려했어요", "잘 먹었어요", "조금 먹었어요", "보챘어요", "기타"],
  foodReaction: ["잘 먹음", "보통", "거부"],
  temperatureSite: ["겨드랑이", "귀", "이마", "구강"],
  vaccinationAftercare: ["미열", "붓기", "보챔", "평소와 같음", "잘 먹음", "잠이 많음"],
  completion: [RECORD_VALUE.done, RECORD_VALUE.notDone],
} as const;

export const DEFAULT_QUICK_RECORD_VALUES = {
  formulaLabel: "분유 120ml",
  sleepLabel: "낮잠 시작",
  diaperLabel: "기저귀 소변",
  pregnancyMoodLabel: "컨디션 좋음",
  pregnancyMoodChip: "좋음",
  pregnancySymptomLabel: "입덧",
  pregnancyMedicationLabel: "영양제",
  pregnancyKickLabel: "태동 느꼈어요",
  pregnancyKickChip: "느꼈어요",
} as const;
