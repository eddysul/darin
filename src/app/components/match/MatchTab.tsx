import { useState } from "react";
import {
  CheckCircle,
  Clock,
  Globe,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { motion } from "motion/react";
import { CareChatModal } from "../care/CareChatModal";
import { CaregiverDetailSheet } from "../care/CaregiverDetailSheet";
import { CarePlanModal } from "../care/CarePlanModal";
import { CareProposalsSheet } from "../care/CareProposalsSheet";
import { CareRequestModal } from "../care/CareRequestModal";
import { ContactMessageModal } from "../care/ContactMessageModal";
import { useCareFlow } from "../../context/CareFlowContext";
import { CAREGIVER_MATCHES, type CaregiverMatch } from "../../demo/caregivers";
import { getCaregiverRole } from "../../i18n";
import { useLanguage } from "../../LanguageContext";
import {
  getBackgroundCheckLabel,
  isBackgroundCheckComplete,
} from "../../utils/caregiverLabels";

function Avatar({ src, size = 52 }: { src: string; size?: number }) {
  return (
    <img
      src={`https://images.unsplash.com/${src}?w=${size * 2}&h=${size * 2}&fit=crop&auto=format`}
      alt=""
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

type MatchTabProps = {
  onGoHome: () => void;
};

export function MatchTab({ onGoHome }: MatchTabProps) {
  const { locale, t } = useLanguage();
  const { proposalsReceived, setProposalsReceived, activeRelationship, carePlan } = useCareFlow();

  const [selected, setSelected] = useState<CaregiverMatch | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [careRequestOpen, setCareRequestOpen] = useState(false);
  const [proposalsOpen, setProposalsOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatCaregiverId, setChatCaregiverId] = useState<number | null>(null);
  const [carePlanOpen, setCarePlanOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filters = [
    t("match.filterAll"),
    t("match.filterBilingual"),
    t("match.filterWeekday"),
    t("match.filterInfant"),
    t("match.filterCertified"),
  ];

  const openProfile = (caregiver: CaregiverMatch) => {
    setSelected(caregiver);
    setDetailOpen(true);
  };

  const openProfileById = (id: number) => {
    const caregiver = CAREGIVER_MATCHES.find((c) => c.id === id);
    if (caregiver) openProfile(caregiver);
  };

  const openCareRequest = (caregiver?: CaregiverMatch) => {
    if (caregiver) setSelected(caregiver);
    setCareRequestOpen(true);
  };

  const handleCareRequestSent = () => {
    setProposalsReceived(true);
    setCareRequestOpen(false);
    setProposalsOpen(true);
  };

  const openChat = (caregiverId: number) => {
    setChatCaregiverId(caregiverId);
    setSelected(CAREGIVER_MATCHES.find((c) => c.id === caregiverId) ?? null);
    setChatOpen(true);
    setProposalsOpen(false);
  };

  const handleAccept = (caregiverId: number) => {
    openChat(caregiverId);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const activeCaregiver = activeRelationship
    ? CAREGIVER_MATCHES.find((c) => c.id === activeRelationship.caregiverId)
    : null;

  return (
    <>
      <div className="flex flex-col gap-4 pb-6 relative">
        {toast && (
          <div className="fixed top-14 left-4 right-4 z-50 flex items-center gap-2 bg-white border border-[#E0B23F] rounded-2xl p-3.5 shadow-lg max-w-[358px] mx-auto">
            <CheckCircle size={16} className="text-[#E0B23F] shrink-0" />
            <span className="text-sm font-semibold">{toast}</span>
          </div>
        )}

        <div className="mx-4 mt-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Nunito, sans-serif" }}>
                {t("match.title")}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">{t("match.subtitle")}</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-[#111111] bg-[#FFF8E7] px-2.5 py-1.5 rounded-full flex items-center gap-1 whitespace-nowrap">
              <Sparkles size={11} />
              {t("match.aiRecommended")}
            </span>
          </div>
        </div>

        {activeRelationship && activeCaregiver && (
          <div className="mx-4 bg-[#FFF8E7] border border-[#E0B23F] rounded-3xl p-4">
            <p className="text-xs font-bold text-[#111111] mb-1">{t("match.activeMatch")}</p>
            <p className="text-sm font-semibold">
              {activeCaregiver.name} · {activeRelationship.schedule}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t("match.activeMatchDetail")}</p>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => openChat(activeRelationship.caregiverId)}
                className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
              >
                {t("match.openChat")}
              </button>
              <button
                type="button"
                onClick={() => setCarePlanOpen(true)}
                className="flex-1 py-2 rounded-xl border border-[#EAEAEA] bg-white text-xs font-semibold"
              >
                {t("match.viewCarePlan")}
              </button>
            </div>
          </div>
        )}

        {proposalsReceived && !activeRelationship && (
          <div className="mx-4">
            <button
              type="button"
              onClick={() => setProposalsOpen(true)}
              className="w-full flex items-center justify-between bg-white border border-[#EAEAEA] rounded-2xl p-4 hover:bg-[#FAFAF8] transition-colors"
            >
              <div className="text-left">
                <p className="text-sm font-bold">{t("proposals.title")}</p>
                <p className="text-xs text-muted-foreground">{t("careRequest.proposalsReceived")}</p>
              </div>
              <Sparkles size={18} className="text-[#E0B23F]" />
            </button>
          </div>
        )}

        <div className="mx-4 flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-3 shadow-sm">
          <Search size={16} className="text-muted-foreground" />
          <input
            className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            placeholder={t("match.placeholder")}
          />
        </div>

        <div className="px-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {filters.map((f, idx) => (
            <button
              key={f}
              type="button"
              className={`whitespace-nowrap text-xs rounded-full px-3.5 py-2 font-semibold border transition-colors ${
                idx === 0
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 mx-4">
          {CAREGIVER_MATCHES.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-3xl p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar src={c.img} size={52} />
                  {c.verified && (
                    <div className="absolute -bottom-1 -right-1 bg-[#111111] rounded-full p-0.5">
                      <CheckCircle size={12} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.matchScore}% {t("match.matchScore")} · {c.rating} {t("match.rating")} · {c.distance}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {c.languages.join("/")} · {c.available} · {c.price}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {isBackgroundCheckComplete(c.backgroundCheckStatus) && (
                  <span className="text-[11px] font-semibold bg-[#FAFAF8] border border-[#EAEAEA] px-2.5 py-1 rounded-full flex items-center gap-1">
                    <ShieldCheck size={10} className="text-[#111111]" />
                    {t("match.backgroundChecked")}
                  </span>
                )}
                {c.credentials.some((cr) => cr.id === "cpr" && cr.status === "verified") && (
                  <span className="text-[11px] font-semibold bg-[#FAFAF8] border border-[#EAEAEA] px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle size={10} />
                    {t("match.cprCertified")}
                  </span>
                )}
                {c.credentials.some((cr) => cr.id === "license" && cr.status === "verified") && (
                  <span className="text-[11px] font-semibold bg-[#FAFAF8] border border-[#EAEAEA] px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle size={10} />
                    {t("match.licenseUploaded")}
                  </span>
                )}
                {!isBackgroundCheckComplete(c.backgroundCheckStatus) && (
                  <span className="text-[11px] font-medium bg-[#FAFAF8] border border-[#EAEAEA] px-2.5 py-1 rounded-full text-muted-foreground">
                    {getBackgroundCheckLabel(c.backgroundCheckStatus, t)}
                  </span>
                )}
              </div>

              <div className="mt-3 bg-[#FFF8E7] border border-[#EAEAEA] rounded-2xl p-3">
                <p className="text-xs font-semibold text-[#111111] mb-1 flex items-center gap-1">
                  <Sparkles size={11} className="text-[#E0B23F]" />
                  {t("match.aiRecommendation")}
                </p>
                <p className="text-xs text-foreground/85 leading-relaxed">
                  &ldquo;{locale === "ko" ? c.aiExplanationKo : c.aiExplanationEn}&rdquo;
                </p>
              </div>

              <div className="flex gap-1.5 flex-wrap mt-2">
                {c.languages.map((lang) => (
                  <span key={lang} className="bg-[#FAFAF8] text-[#666666] text-xs rounded-full px-2 py-0.5 font-medium flex items-center gap-1">
                    <Globe size={10} />
                    {lang}
                  </span>
                ))}
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => openProfile(c)}
                  className="flex-1 py-2 rounded-xl border border-[#EAEAEA] text-xs font-semibold hover:bg-[#FAFAF8]"
                >
                  {t("match.viewProfile")}
                </button>
                <button
                  type="button"
                  onClick={() => openCareRequest(c)}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                >
                  {t("match.requestProposal")}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <CaregiverDetailSheet
        open={detailOpen}
        caregiver={selected}
        onClose={() => setDetailOpen(false)}
        onContact={() => {
          setDetailOpen(false);
          setContactOpen(true);
        }}
        onRequestCare={() => {
          setDetailOpen(false);
          openCareRequest(selected ?? undefined);
        }}
      />

      <ContactMessageModal
        open={contactOpen}
        caregiver={selected}
        onClose={() => setContactOpen(false)}
        onSent={() => showToast(t("match.requestSentToast"))}
      />

      <CareRequestModal
        open={careRequestOpen}
        onClose={() => setCareRequestOpen(false)}
        onSent={handleCareRequestSent}
      />

      <CareProposalsSheet
        open={proposalsOpen}
        onClose={() => setProposalsOpen(false)}
        onViewProfile={openProfileById}
        onChat={openChat}
        onAccept={handleAccept}
      />

      <CareChatModal
        open={chatOpen}
        caregiverId={chatCaregiverId}
        onClose={() => setChatOpen(false)}
        onViewCarePlan={() => {
          setChatOpen(false);
          setCarePlanOpen(true);
        }}
        onGoHome={onGoHome}
      />

      <CarePlanModal open={carePlanOpen} plan={carePlan} onClose={() => setCarePlanOpen(false)} />
    </>
  );
}
