import { useEffect, useState } from "react";
import { CheckCircle, Send, Sparkles, X } from "lucide-react";
import type { CaregiverMatch } from "../../demo/caregivers";
import { useLanguage } from "../../LanguageContext";

type ContactMessageModalProps = {
  open: boolean;
  caregiver: CaregiverMatch | null;
  onClose: () => void;
  onSent: () => void;
};

export function ContactMessageModal({ open, caregiver, onClose, onSent }: ContactMessageModalProps) {
  const { locale, t } = useLanguage();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open || !caregiver) return;
    setMessage(locale === "ko" ? caregiver.contactDraftKo : caregiver.contactDraftEn);
    setSent(false);
  }, [open, caregiver, locale]);

  if (!open || !caregiver) return null;

  const handleSend = () => {
    setSent(true);
    setTimeout(() => {
      onSent();
      onClose();
      setSent(false);
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-[390px] bg-white border border-[#EAEAEA] rounded-t-3xl p-5 pb-7 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{t("match.contactTitle")}</h2>
            <p className="text-sm text-muted-foreground">{caregiver.name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#FAFAF8]">
            <X size={18} className="text-[#666666]" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <CheckCircle size={28} className="text-[#E0B23F]" />
            <p className="font-bold">{t("match.requestSentTitle")}</p>
            <p className="text-sm text-muted-foreground text-center">{t("match.requestSentBody")}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-[#FFF8E7] rounded-xl p-2.5 mb-3">
              <Sparkles size={14} className="text-[#E0B23F] shrink-0" />
              <span className="text-xs font-semibold">{t("match.suggestedFirstMessage")}</span>
            </div>
            <textarea
              className="w-full min-h-[120px] bg-[#FAFAF8] border border-[#EAEAEA] rounded-2xl p-3.5 text-sm leading-relaxed resize-none outline-none focus:border-[#111111]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              type="button"
              onClick={handleSend}
              className="w-full mt-3.5 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold hover:opacity-90"
            >
              <Send size={16} />
              {t("match.sendRequest")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
