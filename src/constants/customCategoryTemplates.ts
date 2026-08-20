import { categoryColors } from "../theme";

/** Icon keys available for custom log categories (picker + persistence). */
export type CustomCategoryIconKey =
  | "memo"
  | "play"
  | "book"
  | "walk"
  | "outing"
  | "bath"
  | "massage"
  | "hospital"
  | "med"
  | "temp"
  | "growth"
  | "sleep"
  | "feeding"
  | "diaper"
  | "mood"
  | "cry"
  | "spit"
  | "vaccine"
  | "photo"
  | "phone"
  | "other"
  | "symptom";

/** @deprecated Prefer CustomCategoryIconKey — kept for existing imports. */
export type CustomCategoryTemplateId = CustomCategoryIconKey;

export type CustomCategoryIconOption = {
  iconKey: CustomCategoryIconKey;
  label: string;
  /** Soft default accent; user color still overrides on save. */
  color: string;
};

/** Legacy shape used by addCustomFromTemplate. */
export type CustomCategoryTemplate = {
  templateId: CustomCategoryTemplateId;
  label: string;
  color: string;
  chips?: string[];
  duration?: boolean;
  amount?: string;
};

/** Pregnancy add-sheet suggestions: tap to fill name, icon, and input mode. */
export const PREGNANCY_CATEGORY_SUGGESTIONS: Array<{
  label: string;
  iconKey: CustomCategoryIconKey;
  inputMode: "memo" | "duration" | "amount" | "check";
}> = [
  { label: "태교", iconKey: "book", inputMode: "duration" },
  { label: "산책", iconKey: "walk", inputMode: "duration" },
  { label: "운동", iconKey: "play", inputMode: "duration" },
  { label: "수면", iconKey: "sleep", inputMode: "duration" },
  { label: "자궁수축", iconKey: "symptom", inputMode: "check" },
  { label: "마사지", iconKey: "massage", inputMode: "duration" },
  { label: "병원 전화", iconKey: "phone", inputMode: "memo" },
  { label: "초음파", iconKey: "photo", inputMode: "memo" },
];

const PREGNANCY_ICON_KEYS = new Set<CustomCategoryIconKey>([
  "book",
  "walk",
  "outing",
  "play",
  "sleep",
  "massage",
  "hospital",
  "med",
  "temp",
  "growth",
  "mood",
  "symptom",
  "photo",
  "phone",
  "memo",
  "other",
]);

export const CUSTOM_CATEGORY_ICON_OPTIONS: CustomCategoryIconOption[] = [
  { iconKey: "play", label: "놀이", color: categoryColors.play },
  { iconKey: "book", label: "책", color: "#7c83fd" },
  { iconKey: "walk", label: "산책", color: "#69AFA0" },
  { iconKey: "outing", label: "외출", color: categoryColors.bath },
  { iconKey: "bath", label: "목욕", color: categoryColors.bath },
  { iconKey: "massage", label: "마사지", color: "#e8607a" },
  { iconKey: "hospital", label: "병원", color: categoryColors.doctor },
  { iconKey: "med", label: "약", color: categoryColors.med },
  { iconKey: "temp", label: "체온", color: categoryColors.temp },
  { iconKey: "growth", label: "성장", color: "#5b8dee" },
  { iconKey: "sleep", label: "수면", color: categoryColors.sleep },
  { iconKey: "feeding", label: "수유", color: categoryColors.formula },
  { iconKey: "diaper", label: "기저귀", color: categoryColors.diaper },
  { iconKey: "mood", label: "기분", color: categoryColors.play },
  { iconKey: "cry", label: "울음", color: "#e8607a" },
  { iconKey: "spit", label: "트림/토함", color: categoryColors.formula },
  { iconKey: "vaccine", label: "예방접종", color: categoryColors.doctor },
  { iconKey: "photo", label: "사진", color: "#7c83fd" },
  { iconKey: "phone", label: "전화", color: "#4ec9b0" },
  { iconKey: "other", label: "기타", color: categoryColors.other },
  { iconKey: "symptom", label: "증상", color: categoryColors.temp },
];

const ICON_BY_KEY = new Map(CUSTOM_CATEGORY_ICON_OPTIONS.map((item) => [item.iconKey, item]));

/** Legacy recommended templates (chips/duration helpers). Still valid icon keys. */
export const RECOMMENDED_CUSTOM_TEMPLATES: CustomCategoryTemplate[] = [
  {
    templateId: "symptom",
    label: "증상",
    color: categoryColors.temp,
    chips: ["열", "기침", "콧물", "발진", "기타"],
  },
  {
    templateId: "growth",
    label: "성장",
    color: "#5b8dee",
    chips: ["키", "몸무게", "머리둘레"],
    amount: "cm/kg",
  },
  {
    templateId: "mood",
    label: "기분/울음",
    color: categoryColors.play,
    chips: ["좋음", "보통", "울음", "보챔"],
    duration: true,
  },
  {
    templateId: "vaccine",
    label: "예방접종",
    color: categoryColors.doctor,
    chips: ["1차", "2차", "3차", "추가"],
  },
  {
    templateId: "spit",
    label: "트림/토함",
    color: categoryColors.formula,
    chips: ["트림", "역류", "토함"],
  },
  {
    templateId: "outing",
    label: "외출",
    color: categoryColors.bath,
    chips: ["산책", "병원", "친척", "기타"],
    duration: true,
  },
];

export function customCategoryIconOptionsForStage(pregnancy: boolean): CustomCategoryIconOption[] {
  if (!pregnancy) return CUSTOM_CATEGORY_ICON_OPTIONS;
  const preferred = CUSTOM_CATEGORY_ICON_OPTIONS.filter((option) => PREGNANCY_ICON_KEYS.has(option.iconKey));
  return preferred.length ? preferred : CUSTOM_CATEGORY_ICON_OPTIONS;
}

export function isCustomCategoryIconKey(value: string): value is CustomCategoryIconKey {
  return ICON_BY_KEY.has(value as CustomCategoryIconKey);
}

export function getCustomCategoryIconOption(
  iconKey: CustomCategoryIconKey,
): CustomCategoryIconOption | undefined {
  return ICON_BY_KEY.get(iconKey);
}

export function getCustomCategoryTemplate(
  templateId: CustomCategoryTemplateId,
): CustomCategoryTemplate {
  const t = RECOMMENDED_CUSTOM_TEMPLATES.find((x) => x.templateId === templateId);
  if (t) return t;
  const icon = getCustomCategoryIconOption(templateId);
  if (icon) {
    return { templateId: icon.iconKey, label: icon.label, color: icon.color };
  }
  throw new Error(`Unknown template: ${templateId}`);
}
