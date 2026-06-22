import type { IncomingCareRequest } from "../types/incomingCareRequest";

export const DEMO_INCOMING_CARE_REQUESTS: IncomingCareRequest[] = [
  {
    id: "req-emma-1",
    familyName: "Emma's Family",
    childName: "Emma",
    childAge: "8 months",
    location: "Seattle, Capitol Hill",
    schedule: "Mon–Fri, 3 PM–8 PM",
    languages: "Korean / English",
    careNeeds: [
      "Feeding support",
      "Nap routine",
      "Light play",
      "Bilingual daily report",
    ],
    budget: "$18–25/hr",
    startDate: "Next Monday",
    note: "Slight cough recently. Parent prefers daily bilingual updates.",
    status: "open",
  },
];
