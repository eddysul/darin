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
  reportEn: string;
  reportKo: string;
  parentReplyDraft: string;
  items: DailyReportItem[];
  savedAt: string;
};
