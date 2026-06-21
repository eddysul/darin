export type ReportMainCategory = "bowel" | "sleep" | "meal" | "growth" | "clinic";

export type ReportDetailCategory =
  | "bowel"
  | "meal"
  | "sleep"
  | "growth"
  | "bath"
  | "clinic"
  | "environment"
  | "supplement"
  | "tummy_time"
  | "snack"
  | "medication";

export type ReportDetailRow = {
  type: ReportDetailCategory;
  value: string;
  recorded: boolean;
};

/** @deprecated Legacy API item types — kept for backward compatibility */
export type DailyReportItemType = "meal" | "nap" | "activity" | "health" | "reminder";

export type DailyReportItem = {
  type: DailyReportItemType;
  label: string;
  value: string;
};

export type DailyReport = {
  id: string;
  date: string;
  child: string;
  caregiver: string;
  sourceNote: string;
  careSummaryEn?: string;
  careSummaryKo?: string;
  reportEn: string;
  reportKo: string;
  parentReplyDraft: string;
  mainCategories?: ReportMainCategory[];
  details?: ReportDetailRow[];
  items: DailyReportItem[];
  savedAt: string;
};

export const REPORT_MAIN_CATEGORIES: ReportMainCategory[] = [
  "bowel",
  "sleep",
  "meal",
  "growth",
  "clinic",
];

export const REPORT_DETAIL_CATEGORIES: ReportDetailCategory[] = [
  "bowel",
  "meal",
  "sleep",
  "growth",
  "bath",
  "clinic",
  "environment",
  "supplement",
  "tummy_time",
  "snack",
  "medication",
];
