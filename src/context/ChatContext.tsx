import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { INITIAL_CHAT_MESSAGES } from "../demo/careFlow";
import { CAREGIVER_MATCHES } from "../demo/caregivers";
import type { ChatMessage } from "../types/careFlow";

export type ChatThread = {
  caregiverId: number;
  messages: ChatMessage[];
  updatedAtEn: string;
  updatedAtKo: string;
  savedChat?: boolean;
};

function previewFromMessages(messages: ChatMessage[], locale: "en" | "ko") {
  const last = [...messages].reverse().find((m) => m.role !== "ai");
  if (!last) return locale === "ko" ? "새 대화" : "New conversation";
  const text = locale === "ko" ? last.textKo : last.textEn;
  return text.length > 52 ? `${text.slice(0, 52)}…` : text;
}

function buildInitialThreads(): ChatThread[] {
  return [
    {
      caregiverId: 1,
      messages: INITIAL_CHAT_MESSAGES,
      updatedAtEn: "2:41 PM",
      updatedAtKo: "오후 2:41",
    },
    {
      caregiverId: 2,
      messages: [
        {
          id: "s1",
          role: "parent" as const,
          textEn: "Hi Sarah, are you available this weekend?",
          textKo: "Sarah님, 이번 주말 가능하신가요?",
        },
        {
          id: "s2",
          role: "caregiver" as const,
          textEn: "Yes, Saturday afternoon works for me.",
          textKo: "네, 토요일 오후 가능합니다.",
        },
      ],
      updatedAtEn: "Yesterday",
      updatedAtKo: "어제",
    },
    {
      caregiverId: 3,
      messages: [
        {
          id: "m1",
          role: "caregiver" as const,
          textEn: "I can support evening or weekend care if needed.",
          textKo: "필요하시면 저녁이나 주말 돌봄도 가능합니다.",
        },
      ],
      updatedAtEn: "Mon",
      updatedAtKo: "월",
    },
  ].filter((t) => CAREGIVER_MATCHES.some((c) => c.id === t.caregiverId));
}

type ChatContextValue = {
  threads: ChatThread[];
  getThread: (caregiverId: number) => ChatThread | undefined;
  sendMessage: (caregiverId: number, textEn: string, textKo: string) => void;
  getPreview: (caregiverId: number, locale: "en" | "ko") => string;
  markThreadSaved: (caregiverId: number) => void;
  ensureProposalThread: (caregiverId: number) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useState<ChatThread[]>(buildInitialThreads);

  const getThread = useCallback(
    (caregiverId: number) => threads.find((t) => t.caregiverId === caregiverId),
    [threads],
  );

  const sendMessage = useCallback((caregiverId: number, textEn: string, textKo: string) => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    const updatedAtEn = `${h12}:${minutes} ${ampm}`;
    const updatedAtKo = `${hours >= 12 ? "오후" : "오전"} ${h12}:${minutes}`;

    const newMsg: ChatMessage = {
      id: String(Date.now()),
      role: "parent",
      textEn,
      textKo,
    };

    setThreads((prev) => {
      const existing = prev.find((t) => t.caregiverId === caregiverId);
      let next: ChatThread[];

      if (existing) {
        next = prev.map((t) =>
          t.caregiverId === caregiverId
            ? {
                ...t,
                messages: [...t.messages, newMsg],
                updatedAtEn,
                updatedAtKo,
              }
            : t,
        );
      } else {
        next = [
          {
            caregiverId,
            messages: [newMsg],
            updatedAtEn,
            updatedAtKo,
          },
          ...prev,
        ];
      }

      const active = next.find((t) => t.caregiverId === caregiverId)!;
      return [active, ...next.filter((t) => t.caregiverId !== caregiverId)];
    });
  }, []);

  const getPreview = useCallback(
    (caregiverId: number, locale: "en" | "ko") => {
      const thread = threads.find((t) => t.caregiverId === caregiverId);
      if (!thread) return locale === "ko" ? "새 대화" : "New conversation";
      return previewFromMessages(thread.messages, locale);
    },
    [threads],
  );

  const markThreadSaved = useCallback((caregiverId: number) => {
    setThreads((prev) =>
      prev.map((t) => (t.caregiverId === caregiverId ? { ...t, savedChat: true } : t)),
    );
  }, []);

  const ensureProposalThread = useCallback((caregiverId: number) => {
    setThreads((prev) => {
      if (prev.some((t) => t.caregiverId === caregiverId)) return prev;
      const seed =
        caregiverId === 1
          ? INITIAL_CHAT_MESSAGES
          : [
              {
                id: `p-${caregiverId}`,
                role: "caregiver" as const,
                textEn: "Thank you for reviewing my Care Proposal. Happy to answer any questions.",
                textKo: "돌봄 제안을 검토해 주셔서 감사합니다. 궁금한 점이 있으면 편하게 물어보세요.",
              },
            ];
      return [
        {
          caregiverId,
          messages: seed,
          updatedAtEn: "Now",
          updatedAtKo: "방금",
        },
        ...prev,
      ];
    });
  }, []);

  const value = useMemo(
    () => ({ threads, getThread, sendMessage, getPreview, markThreadSaved, ensureProposalThread }),
    [threads, getThread, sendMessage, getPreview, markThreadSaved, ensureProposalThread],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
