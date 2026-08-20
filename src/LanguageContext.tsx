import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAppSettings } from "./context/AppSettingsContext";
import { createT, type Locale } from "./i18n";
import { resolveAppLocale } from "./types/profilePreferences";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: ReturnType<typeof createT>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { settings, ready, setSettings } = useAppSettings();
  const [locale, setLocaleState] = useState<Locale>("ko");

  useEffect(() => {
    if (!ready) return;
    setLocaleState(resolveAppLocale(settings.account.language));
  }, [ready, settings.account.language]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setSettings((current) => current.account.language === next
      ? current
      : { ...current, account: { ...current.account, language: next } });
  }, [setSettings]);
  const t = useMemo(() => createT(locale), [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
