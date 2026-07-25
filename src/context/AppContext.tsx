import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { CareSetup } from "../types/careSetup";
import type { UserProfile } from "../types/profile";
import { getEffectiveCareSetup, hydrateCareSetup, loadCareSetup, saveCareSetup, clearCareSetup } from "../utils/careSetupStore";
import { DEMO_CARE_SETUP } from "../types/careSetup";
import { clearSupabaseSync } from "../utils/supabaseSyncStore";
import { AuthRepository } from "../repositories/AuthRepository";
import { isSupabaseConfigured } from "../lib/supabase";

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
  hasSavedCareSetup: boolean;
  /** Clear saved setup and return session to a logged-out baseline. */
  clearSession: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PARENT_PROFILE);
  const [careSetup, setCareSetupState] = useState<CareSetup>(getEffectiveCareSetup);
  const [careSetupReady, setCareSetupReady] = useState(false);
  const [hasSavedCareSetup, setHasSavedCareSetup] = useState(false);

  useEffect(() => {
    void hydrateCareSetup().then(() => {
      const saved = loadCareSetup();
      if (saved) {
        setCareSetupState(saved);
        setHasSavedCareSetup(true);
      }
      setCareSetupReady(true);
    });
  }, []);

  const setCareSetup = useCallback((setup: CareSetup) => {
    setCareSetupState(setup);
    setHasSavedCareSetup(true);
    void saveCareSetup(setup);
  }, []);

  const clearSession = useCallback(async () => {
    await clearCareSetup();
    await clearSupabaseSync();
    if (isSupabaseConfigured()) {
      try {
        await AuthRepository.signOut();
      } catch {
        /* local logout still proceeds */
      }
    }
    setHasSavedCareSetup(false);
    setCareSetupState(DEMO_CARE_SETUP);
    setProfile(DEFAULT_PARENT_PROFILE);
  }, []);

  return (
    <AppContext.Provider
      value={{
        profile,
        setProfile,
        careSetup,
        setCareSetup,
        careSetupReady,
        hasSavedCareSetup,
        clearSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
