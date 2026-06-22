export type IncomingCareRequestStatus = "open" | "proposal_sent";

export type IncomingCareRequest = {
  id: string;
  familyName: string;
  childName: string;
  childAge: string;
  location: string;
  schedule: string;
  languages: string;
  careNeeds: string[];
  budget: string;
  startDate: string;
  note: string;
  status: IncomingCareRequestStatus;
};
