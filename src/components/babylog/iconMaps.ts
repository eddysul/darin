import type { ComponentType } from "react";
import {
  Apple,
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Baby,
  Bath,
  Bell,
  Bookmark,
  Bot,
  BookOpen,
  Cake,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  MessageCircle,
  FileText,
  FolderOpen,
  Handshake,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  GlassWater,
  Lock,
  LogOut,
  Menu,
  Mic,
  Milk,
  Moon,
  Pencil,
  Pill,
  Plus,
  Send,
  Settings,
  Sparkles,
  Star,
  Stethoscope,
  Thermometer,
  Syringe,
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
  vaccination: Syringe,
  temp: Thermometer,
  med: Pill,
  snack: Apple,
  tummy: TummyTimeIcon,
  play: RattleIcon,
  memo: FileText,
  other: Star,
  pregMood: Heart,
  pregSymptom: AlertTriangle,
  pregWeight: Activity,
  pregBp: Activity,
  pregMed: Pill,
  pregKick: Baby,
  pregHospital: Stethoscope,
};

export type TabIconKey = "record" | "diary" | "report" | "consult" | "mic" | "menu" | "memories";
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
  | "calendar"
  | "interval"
  | "bell"
  | "sparkles"
  | "heart"
  | "voice"
  | "trash"
  | "bot"
  | "logout"
  | "chat"
  | "settings"
  | "image"
  | "layout"
  | "bookmark"
  | "send"
  | "alert"
  | "cake"
  | "lock"
  | "handshake";

export const TAB_ICONS: Record<TabIconKey, IconComponent> = {
  record: ClipboardList,
  diary: BookOpen,
  report: Activity,
  consult: MessageCircle,
  mic: Mic,
  menu: Menu,
  memories: FolderOpen,
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
  calendar: CalendarDays,
  interval: ArrowLeftRight,
  bell: Bell,
  sparkles: Sparkles,
  heart: Heart,
  voice: Mic,
  trash: Trash2,
  bot: Bot,
  logout: LogOut,
  chat: MessageCircle,
  settings: Settings,
  image: ImageIcon,
  layout: LayoutGrid,
  bookmark: Bookmark,
  send: Send,
  alert: AlertTriangle,
  cake: Cake,
  lock: Lock,
  handshake: Handshake,
};
