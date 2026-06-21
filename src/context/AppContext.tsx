import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { DailyReport } from "../types/dailyReport";
import type { ContractFields, IncomingRequest, InterviewSlot, ScheduledInterview } from "../types/interview";
import type { LogEntry } from "../types/log";
import type { WeeklyPayment } from "../types/payment";
import type { UserProfile } from "../types/profile";
import type { MainTabName } from "../types/navigation";
import { DEMO_INCOMING_REQUESTS, DEMO_LOG_ENTRIES } from "../demo/parents";
import { buildDailyReportText } from "../utils/categorize";
import { createId } from "../utils/id";

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
  ethnicity: "Korean",
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
  ethnicity: "Korean",
};

const DEFAULT_PROFILE = DEFAULT_PARENT_PROFILE;

export { DEFAULT_CAREGIVER_PROFILE, DEFAULT_PARENT_PROFILE };

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
  caregiverBidRate: string | null;
  logEntries: LogEntry[];
  addLogEntry: (entry: Omit<LogEntry, "id">) => void;
  generateDailyReportFromLogs: (locale: "en" | "ko") => void;
  weeklyPayments: WeeklyPayment[];
  makePayment: (paymentId: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [caregiverBidRate, setCaregiverBidRate] = useState<string | null>(null);
  const [profile, setProfileRaw] = useState<UserProfile>(DEFAULT_PROFILE);
  const profileRef = useRef(DEFAULT_PROFILE);
  const setProfile = useCallback((p: UserProfile) => {
    setProfileRaw(p);
    profileRef.current = p;
    if (p.role === "caregiver" && p.bidRate) setCaregiverBidRate(p.bidRate);
  }, []);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [scheduledInterviews, setScheduledInterviews] = useState<ScheduledInterview[]>([]);
  const scheduledInterviewsRef = useRef<ScheduledInterview[]>([]);
  const [pendingTab, setPendingTab] = useState<MainTabName | null>(null);
  const [pendingContractInterviewId, setPendingContractInterviewId] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>(DEMO_INCOMING_REQUESTS);
  const [logEntries, setLogEntries] = useState<LogEntry[]>(DEMO_LOG_ENTRIES);
  const [weeklyPayments, setWeeklyPayments] = useState<WeeklyPayment[]>([
    {
      id: "pay-1",
      weekLabel: "Week of June 16",
      weekLabelKo: "6월 3주차 (6/16–6/20)",
      amount: "$1,800",
      dueDate: "June 20, 2026",
      dueDateKo: "2026년 6월 20일",
      status: "pending",
      caregiverName: "Ji-yeon Park",
    },
  ]);

  const makePayment = useCallback((paymentId: string) => {
    setWeeklyPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? { ...p, status: "paid" as const, paidAt: new Date().toISOString() }
          : p,
      ),
    );
  }, []);

  const addLogEntry = useCallback((entry: Omit<LogEntry, "id">) => {
    setLogEntries((prev) => [...prev, { ...entry, id: createId() }]);
  }, []);

  const generateDailyReportFromLogs = useCallback((locale: "en" | "ko") => {
    const text = buildDailyReportText(logEntries, locale);
    if (!text) return;
    const now = new Date();
    const report: DailyReport = {
      id: createId(),
      date: now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      child: "Baby",
      caregiver: "Ji-yeon Park",
      sourceNote: text,
      reportEn: buildDailyReportText(logEntries, "en"),
      reportKo: buildDailyReportText(logEntries, "ko"),
      parentReplyDraft: "Thank you for today's detailed care log. I appreciate the updates!",
      items: [],
      savedAt: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    };
    setDailyReport(report);
  }, [logEntries, setDailyReport]);

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
      setScheduledInterviews((prev) => {
        const next = [...prev.filter((i) => i.caregiverId !== caregiver.id), entry];
        scheduledInterviewsRef.current = next;
        return next;
      });
      // Mirror on caregiver side so the request shows up in caregiver Home
      setIncomingRequests((prev) => {
        const existing = prev.find((r) => r.caregiverId === caregiver.id);
        if (existing) {
          return prev.map((r) =>
            r.caregiverId === caregiver.id
              ? { ...r, slotLabelEn: slot.labelEn, slotLabelKo: slot.labelKo, status: "pending" as const }
              : r,
          );
        }
        return [
          ...prev,
          {
            id: `req-${caregiver.id}`,
            parentId: "p2",
            caregiverId: caregiver.id,
            parentName: profileRef.current.name,
            parentAvatar: profileRef.current.avatar,
            parentLocation: profileRef.current.location,
            dueDate: profileRef.current.dueDate ?? "",
            budget: profileRef.current.budget ?? "",
            liveIn: profileRef.current.liveIn ?? false,
            breastfeeding: profileRef.current.breastfeeding ?? false,
            notes: profileRef.current.notes,
            slotLabelEn: slot.labelEn,
            slotLabelKo: slot.labelKo,
            status: "pending" as const,
          },
        ];
      });
      setPendingTab("Home");
    },
    [],
  );

  const completeInterview = useCallback((interviewId: string) => {
    setScheduledInterviews((prev) => {
      const next = prev.map((i) => (i.id === interviewId ? { ...i, status: "completed" as const } : i));
      scheduledInterviewsRef.current = next;
      return next;
    });
    setPendingContractInterviewId(interviewId);
    setPendingTab("Profile");
  }, []);

  const signContract = useCallback(
    (interviewId: string, fields: ContractFields, signature: string) => {
      const interview = scheduledInterviewsRef.current.find((i) => i.id === interviewId);
      setScheduledInterviews((prev) => {
        const next = prev.map((i) =>
          i.id === interviewId
            ? { ...i, status: "contract_signed" as const, contractFields: fields, signature, signedAt: new Date().toISOString() }
            : i,
        );
        scheduledInterviewsRef.current = next;
        return next;
      });
      // Mirror parent signature on caregiver side so caregiver sees "Sign Contract" button
      if (interview?.caregiverId !== undefined) {
        const cid = interview.caregiverId;
        setIncomingRequests((prev) =>
          prev.map((r) =>
            r.caregiverId === cid
              ? { ...r, contractFields: fields, parentSignature: signature, parentSignedAt: new Date().toISOString() }
              : r,
          ),
        );
      }
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
        caregiverBidRate,
        logEntries,
        addLogEntry,
        generateDailyReportFromLogs,
        weeklyPayments,
        makePayment,
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
