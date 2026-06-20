import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Baby, CheckCircle, HeartPulse, Pencil, Share2, ShieldCheck, Sparkles, X } from "lucide-react";
import { EMMA_CHILD_PROFILE } from "../../demo/childProfile";
import { useLanguage } from "../LanguageContext";
import { CHILD_NOTE_TYPES, type ChildNoteType, type ChildProfile, type ChildSpecialNote } from "../../types/childProfile";

type ChildCareSnapshotModalProps = {
  open: boolean;
  child?: ChildProfile;
  onClose: () => void;
};

function Avatar({ src, size = 56 }: { src: string; size?: number }) {
  return (
    <img
      src={`https://images.unsplash.com/${src}?w=${size * 2}&h=${size * 2}&fit=crop&auto=format`}
      alt=""
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <span className="text-xs text-[#666666]">{label}</span>
      <span className="text-xs font-semibold text-[#111111] text-right max-w-[58%]">{value}</span>
    </div>
  );
}

export function ChildCareSnapshotModal({
  open,
  child = EMMA_CHILD_PROFILE,
  onClose,
}: ChildCareSnapshotModalProps) {
  const { t } = useLanguage();
  const [notes, setNotes] = useState<ChildSpecialNote[]>(child.specialNotes);
  const [noteType, setNoteType] = useState<ChildNoteType>("Allergy");
  const [noteText, setNoteText] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNotes(child.specialNotes);
    setNoteType("Allergy");
    setNoteText("");
    setToast(null);
  }, [open, child.specialNotes]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    setNotes((prev) => [...prev, { id: `note-${Date.now()}`, type: noteType, text: noteText.trim() }]);
    setNoteText("");
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/45"
            onClick={onClose}
            aria-label="Close"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative w-full max-w-[390px] max-h-[94vh] bg-white border border-[#EAEAEA] rounded-t-3xl overflow-hidden flex flex-col"
          >
            <div className="w-10 h-1 bg-[#EAEAEA] rounded-full mx-auto mt-2.5 shrink-0" />

            <div className="flex items-start justify-between px-5 pt-3 pb-3 border-b border-[#EAEAEA] shrink-0">
              <div className="pr-3">
                <h2 className="text-lg font-bold text-[#111111]">{t("childSnapshot.title")}</h2>
                <p className="text-xs text-[#666666] mt-1">{t("childSnapshot.subtitle")}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => showToast(t("childSnapshot.editToast"))}
                  className="w-9 h-9 rounded-xl border border-[#EAEAEA] bg-[#FAFAF8] flex items-center justify-center"
                  aria-label={t("childSnapshot.edit")}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-xl border border-[#EAEAEA] bg-[#FAFAF8] flex items-center justify-center text-[#666666]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 pb-6">
              <div className="flex items-center gap-3 mt-4 p-3.5 bg-[#FAFAF8] border border-[#EAEAEA] rounded-2xl">
                <Avatar src={child.avatar} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#111111]">{child.preferredName ?? child.name}</p>
                  <p className="text-xs text-[#666666]">{child.age}</p>
                </div>
                <span className="text-[9px] font-bold bg-[#FFF8E7] border border-[#E0B23F] text-[#111111] px-2 py-1 rounded-full flex items-center gap-1 shrink-0">
                  <ShieldCheck size={11} className="text-[#E0B23F]" />
                  {t("childSnapshot.trustBadge")}
                </span>
              </div>

              <Section title={t("childSnapshot.basicInfo")} icon={Baby}>
                <InfoRow label={t("childSnapshot.name")} value={child.name} />
                <InfoRow label={t("childSnapshot.age")} value={child.age} />
                <InfoRow label={t("childSnapshot.dob")} value={child.dateOfBirth} />
                <InfoRow label={t("childSnapshot.gender")} value={child.gender} />
                <InfoRow label={t("childSnapshot.bloodType")} value={child.bloodType} />
                <InfoRow label={t("childSnapshot.preferredName")} value={child.preferredName ?? "—"} />
              </Section>

              <Section title={t("childSnapshot.healthSafety")} icon={HeartPulse} highlight>
                <InfoRow label={t("childSnapshot.allergies")} value={child.allergies.join(", ")} />
                <InfoRow label={t("childSnapshot.conditions")} value={child.conditions.join(", ")} />
                <InfoRow label={t("childSnapshot.medication")} value={child.medications.join(", ")} />
                <InfoRow label={t("childSnapshot.foodRestrictions")} value={child.foodRestrictions.join(", ")} />
                <InfoRow label={t("childSnapshot.doctorClinic")} value={child.doctorClinic} />
                <InfoRow label={t("childSnapshot.emergencyContact")} value={child.emergencyContact} />
                <div className="flex flex-wrap gap-2 mt-2">
                  {["Allergy", "Condition", "Medication", "Food restriction"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => showToast(t("childSnapshot.editToast"))}
                      className="text-[11px] font-semibold bg-[#FAFAF8] border border-[#EAEAEA] rounded-full px-2.5 py-1"
                    >
                      {label} · <span className="underline text-[#666666]">{t("childSnapshot.edit")}</span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section title={t("childSnapshot.specialNotes")} icon={Sparkles}>
                {notes.map((note) => (
                  <div key={note.id} className="bg-[#FAFAF8] border border-[#EAEAEA] rounded-xl p-2.5 mb-2">
                    <span className="text-[10px] font-bold bg-[#FFF8E7] px-2 py-0.5 rounded-full">{note.type}</span>
                    <p className="text-sm text-[#111111] mt-2 leading-relaxed">{note.text}</p>
                  </div>
                ))}
                <p className="text-xs font-semibold text-[#666666] mt-2 mb-2">{t("childSnapshot.noteType")}</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {CHILD_NOTE_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNoteType(type)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                        noteType === type
                          ? "bg-[#FFF8E7] border-[#E0B23F] text-[#111111]"
                          : "bg-[#FAFAF8] border-[#EAEAEA] text-[#666666]"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={t("childSnapshot.notePlaceholder")}
                  className="w-full min-h-[72px] bg-[#FAFAF8] border border-[#EAEAEA] rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                />
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className="w-full mt-2 py-2.5 rounded-xl bg-[#1A1A1A] text-white text-sm font-semibold"
                >
                  {t("childSnapshot.saveNote")}
                </button>
              </Section>

              <Section title={t("childSnapshot.dailyRoutine")}>
                <InfoRow label={t("childSnapshot.feeding")} value={child.routine.feeding} />
                <InfoRow label={t("childSnapshot.nap")} value={child.routine.nap} />
                <InfoRow label={t("childSnapshot.diaper")} value={child.routine.diaper} />
                <InfoRow label={t("childSnapshot.comfortMethod")} value={child.routine.comfortMethod} />
                <InfoRow label={t("childSnapshot.favoriteActivity")} value={child.routine.favoriteActivity} />
              </Section>

              <Section title={t("childSnapshot.carePreferences")}>
                <InfoRow label={t("childSnapshot.languages")} value={child.carePreferences.languages.join(" / ")} />
                <InfoRow label={t("childSnapshot.dailyReportLanguage")} value={child.carePreferences.dailyReportLanguage} />
                <InfoRow label={t("childSnapshot.updateTopics")} value={child.carePreferences.updateTopics.join(", ")} />
                <InfoRow label={t("childSnapshot.communicationStyle")} value={child.carePreferences.communicationStyle} />
                <InfoRow label={t("childSnapshot.reportFrequency")} value={child.carePreferences.reportFrequency} />
              </Section>

              <Section title={t("childSnapshot.authorizedPickup")}>
                {child.authorizedPickup.map((person) => (
                  <div key={person.name} className="flex items-center gap-2 mb-2">
                    <CheckCircle size={14} />
                    <span className="text-sm font-semibold">
                      {person.name} — {person.relationship}
                    </span>
                  </div>
                ))}
                <p className="text-xs text-[#666666] italic mt-1">{t("childSnapshot.pickupNotice")}</p>
              </Section>

              <div className="flex gap-2.5 mt-4 p-3.5 bg-[#FAFAF8] border border-[#EAEAEA] rounded-2xl">
                <ShieldCheck size={14} className="text-[#E0B23F] shrink-0 mt-0.5" />
                <p className="text-xs text-[#666666] leading-relaxed">{t("childSnapshot.privacyNotice")}</p>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => showToast(t("childSnapshot.editToast"))}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#EAEAEA] bg-[#FAFAF8] text-sm font-semibold"
                >
                  <Pencil size={14} />
                  {t("childSnapshot.editInfo")}
                </button>
                <button
                  type="button"
                  onClick={() => showToast(t("childSnapshot.shareToast"))}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#1A1A1A] text-white text-sm font-semibold"
                >
                  <Share2 size={14} />
                  {t("childSnapshot.shareCaregiver")}
                </button>
              </div>
            </div>

            {toast && (
              <div className="absolute bottom-5 left-5 right-5 flex items-center gap-2 bg-white border border-[#E0B23F] rounded-2xl px-3 py-2.5 shadow-lg">
                <CheckCircle size={14} className="text-[#E0B23F]" />
                <p className="text-xs font-semibold text-[#111111]">{toast}</p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Section({
  title,
  icon: Icon,
  highlight,
  children,
}: {
  title: string;
  icon?: typeof Baby;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`mt-4 border rounded-2xl p-3.5 ${
        highlight ? "bg-[#FFF8E7] border-[#EAEAEA]" : "bg-white border-[#EAEAEA]"
      }`}
    >
      <h3 className="text-sm font-bold text-[#111111] mb-2 flex items-center gap-1.5">
        {Icon && <Icon size={14} className={highlight ? "text-[#E0B23F]" : "text-[#111111]"} />}
        {title}
      </h3>
      {children}
    </div>
  );
}
