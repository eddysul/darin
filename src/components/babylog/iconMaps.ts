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
import type { BabyLogCategoryId } from "../../constants/babyLogCategories";
import { BabyBottleIcon } from "./icons/BabyBottleIcon";
import { BreastfeedingIcon } from "./icons/BreastfeedingIcon";
import { BreastPumpIcon } from "./icons/BreastPumpIcon";
import { DiaperIcon } from "./icons/DiaperIcon";
import { RattleIcon } from "./icons/RattleIcon";
import { TummyTimeIcon } from "./icons/TummyTimeIcon";

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

export const QUICK_STATUS_ICONS: Record<QuickStatusIconKey, IconComponent> = {
  feed: BabyBottleIcon,
  sleep: Moon,
  diaper: DiaperIcon,
};

export const FREQUENT_ICONS: Record<FrequentIconKey, IconComponent> = {
  feeding: BabyBottleIcon,
  sleep: Moon,
  diaper: DiaperIcon,
  temp: Thermometer,
};

export const TAB_ICONS: Record<TabIconKey, IconComponent> = {
  record: ClipboardList,
  diary: BookOpen,
  report: Activity,
  consult: MessageCircle,
  mic: Mic,
};

export const MISC_ICONS: Record<MiscIconKey, IconComponent> = {
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
