export type InterviewSlot = {
  id: string;
  labelEn: string;
  labelKo: string;
};

export type InterviewStatus = "scheduled" | "completed" | "contract_signed";

export type ContractFields = {
  startDate: string;
  weeklyPay: string;
  liveIn: boolean;
  workHours: string;
  specialTerms: string;
};

export type ScheduledInterview = {
  id: string;
  caregiverId: number;
  caregiverName: string;
  caregiverAvatar: string;
  weeklyPay: string;
  slotId: string;
  slotLabelEn: string;
  slotLabelKo: string;
  status: InterviewStatus;
  contractFields?: ContractFields;
  signature?: string;
  signedAt?: string;
};
