import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { CareSetup } from "../types/careSetup";
import type { UserProfile } from "../types/profile";
import { getEffectiveCareSetup, hydrateCareSetup, loadCareSetup, saveCareSetup } from "../utils/careSetupStore";

export const DEFAULT_PARENT_PROFILE: UserProfile = {
  name: "Jisoo Kim",
  location: "Capitol Hill, Seattle",
  avatar: "photo-1438761681033-6461ffad8d80",
  role: "parent",
  languages: "Korean, English",
  dueDate: "Aug 15, 2026",
};

export const DEFAULT_CAREGIVER_PROFILE: UserProfile = {
  name: "Ji-yeon Park",
  location: "Seattle, WA",
  avatar: "photo-1544005313-94ddf0286df2",
  role: "caregiver",
  languages: "Korean, English",
  experience: "8 years postpartum care",
  specialty: "Newborn care · Breastfeeding support",
  weeklyRate: "$1,800–$2,000/wk",
  proposedRate: "$22/hr",
  availability: "Mon–Fri · 3 PM–8 PM",
  liveIn: false,
  licenseNumber: "WA-2019-PCN-4821",
  bio: "Gentle, routine-based infant care with bilingual daily updates.",
};

type AppContextValue = {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  careSetup: CareSetup;
  setCareSetup: (setup: CareSetup) => void;
  careSetupReady: boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PARENT_PROFILE);
  const [careSetup, setCareSetupState] = useState<CareSetup>(getEffectiveCareSetup);
  const [careSetupReady, setCareSetupReady] = useState(false);

  useEffect(() => {
    void hydrateCareSetup().then(() => {
      const saved = loadCareSetup();
      if (saved) setCareSetupState(saved);
      setCareSetupReady(true);
    });
  }, []);

  const setCareSetup = useCallback((setup: CareSetup) => {
    setCareSetupState(setup);
    void saveCareSetup(setup);
  }, []);

  return (
    <AppContext.Provider value={{ profile, setProfile, careSetup, setCareSetup, careSetupReady }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
