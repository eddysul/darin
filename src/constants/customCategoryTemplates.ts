import { categoryColors } from "../theme";

export type CustomCategoryTemplateId =
  | "symptom"
  | "growth"
  | "mood"
  | "vaccine"
  | "spit"
  | "outing";

export type CustomCategoryTemplate = {
  templateId: CustomCategoryTemplateId;
  label: string;
  color: string;
  chips?: string[];
  duration?: boolean;
  amount?: string;
};

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

export function getCustomCategoryTemplate(
  templateId: CustomCategoryTemplateId,
): CustomCategoryTemplate {
  const t = RECOMMENDED_CUSTOM_TEMPLATES.find((x) => x.templateId === templateId);
  if (!t) throw new Error(`Unknown template: ${templateId}`);
  return t;
}
