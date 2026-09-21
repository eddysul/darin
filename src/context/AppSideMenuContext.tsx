import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type AppSideMenuValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const AppSideMenuContext = createContext<AppSideMenuValue | null>(null);

export function AppSideMenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ isOpen, open, close }), [close, isOpen, open]);
  return <AppSideMenuContext.Provider value={value}>{children}</AppSideMenuContext.Provider>;
}

export function useAppSideMenu() {
  const value = useContext(AppSideMenuContext);
  if (!value) {
    return {
      isOpen: false,
      open: () => undefined,
      close: () => undefined,
    };
  }
  return value;
}
