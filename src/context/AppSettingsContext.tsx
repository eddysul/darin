import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppSettings } from "../types/appSettings";
import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from "../types/appSettings";
import {
  getAppSettings,
  hydrateAppSettings,
  resetAppSettings,
  saveAppSettings,
} from "../utils/appSettingsStore";

type AppSettingsContextValue = {
  settings: AppSettings;
  ready: boolean;
  setSettings: (next: AppSettings | ((current: AppSettings) => AppSettings)) => void;
  resetSettings: () => Promise<void>;
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<AppSettings>(() =>
    normalizeAppSettings(DEFAULT_APP_SETTINGS),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void hydrateAppSettings().then(() => {
      setSettingsState(getAppSettings());
      setReady(true);
    });
  }, []);

  const setSettings = useCallback(
    (next: AppSettings | ((current: AppSettings) => AppSettings)) => {
      setSettingsState((current) => {
        const normalized = normalizeAppSettings(
          typeof next === "function" ? next(current) : next,
        );
        void saveAppSettings(normalized);
        return normalized;
      });
    },
    [],
  );

  const resetSettings = useCallback(async () => {
    await resetAppSettings();
    setSettingsState(getAppSettings());
  }, []);

  const value = useMemo(
    () => ({ settings, ready, setSettings, resetSettings }),
    [ready, resetSettings, setSettings, settings],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const value = useContext(AppSettingsContext);
  if (!value) throw new Error("useAppSettings must be used within AppSettingsProvider");
  return value;
}
