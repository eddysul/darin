import type { BabyLogCategoryId } from "../constants/babyLogCategories";

/** Defaults applied when tapping a frequent/custom quick record. */
export type QuickRecordDefaults = {
  cat: BabyLogCategoryId;
  chip?: string;
  chip2?: string;
  stoolState?: string;
  amount?: string;
  duration?: string;
  notes?: string;
  /** Sleep-only: start creates open sleep; end closes active sleep. */
  sleepAction?: "start" | "end";
};

export type QuickRecord = {
  id: string;
  label: string;
  color: string;
  /** Display glyph (emoji or short mark) */
  icon: string;
  defaults: QuickRecordDefaults;
  /** Show in the frequent bar on Record screen */
  pinned: boolean;
  /** User-created vs seed preset */
  isCustom: boolean;
};
