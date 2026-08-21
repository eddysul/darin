import type { MessageKey } from "../i18n";
import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import type { QuickRecord } from "../types/quickRecord";

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

const CATEGORY_KEYS: Record<BabyLogCategoryId, MessageKey> = {
  breast: "record.category.breast", formula: "record.category.formula", storedMilk: "record.category.storedMilk",
  food: "record.category.food", water: "record.category.water", milk: "record.category.milk", diaper: "record.category.diaper",
  sleep: "record.category.sleep", pump: "record.category.pump", bath: "record.category.bath", doctor: "record.category.doctor",
  vaccination: "record.category.vaccination", temp: "record.category.temp", med: "record.category.med", snack: "record.category.snack",
  tummy: "record.category.tummy", play: "record.category.play", memo: "record.category.memo", other: "record.category.other",
  pregMood: "record.category.pregMood", pregSymptom: "record.category.pregSymptom", pregWeight: "record.category.pregWeight",
  pregBp: "record.category.pregBp", pregMed: "record.category.pregMed", pregKick: "record.category.pregKick",
  pregHospital: "record.category.pregHospital",
};

const DEFAULT_QUICK_KEYS: Record<string, MessageKey> = {
  "qr-formula-120": "record.defaultQuick.formula120", "qr-sleep-start": "record.defaultQuick.sleepStart",
  "qr-diaper-pee": "record.defaultQuick.diaperPee", "qr-preg-mood-ok": "record.defaultQuick.pregMoodGood",
  "qr-preg-symptom-nausea": "record.defaultQuick.nausea", "qr-preg-med-vitamin": "record.defaultQuick.supplement",
  "qr-preg-kick": "record.defaultQuick.fetalMovement",
};

const STORED_VALUE_KEYS: Record<string, MessageKey> = {
  "소변": "record.detail.option.urine", "대변": "record.detail.option.stool", "소변+대변": "record.detail.option.both",
  "둘다": "record.detail.option.both", "둘 다": "record.detail.option.both", "낮잠": "record.detail.option.nap",
  "밤잠": "record.detail.option.nightSleep", "적음": "record.detail.option.small", "보통": "record.detail.option.normal",
  "많음": "record.detail.option.large", "묽음": "record.detail.option.loose", "딱딱함": "record.detail.option.hard",
  "설사": "record.detail.option.diarrhea", "잘 먹음": "record.detail.option.ateWell", "거부": "record.detail.option.refusedFood",
  "졸려했어요": "record.detail.option.sleepy", "잘 먹었어요": "record.detail.option.ateWell",
  "조금 먹었어요": "record.detail.option.ateLittle", "보챘어요": "record.detail.option.fussy",
  "겨드랑이": "record.detail.option.armpit", "귀": "record.detail.option.ear", "이마": "record.detail.option.forehead",
  "구강": "record.detail.option.oral", "미열": "record.detail.option.lowFever", "붓기": "record.detail.option.swelling",
  "보챔": "record.detail.option.fussiness", "평소와 같음": "record.detail.option.usual", "잠이 많음": "record.detail.option.sleepyMore",
  "완료": "record.detail.option.done", "미완료": "record.detail.option.notDone", "좋음": "record.option.good",
  "힘듦": "record.option.difficult", "입덧": "record.option.nausea", "두통": "record.option.headache", "부종": "record.option.edema",
  "피로": "record.option.fatigue", "느꼈어요": "record.option.felt", "활발": "record.option.active",
  "진료": "record.option.treatment", "초음파": "record.option.ultrasound", "영양제": "record.detail.supplement",
  "약": "record.detail.medicine", "기타": "record.detail.other",
};

const CUSTOM_SUGGESTION_KEYS: Record<string, MessageKey> = {
  book: "record.custom.suggestion.book", walk: "record.custom.suggestion.walk", play: "record.custom.suggestion.play",
  sleep: "record.custom.suggestion.sleep", symptom: "record.custom.suggestion.symptom", massage: "record.custom.suggestion.massage",
  phone: "record.custom.suggestion.phone", photo: "record.custom.suggestion.photo",
};

const CUSTOM_ICON_KEYS: Record<string, MessageKey> = {
  memo: "record.custom.icon.memo", play: "record.custom.icon.play", book: "record.custom.icon.book", walk: "record.custom.icon.walk",
  outing: "record.custom.icon.outing", bath: "record.custom.icon.bath", massage: "record.custom.icon.massage",
  hospital: "record.custom.icon.hospital", med: "record.custom.icon.med", temp: "record.custom.icon.temp",
  growth: "record.custom.icon.growth", sleep: "record.custom.icon.sleep", feeding: "record.custom.icon.feeding",
  diaper: "record.custom.icon.diaper", mood: "record.custom.icon.mood", cry: "record.custom.icon.cry", spit: "record.custom.icon.spit",
  vaccine: "record.custom.icon.vaccine", photo: "record.custom.icon.photo", phone: "record.custom.icon.phone",
  other: "record.custom.icon.other", symptom: "record.custom.icon.symptom",
};

const CUSTOM_MODE_LABEL_KEYS: Record<string, MessageKey> = {
  memo: "record.custom.mode.memo.label", duration: "record.custom.mode.duration.label",
  amount: "record.custom.mode.amount.label", check: "record.custom.mode.check.label",
};

const CUSTOM_MODE_HINT_KEYS: Record<string, MessageKey> = {
  memo: "record.custom.mode.memo.hint", duration: "record.custom.mode.duration.hint",
  amount: "record.custom.mode.amount.hint", check: "record.custom.mode.check.hint",
};

export function recordCategoryLabel(t: Translate, id: BabyLogCategoryId): string {
  return t(CATEGORY_KEYS[id]);
}

export function quickRecordLabel(t: Translate, record: QuickRecord): string {
  const key = !record.isCustom ? DEFAULT_QUICK_KEYS[record.id] : undefined;
  return key ? t(key) : record.label;
}

export function storedRecordValueLabel(t: Translate, value: string): string {
  const key = STORED_VALUE_KEYS[value];
  return key ? t(key) : value;
}

export function customSuggestionLabel(t: Translate, iconKey: string, fallback: string): string {
  const key = CUSTOM_SUGGESTION_KEYS[iconKey];
  return key ? t(key) : fallback;
}

export function customIconLabel(t: Translate, iconKey: string, fallback: string): string {
  const key = CUSTOM_ICON_KEYS[iconKey];
  return key ? t(key) : fallback;
}

export function customModeLabel(t: Translate, mode: string, fallback: string): string {
  const key = CUSTOM_MODE_LABEL_KEYS[mode];
  return key ? t(key) : fallback;
}

export function customModeHint(t: Translate, mode: string, fallback: string): string {
  const key = CUSTOM_MODE_HINT_KEYS[mode];
  return key ? t(key) : fallback;
}
