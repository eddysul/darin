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
  "좌측": "record.timeline.left", "우측": "record.timeline.right", "왼쪽": "record.timeline.left", "오른쪽": "record.timeline.right",
  "양쪽": "chrome.critical.008", "검진": "record.timeline.checkup", "질환": "record.timeline.illness",
  "열": "chrome.critical.082", "기침": "chrome.critical.083", "콧물": "chrome.critical.084", "발진": "chrome.critical.085",
  "키": "chrome.critical.086", "몸무게": "home.metric.weight", "머리둘레": "chrome.critical.087",
  "울음": "record.custom.icon.cry", "1차": "home.vaccine.first", "2차": "home.vaccine.second",
  "3차": "home.vaccine.third", "추가": "home.vaccine.booster",
  "트림": "chrome.critical.088", "역류": "chrome.critical.089", "토함": "chrome.critical.090",
  "산책": "record.custom.icon.walk", "병원": "record.custom.icon.hospital", "친척": "chrome.critical.091",
  "회/량": "record.screen.countAmount",
  "쌀미음": "chrome.critical.092", "소고기": "chrome.critical.093", "애호박": "chrome.critical.094",
  "바나나": "chrome.critical.095", "고구마": "chrome.critical.096", "사과": "chrome.critical.097",
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

const STORED_CUSTOM_LABEL_KEYS: Record<string, MessageKey> = {
  "메모": "record.custom.icon.memo", "놀이": "record.custom.icon.play", "책": "record.custom.icon.book",
  "산책": "record.custom.icon.walk", "외출": "record.custom.icon.outing", "목욕": "record.custom.icon.bath",
  "마사지": "record.custom.icon.massage", "병원": "record.custom.icon.hospital", "약": "record.custom.icon.med",
  "체온": "record.custom.icon.temp", "성장": "record.custom.icon.growth", "수면": "record.custom.icon.sleep",
  "수유": "record.custom.icon.feeding", "기저귀": "record.custom.icon.diaper", "기분": "record.custom.icon.mood",
  "기분/울음": "chrome.critical.081", "울음": "record.custom.icon.cry", "트림/토함": "record.custom.icon.spit",
  "예방접종": "record.custom.icon.vaccine", "사진": "record.custom.icon.photo", "전화": "record.custom.icon.phone",
  "기타": "record.custom.icon.other", "증상": "record.custom.icon.symptom", "사용자 카테고리": "chrome.critical.007",
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

/** Remap seeded Korean custom-category names at display. User-renamed labels stay as stored. */
export function customCategoryDisplayLabel(
  t: Translate,
  category: { label: string },
): string {
  const key = STORED_CUSTOM_LABEL_KEYS[category.label];
  return key ? t(key) : category.label;
}
