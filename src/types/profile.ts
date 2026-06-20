export type UserRole = "parent" | "caregiver";

export type CaregiverCertificate = {
  id: string;
  name: string;
  photo: string;
};

export type UserProfile = {
  name: string;
  location: string;
  avatar: string;
  role: UserRole;
  dueDate?: string;
  childName?: string;
  languages?: string;
  experience?: string;
  specialty?: string;
  budget?: string;
  liveIn?: boolean;
  breastfeeding?: boolean;
  notes?: string;
  weeklyRate?: string;
  bidRate?: string;
  bidNote?: string;
  bio?: string;
  availability?: string;
  licenseNumber?: string;
  licensePhoto?: string;
  certificates?: CaregiverCertificate[];
};

export const EMPTY_PROFILE: UserProfile = {
  name: "",
  location: "",
  avatar: "photo-1438761681033-6461ffad8d80",
  role: "parent",
  dueDate: "",
  childName: "",
  languages: "",
  experience: "",
  specialty: "",
  budget: "",
  liveIn: false,
  breastfeeding: false,
  notes: "",
};
