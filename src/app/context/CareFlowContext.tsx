import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { buildCarePlan } from "../demo/careFlow";
import { CAREGIVER_MATCHES } from "../demo/caregivers";
import type {
  ActiveCareRelationship,
  CarePlan,
  MatchConfirmationStatus,
} from "../types/careFlow";

type CareFlowContextValue = {
  proposalsReceived: boolean;
  setProposalsReceived: (value: boolean) => void;
  shortlisted: number[];
  toggleShortlist: (caregiverId: number) => void;
  matchStatus: MatchConfirmationStatus;
  confirmParentMatch: () => void;
  simulateCaregiverConfirm: () => void;
  activeRelationship: ActiveCareRelationship | null;
  carePlan: CarePlan | null;
  resetDemo: () => void;
};

const CareFlowContext = createContext<CareFlowContextValue | null>(null);

export function CareFlowProvider({ children }: { children: ReactNode }) {
  const [proposalsReceived, setProposalsReceived] = useState(false);
  const [shortlisted, setShortlisted] = useState<number[]>([]);
  const [matchStatus, setMatchStatus] = useState<MatchConfirmationStatus>("none");
  const [activeRelationship, setActiveRelationship] = useState<ActiveCareRelationship | null>(null);

  const toggleShortlist = useCallback((caregiverId: number) => {
    setShortlisted((prev) =>
      prev.includes(caregiverId) ? prev.filter((id) => id !== caregiverId) : [...prev, caregiverId],
    );
  }, []);

  const confirmParentMatch = useCallback(() => {
    setMatchStatus("parent_pending");
  }, []);

  const simulateCaregiverConfirm = useCallback(() => {
    const caregiver = CAREGIVER_MATCHES.find((c) => c.id === 1);
    if (!caregiver) return;

    setMatchStatus("confirmed");
    setActiveRelationship({
      caregiverId: 1,
      childName: "Emma",
      schedule: "Mon–Fri, 3 PM–8 PM",
      rate: "$22/hr",
      startDate: "Next Monday",
      careNeeds: ["feeding", "nap routine", "light play", "bilingual daily report"],
      languages: "Korean/English",
      dailyReportEnabled: true,
      chatSaved: true,
    });
  }, []);

  const resetDemo = useCallback(() => {
    setProposalsReceived(false);
    setShortlisted([]);
    setMatchStatus("none");
    setActiveRelationship(null);
  }, []);

  const carePlan = useMemo(() => {
    if (!activeRelationship) return null;
    const caregiver = CAREGIVER_MATCHES.find((c) => c.id === activeRelationship.caregiverId);
    return caregiver ? buildCarePlan(caregiver.name) : null;
  }, [activeRelationship]);

  const value = useMemo(
    () => ({
      proposalsReceived,
      setProposalsReceived,
      shortlisted,
      toggleShortlist,
      matchStatus,
      confirmParentMatch,
      simulateCaregiverConfirm,
      activeRelationship,
      carePlan,
      resetDemo,
    }),
    [
      proposalsReceived,
      shortlisted,
      toggleShortlist,
      matchStatus,
      confirmParentMatch,
      simulateCaregiverConfirm,
      activeRelationship,
      carePlan,
      resetDemo,
    ],
  );

  return <CareFlowContext.Provider value={value}>{children}</CareFlowContext.Provider>;
}

export function useCareFlow() {
  const ctx = useContext(CareFlowContext);
  if (!ctx) throw new Error("useCareFlow must be used within CareFlowProvider");
  return ctx;
}
