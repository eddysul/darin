import type { CarePlan } from "./careFlow";
import type { ChildProfile } from "./childProfile";
import type { DailyReport } from "./dailyReport";

export type ReportConsultationTask = "report_consultation";

export type ReportConsultationPayload = {
  task: ReportConsultationTask;
  childName: string;
  selectedReports: DailyReport[];
  childProfile?: ChildProfile;
  activeCarePlan?: CarePlan | null;
  userQuestion: string;
};

export type ConsultationMessage = {
  id: string;
  role: "user" | "darin";
  text: string;
};
