import { useEffect, useState } from "react";
import { CheckCircle, Sparkles, X } from "lucide-react";
import { DEFAULT_CARE_REQUEST } from "../../demo/careFlow";
import type { CareRequestForm } from "../../types/careFlow";
import { useLanguage } from "../../LanguageContext";

type CareRequestModalProps = {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
};

const FIELDS: { key: keyof CareRequestForm; labelKey: string }[] = [
  { key: "childName", labelKey: "careRequest.childName" },
  { key: "childAge", labelKey: "careRequest.childAge" },
  { key: "location", labelKey: "careRequest.location" },
  { key: "schedule", labelKey: "careRequest.schedule" },
  { key: "preferredLanguage", labelKey: "careRequest.preferredLanguage" },
  { key: "careNeeds", labelKey: "careRequest.careNeeds" },
  { key: "budgetRange", labelKey: "careRequest.budgetRange" },
  { key: "startDate", labelKey: "careRequest.startDate" },
  { key: "specialNotes", labelKey: "careRequest.specialNotes" },
];

export function CareRequestModal({ open, onClose, onSent }: CareRequestModalProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState<CareRequestForm>(DEFAULT_CARE_REQUEST);
  const [step, setStep] = useState<"form" | "sent" | "proposals">("form");

  useEffect(() => {
    if (!open) return;
    setForm(DEFAULT_CARE_REQUEST);
    setStep("form");
  }, [open]);

  if (!open) return null;

  const handleSend = () => {
    setStep("sent");
    setTimeout(() => {
      setStep("proposals");
      onSent();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-[390px] bg-white border border-[#EAEAEA] rounded-t-3xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-start justify-between p-5 pb-3 shrink-0">
          <div>
            <h2 className="text-lg font-bold">{t("careRequest.title")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{t("careRequest.subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#FAFAF8]">
            <X size={18} className="text-[#666666]" />
          </button>
        </div>

        {step === "form" && (
          <>
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
              {FIELDS.map(({ key, labelKey }) => (
                <label key={key} className="block">
                  <span className="text-xs font-semibold text-muted-foreground">{t(labelKey as never)}</span>
                  {key === "specialNotes" || key === "careNeeds" ? (
                    <textarea
                      className="mt-1 w-full bg-[#FAFAF8] border border-[#EAEAEA] rounded-xl p-3 text-sm outline-none focus:border-[#111111] min-h-[72px] resize-none"
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      className="mt-1 w-full bg-[#FAFAF8] border border-[#EAEAEA] rounded-xl p-3 text-sm outline-none focus:border-[#111111]"
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="shrink-0 p-5 pt-2 border-t border-[#EAEAEA]">
              <button
                type="button"
                onClick={handleSend}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
              >
                {t("careRequest.send")}
              </button>
            </div>
          </>
        )}

        {step === "sent" && (
          <div className="flex flex-col items-center py-16 px-5 gap-3">
            <CheckCircle size={32} className="text-[#E0B23F]" />
            <p className="font-bold text-lg">{t("careRequest.sentTitle")}</p>
            <p className="text-sm text-muted-foreground text-center">{t("careRequest.sentBody")}</p>
          </div>
        )}

        {step === "proposals" && (
          <div className="flex flex-col items-center py-16 px-5 gap-3">
            <div className="bg-[#FFF8E7] rounded-full p-4">
              <Sparkles size={28} className="text-[#E0B23F]" />
            </div>
            <p className="font-bold text-lg">{t("careRequest.proposalsReceived")}</p>
            <p className="text-sm text-muted-foreground text-center">{t("careRequest.proposalsHint")}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
            >
              {t("careRequest.viewProposals")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
