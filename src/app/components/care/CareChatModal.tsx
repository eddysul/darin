import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle,
  Globe,
  Send,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import {
  AI_DRAFT_MESSAGE,
  AI_SUGGESTED_MESSAGE,
  AI_TRANSLATE_DEMO,
  INITIAL_CHAT_MESSAGES,
} from "../../demo/careFlow";
import { CAREGIVER_MATCHES } from "../../demo/caregivers";
import { useCareFlow } from "../../context/CareFlowContext";
import type { ChatMessage } from "../../types/careFlow";
import { useLanguage } from "../../LanguageContext";

type CareChatModalProps = {
  open: boolean;
  caregiverId: number | null;
  onClose: () => void;
  onViewCarePlan: () => void;
  onGoHome: () => void;
};

function Avatar({ src, size = 32 }: { src: string; size?: number }) {
  return (
    <img
      src={`https://images.unsplash.com/${src}?w=${size * 2}&h=${size * 2}&fit=crop&auto=format`}
      alt=""
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

const SUGGESTION_CHIPS = [
  "chat.chipInfant",
  "chat.chipNap",
  "chat.chipBackground",
  "chat.chipTrial",
  "chat.chipReports",
] as const;

export function CareChatModal({ open, caregiverId, onClose, onViewCarePlan, onGoHome }: CareChatModalProps) {
  const { locale, t } = useLanguage();
  const { matchStatus, confirmParentMatch, simulateCaregiverConfirm, activeRelationship } = useCareFlow();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [input, setInput] = useState("");
  const [translatePreview, setTranslatePreview] = useState<string | null>(null);

  const caregiver = CAREGIVER_MATCHES.find((c) => c.id === caregiverId) ?? CAREGIVER_MATCHES[0];

  useEffect(() => {
    if (!open) return;
    setMessages(INITIAL_CHAT_MESSAGES);
    setInput("");
    setTranslatePreview(null);
  }, [open, caregiverId]);

  if (!open) return null;

  const suggestedMessage = locale === "ko" ? AI_SUGGESTED_MESSAGE.ko : AI_SUGGESTED_MESSAGE.en;
  const isConfirmed = matchStatus === "confirmed" && activeRelationship;

  const appendMessage = (role: "parent" | "caregiver", textEn: string, textKo: string) => {
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), role, textEn, textKo },
    ]);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    appendMessage("parent", input.trim(), input.trim());
    setInput("");
    setTranslatePreview(null);
  };

  const handleDraftAI = () => {
    setInput(locale === "ko" ? AI_DRAFT_MESSAGE.ko : AI_DRAFT_MESSAGE.en);
  };

  const handleTranslate = () => {
    setInput(AI_TRANSLATE_DEMO.inputKo);
    setTranslatePreview(AI_TRANSLATE_DEMO.outputEn);
  };

  const handleChip = (key: typeof SUGGESTION_CHIPS[number]) => {
    setInput(t(key));
  };

  const handleInsertSuggested = () => {
    setInput(suggestedMessage);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white">
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-[#EAEAEA] shrink-0">
        <Avatar src={caregiver.img} size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{caregiver.name}</p>
          <p className="text-xs text-muted-foreground">
            {activeRelationship?.chatSaved ? t("chat.savedChat") : t("chat.negotiationSpace")}
          </p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[#FAFAF8]">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          const text = locale === "ko" ? msg.textKo : msg.textEn;
          if (msg.role === "ai") {
            return (
              <div key={msg.id} className="bg-[#FFF8E7] border border-[#EAEAEA] rounded-2xl p-3">
                <p className="text-xs font-semibold flex items-center gap-1 mb-1">
                  <Sparkles size={11} className="text-[#E0B23F]" />
                  Darin AI
                </p>
                <p className="text-xs text-foreground/85 leading-relaxed">{text}</p>
              </div>
            );
          }
          const isParent = msg.role === "parent";
          return (
            <div key={msg.id} className={`flex gap-2 ${isParent ? "justify-end" : "justify-start"}`}>
              {!isParent && <Avatar src={caregiver.img} size={28} />}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  isParent ? "bg-[#1A1A1A] text-white" : "bg-[#FAFAF8] border border-[#EAEAEA] text-foreground"
                }`}
              >
                {text}
              </div>
            </div>
          );
        })}

        {!isConfirmed && (
          <div className="bg-[#FAFAF8] border border-[#EAEAEA] rounded-2xl p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">{t("chat.suggestedMessage")}</p>
            <p className="text-sm italic text-foreground/85">&ldquo;{suggestedMessage}&rdquo;</p>
            <button
              type="button"
              onClick={handleInsertSuggested}
              className="mt-2 text-xs font-semibold text-[#111111] underline"
            >
              {t("chat.useSuggestion")}
            </button>
          </div>
        )}

        {matchStatus === "parent_pending" && !isConfirmed && (
          <div className="bg-[#FFF8E7] border border-[#E0B23F] rounded-2xl p-4 text-center">
            <CheckCircle size={24} className="mx-auto text-[#E0B23F] mb-2" />
            <p className="font-bold text-sm">{t("chat.parentConfirmed")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("chat.waitingCaregiver")}</p>
            <button
              type="button"
              onClick={simulateCaregiverConfirm}
              className="mt-3 w-full py-2.5 rounded-xl border border-[#EAEAEA] bg-white text-xs font-semibold"
            >
              {t("chat.simulateCaregiver")}
            </button>
          </div>
        )}

        {isConfirmed && activeRelationship && (
          <div className="bg-white border-2 border-[#E0B23F] rounded-3xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-[#E0B23F]" />
              <p className="font-bold">{t("chat.matchConfirmedTitle")}</p>
            </div>
            <p className="text-sm font-semibold">
              {caregiver.name} ↔ {t("chat.emmaFamily")}
            </p>
            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <p><span className="font-semibold text-foreground">{t("chat.schedule")}:</span> {activeRelationship.schedule}</p>
              <p><span className="font-semibold text-foreground">{t("chat.rate")}:</span> {activeRelationship.rate}</p>
              <p><span className="font-semibold text-foreground">{t("chat.startDate")}:</span> {activeRelationship.startDate}</p>
              <p><span className="font-semibold text-foreground">{t("chat.carePlan")}:</span> {activeRelationship.careNeeds.join(", ")}</p>
              <p><span className="font-semibold text-foreground">{t("chat.status")}:</span> {t("chat.chatSaved")}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 mt-4">
              <button type="button" onClick={onClose} className="py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
                {t("chat.goActiveChat")}
              </button>
              <button type="button" onClick={onViewCarePlan} className="py-2.5 rounded-xl border border-[#EAEAEA] text-xs font-semibold">
                {t("chat.viewCarePlan")}
              </button>
              <button type="button" onClick={onGoHome} className="py-2.5 rounded-xl border border-[#EAEAEA] text-xs font-semibold">
                {t("chat.startDailyReports")}
              </button>
            </div>
          </div>
        )}
      </div>

      {!isConfirmed && (
        <div className="shrink-0 border-t border-[#EAEAEA] p-4 pb-8 bg-white">
          <div className="flex gap-1.5 flex-wrap mb-3">
            {SUGGESTION_CHIPS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleChip(key)}
                className="text-[10px] font-semibold bg-[#FAFAF8] border border-[#EAEAEA] px-2.5 py-1 rounded-full hover:bg-[#FFF8E7]"
              >
                {t(key)}
              </button>
            ))}
          </div>

          {translatePreview && (
            <div className="mb-2 p-2.5 bg-[#FFF8E7] rounded-xl text-xs">
              <span className="font-semibold">{t("chat.translated")}: </span>
              {translatePreview}
            </div>
          )}

          <div className="flex gap-2 mb-3">
            <button type="button" onClick={handleDraftAI} className="flex-1 py-2 rounded-xl border border-[#EAEAEA] text-[11px] font-semibold flex items-center justify-center gap-1">
              <Wand2 size={12} />
              {t("chat.draftAI")}
            </button>
            <button type="button" onClick={handleTranslate} className="flex-1 py-2 rounded-xl border border-[#EAEAEA] text-[11px] font-semibold flex items-center justify-center gap-1">
              <Globe size={12} />
              {t("chat.translate")}
            </button>
            <button type="button" className="flex-1 py-2 rounded-xl border border-[#EAEAEA] text-[11px] font-semibold flex items-center justify-center gap-1">
              <Calendar size={12} />
              {t("chat.scheduleTrial")}
            </button>
          </div>

          <div className="flex gap-2">
            <input
              className="flex-1 bg-[#FAFAF8] border border-[#EAEAEA] rounded-xl px-3 py-2.5 text-sm outline-none"
              placeholder={t("chat.placeholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button type="button" onClick={handleSend} className="p-2.5 rounded-xl bg-[#1A1A1A] text-white">
              <Send size={16} />
            </button>
          </div>

          {matchStatus === "none" && (
            <button
              type="button"
              onClick={confirmParentMatch}
              className="w-full mt-3 py-3 rounded-xl bg-[#FFF8E7] border border-[#E0B23F] text-sm font-bold text-[#111111]"
            >
              {t("chat.confirmMatch")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
