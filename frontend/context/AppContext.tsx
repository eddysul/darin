import React, { createContext, useContext, useState } from 'react';

type Role = 'family' | 'caregiver' | null;

export type BidStatus = 'pending' | 'interview_scheduled' | 'accepted' | 'rejected';

export type Bid = {
  id: string;
  caregiverId: string;
  caregiverName: string;
  caregiverAvatar: string;
  caregiverRole: string;
  parentId: number;
  price: string;
  message: string;
  status: BidStatus;
  submittedAt: string;
  interviewDate?: string;
};

interface AppContextType {
  role: Role;
  setRole: (role: Role) => void;
  familyId: string;
  caregiverId: string;
  bids: Bid[];
  addBid: (bid: Omit<Bid, 'id' | 'submittedAt' | 'status'>) => void;
  updateBid: (id: string, updates: Partial<Bid>) => void;
}

const MOCK_BIDS: Bid[] = [
  {
    id: 'bid-1',
    caregiverId: 'cg-1',
    caregiverName: 'Ji-yeon Park',
    caregiverAvatar: '👩‍⚕️',
    caregiverRole: 'Certified Nanny',
    parentId: 1,
    price: '$1,800/wk',
    message: 'I have 8 years of newborn care experience and am fully bilingual. I would love to support your family through this special time.',
    status: 'pending',
    submittedAt: '2h ago',
  },
  {
    id: 'bid-2',
    caregiverId: 'cg-2',
    caregiverName: 'Min-jun Lee',
    caregiverAvatar: '👨‍⚕️',
    caregiverRole: 'Postpartum Specialist',
    parentId: 1,
    price: '$2,100/wk',
    message: 'Certified postpartum specialist with 12 years of experience. I specialize in breastfeeding support and newborn sleep coaching.',
    status: 'pending',
    submittedAt: '5h ago',
  },
  {
    id: 'bid-3',
    caregiverId: 'cg-3',
    caregiverName: 'Sarah Kim',
    caregiverAvatar: '👩',
    caregiverRole: 'Bilingual Caregiver',
    parentId: 1,
    price: '$1,650/wk',
    message: 'Korean-American caregiver fluent in both languages. CPR certified, non-smoker, and experienced with twins and newborns.',
    status: 'interview_scheduled',
    submittedAt: '1d ago',
    interviewDate: 'Jun 22, 2026 · 2:00 PM',
  },
];

const AppContext = createContext<AppContextType>({} as AppContextType);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [bids, setBids] = useState<Bid[]>(MOCK_BIDS);

  function addBid(bid: Omit<Bid, 'id' | 'submittedAt' | 'status'>) {
    setBids((prev) => [
      { ...bid, id: `bid-${Date.now()}`, submittedAt: 'Just now', status: 'pending' },
      ...prev,
    ]);
  }

  function updateBid(id: string, updates: Partial<Bid>) {
    setBids((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }

  return (
    <AppContext.Provider value={{ role, setRole, familyId: 'family-001', caregiverId: 'caregiver-001', bids, addBid, updateBid }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
