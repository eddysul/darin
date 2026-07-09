import type { ComponentType } from "react";
import {
  Apple,
  Activity,
  ArrowLeftRight,
  Baby,
  Bath,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  FolderOpen,
  MessageCircle,
  Mic,
  Moon,
  Pencil,
  Pill,
  Plus,
  Sparkles,
  Stethoscope,
  Thermometer,
  Trash2,
  User,
  Users,
  Utensils,
  type LucideProps,
} from "lucide-react-native";
import type { FrequentShortcutId } from "../../constants/frequentShortcuts";
import { BabyBottleIcon } from "./icons/BabyBottleIcon";
import { BreastfeedingIcon } from "./icons/BreastfeedingIcon";
import { BreastPumpIcon } from "./icons/BreastPumpIcon";
import { DiaperIcon } from "./icons/DiaperIcon";
import { RattleIcon } from "./icons/RattleIcon";
import { TummyTimeIcon } from "./icons/TummyTimeIcon";
import { getCategory, type BabyLogCategoryId } from "../../constants/babyLogCategories";

type IconComponent = ComponentType<LucideProps>;

export const CATEGORY_ICONS: Record<BabyLogCategoryId, IconComponent> = {
  breast: BreastfeedingIcon,
  formula: BabyBottleIcon,
  food: Utensils,
  diaper: DiaperIcon,
  sleep: Moon,
  pump: BreastPumpIcon,
  bath: Bath,
  doctor: Stethoscope,
  temp: Thermometer,
  med: Pill,
  snack: Apple,
  tummy: TummyTimeIcon,
  play: RattleIcon,
  memo: FileText,
};

export type QuickStatusIconKey = "feed" | "sleep" | "diaper";
export type FrequentIconKey = "feeding" | "sleep" | "diaper" | "temp";
export type TabIconKey = "record" | "diary" | "report" | "consult" | "mic";
export type MiscIconKey =
  | "new"
  | "baby"
  | "profile"
  | "family"
  | "edit"
  | "chevron"
  | "check"
  | "folder"
  | "clock"
  | "interval"
  | "bell"
  | "sparkles"
  | "voice"
  | "trash";

const QUICK_STATUS_ICONS: Record<QuickStatusIconKey, IconComponent> = {
  feed: BabyBottleIcon,
  sleep: Moon,
  diaper: DiaperIcon,
};

const FREQUENT_ICONS: Record<FrequentIconKey, IconComponent> = {
  feeding: BabyBottleIcon,
  sleep: Moon,
  diaper: DiaperIcon,
  temp: Thermometer,
};

const TAB_ICONS: Record<TabIconKey, IconComponent> = {
  record: ClipboardList,
  diary: BookOpen,
  report: Activity,
  consult: MessageCircle,
  mic: Mic,
};

const MISC_ICONS: Record<MiscIconKey, IconComponent> = {
  new: Plus,
  baby: Baby,
  profile: User,
  family: Users,
  edit: Pencil,
  chevron: ChevronRight,
  check: Check,
  folder: FolderOpen,
  clock: Clock,
  interval: ArrowLeftRight,
  bell: Bell,
  sparkles: Sparkles,
  voice: Mic,
  trash: Trash2,
};

type BaseProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

type BabyLogIconProps = BaseProps &
  (
    | { catId: BabyLogCategoryId }
    | { kind: "quick"; icon: QuickStatusIconKey }
    | { kind: "frequent"; icon: FrequentIconKey }
    | { kind: "tab"; tab: TabIconKey }
    | { kind: MiscIconKey }
  );

export function BabyLogIcon(props: BabyLogIconProps) {
  const { size = 20, color, strokeWidth = 1.8 } = props;

  let Icon: IconComponent;
  let resolvedColor = color ?? "#7A746C";

  if ("catId" in props) {
    Icon = CATEGORY_ICONS[props.catId];
    if (!color) resolvedColor = getCategory(props.catId).color;
  } else if (props.kind === "quick") {
    Icon = QUICK_STATUS_ICONS[props.icon];
  } else if (props.kind === "frequent") {
    Icon = FREQUENT_ICONS[props.icon];
  } else if (props.kind === "tab") {
    Icon = TAB_ICONS[props.tab];
  } else {
    Icon = MISC_ICONS[props.kind];
  }

  return <Icon size={size} color={resolvedColor} strokeWidth={strokeWidth} />;
}

export function ShortcutIcon({
  id,
  size = 20,
  color,
  strokeWidth = 1.8,
}: {
  id: FrequentShortcutId;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  if (id === "feeding") {
    return <BabyLogIcon kind="frequent" icon="feeding" size={size} color={color} strokeWidth={strokeWidth} />;
  }
  return <BabyLogIcon catId={id} size={size} color={color} strokeWidth={strokeWidth} />;
}
