import React, { createContext, useContext, useState } from 'react';

type Role = 'family' | 'caregiver' | null;

interface AppContextType {
  role: Role;
  setRole: (role: Role) => void;
  matchedCaregiverId: string | null;
  setMatchedCaregiverId: (id: string | null) => void;
  familyId: string;
  caregiverId: string;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [matchedCaregiverId, setMatchedCaregiverId] = useState<string | null>(null);

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        matchedCaregiverId,
        setMatchedCaregiverId,
        familyId: 'family-001',
        caregiverId: 'caregiver-001',
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
