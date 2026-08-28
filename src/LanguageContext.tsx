import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppSettings } from "./context/AppSettingsContext";
import { createT, type Locale } from "./i18n";
import { resolveAppLocale } from "./types/profilePreferences";
import { ProfileRepository } from "./repositories/ProfileRepository";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: ReturnType<typeof createT>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { settings, ready, setSettings } = useAppSettings();
  const [locale, setLocaleState] = useState<Locale>("ko");
  const lastSyncedPreference = useRef(settings.account.language);

  useEffect(() => {
    if (!ready) return;
    const resolved = resolveAppLocale(settings.account.language);
    setLocaleState(resolved);
    if (lastSyncedPreference.current === settings.account.language) return;
    lastSyncedPreference.current = settings.account.language;
    // Best effort: local language changes must also drive recipient-specific server push copy.
    void ProfileRepository.syncPreferredLanguage(resolved).catch(() => undefined);
  }, [ready, settings.account.language]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(resolveAppLocale(next));
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
