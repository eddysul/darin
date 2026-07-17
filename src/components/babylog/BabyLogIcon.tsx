import { getCategory, type BabyLogCategoryId } from "../../constants/babyLogCategories";
import {
  CATEGORY_ICONS,
  MISC_ICONS,
  TAB_ICONS,
  type MiscIconKey,
  type TabIconKey,
} from "./iconMaps";

export type { MiscIconKey, TabIconKey } from "./iconMaps";
export { CATEGORY_ICONS } from "./iconMaps";

type BaseProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

type BabyLogIconProps = BaseProps &
  (
    | { catId: BabyLogCategoryId }
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
  } else if (props.kind === "tab") {
    Icon = TAB_ICONS[props.tab];
  } else {
    Icon = MISC_ICONS[props.kind];
  }

  return <Icon size={size} color={resolvedColor} strokeWidth={strokeWidth} />;
}
