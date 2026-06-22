import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  buildAiAgreementSummaryEn,
  buildAiAgreementSummaryKo,
  buildCarePlan,
  buildCarePlanUpdatePayload,
  buildDefaultCarePlanDraft,
  CARE_PROPOSALS,
  careNeedsFromAdjustForm,
  DEFAULT_AGREEMENT_TERMS,
} from "../demo/careFlow";
import { CAREGIVER_MATCHES } from "../demo/caregivers";
import type {
  ActiveCareRelationship,
  AgreementTerms,
  CarePlan,
  CarePlanAdjustForm,
  CarePlanDraft,
  MatchConfirmationStatus,
  NegotiationChatItem,
} from "../types/careFlow";
import type { TrialSlot } from "../types/trialSlot";

type CaregiverNegotiation = {
  draft: CarePlanDraft;
  terms: AgreementTerms;
  items: NegotiationChatItem[];
};

type CareFlowContextValue = {
  proposalsReceived: boolean;
  setProposalsReceived: (value: boolean) => void;
  shortlisted: number[];
  toggleShortlist: (caregiverId: number) => void;
  selectedProposalId: number | null;
  selectProposal: (caregiverId: number) => void;
  acceptedProposalId: number | null;
  acceptProposal: (caregiverId: number) => void;
  matchStatus: MatchConfirmationStatus;
  parentConfirmed: boolean;
  caregiverConfirmed: boolean;
  matchConfirmed: boolean;
  confirmParentMatch: () => void;
  simulateCaregiverConfirm: () => number;
  activeRelationship: ActiveCareRelationship | null;
  carePlan: CarePlan | null;
  getNegotiation: (caregiverId: number) => CaregiverNegotiation;
  initNegotiation: (caregiverId: number) => void;
  sendCarePlanUpdate: (caregiverId: number, form: CarePlanAdjustForm) => void;
  acceptCarePlanUpdate: (caregiverId: number, itemId: string) => void;
  askDarinOnUpdate: (caregiverId: number) => void;
  summarizeAgreement: (caregiverId: number) => void;
  suggestQuestions: (caregiverId: number) => void;
  proposeTrialSession: (caregiverId: number, slot: TrialSlot) => void;
  appendScheduleProposal: (caregiverId: number, scheduleEventId: string, textEn: string, textKo: string, role: "parent" | "caregiver") => void;
  appendScheduleSystemMessage: (caregiverId: number, textEn: string, textKo: string) => void;
  agreeScheduleTerm: (caregiverId: number) => void;
  resetDemo: () => void;
};

const CareFlowContext = createContext<CareFlowContextValue | null>(null);

function createNegotiation(caregiverId: number): CaregiverNegotiation {
  const caregiver = CAREGIVER_MATCHES.find((c) => c.id === caregiverId);
  const proposal = CARE_PROPOSALS.find((p) => p.caregiverId === caregiverId);
  return {
    draft: buildDefaultCarePlanDraft(caregiver?.name ?? "Caregiver", proposal?.rate ?? "$22/hr"),
    terms: { ...DEFAULT_AGREEMENT_TERMS },
    items: [],
  };
}

export function CareFlowProvider({ children }: { children: ReactNode }) {
  const [proposalsReceived, setProposalsReceived] = useState(false);
  const [shortlisted, setShortlisted] = useState<number[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
  const [acceptedProposalId, setAcceptedProposalId] = useState<number | null>(null);
  const [matchStatus, setMatchStatus] = useState<MatchConfirmationStatus>("none");
  const [activeRelationship, setActiveRelationship] = useState<ActiveCareRelationship | null>(null);
  const [negotiations, setNegotiations] = useState<Record<number, CaregiverNegotiation>>({});

  const getNegotiation = useCallback(
    (caregiverId: number) => negotiations[caregiverId] ?? createNegotiation(caregiverId),
    [negotiations],
  );

  const initNegotiation = useCallback((caregiverId: number) => {
    setNegotiations((prev) => {
      if (prev[caregiverId]) return prev;
      return { ...prev, [caregiverId]: createNegotiation(caregiverId) };
    });
  }, []);

  const updateNegotiation = useCallback(
    (caregiverId: number, updater: (current: CaregiverNegotiation) => CaregiverNegotiation) => {
      setNegotiations((prev) => {
        const current = prev[caregiverId] ?? createNegotiation(caregiverId);
        return { ...prev, [caregiverId]: updater(current) };
      });
    },
    [],
  );

  const toggleShortlist = useCallback((caregiverId: number) => {
    setShortlisted((prev) =>
      prev.includes(caregiverId) ? prev.filter((id) => id !== caregiverId) : [...prev, caregiverId],
    );
  }, []);

  const selectProposal = useCallback((caregiverId: number) => {
    setSelectedProposalId(caregiverId);
  }, []);

  const acceptProposal = useCallback((caregiverId: number) => {
    setAcceptedProposalId(caregiverId);
    setSelectedProposalId(caregiverId);
  }, []);

  const confirmParentMatch = useCallback(() => {
    setMatchStatus("parent_pending");
  }, []);

  const sendCarePlanUpdate = useCallback(
    (caregiverId: number, form: CarePlanAdjustForm) => {
      const payload = buildCarePlanUpdatePayload(form);
      const id = `update-${Date.now()}`;
      updateNegotiation(caregiverId, (current) => ({
        ...current,
        draft: {
          ...current.draft,
          schedule: form.schedule,
          rate: form.rate,
          startDate: form.startDate,
          trialSession: form.trialSession,
          careNeeds: careNeedsFromAdjustForm(form),
        },
        terms: {
          ...current.terms,
          rate: "discussing",
          trialSession: form.trialSession ? "discussing" : current.terms.trialSession,
        },
        items: [
          ...current.items,
          {
            id,
            type: "care_plan_update",
            role: "parent",
            textEn: "Parent proposed a Care Plan Update",
            textKo: "부모님이 돌봄 계획 업데이트를 제안했습니다",
            update: payload,
          },
          ...(form.message.trim()
            ? [
                {
                  id: `msg-${Date.now()}`,
                  type: "text" as const,
                  role: "parent" as const,
                  textEn: form.message.trim(),
                  textKo: form.message.trim(),
                },
              ]
            : []),
        ],
      }));
    },
    [updateNegotiation],
  );

  const acceptCarePlanUpdate = useCallback(
    (caregiverId: number, itemId: string) => {
      const caregiver = CAREGIVER_MATCHES.find((c) => c.id === caregiverId);
      updateNegotiation(caregiverId, (current) => {
        const item = current.items.find((i) => i.id === itemId);
        const update = item?.update;
        if (!update) return current;

        const nextDraft: CarePlanDraft = {
          ...current.draft,
          schedule: update.schedule,
          rate: update.rate,
          startDate: update.startDate,
          trialSession: update.trialSession,
          careNeeds: update.careNeeds,
        };
        const summaryEn = buildAiAgreementSummaryEn(nextDraft);
        const summaryKo = buildAiAgreementSummaryKo(nextDraft);

        return {
          draft: nextDraft,
          terms: {
            ...current.terms,
            rate: "agreed",
            trialSession: update.trialSession ? "agreed" : current.terms.trialSession,
          },
          items: [
            ...current.items.map((i) =>
              i.id === itemId && i.update ? { ...i, update: { ...i.update, status: "accepted" as const } } : i,
            ),
            {
              id: `sys-${Date.now()}`,
              type: "system",
              role: "system",
              textEn: `${caregiver?.name.split(" ")[0] ?? "Caregiver"} accepted the updated care plan.`,
              textKo: `${caregiver?.name.split(" ")[0] ?? "케어기버"}님이 업데이트된 돌봄 계획을 수락했습니다.`,
            },
            {
              id: `ai-${Date.now()}`,
              type: "ai_summary",
              role: "ai",
              textEn: `So far, both sides agree on:\n• ${summaryEn.agreed.join("\n• ")}\n\nStill needs confirmation:\n• ${summaryEn.pending.join("\n• ")}`,
              textKo: `지금까지 양측이 합의한 내용:\n• ${summaryKo.agreed.join("\n• ")}\n\n아직 확인 필요:\n• ${summaryKo.pending.join("\n• ")}`,
            },
          ],
        };
      });
    },
    [updateNegotiation],
  );

  const askDarinOnUpdate = useCallback(
    (caregiverId: number) => {
      updateNegotiation(caregiverId, (current) => ({
        ...current,
        items: [
          ...current.items,
          {
            id: `ai-help-${Date.now()}`,
            type: "ai_summary",
            role: "ai",
            textEn:
              "Darin suggests asking whether the updated rate reflects a trial session and confirming bilingual daily report timing before final match confirmation.",
            textKo:
              "Darin은 업데이트된 요금이 시범 세션을 포함하는지, 그리고 최종 매칭 전에 이중언어 일일 리포트 시간을 확인할 것을 제안합니다.",
          },
        ],
      }));
    },
    [updateNegotiation],
  );

  const summarizeAgreement = useCallback(
    (caregiverId: number) => {
      updateNegotiation(caregiverId, (current) => {
        const summaryEn = buildAiAgreementSummaryEn(current.draft);
        const summaryKo = buildAiAgreementSummaryKo(current.draft);
        return {
          ...current,
          items: [
            ...current.items,
            {
              id: `ai-summary-${Date.now()}`,
              type: "ai_summary",
              role: "ai",
              textEn: `So far, both sides agree on:\n• ${summaryEn.agreed.join("\n• ")}\n\nStill needs confirmation:\n• ${summaryEn.pending.join("\n• ")}`,
              textKo: `지금까지 양측이 합의한 내용:\n• ${summaryKo.agreed.join("\n• ")}\n\n아직 확인 필요:\n• ${summaryKo.pending.join("\n• ")}`,
            },
          ],
        };
      });
    },
    [updateNegotiation],
  );

  const suggestQuestions = useCallback(
    (caregiverId: number) => {
      updateNegotiation(caregiverId, (current) => ({
        ...current,
        items: [
          ...current.items,
          {
            id: `ai-questions-${Date.now()}`,
            type: "ai_summary",
            role: "ai",
            textEn:
              "Suggested questions: Ask about newborn experience, nap routine, background check, trial session availability, and daily report language preference.",
            textKo:
              "추천 질문: 신생아 경험, 낮잠 루틴, 신원 조회, 시범 세션 가능 여부, 일일 리포트 언어 선호를 물어보세요.",
          },
        ],
      }));
    },
    [updateNegotiation],
  );

  const proposeTrialSession = useCallback(
    (caregiverId: number, slot: TrialSlot) => {
      updateNegotiation(caregiverId, (current) => ({
        draft: {
          ...current.draft,
          trialSession: slot.labelEn,
          trialSlotId: slot.id,
        },
        terms: { ...current.terms, trialSession: "discussing" },
        items: [
          ...current.items,
          {
            id: `trial-${Date.now()}`,
            type: "trial_proposal",
            role: "parent",
            textEn: `Parent proposed a trial session for ${slot.labelEn}.`,
            textKo: `부모님이 ${slot.labelKo} 시범 세션을 제안했습니다.`,
          },
        ],
      }));
    },
    [updateNegotiation],
  );

  const appendScheduleProposal = useCallback(
    (
      caregiverId: number,
      scheduleEventId: string,
      textEn: string,
      textKo: string,
      role: "parent" | "caregiver",
    ) => {
      updateNegotiation(caregiverId, (current) => ({
        ...current,
        terms: { ...current.terms, schedule: "discussing" },
        items: [
          ...current.items,
          {
            id: `sched-${Date.now()}`,
            type: "schedule_proposal",
            role,
            textEn,
            textKo,
            scheduleEventId,
          },
        ],
      }));
    },
    [updateNegotiation],
  );

  const appendScheduleSystemMessage = useCallback(
    (caregiverId: number, textEn: string, textKo: string) => {
      updateNegotiation(caregiverId, (current) => ({
        ...current,
        items: [
          ...current.items,
          {
            id: `sched-sys-${Date.now()}`,
            type: "system",
            role: "system",
            textEn,
            textKo,
          },
        ],
      }));
    },
    [updateNegotiation],
  );

  const agreeScheduleTerm = useCallback(
    (caregiverId: number) => {
      updateNegotiation(caregiverId, (current) => ({
        ...current,
        terms: { ...current.terms, schedule: "agreed" },
      }));
    },
    [updateNegotiation],
  );

  const simulateCaregiverConfirm = useCallback(() => {
    const caregiverId = acceptedProposalId ?? selectedProposalId ?? 1;
    const caregiver = CAREGIVER_MATCHES.find((c) => c.id === caregiverId);
    if (!caregiver) return caregiverId;

    const negotiation = negotiations[caregiverId] ?? createNegotiation(caregiverId);

    setMatchStatus("confirmed");
    setActiveRelationship({
      caregiverId,
      childName: negotiation.draft.childName,
      schedule: negotiation.draft.schedule,
      rate: negotiation.draft.rate,
      startDate: negotiation.draft.startDate,
      trialSession: negotiation.draft.trialSession,
      careNeeds: negotiation.draft.careNeeds,
      languages: "Korean/English",
      dailyReportEnabled: negotiation.draft.dailyReportIncluded,
      chatSaved: true,
    });
    return caregiverId;
  }, [acceptedProposalId, selectedProposalId, negotiations]);

  const resetDemo = useCallback(() => {
    setProposalsReceived(false);
    setShortlisted([]);
    setSelectedProposalId(null);
    setAcceptedProposalId(null);
    setMatchStatus("none");
    setActiveRelationship(null);
    setNegotiations({});
  }, []);

  const carePlan = useMemo(() => {
    if (!activeRelationship) return null;
    const caregiver = CAREGIVER_MATCHES.find((c) => c.id === activeRelationship.caregiverId);
    return caregiver
      ? buildCarePlan(caregiver.name, activeRelationship.rate, activeRelationship.schedule)
      : null;
  }, [activeRelationship]);

  const value = useMemo(
    () => ({
      proposalsReceived,
      setProposalsReceived,
      shortlisted,
      toggleShortlist,
      selectedProposalId,
      selectProposal,
      acceptedProposalId,
      acceptProposal,
      matchStatus,
      parentConfirmed: matchStatus === "parent_pending" || matchStatus === "confirmed",
      caregiverConfirmed: matchStatus === "confirmed",
      matchConfirmed: matchStatus === "confirmed",
      confirmParentMatch,
      simulateCaregiverConfirm,
      activeRelationship,
      carePlan,
      getNegotiation,
      initNegotiation,
      sendCarePlanUpdate,
      acceptCarePlanUpdate,
      askDarinOnUpdate,
      summarizeAgreement,
      suggestQuestions,
      proposeTrialSession,
      appendScheduleProposal,
      appendScheduleSystemMessage,
      agreeScheduleTerm,
      resetDemo,
    }),
    [
      proposalsReceived,
      shortlisted,
      toggleShortlist,
      selectedProposalId,
      selectProposal,
      acceptedProposalId,
      acceptProposal,
      matchStatus,
      confirmParentMatch,
      simulateCaregiverConfirm,
      activeRelationship,
      carePlan,
      getNegotiation,
      initNegotiation,
      sendCarePlanUpdate,
      acceptCarePlanUpdate,
      askDarinOnUpdate,
      summarizeAgreement,
      suggestQuestions,
      proposeTrialSession,
      appendScheduleProposal,
      appendScheduleSystemMessage,
      agreeScheduleTerm,
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
