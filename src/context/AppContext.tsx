import { createContext, useContext, useState, type ReactNode } from "react";
import type { DailyReport } from "../types/dailyReport";
import type { UserProfile } from "../types/profile";

const DEFAULT_PROFILE: UserProfile = {
  name: "Jisoo Kim",
  location: "Capitol Hill, Seattle",
  avatar: "photo-1438761681033-6461ffad8d80",
  role: "parent",
  languages: "Korean, English",
  dueDate: "Aug 15, 2026",
  budget: "$1,500–$2,000/wk",
  liveIn: true,
  experience: "First-time parent",
  breastfeeding: true,
};

type AppContextValue = {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  dailyReport: DailyReport | null;
  setDailyReport: (report: DailyReport | null) => void;
  langPickerOpen: boolean;
  setLangPickerOpen: (open: boolean) => void;
  profileEditOpen: boolean;
  setProfileEditOpen: (open: boolean) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);

  return (
    <AppContext.Provider
      value={{
        profile,
        setProfile,
        dailyReport,
        setDailyReport,
        langPickerOpen,
        setLangPickerOpen,
        profileEditOpen,
        setProfileEditOpen,
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
