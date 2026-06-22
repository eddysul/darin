export type ParentProfileData = {
  header: {
    name: string;
    relationship: string;
    location: string;
    languages: string;
    preferredContact: string;
  };
  careNeeds: {
    lookingFor: string;
    child: string;
    schedule: string;
    startDate: string;
    budget: string;
    careFocus: string[];
  };
  childSnapshot: {
    name: string;
    age: string;
    allergies: string[];
    conditions: string[];
    routine: string[];
  };
  communication: {
    reportLanguage: string;
    reportFrequency: string;
    updateStyle: string;
    importantUpdates: string[];
  };
  careStyle: string[];
  household: {
    neighborhood: string;
    careLocation: string;
    pets: string;
    householdLanguage: string;
  };
  verification: {
    phone: boolean;
    email: boolean;
    payment: boolean;
    profileComplete: boolean;
  };
};
