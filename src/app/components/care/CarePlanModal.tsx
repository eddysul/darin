import { CheckCircle, ShieldCheck, Sparkles, X } from "lucide-react";
import type { CarePlan } from "../../types/careFlow";
import { useLanguage } from "../../LanguageContext";

type CarePlanModalProps = {
  open: boolean;
  plan: CarePlan | null;
  onClose: () => void;
};

export function CarePlanModal({ open, plan, onClose }: CarePlanModalProps) {
  const { t } = useLanguage();
  if (!open || !plan) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-[390px] bg-white border border-[#EAEAEA] rounded-t-3xl max-h-[90vh] overflow-y-auto p-5 pb-8 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles size={18} className="text-[#E0B23F]" />
              {t("carePlan.title")}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{t("carePlan.subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#FAFAF8]">
            <X size={18} className="text-[#666666]" />
          </button>
        </div>

        <div className="space-y-3">
          {[
            { label: t("carePlan.child"), value: plan.childName },
            { label: t("carePlan.caregiver"), value: plan.caregiverName },
            { label: t("carePlan.schedule"), value: plan.schedule },
            { label: t("carePlan.rate"), value: plan.rate },
            { label: t("carePlan.startDate"), value: plan.startDate },
            { label: t("carePlan.languages"), value: plan.languages },
            {
              label: t("carePlan.dailyReport"),
              value: plan.dailyReportEnabled ? t("carePlan.enabled") : t("carePlan.disabled"),
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-start py-2 border-b border-[#EAEAEA]">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm font-semibold text-right max-w-[60%]">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <p className="text-sm font-bold mb-2">{t("carePlan.careNeeds")}</p>
          <div className="flex flex-wrap gap-2">
            {plan.careNeeds.map((need) => (
              <span key={need} className="text-xs font-medium bg-[#FAFAF8] border border-[#EAEAEA] px-3 py-1.5 rounded-full">
                {need}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-bold mb-2 flex items-center gap-1.5">
            <ShieldCheck size={14} />
            {t("carePlan.safety")}
          </p>
          {plan.safetyItems.map((item) => (
            <div key={item} className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <CheckCircle size={14} className="text-[#111111]" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
