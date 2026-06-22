import type { CareScheduleEvent } from "../types/schedule";

/** Demo dates anchored to June 20, 2026 (Saturday) */
const mondayDate = "2026-06-22";
const fridayDate = "2026-06-26";
const wednesdayDate = "2026-06-25";

export const MOCK_SCHEDULE_EVENTS: CareScheduleEvent[] = [
  {
    id: "sched-1",
    title: "Afternoon care with Ji-yeon",
    childName: "Emma",
    caregiverName: "Ji-yeon Park",
    type: "care_shift",
    date: mondayDate,
    startTime: "15:00",
    endTime: "20:00",
    displayTime: "3:00 PM – 8:00 PM",
    locationLabel: "Family home · Capitol Hill",
    note: "Regular Mon–Fri care shift",
    proposedBy: "parent",
    assignedTo: "caregiver",
    status: "accepted",
    parentAccepted: true,
    caregiverAccepted: true,
    source: "care_plan",
    linkedCaregiverId: 1,
    linkedThreadId: 1,
    createdAt: "2026-06-17T10:00:00.000Z",
    updatedAt: "2026-06-18T10:00:00.000Z",
  },
  {
    id: "sched-2",
    title: "Trial session with Ji-yeon",
    childName: "Emma",
    caregiverName: "Ji-yeon Park",
    type: "trial_session",
    date: fridayDate,
    startTime: "16:00",
    endTime: "17:00",
    displayTime: "4:00 PM – 5:00 PM",
    locationLabel: "Family home · Capitol Hill",
    note: "Parent proposed this trial session from chat.",
    proposedBy: "parent",
    assignedTo: "caregiver",
    status: "proposed",
    parentAccepted: true,
    caregiverAccepted: false,
    source: "chat",
    linkedCaregiverId: 1,
    linkedThreadId: 1,
    createdAt: "2026-06-20T12:00:00.000Z",
    updatedAt: "2026-06-20T12:00:00.000Z",
  },
  {
    id: "sched-3",
    title: "Clinic visit reminder",
    childName: "Emma",
    caregiverName: "Ji-yeon Park",
    type: "clinic_visit",
    date: wednesdayDate,
    startTime: "10:00",
    endTime: "11:00",
    displayTime: "10:00 AM",
    locationLabel: "Capitol Hill clinic area",
    note: "Routine checkup",
    proposedBy: "parent",
    status: "accepted",
    parentAccepted: true,
    caregiverAccepted: true,
    source: "scheduler",
    linkedCaregiverId: 1,
    createdAt: "2026-06-16T10:00:00.000Z",
    updatedAt: "2026-06-17T10:00:00.000Z",
  },
];

export function buildTrialScheduleEvent(params: {
  id: string;
  date: string;
  displayTime: string;
  startTime: string;
  endTime: string;
  proposedBy: "parent" | "caregiver";
  caregiverName: string;
  caregiverId: number;
  note?: string;
}): CareScheduleEvent {
  const now = new Date().toISOString();
  return {
    id: params.id,
    title: `Trial session with ${params.caregiverName.split(" ")[0]}`,
    childName: "Emma",
    caregiverName: params.caregiverName,
    type: "trial_session",
    date: params.date,
    startTime: params.startTime,
    endTime: params.endTime,
    displayTime: params.displayTime,
    locationLabel: "Family home · Capitol Hill",
    note: params.note ?? "Trial session proposed from chat.",
    proposedBy: params.proposedBy,
    assignedTo: params.proposedBy === "parent" ? "caregiver" : "parent",
    status: "proposed",
    parentAccepted: params.proposedBy === "parent",
    caregiverAccepted: params.proposedBy === "caregiver",
    source: "chat",
    linkedCaregiverId: params.caregiverId,
    linkedThreadId: params.caregiverId,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildCareShiftScheduleEvent(params: {
  id: string;
  scheduleLabel: string;
  displayTime: string;
  startTime: string;
  endTime: string;
  date: string;
  proposedBy: "parent" | "caregiver";
  caregiverName: string;
  caregiverId: number;
  note?: string;
}): CareScheduleEvent {
  const now = new Date().toISOString();
  return {
    id: params.id,
    title: `Care shift · ${params.scheduleLabel}`,
    childName: "Emma",
    caregiverName: params.caregiverName,
    type: "care_shift",
    date: params.date,
    startTime: params.startTime,
    endTime: params.endTime,
    displayTime: params.displayTime,
    locationLabel: "Family home · Capitol Hill",
    note: params.note ?? "Care plan schedule update",
    proposedBy: params.proposedBy,
    assignedTo: params.proposedBy === "parent" ? "caregiver" : "parent",
    status: "proposed",
    parentAccepted: params.proposedBy === "parent",
    caregiverAccepted: params.proposedBy === "caregiver",
    source: "care_plan",
    linkedCaregiverId: params.caregiverId,
    linkedThreadId: params.caregiverId,
    createdAt: now,
    updatedAt: now,
  };
}
