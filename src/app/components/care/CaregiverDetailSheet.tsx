import { CheckCircle, Clock, MapPin, ShieldCheck, Sparkles, Star, X } from "lucide-react";
import type { CaregiverMatch } from "../../demo/caregivers";
import { getCaregiverRole } from "../../i18n";
import { useLanguage } from "../../LanguageContext";
import {
  getBackgroundCheckLabel,
  getCredentialLabel,
  getCredentialStatusLabel,
  isBackgroundCheckComplete,
} from "../../utils/caregiverLabels";
import { Sheet, SheetContent } from "../ui/sheet";

type CaregiverDetailSheetProps = {
  open: boolean;
  caregiver: CaregiverMatch | null;
  onClose: () => void;
  onContact: () => void;
  onRequestCare: () => void;
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

function Section({ title, ai, children }: { title: string; ai?: boolean; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
        {ai && <Sparkles size={12} className="text-[#E0B23F]" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

export function CaregiverDetailSheet({
  open,
  caregiver,
  onClose,
  onContact,
  onRequestCare,
}: CaregiverDetailSheetProps) {
  const { locale, t } = useLanguage();
  if (!caregiver) return null;

  const about = locale === "ko" ? caregiver.aboutKo : caregiver.aboutEn;
  const experience = locale === "ko" ? caregiver.experienceKo : caregiver.experienceEn;
  const careStyle = locale === "ko" ? caregiver.careStyleKo : caregiver.careStyleEn;
  const aiExplanation = locale === "ko" ? caregiver.aiExplanationKo : caregiver.aiExplanationEn;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-3xl p-0 border-[#EAEAEA]">
        <div className="flex flex-col h-full">
          <div className="w-10 h-1 bg-[#EAEAEA] rounded-full mx-auto mt-3 shrink-0" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#FAFAF8]"
            aria-label="Close"
          >
            <X size={18} className="text-[#666666]" />
          </button>

          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <div className="flex flex-col items-center pt-4 pb-2">
              <Avatar src={caregiver.img} size={72} />
              <h2 className="text-xl font-bold mt-3">{caregiver.name}</h2>
              <p className="text-sm text-muted-foreground">{getCaregiverRole(locale, caregiver.role)}</p>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Star size={13} className="text-[#E0B23F] fill-[#E0B23F]" />
                <span>{caregiver.rating}</span>
                <span>·</span>
                <MapPin size={13} />
                <span>{caregiver.distance}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Clock size={12} />
                <span>{caregiver.available}</span>
              </div>
              <span className="mt-3 text-xs font-bold text-[#111111] bg-[#FFF8E7] border border-[#EAEAEA] px-3 py-1.5 rounded-full">
                {caregiver.matchScore}% {t("match.matchScore")}
              </span>
              <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold bg-[#FAFAF8] border border-[#EAEAEA] px-3 py-1.5 rounded-full">
                <ShieldCheck size={12} className={isBackgroundCheckComplete(caregiver.backgroundCheckStatus) ? "text-[#111111]" : "text-[#666666]"} />
                {isBackgroundCheckComplete(caregiver.backgroundCheckStatus)
                  ? t("match.backgroundChecked")
                  : getBackgroundCheckLabel(caregiver.backgroundCheckStatus, t)}
              </span>
            </div>

            <Section title={t("match.whyRecommended")} ai>
              <p className="text-sm text-muted-foreground leading-relaxed">{aiExplanation}</p>
            </Section>

            <Section title={t("match.about")}>
              <p className="text-sm text-muted-foreground leading-relaxed">{about}</p>
            </Section>

            <Section title={t("match.careStyle")}>
              <p className="text-sm text-muted-foreground leading-relaxed">{careStyle}</p>
            </Section>

            <Section title={t("match.experience")}>
              <p className="text-sm text-muted-foreground leading-relaxed">{experience}</p>
            </Section>

            <Section title={t("match.languagesSection")}>
              <div className="flex flex-wrap gap-2">
                {caregiver.languages.map((lang) => (
                  <span key={lang} className="text-xs font-semibold bg-[#FAFAF8] border border-[#EAEAEA] px-3 py-1.5 rounded-full">
                    {lang}
                  </span>
                ))}
              </div>
            </Section>

            <Section title={t("match.verifiedCredentials")}>
              {caregiver.credentials.map((cred) => {
                const statusLabel =
                  cred.id === "background_check"
                    ? getBackgroundCheckLabel(caregiver.backgroundCheckStatus, t)
                    : getCredentialStatusLabel(cred.status, t);
                const verified =
                  cred.id === "background_check"
                    ? isBackgroundCheckComplete(caregiver.backgroundCheckStatus)
                    : cred.status === "verified";

                return (
                  <div key={cred.id} className="flex items-start gap-2.5 py-2 border-b border-[#EAEAEA] last:border-0">
                    <CheckCircle size={14} className={verified ? "text-[#111111] mt-0.5" : "text-[#666666] mt-0.5"} />
                    <div>
                      <p className="text-sm font-semibold">{getCredentialLabel(cred.id, t)}</p>
                      <p className="text-xs text-muted-foreground">{statusLabel}</p>
                    </div>
                  </div>
                );
              })}
            </Section>

            <Section title={t("match.parentReviews")}>
              {caregiver.parentReviews.map((review) => (
                <div key={review.author} className="bg-[#FAFAF8] border border-[#EAEAEA] rounded-2xl p-3 mb-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">{review.author}</span>
                    <span className="text-xs text-muted-foreground">{review.date}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Star size={11} className="text-[#E0B23F] fill-[#E0B23F]" />
                    <span className="text-xs font-semibold">{review.rating.toFixed(1)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{review.text}</p>
                </div>
              ))}
            </Section>

            <div className="mt-5 p-4 bg-[#FAFAF8] border border-[#EAEAEA] rounded-2xl flex justify-between items-center">
              <span className="text-sm font-semibold text-muted-foreground">{t("match.hourlyRate")}</span>
              <span className="text-base font-bold">{caregiver.price}</span>
            </div>
          </div>

          <div className="shrink-0 flex gap-2.5 px-5 pt-3 pb-6 border-t border-[#EAEAEA] bg-white">
            <button
              type="button"
              onClick={onContact}
              className="flex-1 py-3.5 rounded-xl border border-[#EAEAEA] bg-[#FAFAF8] text-sm font-semibold hover:bg-[#F5F5F3] transition-colors"
            >
              {t("match.contact")}
            </button>
            <button
              type="button"
              onClick={onRequestCare}
              className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {t("match.requestCare")}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
