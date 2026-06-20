import {
  CheckCircle,
  Heart,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { AI_COMPARISON_SUMMARY, CARE_PROPOSALS } from "../../demo/careFlow";
import { CAREGIVER_MATCHES } from "../../demo/caregivers";
import { useCareFlow } from "../../context/CareFlowContext";
import { useLanguage } from "../../LanguageContext";
import { getBackgroundCheckLabel, isBackgroundCheckComplete } from "../../utils/caregiverLabels";
import { Sheet, SheetContent } from "../ui/sheet";

type CareProposalsSheetProps = {
  open: boolean;
  onClose: () => void;
  onViewProfile: (caregiverId: number) => void;
  onChat: (caregiverId: number) => void;
  onAccept: (caregiverId: number) => void;
};

function Avatar({ src, size = 40 }: { src: string; size?: number }) {
  return (
    <img
      src={`https://images.unsplash.com/${src}?w=${size * 2}&h=${size * 2}&fit=crop&auto=format`}
      alt=""
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function CareProposalsSheet({
  open,
  onClose,
  onViewProfile,
  onChat,
  onAccept,
}: CareProposalsSheetProps) {
  const { locale, t } = useLanguage();
  const { shortlisted, toggleShortlist } = useCareFlow();
  const summary = locale === "ko" ? AI_COMPARISON_SUMMARY.ko : AI_COMPARISON_SUMMARY.en;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[94vh] rounded-t-3xl p-0 border-[#EAEAEA]">
        <div className="flex flex-col h-full">
          <div className="w-10 h-1 bg-[#EAEAEA] rounded-full mx-auto mt-3 shrink-0" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#FAFAF8] z-10"
          >
            <X size={18} className="text-[#666666]" />
          </button>

          <div className="px-5 pt-4 pb-3 shrink-0">
            <h2 className="text-xl font-bold">{t("proposals.title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("proposals.subtitle")}</p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
            <div className="bg-[#FFF8E7] border border-[#EAEAEA] rounded-2xl p-4">
              <p className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                <Sparkles size={12} className="text-[#E0B23F]" />
                {t("proposals.aiSummary")}
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed">{summary}</p>
            </div>

            {CARE_PROPOSALS.map((proposal) => {
              const caregiver = CAREGIVER_MATCHES.find((c) => c.id === proposal.caregiverId);
              if (!caregiver) return null;
              const message = locale === "ko" ? proposal.proposalMessageKo : proposal.proposalMessageEn;
              const isShortlisted = shortlisted.includes(proposal.caregiverId);

              return (
                <div key={proposal.caregiverId} className="bg-white border border-[#EAEAEA] rounded-3xl p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Avatar src={caregiver.img} size={48} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm">{caregiver.name}</p>
                        <span className="ml-auto text-xs font-bold bg-[#FFF8E7] text-[#111111] px-2 py-1 rounded-full">
                          {proposal.matchScore}% {t("match.matchScore")}
                        </span>
                      </div>
                      <p className="text-sm font-bold mt-1">{proposal.rate}</p>
                      <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star size={11} className="text-[#E0B23F] fill-[#E0B23F]" />
                          {caregiver.rating}
                        </span>
                        <span>{proposal.availability}</span>
                        <span>{proposal.languages}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {proposal.highlights.map((h) => (
                      <span key={h} className="text-[11px] font-medium bg-[#FAFAF8] border border-[#EAEAEA] px-2.5 py-1 rounded-full flex items-center gap-1">
                        {h.toLowerCase().includes("background") ? (
                          <ShieldCheck size={10} className={isBackgroundCheckComplete(proposal.backgroundCheckStatus) ? "text-[#111111]" : "text-[#666666]"} />
                        ) : h.toLowerCase().includes("cpr") ? (
                          <CheckCircle size={10} />
                        ) : (
                          <MapPin size={10} />
                        )}
                        {h.includes("Background")
                          ? getBackgroundCheckLabel(proposal.backgroundCheckStatus, t)
                          : h}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed italic">&ldquo;{message}&rdquo;</p>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => onViewProfile(proposal.caregiverId)}
                      className="py-2 rounded-xl border border-[#EAEAEA] text-xs font-semibold hover:bg-[#FAFAF8]"
                    >
                      {t("match.viewProfile")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onChat(proposal.caregiverId)}
                      className="py-2 rounded-xl border border-[#EAEAEA] text-xs font-semibold flex items-center justify-center gap-1 hover:bg-[#FAFAF8]"
                    >
                      <MessageCircle size={13} />
                      {t("proposals.chat")}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleShortlist(proposal.caregiverId)}
                      className={`py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                        isShortlisted
                          ? "border-[#E0B23F] bg-[#FFF8E7] text-[#111111]"
                          : "border-[#EAEAEA] hover:bg-[#FAFAF8]"
                      }`}
                    >
                      <Heart size={13} className={isShortlisted ? "fill-[#E0B23F] text-[#E0B23F]" : ""} />
                      {t("proposals.shortlist")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAccept(proposal.caregiverId)}
                      className="py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                    >
                      {t("proposals.accept")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
