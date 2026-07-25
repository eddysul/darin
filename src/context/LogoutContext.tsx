import { createContext, useContext, type ReactNode } from "react";

type LogoutFn = () => void | Promise<void>;

const LogoutContext = createContext<LogoutFn | null>(null);

export function LogoutProvider({
  onLogout,
  children,
}: {
  onLogout: LogoutFn;
  children: ReactNode;
}) {
  return <LogoutContext.Provider value={onLogout}>{children}</LogoutContext.Provider>;
}

export function useLogout(): LogoutFn {
  const ctx = useContext(LogoutContext);
  if (!ctx) throw new Error("useLogout must be used within LogoutProvider");
  return ctx;
}
