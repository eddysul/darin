import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../LanguageContext";

export type UserProfile = {
  name: string;
  location: string;
  avatar: string;
};

type ProfileEditModalProps = {
  open: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
};

export function ProfileEditModal({ open, profile, onClose, onSave }: ProfileEditModalProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(profile);

  useEffect(() => {
    if (open) setDraft(profile);
  }, [open, profile]);

  const handleSave = () => {
    if (!draft.name.trim()) return;
    onSave({ ...draft, name: draft.name.trim(), location: draft.location.trim() });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[300px] bg-card rounded-2xl border border-border shadow-xl p-4"
          >
            <p className="text-sm font-bold text-foreground mb-4">{t("profile.editTitle")}</p>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">{t("profile.name")}</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={t("profile.namePlaceholder")}
                  className="w-full bg-input-background rounded-xl px-3 py-2.5 text-sm border-0 outline-none text-foreground placeholder:text-muted-foreground"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">{t("profile.location")}</span>
                <input
                  type="text"
                  value={draft.location}
                  onChange={(e) => setDraft((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder={t("profile.locationPlaceholder")}
                  className="w-full bg-input-background rounded-xl px-3 py-2.5 text-sm border-0 outline-none text-foreground placeholder:text-muted-foreground"
                />
              </label>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-secondary text-muted-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {t("profile.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {t("profile.save")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
