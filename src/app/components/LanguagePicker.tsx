import { Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../LanguageContext";
import type { Locale } from "../i18n";

type LanguagePickerProps = {
  open: boolean;
  onClose: () => void;
};

const OPTIONS: { locale: Locale; labelKey: "langPicker.english" | "langPicker.korean" }[] = [
  { locale: "en", labelKey: "langPicker.english" },
  { locale: "ko", labelKey: "langPicker.korean" },
];

export function LanguagePicker({ open, onClose }: LanguagePickerProps) {
  const { locale, setLocale, t } = useLanguage();

  const handleSelect = (next: Locale) => {
    setLocale(next);
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
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[280px] bg-card rounded-2xl border border-border shadow-xl p-4"
          >
            <p className="text-sm font-bold text-foreground mb-3">{t("langPicker.title")}</p>
            <div className="flex flex-col gap-1.5">
              {OPTIONS.map(({ locale: opt, labelKey }) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`flex items-center justify-between w-full px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    locale === opt
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  {t(labelKey)}
                  {locale === opt && <Check size={16} strokeWidth={2.5} />}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
