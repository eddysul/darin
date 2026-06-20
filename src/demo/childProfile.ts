import type { ChildProfile } from "../types/childProfile";

export const EMMA_CHILD_PROFILE: ChildProfile = {
  id: "emma",
  name: "Emma Kim",
  preferredName: "Emma",
  age: "8 months",
  dateOfBirth: "October 12, 2025",
  gender: "Female",
  bloodType: "O",
  allergies: ["Peanuts"],
  conditions: ["Mild eczema"],
  medications: ["None"],
  foodRestrictions: ["Avoid peanuts and tree nuts"],
  doctorClinic: "Seattle Children's Clinic",
  emergencyContact: "Jisoo Kim · 206-555-0184",
  routine: {
    feeding: "Bottle every 3 hours",
    nap: "Usually 1–2 PM",
    diaper: "Sensitive skin, use fragrance-free wipes",
    comfortMethod: "Likes lullabies and being held upright",
    favoriteActivity: "Soft books and gentle music",
  },
  carePreferences: {
    languages: ["Korean", "English"],
    dailyReportLanguage: "Korean preferred",
    updateTopics: ["meals", "naps", "cough", "mood"],
    communicationStyle: "Warm and detailed",
    reportFrequency: "Daily report + urgent notes as needed",
  },
  authorizedPickup: [
    { name: "Jisoo Kim", relationship: "Mother" },
    { name: "Daniel Kim", relationship: "Father" },
  ],
  specialNotes: [
    {
      id: "seed-1",
      type: "Allergy",
      text: "Peanut allergy. Please avoid snacks that may contain peanuts or tree nuts.",
    },
  ],
  avatar: "photo-1594608661623-aa0bd3a69d98",
};
