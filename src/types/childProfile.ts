export type ChildSpecialNote = {
  id: string;
  type: string;
  text: string;
};

export type ChildProfile = {
  id: string;
  name: string;
  preferredName?: string;
  age: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  foodRestrictions: string[];
  doctorClinic: string;
  emergencyContact: string;
  routine: {
    feeding: string;
    nap: string;
    diaper: string;
    comfortMethod: string;
    favoriteActivity: string;
  };
  carePreferences: {
    languages: string[];
    dailyReportLanguage: string;
    updateTopics: string[];
    communicationStyle: string;
    reportFrequency: string;
  };
  authorizedPickup: {
    name: string;
    relationship: string;
  }[];
  specialNotes: ChildSpecialNote[];
  avatar: string;
};

export const CHILD_NOTE_TYPES = [
  "Allergy",
  "Condition",
  "Medication",
  "Behavior",
  "Food",
  "Sleep",
  "Other",
] as const;

export type ChildNoteType = (typeof CHILD_NOTE_TYPES)[number];
