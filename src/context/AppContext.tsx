import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEMO_INCOMING_CARE_REQUESTS } from "../demo/incomingCareRequests";
import type { DailyReport } from "../types/dailyReport";
import type { IncomingCareRequest } from "../types/incomingCareRequest";
import type { LogEntry } from "../types/log";
import type { MainTabName } from "../types/navigation";
import type { UserProfile } from "../types/profile";
import { createId } from "../utils/id";
import { getLatestSavedReport, hydrateReportStore, saveDailyReport } from "../utils/reportStore";

export const DEFAULT_PARENT_PROFILE: UserProfile = {
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
  notes: "",
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
  breastfeeding: true,
  licenseNumber: "WA-2019-PCN-4821",
  bio: "Gentle, routine-based infant care with bilingual daily updates.",
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
  logEntries: LogEntry[];
  addLogEntry: (entry: Omit<LogEntry, "id">) => void;
  clearLogEntries: () => void;
  pendingTab: MainTabName | null;
  setPendingTab: (tab: MainTabName | null) => void;
  clearPendingTab: () => void;
  incomingCareRequests: IncomingCareRequest[];
  markCareProposalSent: (requestId: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PARENT_PROFILE);
  const [dailyReport, setDailyReportState] = useState<DailyReport | null>(null);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [pendingTab, setPendingTab] = useState<MainTabName | null>(null);
  const [incomingCareRequests, setIncomingCareRequests] = useState<IncomingCareRequest[]>(
    DEMO_INCOMING_CARE_REQUESTS,
  );

  useEffect(() => {
    void hydrateReportStore().then(() => {
      const saved = getLatestSavedReport();
      if (saved) setDailyReportState(saved);
    });
  }, []);

  const setDailyReport = useCallback((report: DailyReport | null) => {
    setDailyReportState(report);
    if (report) void saveDailyReport(report);
  }, []);

  const addLogEntry = useCallback((entry: Omit<LogEntry, "id">) => {
    setLogEntries((prev) => [...prev, { ...entry, id: createId() }]);
  }, []);

  const clearLogEntries = useCallback(() => {
    setLogEntries([]);
  }, []);

  const clearPendingTab = useCallback(() => setPendingTab(null), []);

  const markCareProposalSent = useCallback((requestId: string) => {
    setIncomingCareRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: "proposal_sent" as const } : r)),
    );
  }, []);

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
        logEntries,
        addLogEntry,
        clearLogEntries,
        pendingTab,
        setPendingTab,
        clearPendingTab,
        incomingCareRequests,
        markCareProposalSent,
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
