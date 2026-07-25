import type { ComponentType } from "react";
import {
  Apple,
  Activity,
  ArrowLeftRight,
  Baby,
  Bath,
  Bell,
  Bot,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  FolderOpen,
  GlassWater,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  Milk,
  Moon,
  Pencil,
  Pill,
  Plus,
  Sparkles,
  Star,
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
import { StoredMilkIcon } from "./icons/StoredMilkIcon";

type IconComponent = ComponentType<LucideProps>;

export const CATEGORY_ICONS: Record<BabyLogCategoryId, IconComponent> = {
  breast: BreastfeedingIcon,
  formula: BabyBottleIcon,
  storedMilk: StoredMilkIcon,
  food: Utensils,
  water: GlassWater,
  milk: Milk,
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
  other: Star,
};

export type TabIconKey = "record" | "diary" | "report" | "consult" | "mic" | "menu";
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
  | "trash"
  | "bot"
  | "logout";

export const TAB_ICONS: Record<TabIconKey, IconComponent> = {
  record: ClipboardList,
  diary: BookOpen,
  report: Activity,
  consult: MessageCircle,
  mic: Mic,
  menu: Menu,
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
  bot: Bot,
  logout: LogOut,
};
