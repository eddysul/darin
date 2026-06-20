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
  highlights: string[];
  backgroundCheckStatus: "completed" | "pending" | "not_submitted" | "expired";
  proposalMessageEn: string;
  proposalMessageKo: string;
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
