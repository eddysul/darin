import type { ComponentType } from "react";
import {
  BookOpen,
  Camera,
  Car,
  FileText,
  Footprints,
  Frown,
  Hand,
  Phone,
  Smile,
  Star,
  Syringe,
  TrendingUp,
  type LucideProps,
} from "lucide-react-native";
import type { CustomCategoryIconKey } from "../../constants/customCategoryTemplates";
import { CATEGORY_ICONS } from "./iconMaps";
import { SpitIcon, SymptomIcon } from "./icons/TemplateIcons";

const TEMPLATE_ICONS: Record<CustomCategoryIconKey, ComponentType<LucideProps>> = {
  memo: FileText,
  play: CATEGORY_ICONS.play,
  book: BookOpen,
  walk: Footprints,
  outing: Car,
  bath: CATEGORY_ICONS.bath,
  massage: Hand,
  hospital: CATEGORY_ICONS.doctor,
  med: CATEGORY_ICONS.med,
  temp: CATEGORY_ICONS.temp,
  growth: TrendingUp,
  sleep: CATEGORY_ICONS.sleep,
  feeding: CATEGORY_ICONS.formula,
  diaper: CATEGORY_ICONS.diaper,
  mood: Smile,
  cry: Frown,
  spit: SpitIcon,
  vaccine: Syringe,
  photo: Camera,
  phone: Phone,
  other: Star,
  symptom: SymptomIcon,
};

type Props = LucideProps & {
  /** Preferred prop for custom category icons. */
  iconKey?: CustomCategoryIconKey;
  /** Legacy alias for iconKey. */
  templateId?: CustomCategoryIconKey;
};

export function CustomTemplateIcon({
  iconKey,
  templateId,
  size = 20,
  color = "currentColor",
  strokeWidth = 1.8,
}: Props) {
  const key = iconKey ?? templateId;
  const Icon = key ? TEMPLATE_ICONS[key] ?? FileText : FileText;
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}
