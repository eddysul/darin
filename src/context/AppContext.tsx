import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { DailyReport } from "../types/dailyReport";
import type { ContractFields, IncomingRequest, InterviewSlot, ScheduledInterview } from "../types/interview";
import type { UserProfile } from "../types/profile";
import type { MainTabName } from "../types/navigation";
import { DEMO_INCOMING_REQUESTS } from "../demo/parents";

const DEFAULT_PARENT_PROFILE: UserProfile = {
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

const DEFAULT_CAREGIVER_PROFILE: UserProfile = {
  name: "Ji-yeon Park",
  location: "Seattle, WA",
  avatar: "photo-1544005313-94ddf0286df2",
  role: "caregiver",
  languages: "Korean, English",
  experience: "8 years postpartum care",
  specialty: "Newborn care · Breastfeeding support",
  weeklyRate: "$1,800–$2,000/wk",
  availability: "Mon–Fri · 8am–6pm or Live-in",
  liveIn: true,
  breastfeeding: true,
  licenseNumber: "WA-2019-PCN-4821",
};

const DEFAULT_PROFILE = DEFAULT_PARENT_PROFILE;

export { DEFAULT_CAREGIVER_PROFILE };

type AppContextValue = {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  dailyReport: DailyReport | null;
  setDailyReport: (report: DailyReport | null) => void;
  langPickerOpen: boolean;
  setLangPickerOpen: (open: boolean) => void;
  profileEditOpen: boolean;
  setProfileEditOpen: (open: boolean) => void;
  scheduledInterviews: ScheduledInterview[];
  scheduleInterview: (
    caregiver: { id: number; name: string; img: string; weeklyPay: string },
    slot: InterviewSlot,
  ) => void;
  completeInterview: (interviewId: string) => void;
  signContract: (interviewId: string, fields: ContractFields, signature: string) => void;
  getInterviewForCaregiver: (caregiverId: number) => ScheduledInterview | undefined;
  pendingTab: MainTabName | null;
  clearPendingTab: () => void;
  setPendingTab: (tab: MainTabName | null) => void;
  pendingContractInterviewId: string | null;
  clearPendingContractInterview: () => void;
  incomingRequests: IncomingRequest[];
  acceptRequest: (requestId: string) => void;
  caregiverSignContract: (requestId: string, signature: string, notes?: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [scheduledInterviews, setScheduledInterviews] = useState<ScheduledInterview[]>([]);
  const [pendingTab, setPendingTab] = useState<MainTabName | null>(null);
  const [pendingContractInterviewId, setPendingContractInterviewId] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>(DEMO_INCOMING_REQUESTS);

  const clearPendingTab = useCallback(() => setPendingTab(null), []);
  const clearPendingContractInterview = useCallback(() => setPendingContractInterviewId(null), []);

  const acceptRequest = useCallback((requestId: string) => {
    setIncomingRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: "accepted" as const } : r)),
    );
  }, []);

  const caregiverSignContract = useCallback((requestId: string, signature: string, notes?: string) => {
    setIncomingRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: "contract_signed" as const,
              caregiverSignature: signature,
              caregiverSignedAt: new Date().toISOString(),
              ...(notes ? { notes } : {}),
            }
          : r,
      ),
    );
  }, []);

  const scheduleInterview = useCallback(
    (caregiver: { id: number; name: string; img: string; weeklyPay: string }, slot: InterviewSlot) => {
      const entry: ScheduledInterview = {
        id: `${caregiver.id}-${slot.id}`,
        caregiverId: caregiver.id,
        caregiverName: caregiver.name,
        caregiverAvatar: caregiver.img,
        weeklyPay: caregiver.weeklyPay,
        slotId: slot.id,
        slotLabelEn: slot.labelEn,
        slotLabelKo: slot.labelKo,
        status: "scheduled",
      };
      setScheduledInterviews((prev) => [
        ...prev.filter((i) => i.caregiverId !== caregiver.id),
        entry,
      ]);
      setPendingTab("Home");
    },
    [],
  );

  const completeInterview = useCallback((interviewId: string) => {
    setScheduledInterviews((prev) =>
      prev.map((i) => (i.id === interviewId ? { ...i, status: "completed" as const } : i)),
    );
    setPendingContractInterviewId(interviewId);
    setPendingTab("Profile");
  }, []);

  const signContract = useCallback(
    (interviewId: string, fields: ContractFields, signature: string) => {
      setScheduledInterviews((prev) =>
        prev.map((i) =>
          i.id === interviewId
            ? {
                ...i,
                status: "contract_signed" as const,
                contractFields: fields,
                signature,
                signedAt: new Date().toISOString(),
              }
            : i,
        ),
      );
    },
    [],
  );

  const getInterviewForCaregiver = useCallback(
    (caregiverId: number) => scheduledInterviews.find((i) => i.caregiverId === caregiverId),
    [scheduledInterviews],
  );

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
        scheduledInterviews,
        scheduleInterview,
        completeInterview,
        signContract,
        getInterviewForCaregiver,
        pendingTab,
        clearPendingTab,
        setPendingTab,
        pendingContractInterviewId,
        clearPendingContractInterview,
        incomingRequests,
        acceptRequest,
        caregiverSignContract,
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
