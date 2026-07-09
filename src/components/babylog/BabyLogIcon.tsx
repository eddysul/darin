import type { FrequentShortcutId } from "../../constants/frequentShortcuts";
import { getCategory, type BabyLogCategoryId } from "../../constants/babyLogCategories";
import {
  CATEGORY_ICONS,
  FREQUENT_ICONS,
  MISC_ICONS,
  QUICK_STATUS_ICONS,
  TAB_ICONS,
  type FrequentIconKey,
  type MiscIconKey,
  type QuickStatusIconKey,
  type TabIconKey,
} from "./iconMaps";

export type { FrequentIconKey, MiscIconKey, QuickStatusIconKey, TabIconKey } from "./iconMaps";
export { CATEGORY_ICONS } from "./iconMaps";

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

  let Icon = MISC_ICONS.new;
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
