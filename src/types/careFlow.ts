export type MatchConfirmationStatus = "none" | "parent_pending" | "confirmed";

export type CareRequestForm = {
  childName: string;
  childAge: string;
  location: string;
  schedule: string;
  preferredLanguage: string;
  careNeeds: string;
  budgetRange: string;
  startDate: string;
  specialNotes: string;
};

export type CareProposal = {
  caregiverId: number;
  matchScore: number;
  rate: string;
  availability: string;
  languages: string;
  careStyleEn: string;
  careStyleKo: string;
  trustSummaryEn: string;
  trustSummaryKo: string;
  highlights: string[];
  backgroundCheckStatus: "completed" | "pending" | "not_submitted" | "expired";
  proposalMessageEn: string;
  proposalMessageKo: string;
};

export type TermStatus = "agreed" | "discussing" | "needs_confirmation";

export type AgreementTerms = {
  schedule: TermStatus;
  careScope: TermStatus;
  dailyReportLanguage: TermStatus;
  rate: TermStatus;
  trialSession: TermStatus;
};

export type CarePlanDraft = {
  childName: string;
  caregiverName: string;
  schedule: string;
  rate: string;
  startDate: string;
  careNeeds: string[];
  trialSession: string | null;
  dailyReportIncluded: boolean;
};

export type CarePlanAdjustForm = {
  schedule: string;
  rate: string;
  trialSession: string;
  startDate: string;
  careNeeds: {
    feeding: boolean;
    napRoutine: boolean;
    lightPlay: boolean;
    bilingualReports: boolean;
    lightHousekeeping: boolean;
  };
  message: string;
};

export type CarePlanUpdatePayload = {
  schedule: string;
  rate: string;
  trialSession: string;
  startDate: string;
  careNeeds: string[];
  message: string;
  status: "pending" | "accepted";
};

export type NegotiationChatItem = {
  id: string;
  type: "text" | "care_plan_update" | "system" | "ai_summary" | "trial_proposal";
  role: "parent" | "caregiver" | "ai" | "system";
  textEn: string;
  textKo: string;
  update?: CarePlanUpdatePayload;
};

export type ChatMessage = {
  id: string;
  role: "parent" | "caregiver" | "ai";
  textEn: string;
  textKo: string;
};

export type ActiveCareRelationship = {
  caregiverId: number;
  childName: string;
  schedule: string;
  rate: string;
  startDate: string;
  trialSession: string | null;
  careNeeds: string[];
  languages: string;
  dailyReportEnabled: boolean;
  chatSaved: boolean;
};

export type CarePlan = {
  childName: string;
  caregiverName: string;
  schedule: string;
  rate: string;
  startDate: string;
  languages: string;
  dailyReportEnabled: boolean;
  careNeeds: string[];
  safetyItems: string[];
};
