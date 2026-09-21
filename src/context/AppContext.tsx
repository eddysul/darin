import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_CARE_SETUP, type CareSetup } from "../types/careSetup";
import type { UserProfile } from "../types/profile";
import { clearCareSetup, getEffectiveCareSetup, hydrateCareSetup, loadCareSetup, saveCareSetup } from "../utils/careSetupStore";
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
  /** Remove a stale device setup before onboarding a different account. */
  resetCareSetup: () => Promise<void>;
  /** Clear only the auth session. CareSetup remains a local cache for server restoration. */
  clearSession: (options?: { localOnly?: boolean }) => Promise<void>;
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

  const clearSession = useCallback(async (_options?: { localOnly?: boolean }) => {
    let syncError: unknown;
    let sessionError: unknown;
    try { await clearSupabaseSync(); } catch (error) { syncError = error; }
    if (isSupabaseConfigured()) {
      try { await AuthRepository.signOutLocal(); } catch (error) { sessionError = error; }
    }
    setProfile(DEFAULT_PARENT_PROFILE);
    if (sessionError || syncError) throw sessionError ?? syncError;
  }, []);

  const resetCareSetup = useCallback(async () => {
    await clearCareSetup();
    setHasSavedCareSetup(false);
    setCareSetupState(DEFAULT_CARE_SETUP);
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
        resetCareSetup,
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
