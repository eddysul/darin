/** Top-level summary pills shown on each report card */
export type ReportMainCategory = "bowel" | "sleep" | "meal" | "growth" | "clinic";

/** Expandable care detail rows */
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
  /** Whether meaningful care data was recorded for this category */
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
  /** Short scan-friendly summary (1–2 sentences) */
  careSummaryEn?: string;
  careSummaryKo?: string;
  reportEn: string;
  reportKo: string;
  parentReplyDraft: string;
  /** Active main summary categories */
  mainCategories?: ReportMainCategory[];
  /** Structured detail log rows */
  details?: ReportDetailRow[];
  /** Legacy flat items from API */
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
