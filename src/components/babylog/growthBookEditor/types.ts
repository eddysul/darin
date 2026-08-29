import type { Animated } from "react-native";
import type { GrowthBookEdit } from "../../../types/growthBook";
import type { GrowthBookPageMeta } from "../../../utils/growthBookPages";

export type BookPageNavigationProps = {
  pages: GrowthBookPageMeta[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  pageTurnProgress: Animated.Value;
  pageTurnDirection: -1 | 1;
};

export type GrowthBookEditorPatch = (updater: (prev: GrowthBookEdit) => GrowthBookEdit) => void;
