export type ScheduleEventType =
  | "care_shift"
  | "pickup_dropoff"
  | "trial_session"
  | "clinic_visit"
  | "custom";

export type ScheduleStatus =
  | "proposed"
  | "accepted"
  | "declined"
  | "countered"
  | "cancelled";

export type ScheduleParticipantRole = "parent" | "caregiver";

export type ScheduleSource = "scheduler" | "chat" | "care_plan";

export type CareScheduleEvent = {
  id: string;
  title: string;
  childName: string;
  caregiverName: string;
  type: ScheduleEventType;
  date: string;
  startTime: string;
  endTime: string;
  displayTime: string;
  locationLabel?: string;
  note?: string;
  proposedBy: ScheduleParticipantRole;
  assignedTo?: ScheduleParticipantRole;
  status: ScheduleStatus;
  parentAccepted: boolean;
  caregiverAccepted: boolean;
  source: ScheduleSource;
  linkedThreadId?: number;
  linkedCaregiverId?: number;
  counterOfId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProposeScheduleInput = {
  title: string;
  childName: string;
  caregiverName: string;
  type: ScheduleEventType;
  date: string;
  startTime: string;
  endTime: string;
  displayTime: string;
  locationLabel?: string;
  note?: string;
  proposedBy: ScheduleParticipantRole;
  source?: ScheduleSource;
  linkedThreadId?: number;
  linkedCaregiverId?: number;
};

export type CounterScheduleInput = {
  date: string;
  startTime: string;
  endTime: string;
  displayTime: string;
  note?: string;
};
