import type { ComponentType } from "react";
import { Baby, Car, FileText, Syringe, TrendingUp, type LucideProps } from "lucide-react-native";
import type { CustomCategoryTemplateId } from "../../constants/customCategoryTemplates";
import { SpitIcon, SymptomIcon } from "./icons/TemplateIcons";

const TEMPLATE_ICONS: Record<CustomCategoryTemplateId, ComponentType<LucideProps>> = {
  symptom: SymptomIcon,
  growth: TrendingUp,
  mood: Baby,
  vaccine: Syringe,
  spit: SpitIcon,
  outing: Car,
};

type Props = LucideProps & {
  templateId?: CustomCategoryTemplateId;
};

export function CustomTemplateIcon({ templateId, size = 20, color = "currentColor", strokeWidth = 1.8 }: Props) {
  const Icon = templateId ? TEMPLATE_ICONS[templateId] : FileText;
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}
