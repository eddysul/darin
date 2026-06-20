import { useState, useCallback } from "react";
import {
  Home,
  FileText,
  Mic,
  Search,
  User,
  Star,
  MapPin,
  Clock,
  MessageCircle,
  ChevronRight,
  Heart,
  Utensils,
  Moon,
  Activity,
  Thermometer,
  Bell,
  Plus,
  Send,
  Play,
  Pause,
  Globe,
  Calendar,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Baby,
  Settings as SettingsIcon,
  CreditCard,
  UserCog,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import { LanguagePicker } from "./components/LanguagePicker";
import { ProfileEditModal } from "./components/ProfileEditModal";
import { SplashScreen } from "./components/SplashScreen";
import { LoginScreen } from "./components/LoginScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import type { UserProfile } from "./types/profile";
import type { DailyReport } from "./types/dailyReport";
import { generateDailyReport, DEMO_VOICE_TRANSCRIPT } from "./demo/dailyReport";
import { CAREGIVER_MATCHES } from "./demo/caregivers";
import { PARENTS } from "./demo/parents";
import type { ParentProfile } from "./demo/parents";
import type { Bid, BidStatus } from "./types/bid";

const MOCK_BIDS: Bid[] = [
  { id: "b1", caregiverId: "cg1", caregiverName: "Ji-yeon Park", caregiverAvatar: "photo-1544005313-94ddf0286df2", caregiverRole: "Postpartum Specialist", parentId: 1, price: "$1,800/wk", message: "I have 8 years of experience with newborns and am CPR certified. I speak both Korean and English fluently.", status: "pending", submittedAt: "2 hours ago" },
  { id: "b2", caregiverId: "cg2", caregiverName: "Sarah Kim", caregiverAvatar: "photo-1438761681033-6461ffad8d80", caregiverRole: "Certified Nanny", parentId: 1, price: "$1,600/wk", message: "Breastfeeding coach certified. I'd love to support your family through this special time.", status: "interview_scheduled", submittedAt: "Yesterday", interviewDate: "Jun 25, 2026 · 2:00 PM" },
  { id: "b3", caregiverId: "cg3", caregiverName: "Min-jun Lee", caregiverAvatar: "photo-1472099645785-5658abf4ff4e", caregiverRole: "Postpartum Specialist", parentId: 1, price: "$2,000/wk", message: "Licensed specialist with expertise in traditional Korean postpartum care. Live-in available.", status: "pending", submittedAt: "3 days ago" },
];

type AppPhase = "splash" | "login" | "onboarding" | "main";

function getDevPreviewPhase(): AppPhase | null {
  if (!import.meta.env.DEV) return null;
  const screen = new URLSearchParams(window.location.search).get("screen");
  if (screen === "caregiver-onboarding" || screen === "parent-onboarding" || screen === "onboarding") {
    return "onboarding";
  }
  return null;
}

function getOnboardingPreview() {
  const screen = new URLSearchParams(window.location.search).get("screen");
  if (screen === "caregiver-onboarding") {
    return { initialRole: "caregiver" as const, initialStep: "profile" as const };
  }
  if (screen === "parent-onboarding") {
    return { initialRole: "parent" as const, initialStep: "profile" as const };
  }
  return { initialRole: undefined, initialStep: undefined };
}
import {
  getLogEntries,
  getCaregiverRole,
} from "./i18n";

type Tab = "home" | "report" | "log" | "match" | "profile";

const DEFAULT_PROFILE: UserProfile = {
  name: "Jisoo Kim",
  location: "Seoul, Korea",
  avatar: "photo-1438761681033-6461ffad8d80",
  role: "parent",
  languages: "Korean, English",
};

const REPORT_ITEM_META: Record<
  DailyReport["items"][number]["type"],
  { icon: typeof Utensils; color: string; bg: string }
> = {
  meal: { icon: Utensils, color: "text-[#B8860B]", bg: "bg-[#FFF4D8]" },
  nap: { icon: Moon, color: "text-[#6B7FA8]", bg: "bg-[#F0F3FA]" },
  activity: { icon: Activity, color: "text-[#6B9080]", bg: "bg-[#EEF5F0]" },
  health: { icon: Thermometer, color: "text-[#A67C52]", bg: "bg-[#FFF4D8]" },
  reminder: { icon: Bell, color: "text-[#D9A441]", bg: "bg-[#FFF9EB]" },
};

function Avatar({ src, size = 40, className = "" }: { src: string; size?: number; className?: string }) {
  return (
    <img
      src={`https://images.unsplash.com/${src}?w=${size * 2}&h=${size * 2}&fit=crop&auto=format`}
      alt="avatar"
      className={`rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

function HomeTab({ profile, dailyReport, pendingBids, onOpenBids }: { profile: UserProfile; dailyReport: DailyReport | null; pendingBids: number; onOpenBids: () => void }) {
  const { locale, t } = useLanguage();
  const firstName = profile.name.split(" ")[0];
  const reportPreview = dailyReport
    ? locale === "ko"
      ? dailyReport.reportKo
      : dailyReport.reportEn
    : null;
  const replyDraft = dailyReport?.parentReplyDraft ?? t("home.draftText");

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div
        className="rounded-3xl mx-4 mt-4 p-5 relative overflow-hidden border border-border"
        style={{ background: "linear-gradient(135deg, #FFF4D8 0%, #FFFDF7 55%, #FFFFFF 100%)" }}
      >
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-[#F4D58D]/20" />
        <div className="flex items-center justify-between relative">
          <div>
            <p className="text-muted-foreground text-sm font-medium">{t("home.greeting")}</p>
            <h1 className="text-2xl font-bold mt-0.5 text-foreground" style={{ fontFamily: "Nunito, sans-serif" }}>
              {firstName} 👋
            </h1>
          </div>
          <Avatar src={profile.avatar} size={48} className="ring-2 ring-[#F4D58D]/50" />
        </div>
        <div className="mt-4 bg-white/70 rounded-2xl p-3 flex items-center gap-3 border border-border">
          <div className="bg-[#FFF4D8] rounded-xl p-2">
            <Baby size={20} className="text-[#B8860B]" />
          </div>
          <div className="flex-1">
            <p className="text-muted-foreground text-xs">{t("home.emmaWith")}</p>
            <p className="text-foreground font-semibold text-sm">
              Ji-yeon Park · {t("home.until")}
            </p>
          </div>
          <CheckCircle size={18} className="text-[#6B9080]" />
        </div>
      </div>

      {/* Bids card — parents only */}
      {profile.role === "parent" && (
        <button type="button" onClick={onOpenBids} className="mx-4 bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow w-full text-left">
          <div className="w-11 h-11 rounded-xl bg-[#FFF9EB] flex items-center justify-center">
            <span className="text-xl">⚖️</span>
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">{locale === "ko" ? "받은 입찰" : "Bids Received"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{locale === "ko" ? `케어기버 3명 · 신규 ${pendingBids}건` : `3 caregivers · ${pendingBids} new`}</p>
          </div>
          {pendingBids > 0 && <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{pendingBids}</span>}
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      )}

      <div className="mx-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground" style={{ fontFamily: "Nunito, sans-serif" }}>
            {t("home.todaysReport")}
          </h2>
          {dailyReport && (
            <span className="text-xs font-semibold text-[#B8860B] bg-[#FFF4D8] px-2.5 py-1 rounded-full flex items-center gap-1">
              <Sparkles size={11} />
              {t("report.aiTranslated")}
            </span>
          )}
        </div>
        <div className="bg-card rounded-3xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Avatar src="photo-1544005313-94ddf0286df2" size={36} />
            <div>
              <p className="text-xs text-muted-foreground">{t("home.from")}</p>
              <p className="text-sm font-semibold">
                {dailyReport ? `${dailyReport.date} · ${dailyReport.savedAt}` : "June 20 · 5:42 PM"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1 bg-[#FFF4D8] text-[#B8860B] text-xs rounded-full px-2.5 py-1 font-semibold">
              <Sparkles size={11} />
              AI
            </div>
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed">
            {reportPreview ??
              (locale === "ko"
                ? "Emma는 오늘 좋은 하루를 보냈습니다. Log 탭에서 음성 메모를 추가하고 일일 리포트를 생성해 보세요."
                : "Generate a daily report from the Log tab to see Emma's AI-translated update here.")}
          </p>
          {dailyReport && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {dailyReport.items.slice(0, 3).map((item) => (
                <span
                  key={item.type}
                  className="text-xs rounded-full px-2.5 py-1 font-medium bg-secondary text-muted-foreground"
                >
                  {item.label}
                </span>
              ))}
              {dailyReport.items.some((i) => i.type === "health") && (
                <span className="text-xs rounded-full px-2.5 py-1 font-medium bg-[#FFF4D8] text-[#A67C52]">
                  {t("home.tagCough")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-4">
        <h2 className="font-bold text-foreground mb-3" style={{ fontFamily: "Nunito, sans-serif" }}>
          {t("home.quickActions")}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: MessageCircle, label: t("home.messageNanny"), color: "bg-[#F0F3FA] text-[#6B7FA8]" },
            { icon: Calendar, label: t("home.schedulePickup"), color: "bg-[#FFF4D8] text-[#B8860B]" },
            { icon: Globe, label: t("home.translateReport"), color: "bg-[#EEF5F0] text-[#6B9080]" },
            { icon: FileText, label: t("home.viewHistory"), color: "bg-[#FFF9EB] text-[#D9A441]" },
          ].map(({ icon: Icon, label, color }) => (
            <button
              key={label}
              className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow text-left"
            >
              <div className={`${color} rounded-xl p-2`}>
                <Icon size={18} />
              </div>
              <span className="text-sm font-semibold text-foreground leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mx-4">
        <h2 className="font-bold text-foreground mb-3" style={{ fontFamily: "Nunito, sans-serif" }}>
          {t("home.aiDraftReply")}
        </h2>
        <div className="bg-card border border-border rounded-3xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles size={11} className="text-[#D9A441]" />
            {t("home.suggestedMessage")}
          </p>
          <p className="text-sm text-foreground/85 leading-relaxed italic">
            &ldquo;{replyDraft}&rdquo;
          </p>
          <div className="flex gap-2 mt-3">
            <button className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <Send size={14} />
              {t("home.send")}
            </button>
            <button className="px-4 bg-secondary text-muted-foreground rounded-xl py-2 text-sm font-semibold">
              {t("home.edit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportTab({ dailyReport }: { dailyReport: DailyReport | null }) {
  const [expanded, setExpanded] = useState(true);
  const { locale, t } = useLanguage();

  const historyDates = ["June 20", "June 19", "June 18"];

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="mx-4 mt-4">
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Nunito, sans-serif" }}>
          {t("report.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("report.subtitle")}</p>
      </div>

      {historyDates.map((date, i) => {
        const isToday = i === 0;
        const report = isToday && dailyReport ? dailyReport : null;

        return (
          <div key={date} className="mx-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground">{date}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div
              className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm cursor-pointer"
              onClick={() => isToday && setExpanded(!expanded)}
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar src="photo-1544005313-94ddf0286df2" size={36} />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Ji-yeon Park</p>
                    <p className="text-xs text-muted-foreground">
                      {report ? `${t("report.submitted")} · ${report.savedAt}` : t("report.submitted")}
                    </p>
                  </div>
                  {isToday && report && (
                    <span className="bg-[#FFF4D8] text-[#B8860B] text-xs rounded-full px-2.5 py-1 font-semibold flex items-center gap-1">
                      <Sparkles size={11} />
                      {t("report.fromLog")}
                    </span>
                  )}
                  {isToday && !report && (
                    <span className="bg-secondary text-muted-foreground text-xs rounded-full px-2.5 py-1 font-medium">
                      {t("log.useVoiceOrNotes")}
                    </span>
                  )}
                </div>

                {report ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {report.items.slice(0, 3).map((item) => {
                        const meta = REPORT_ITEM_META[item.type];
                        const Icon = meta.icon;
                        return (
                          <div key={item.type} className={`${meta.bg} rounded-2xl p-2.5 flex flex-col items-center gap-1`}>
                            <Icon size={16} className={meta.color} />
                            <span className={`text-xs font-semibold ${meta.color}`}>{item.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    {expanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-3">
                        <p className="text-sm text-foreground/85 leading-relaxed">
                          {locale === "ko" ? report.reportKo : report.reportEn}
                        </p>
                        <div className="flex flex-col gap-2">
                          {report.items.map((item) => {
                            const meta = REPORT_ITEM_META[item.type];
                            const Icon = meta.icon;
                            return (
                              <div key={item.type} className="flex items-start gap-3">
                                <div className={`${meta.bg} rounded-xl p-1.5 mt-0.5`}>
                                  <Icon size={14} className={meta.color} />
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
                                  <p className="text-sm">{item.value}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="bg-[#FFF9EB] border border-[#EFE4CF] rounded-2xl p-3 flex items-start gap-2">
                          <Globe size={14} className="text-[#D9A441] mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-[#B8860B] mb-1">{t("report.aiTranslated")}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{report.reportKo}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {locale === "ko"
                      ? "이전 날짜 리포트입니다. 오늘 리포트는 Log 탭에서 생성할 수 있습니다."
                      : "Past report summary. Generate today's report from the Log tab."}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogTab({
  dailyReport,
  onSaveReport,
}: {
  dailyReport: DailyReport | null;
  onSaveReport: (report: DailyReport) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [inputText, setInputText] = useState("");
  const [generated, setGenerated] = useState<DailyReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const { locale, t } = useLanguage();
  const logEntries = getLogEntries(locale);

  const handleVoiceToggle = () => {
    if (isRecording) {
      setIsRecording(false);
      setVoiceTranscript(DEMO_VOICE_TRANSCRIPT);
    } else {
      setIsRecording(true);
      setVoiceTranscript("");
    }
  };

  const handleGenerate = () => {
    const source = [voiceTranscript, inputText].filter(Boolean).join("\n\n");
    if (!source.trim()) return;

    setIsGenerating(true);
    setSaved(false);
    window.setTimeout(() => {
      const report = generateDailyReport(source);
      setGenerated(report);
      setIsGenerating(false);
    }, 900);
  };

  const handleSave = () => {
    if (!generated) return;
    onSaveReport(generated);
    setSaved(true);
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="mx-4 mt-4">
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Nunito, sans-serif" }}>
          {t("log.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("log.subtitle")}</p>
      </div>

      <div className="mx-4 bg-card border border-border rounded-3xl p-4 shadow-sm">
        <p className="text-sm font-semibold mb-3">{t("log.voiceNote")}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleVoiceToggle}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isRecording
                ? "bg-[#243036] shadow-lg scale-110"
                : "bg-primary shadow-md shadow-primary/20"
            }`}
          >
            {isRecording ? (
              <Pause size={22} className="text-[#FFF4D8]" />
            ) : (
              <Mic size={22} className="text-primary-foreground" />
            )}
          </button>
          <div className="flex-1">
            {isRecording ? (
              <div>
                <p className="text-sm font-semibold text-foreground">{t("log.recording")}</p>
                <div className="flex gap-0.5 mt-1.5 items-end h-6">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-[#F4D58D] rounded-full"
                      style={{ height: `${30 + (i % 5) * 14}%` }}
                    />
                  ))}
                </div>
              </div>
            ) : voiceTranscript ? (
              <div>
                <p className="text-xs font-semibold text-[#B8860B] mb-1">{t("log.transcriptReady")}</p>
                <p className="text-sm text-foreground/85 leading-relaxed">{voiceTranscript}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold">{t("log.tapToRecord")}</p>
                <p className="text-xs text-muted-foreground">{t("log.autoTranscribed")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-4 bg-card border border-border rounded-3xl p-4 shadow-sm">
        <p className="text-sm font-semibold mb-1">{t("log.quickNotes")}</p>
        <p className="text-xs text-muted-foreground mb-2">{t("log.autoTranscribed")}</p>
        <textarea
          className="w-full bg-input-background rounded-2xl p-3 text-sm resize-none border border-border outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
          rows={3}
          placeholder={t("log.placeholder")}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || (!voiceTranscript && !inputText.trim())}
          className="mt-3 w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Sparkles size={15} />
          {isGenerating ? t("log.generating") : t("log.generateReport")}
        </button>
      </div>

      <AnimatePresence>
        {(generated || isGenerating) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mx-4 flex flex-col gap-3"
          >
            {isGenerating ? (
              <div className="bg-card border border-border rounded-3xl p-6 text-center">
                <Sparkles size={24} className="text-[#D9A441] mx-auto mb-2 animate-pulse" />
                <p className="text-sm font-semibold">{t("log.generating")}</p>
              </div>
            ) : generated && (
              <>
                {[
                  { title: t("log.originalNote"), body: generated.sourceNote },
                  { title: t("log.aiReportEn"), body: generated.reportEn },
                  { title: t("log.aiReportKo"), body: generated.reportKo },
                  { title: t("log.parentReplyDraft"), body: generated.parentReplyDraft, italic: true },
                ].map((section) => (
                  <div key={section.title} className="bg-card border border-border rounded-3xl p-4 shadow-sm">
                    <p className="text-xs font-semibold text-[#B8860B] mb-2 flex items-center gap-1.5">
                      <Sparkles size={11} />
                      {section.title}
                    </p>
                    <p className={`text-sm text-foreground/85 leading-relaxed ${section.italic ? "italic" : ""}`}>
                      {section.body}
                    </p>
                  </div>
                ))}

                <div className="bg-[#FFF9EB] border border-[#EFE4CF] rounded-3xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={14} className="text-[#D9A441]" />
                    <p className="text-sm font-semibold">{t("log.aiDraft")}</p>
                    <span className="ml-auto text-xs text-muted-foreground">{t("log.readyToSend")}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                    >
                      <Send size={14} />
                      {t("log.sendToParent")}
                    </button>
                    <button type="button" className="px-4 bg-secondary text-muted-foreground rounded-xl text-sm font-semibold">
                      {t("home.edit")}
                    </button>
                  </div>
                  {saved && (
                    <p className="text-xs text-[#6B9080] font-medium mt-2 flex items-center gap-1">
                      <CheckCircle size={12} />
                      {t("log.savedToReports")}
                    </p>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-4">
        <h2 className="font-bold text-foreground mb-3" style={{ fontFamily: "Nunito, sans-serif" }}>
          {t("log.todaysLog")}
        </h2>
        <div className="flex flex-col gap-2">
          {logEntries.map((entry, i) => {
            const colors: Record<string, string> = {
              meal: "bg-[#FFF4D8] text-[#B8860B]",
              sleep: "bg-[#F0F3FA] text-[#6B7FA8]",
              activity: "bg-[#EEF5F0] text-[#6B9080]",
              health: "bg-[#FFF9EB] text-[#A67C52]",
            };
            const icons: Record<string, typeof Utensils> = {
              meal: Utensils,
              sleep: Moon,
              activity: Activity,
              health: Thermometer,
            };
            const Icon = icons[entry.type];
            return (
              <div key={i} className="bg-card border border-border rounded-2xl p-3 flex items-start gap-3">
                <div className={`${colors[entry.type]} rounded-xl p-1.5 mt-0.5 shrink-0`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed">{entry.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">{entry.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MatchTab({
  role,
  onSelectParent,
}: {
  role: "parent" | "caregiver";
  onSelectParent: (p: ParentProfile) => void;
}) {
  const { locale, t } = useLanguage();
  const [activeFilter, setActiveFilter] = useState(0);
  const isParent = role === "parent";

  const caregiverFilters = [t("match.filterAll"), t("match.filterBilingual"), t("match.filterWeekday"), t("match.filterInfant"), t("match.filterCertified")];
  const parentFilters = locale === "ko" ? ["전체", "입주", "한국어", "신생아", "인증"] : ["All", "Live-in", "Korean", "Newborn", "Verified"];
  const filters = isParent ? caregiverFilters : parentFilters;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="mx-4 mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Nunito, sans-serif" }}>
              {isParent ? t("match.title") : (locale === "ko" ? "가족 찾기" : "Find Families")}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isParent ? t("match.subtitle") : (locale === "ko" ? "돌봄을 원하는 가족을 찾아보세요" : "Browse families looking for a caregiver")}
            </p>
          </div>
          {isParent && (
            <span className="shrink-0 text-xs font-semibold text-[#B8860B] bg-[#FFF4D8] px-2.5 py-1.5 rounded-full flex items-center gap-1">
              <Sparkles size={11} />
              {t("match.aiRecommended")}
            </span>
          )}
        </div>
      </div>

      <div className="mx-4 flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-3 shadow-sm">
        <Search size={16} className="text-muted-foreground" />
        <input
          className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          placeholder={isParent ? t("match.placeholder") : (locale === "ko" ? "지역, 요구사항 검색" : "Search by area or requirement")}
        />
      </div>

      <div className="px-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {filters.map((f, idx) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFilter(idx)}
            className={`whitespace-nowrap text-xs rounded-full px-3.5 py-2 font-semibold border transition-colors ${
              activeFilter === idx
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 mx-4">
        {isParent ? (
          /* ── Caregiver cards for parents ── */
          CAREGIVER_MATCHES.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-3xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar src={c.img} size={52} />
                  {c.verified && (
                    <div className="absolute -bottom-1 -right-1 bg-[#6B9080] rounded-full p-0.5">
                      <CheckCircle size={12} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{c.name}</p>
                    <span className="ml-auto text-xs font-bold text-[#B8860B] bg-[#FFF4D8] px-2 py-1 rounded-full">
                      {c.matchScore}% {t("match.matchScore")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{getCaregiverRole(locale, c.role)}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star size={11} className="text-[#D9A441] fill-[#D9A441]" />
                      {c.rating} ({c.reviews})
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={11} />
                      {c.distance}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {c.available.split(" ").slice(0, 2).join(" ")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 bg-[#FFF9EB] border border-[#EFE4CF] rounded-2xl p-3">
                <p className="text-xs font-semibold text-[#B8860B] mb-1 flex items-center gap-1">
                  <Sparkles size={11} />
                  {t("match.whyRecommended")}
                </p>
                <p className="text-xs text-foreground/85 leading-relaxed">
                  {locale === "ko" ? c.aiExplanationKo : c.aiExplanationEn}
                </p>
              </div>

              <p className="text-xs font-semibold text-muted-foreground mt-3 mb-1.5">{t("match.matchReasons")}</p>
              <div className="flex gap-1.5 flex-wrap">
                {c.matchReasons.map((reason) => (
                  <span key={reason} className="bg-secondary text-foreground/80 text-xs rounded-full px-2.5 py-1 font-medium">{reason}</span>
                ))}
              </div>
              <div className="flex gap-1.5 flex-wrap mt-2">
                {c.languages.map((lang) => (
                  <span key={lang} className="bg-[#F0F3FA] text-[#6B7FA8] text-xs rounded-full px-2 py-0.5 font-medium flex items-center gap-1">
                    <Globe size={10} />{lang}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="font-bold text-[#B8860B] text-sm">{c.price}</span>
                <button type="button" className="bg-primary text-primary-foreground text-xs font-semibold rounded-xl px-4 py-1.5 hover:opacity-90 transition-opacity">
                  {t("match.viewProfile")}
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          /* ── Parent cards for caregivers ── */
          PARENTS.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onSelectParent(p)}
              className="bg-card border border-border rounded-3xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="relative">
                  <div className="w-13 h-13 rounded-full bg-pink-100 flex items-center justify-center text-2xl" style={{ width: 52, height: 52 }}>
                    {p.avatar}
                  </div>
                  {p.verified && (
                    <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5">
                      <CheckCircle size={12} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">{locale === "ko" ? p.name.ko : p.name.en}</p>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin size={11} />{p.location}
                  </span>
                  <div className="flex gap-1.5 mt-1.5">
                    {p.languages.map((l) => (
                      <span key={l} className="bg-blue-50 text-blue-600 text-xs rounded-full px-2 py-0.5 font-medium">
                        {l === "Korean" ? "🇰🇷 한국어" : "🇺🇸 English"}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { icon: Baby, color: "#ec4899", label: locale === "ko" ? "출산 예정일" : "Due Date", value: locale === "ko" ? p.dueDate.ko : p.dueDate.en },
                  { icon: Heart, color: "#22c55e", label: locale === "ko" ? "예산" : "Budget", value: p.budget },
                  { icon: Home, color: "#8b5cf6", label: locale === "ko" ? "입주" : "Live-in", value: p.liveIn ? (locale === "ko" ? "입주" : "Yes") : (locale === "ko" ? "출퇴근" : "No") },
                ].map(({ icon: Icon, color, label, value }) => (
                  <div key={label} className="bg-[#FFFDF7] rounded-xl p-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <Icon size={11} style={{ color }} />
                      <span className="text-[10px] text-muted-foreground font-semibold">{label}</span>
                    </div>
                    <p className="text-xs font-bold text-foreground leading-tight">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {p.newbornExp && <span className="bg-primary/10 text-primary text-xs rounded-full px-2.5 py-1 font-semibold border border-primary/20">{locale === "ko" ? "신생아 경험 필수" : "Newborn exp."}</span>}
                {p.nonSmoker && <span className="bg-primary/10 text-primary text-xs rounded-full px-2.5 py-1 font-semibold border border-primary/20">{locale === "ko" ? "비흡연" : "Non-smoker"}</span>}
                {p.breastfeeding && <span className="bg-primary/10 text-primary text-xs rounded-full px-2.5 py-1 font-semibold border border-primary/20">{locale === "ko" ? "모유수유 지원" : "Breastfeeding"}</span>}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">{locale === "ko" ? p.notes.ko : p.notes.en}</p>

              <button type="button" className="w-full bg-primary text-primary-foreground text-xs font-semibold rounded-xl py-2.5 hover:opacity-90 transition-opacity">
                {locale === "ko" ? "프로필 보기 · 입찰하기" : "View Profile & Place Bid"}
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Parent detail + bid placement (caregiver view) ── */
function ParentDetailView({
  parent,
  onBack,
  onBidSubmitted,
}: {
  parent: ParentProfile;
  onBack: () => void;
  onBidSubmitted: (bid: Omit<Bid, "id" | "submittedAt">) => void;
}) {
  const { locale } = useLanguage();
  const ko = locale === "ko";
  const [bidOpen, setBidOpen] = useState(false);
  const [bidPrice, setBidPrice] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submitBid() {
    if (!bidPrice.trim()) return;
    onBidSubmitted({
      caregiverId: "cg-me",
      caregiverName: ko ? "지연 선생님" : "Jiyeon (You)",
      caregiverAvatar: "photo-1544005313-94ddf0286df2",
      caregiverRole: ko ? "산후조리사" : "Postpartum Specialist",
      parentId: parent.id,
      price: `$${bidPrice}/wk`,
      message: bidMessage,
      status: "pending",
    });
    setBidOpen(false);
    setSubmitted(true);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
        <button type="button" onClick={onBack} className="p-1 rounded-lg hover:bg-secondary transition-colors">
          <ChevronRight size={20} className="rotate-180 text-foreground" />
        </button>
        <p className="font-bold text-base flex-1">{ko ? "가족 프로필" : "Family Profile"}</p>
        {parent.verified && (
          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1">
            <CheckCircle size={11} /> {ko ? "인증됨" : "Verified"}
          </span>
        )}
      </div>

      <div className="overflow-y-auto flex-1 pb-24">
        {/* Hero */}
        <div className="mx-4 mt-4 bg-card border border-border rounded-3xl p-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center text-3xl">{parent.avatar}</div>
            <div>
              <p className="font-bold text-lg">{ko ? parent.name.ko : parent.name.en}</p>
              <p className="text-xs text-muted-foreground">{ko ? "부모" : "Parent"}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin size={11} />{parent.location}</p>
              <div className="flex gap-1.5 mt-1.5">
                {parent.languages.map((l) => (
                  <span key={l} className="bg-blue-50 text-blue-600 text-xs rounded-full px-2 py-0.5 font-medium">{l === "Korean" ? "🇰🇷 한국어" : "🇺🇸 English"}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Care Request */}
        <div className="mx-4 mb-4">
          <p className="font-bold text-sm mb-2">{ko ? "돌봄 요청서" : "Care Request"}</p>
          <div className="bg-card border border-border rounded-3xl divide-y divide-border">
            {[
              { icon: Baby, color: "#ec4899", label: ko ? "출산 예정일" : "Due Date", value: ko ? parent.dueDate.ko : parent.dueDate.en },
              { icon: Heart, color: "#22c55e", label: ko ? "예산" : "Budget", value: parent.budget },
              { icon: MapPin, color: "#06b6d4", label: ko ? "위치" : "Location", value: parent.location },
            ].map(({ icon: Icon, color, label, value }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold">{value}</p>
                </div>
              </div>
            ))}
            <div className="px-4 py-3 flex flex-wrap gap-1.5">
              <p className="w-full text-xs text-muted-foreground mb-1">{ko ? "요구사항" : "Requirements"}</p>
              {parent.newbornExp && <span className="bg-primary/10 text-primary text-xs rounded-full px-2.5 py-1 font-semibold">{ko ? "신생아 경험 필수" : "Newborn exp."}</span>}
              {parent.nonSmoker && <span className="bg-primary/10 text-primary text-xs rounded-full px-2.5 py-1 font-semibold">{ko ? "비흡연" : "Non-smoker"}</span>}
              {parent.breastfeeding && <span className="bg-primary/10 text-primary text-xs rounded-full px-2.5 py-1 font-semibold">{ko ? "모유수유 지원" : "Breastfeeding"}</span>}
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">{ko ? "특이사항" : "Special Notes"}</p>
              <p className="text-sm leading-relaxed">{ko ? parent.notes.ko : parent.notes.en}</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="absolute bottom-16 left-0 right-0 px-4 py-3 bg-card/80 backdrop-blur border-t border-border">
        {submitted ? (
          <div className="w-full bg-green-50 border border-green-200 text-green-700 font-semibold text-sm rounded-2xl py-3 text-center">
            ✓ {ko ? "입찰이 제출되었습니다!" : "Bid submitted!"}
          </div>
        ) : (
          <button type="button" onClick={() => setBidOpen(true)} className="w-full bg-primary text-primary-foreground font-semibold rounded-2xl py-3 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <span>⚖️</span> {ko ? "입찰하기" : "Place a Bid"}
          </button>
        )}
      </div>

      {/* Bid modal */}
      <AnimatePresence>
        {bidOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 z-50 flex items-end">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="bg-card rounded-t-3xl p-6 w-full">
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-lg">{ko ? "입찰하기" : "Place a Bid"}</p>
                <button type="button" onClick={() => setBidOpen(false)} className="text-muted-foreground text-sm">{ko ? "취소" : "Cancel"}</button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {ko ? `${parent.name.ko} 가족에게 주당 가격과 자기소개를 보내세요.` : `Send your weekly rate and intro to ${parent.name.en}'s family.`}
              </p>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">{ko ? "희망 주급 (USD)" : "Weekly Rate (USD)"}</label>
              <div className="flex items-center border border-border rounded-xl px-3 mb-4 bg-secondary/30">
                <span className="text-muted-foreground font-semibold mr-1">$</span>
                <input
                  value={bidPrice}
                  onChange={(e) => setBidPrice(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="1800"
                  className="flex-1 py-3 bg-transparent outline-none text-lg font-semibold"
                />
                <span className="text-muted-foreground text-sm">/wk</span>
              </div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">{ko ? "자기소개" : "Introduction"}</label>
              <textarea
                value={bidMessage}
                onChange={(e) => setBidMessage(e.target.value)}
                placeholder={ko ? "경력, 전문 분야를 적어주세요." : "Tell the family about your experience and why you're a great fit."}
                rows={4}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-secondary/30 outline-none resize-none mb-4"
              />
              <button type="button" onClick={submitBid} disabled={!bidPrice.trim()} className="w-full bg-primary text-primary-foreground font-semibold rounded-2xl py-3 disabled:opacity-40 hover:opacity-90 transition-opacity">
                {ko ? "제출하기" : "Submit Bid"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Bids list (parent sees received bids) ── */
function BidsListView({
  bids,
  onBack,
  onSelectBid,
}: {
  bids: Bid[];
  onBack: () => void;
  onSelectBid: (b: Bid) => void;
}) {
  const { locale } = useLanguage();
  const ko = locale === "ko";
  const pending = bids.filter((b) => b.status === "pending").length;

  const STATUS = {
    pending: { label: ko ? "신규" : "New", color: "text-amber-600", bg: "bg-amber-50" },
    interview_scheduled: { label: ko ? "인터뷰 예정" : "Interview Set", color: "text-primary", bg: "bg-blue-50" },
    accepted: { label: ko ? "수락됨" : "Accepted", color: "text-green-600", bg: "bg-green-50" },
    rejected: { label: ko ? "거절됨" : "Declined", color: "text-red-500", bg: "bg-red-50" },
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
        <button type="button" onClick={onBack} className="p-1 rounded-lg hover:bg-secondary transition-colors">
          <ChevronRight size={20} className="rotate-180 text-foreground" />
        </button>
        <div className="flex-1">
          <p className="font-bold text-base">{ko ? "받은 입찰" : "Received Bids"}</p>
          <p className="text-xs text-muted-foreground">{bids.length}{ko ? "명 지원" : " caregivers applied"}</p>
        </div>
        {pending > 0 && <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">{pending} {ko ? "신규" : "New"}</span>}
      </div>
      <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
        {bids.map((bid) => {
          const s = STATUS[bid.status];
          return (
            <button key={bid.id} type="button" onClick={() => onSelectBid(bid)} className="bg-card border border-border rounded-2xl p-4 text-left hover:shadow-md transition-shadow w-full">
              <div className="flex items-center gap-3">
                <Avatar src={bid.caregiverAvatar} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm">{bid.caregiverName}</p>
                    <p className="font-bold text-[#B8860B] text-sm">{bid.price}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{bid.caregiverRole}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-xs font-semibold ${s.color} ${s.bg} px-2 py-0.5 rounded-full`}>{s.label}</span>
                    <span className="text-xs text-muted-foreground">{bid.submittedAt}</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{bid.message}</p>
              {bid.interviewDate && (
                <div className="mt-2 bg-blue-50 rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <Calendar size={12} className="text-primary" />
                  <span className="text-xs font-semibold text-primary">{ko ? "인터뷰: " : "Interview: "}{bid.interviewDate}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Bid detail (parent reviews a bid) ── */
function BidDetailView({
  bid,
  onBack,
  onUpdate,
}: {
  bid: Bid;
  onBack: () => void;
  onUpdate: (id: string, changes: Partial<Bid>) => void;
}) {
  const { locale } = useLanguage();
  const ko = locale === "ko";
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");
  const [contractOpen, setContractOpen] = useState(false);
  const [signature, setSignature] = useState("");
  const [contractSigned, setContractSigned] = useState(false);

  function scheduleInterview() {
    if (!interviewDate.trim()) return;
    onUpdate(bid.id, { status: "interview_scheduled", interviewDate: `${interviewDate}${interviewTime ? " · " + interviewTime : ""}` });
    setInterviewOpen(false);
  }

  if (contractSigned) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-4">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <p className="font-bold text-xl mb-2">{ko ? "계약 완료! 🎉" : "Contract Signed! 🎉"}</p>
        <p className="text-sm text-muted-foreground mb-6">{ko ? `${bid.caregiverName}과의 계약이 체결되었습니다.` : `Your contract with ${bid.caregiverName} is finalized.`}</p>
        <button type="button" onClick={onBack} className="bg-primary text-primary-foreground font-semibold rounded-2xl px-8 py-3">{ko ? "홈으로" : "Back to Home"}</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
        <button type="button" onClick={onBack} className="p-1 rounded-lg hover:bg-secondary transition-colors">
          <ChevronRight size={20} className="rotate-180 text-foreground" />
        </button>
        <p className="font-bold text-base flex-1">{ko ? "입찰 상세" : "Bid Detail"}</p>
      </div>

      <div className="overflow-y-auto flex-1 pb-32">
        {/* Caregiver card */}
        <div className="mx-4 mt-4 bg-card border border-border rounded-3xl p-4 flex flex-col items-center mb-4">
          <Avatar src={bid.caregiverAvatar} size={64} className="mb-3" />
          <p className="font-bold text-lg">{bid.caregiverName}</p>
          <p className="text-xs text-muted-foreground">{bid.caregiverRole}</p>
          <div className="mt-3 bg-primary/10 rounded-2xl px-6 py-3 text-center">
            <p className="text-2xl font-black text-primary">{bid.price}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{ko ? "제안 가격" : "Bid price"}</p>
          </div>
        </div>

        {/* Message */}
        <div className="mx-4 mb-4 bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{ko ? "자기소개" : "Introduction"}</p>
          <p className="text-sm leading-relaxed">{bid.message}</p>
        </div>

        {/* Interview info */}
        {bid.interviewDate && (
          <div className="mx-4 mb-4 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
            <Calendar size={18} className="text-primary" />
            <div>
              <p className="text-xs font-bold text-primary">{ko ? "인터뷰 예정" : "Interview Scheduled"}</p>
              <p className="text-sm font-semibold">{bid.interviewDate}</p>
            </div>
          </div>
        )}

        {/* Contract section when accepted */}
        {bid.status === "accepted" && (
          <div className="mx-4 mb-4 bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-green-700 mb-1">{ko ? "계약서 서명" : "Sign Contract"}</p>
            <p className="text-xs text-muted-foreground mb-3">{ko ? "이름을 입력하면 서명으로 간주됩니다." : "Typing your name acts as your signature."}</p>
            <input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder={ko ? "이름 입력..." : "Type your full name..."}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white outline-none mb-3"
            />
            <button
              type="button"
              disabled={!signature.trim()}
              onClick={() => { onUpdate(bid.id, { status: "accepted" }); setContractSigned(true); }}
              className="w-full bg-green-600 text-white font-semibold rounded-xl py-2.5 disabled:opacity-40 hover:opacity-90 transition-opacity text-sm"
            >
              {ko ? "서명하고 계약 완료" : "Sign & Complete Contract"}
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="absolute bottom-16 left-0 right-0 px-4 py-3 bg-card/80 backdrop-blur border-t border-border flex flex-col gap-2">
        {bid.status === "pending" && (
          <>
            <button type="button" onClick={() => setInterviewOpen(true)} className="w-full bg-primary text-primary-foreground font-semibold rounded-2xl py-3 flex items-center justify-center gap-2">
              <Calendar size={16} />{ko ? "인터뷰 일정 잡기" : "Schedule Interview"}
            </button>
            <button type="button" onClick={() => onUpdate(bid.id, { status: "rejected" })} className="w-full border border-red-200 text-red-500 font-semibold rounded-2xl py-2.5 text-sm">
              {ko ? "거절하기" : "Decline"}
            </button>
          </>
        )}
        {bid.status === "interview_scheduled" && (
          <button type="button" onClick={() => onUpdate(bid.id, { status: "accepted" })} className="w-full bg-green-600 text-white font-semibold rounded-2xl py-3 flex items-center justify-center gap-2">
            <CheckCircle size={16} />{ko ? "수락 & 계약 진행" : "Accept & Proceed to Contract"}
          </button>
        )}
        {bid.status === "rejected" && (
          <div className="w-full bg-red-50 border border-red-200 text-red-500 font-semibold rounded-2xl py-3 text-center text-sm">
            {ko ? "거절된 입찰" : "Bid Declined"}
          </div>
        )}
      </div>

      {/* Interview modal */}
      <AnimatePresence>
        {interviewOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 z-50 flex items-end">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="bg-card rounded-t-3xl p-6 w-full">
              <p className="font-bold text-lg mb-1">{ko ? "인터뷰 일정" : "Schedule Interview"}</p>
              <p className="text-xs text-muted-foreground mb-4">{ko ? `${bid.caregiverName}과의 인터뷰 날짜를 입력하세요` : `Pick a date for your interview with ${bid.caregiverName}`}</p>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">{ko ? "날짜" : "Date"}</label>
              <input value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} placeholder={ko ? "예: Jun 25, 2026" : "e.g. Jun 25, 2026"} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-secondary/30 outline-none mb-3" />
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">{ko ? "시간" : "Time"}</label>
              <input value={interviewTime} onChange={(e) => setInterviewTime(e.target.value)} placeholder={ko ? "예: 2:00 PM" : "e.g. 2:00 PM"} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-secondary/30 outline-none mb-4" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setInterviewOpen(false)} className="flex-1 border border-border rounded-2xl py-3 text-sm font-semibold text-muted-foreground">{ko ? "취소" : "Cancel"}</button>
                <button type="button" onClick={scheduleInterview} className="flex-1 bg-primary text-primary-foreground font-semibold rounded-2xl py-3 text-sm">{ko ? "확정" : "Confirm"}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileTab({
  profile,
  onOpenLanguagePicker,
  onOpenProfileEdit,
}: {
  profile: UserProfile;
  onOpenLanguagePicker: () => void;
  onOpenProfileEdit: () => void;
}) {
  const { locale, t } = useLanguage();
  const children = [{ name: "Emma", age: locale === "ko" ? "2세 4개월" : "2 yrs 4 mo", img: "photo-1594608661623-aa0bd3a69d98" }];

  const settings = [
    {
      icon: Globe,
      label: t("profile.langPref"),
      value: locale === "ko" ? t("profile.langValueKo") : t("profile.langValueEn"),
      onClick: onOpenLanguagePicker,
    },
    {
      icon: Bell,
      label: t("profile.notifications"),
      value: t("profile.notifValue"),
    },
    {
      icon: Calendar,
      label: t("profile.schedule"),
      value: t("profile.scheduleValue"),
    },
    {
      icon: Heart,
      label: t("profile.carePref"),
      value: t("profile.careValue"),
    },
    {
      icon: SettingsIcon,
      label: t("profile.appSettings"),
      value: t("profile.appSettingsValue"),
    },
    {
      icon: CreditCard,
      label: t("profile.billing"),
      value: t("profile.billingValue"),
    },
  ];

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Profile Hero */}
      <div className="mx-4 mt-4 bg-card border border-border rounded-3xl p-5 shadow-sm relative">
        <button
          type="button"
          onClick={onOpenProfileEdit}
          aria-label={t("profile.editProfile")}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
        >
          <UserCog size={18} strokeWidth={2} />
        </button>
        <div className="flex items-center gap-4 pr-10">
          <Avatar src={profile.avatar} size={64} className="ring-2 ring-primary/20" />
          <div>
            <h2 className="font-bold text-lg" style={{ fontFamily: "Nunito, sans-serif" }}>
              {profile.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {profile.role === "caregiver" ? t("profile.roleCaregiver") : t("profile.roleParent")} · {profile.location}
            </p>
            {profile.languages && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {profile.languages.split(",").map((lang) => (
                <span key={lang.trim()} className="bg-[#FFF4D8] text-[#B8860B] text-xs rounded-full px-2 py-0.5 font-medium">
                  {lang.trim()}
                </span>
              ))}
            </div>
            )}
            {!profile.languages && (
            <div className="flex gap-1 mt-1.5">
              <span className="bg-[#FFF4D8] text-[#B8860B] text-xs rounded-full px-2 py-0.5 font-medium">🇰🇷 Korean</span>
              <span className="bg-[#F0F3FA] text-[#6B7FA8] text-xs rounded-full px-2 py-0.5 font-medium">🇺🇸 English</span>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Children — parents only */}
      {profile.role === "parent" && (
      <div className="mx-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground" style={{ fontFamily: "Nunito, sans-serif" }}>
            {t("profile.children")}
          </h2>
          <button className="flex items-center gap-1 text-primary text-sm font-semibold">
            <Plus size={14} />
            {t("profile.add")}
          </button>
        </div>
        {children.map((child) => (
          <div key={child.name} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <Avatar src={child.img} size={44} />
            <div>
              <p className="font-semibold">{child.name}</p>
              <p className="text-xs text-muted-foreground">{child.age}</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground ml-auto" />
          </div>
        ))}
      </div>
      )}

      {/* Caregiver info */}
      {profile.role === "caregiver" &&
        (profile.experience ||
          profile.specialty ||
          profile.licenseNumber ||
          profile.licensePhoto ||
          (profile.certificates && profile.certificates.length > 0)) && (
      <div className="mx-4">
        <h2 className="font-bold text-foreground mb-3" style={{ fontFamily: "Nunito, sans-serif" }}>
          {t("onboarding.caregiverInfo")}
        </h2>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
          {profile.experience && (
            <p className="text-sm"><span className="font-semibold">{t("onboarding.experience")}: </span>{profile.experience}</p>
          )}
          {profile.specialty && (
            <p className="text-sm"><span className="font-semibold">{t("onboarding.specialty")}: </span>{profile.specialty}</p>
          )}
          {(profile.licenseNumber || profile.licensePhoto) && (
            <div className="flex flex-col gap-2 pt-1 border-t border-border">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {t("onboarding.licensesAndCerts")}
              </p>
              {profile.licenseNumber && (
                <p className="text-sm">
                  <span className="font-semibold">{t("onboarding.licenseNumber")}: </span>
                  {profile.licenseNumber}
                </p>
              )}
              {profile.licensePhoto && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">{t("onboarding.licensePhoto")}</span>
                  <img
                    src={profile.licensePhoto}
                    alt={t("onboarding.licensePhoto")}
                    className="w-full max-w-[200px] rounded-xl border border-border object-cover"
                  />
                </div>
              )}
            </div>
          )}
          {profile.certificates && profile.certificates.length > 0 && (
            <div className="flex flex-col gap-3 pt-1 border-t border-border">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {t("onboarding.otherCertificates")}
              </p>
              {profile.certificates.map((cert) => (
                <div key={cert.id} className="flex flex-col gap-1.5">
                  <p className="text-sm font-semibold">{cert.name}</p>
                  <img
                    src={cert.photo}
                    alt={cert.name}
                    className="w-full max-w-[200px] rounded-xl border border-border object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Settings */}
      <div className="mx-4">
        <h2 className="font-bold text-foreground mb-3" style={{ fontFamily: "Nunito, sans-serif" }}>
          {t("profile.settings")}
        </h2>
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
          {settings.map(({ icon: Icon, label, value, onClick }, i) => (
            <div
              key={label}
              role={onClick ? "button" : undefined}
              tabIndex={onClick ? 0 : undefined}
              onClick={onClick}
              onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
              className={`flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors cursor-pointer ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="bg-secondary rounded-xl p-2">
                <Icon size={16} className="text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{value}</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const TABS: { id: Tab; icon: typeof Home; labelKey: "tabs.home" | "tabs.report" | "tabs.log" | "tabs.match" | "tabs.profile" }[] = [
  { id: "home", icon: Home, labelKey: "tabs.home" },
  { id: "report", icon: FileText, labelKey: "tabs.report" },
  { id: "log", icon: Mic, labelKey: "tabs.log" },
  { id: "match", icon: Search, labelKey: "tabs.match" },
  { id: "profile", icon: User, labelKey: "tabs.profile" },
];

type OverlayView =
  | { type: "parent-detail"; parent: ParentProfile }
  | { type: "bids-list" }
  | { type: "bid-detail"; bid: Bid };

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [phase, setPhase] = useState<AppPhase>(() => getDevPreviewPhase() ?? "splash");
  const [bids, setBids] = useState<Bid[]>(MOCK_BIDS);
  const [overlay, setOverlay] = useState<OverlayView | null>(null);
  const onboardingPreview = getOnboardingPreview();
  const { t } = useLanguage();

  const handleSplashComplete = useCallback(() => setPhase("login"), []);
  const handleLogin = useCallback(() => setPhase("main"), []);
  const handleSignUp = useCallback(() => setPhase("onboarding"), []);
  const handleOnboardingComplete = useCallback((nextProfile: UserProfile) => {
    setProfile(nextProfile);
    setPhase("main");
  }, []);

  const handleSaveReport = useCallback((report: DailyReport) => {
    setDailyReport(report);
  }, []);

  const addBid = useCallback((bidData: Omit<Bid, "id" | "submittedAt">) => {
    setBids((prev) => [...prev, { ...bidData, id: crypto.randomUUID(), submittedAt: "Just now" }]);
  }, []);

  const updateBid = useCallback((id: string, changes: Partial<Bid>) => {
    setBids((prev) => prev.map((b) => (b.id === id ? { ...b, ...changes } : b)));
  }, []);

  const pendingBidCount = bids.filter((b) => b.parentId === 1 && b.status === "pending").length;

  const renderTab = () => {
    switch (activeTab) {
      case "home": return <HomeTab profile={profile} dailyReport={dailyReport} pendingBids={pendingBidCount} onOpenBids={() => setOverlay({ type: "bids-list" })} />;
      case "report": return <ReportTab dailyReport={dailyReport} />;
      case "log": return <LogTab dailyReport={dailyReport} onSaveReport={handleSaveReport} />;
      case "match": return (
        <MatchTab
          role={profile.role}
          onSelectParent={(p) => setOverlay({ type: "parent-detail", parent: p })}
        />
      );
      case "profile": return (
        <ProfileTab
          profile={profile}
          onOpenLanguagePicker={() => setLangPickerOpen(true)}
          onOpenProfileEdit={() => setProfileEditOpen(true)}
        />
      );
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        fontFamily: "Plus Jakarta Sans, sans-serif",
        background: "radial-gradient(circle at top, #FFF4D8 0%, #FFFDF7 38%, #FFFFFF 100%)",
      }}
    >
      <div
        className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-border"
        style={{
          width: 390,
          height: 844,
          maxHeight: "100vh",
          maxWidth: "100vw",
          background: "var(--app-gradient)",
        }}
      >
        {/* Status bar + main app */}
        {phase === "main" && (
          <>
            <div className="flex items-center justify-between px-6 pt-3 pb-1 bg-background">
              <span className="text-xs font-bold">9:41</span>
              <div className="w-28 h-6 bg-foreground rounded-full" />
              <div className="flex items-center gap-1">
                <div className="flex gap-0.5 items-end">
                  {[3, 5, 7, 9].map((h) => (
                    <div key={h} className="w-1 bg-foreground rounded-sm" style={{ height: h }} />
                  ))}
                </div>
                <div className="w-4 h-2 border border-foreground rounded-sm">
                  <div className="h-full w-3/4 bg-foreground rounded-sm" />
                </div>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ height: "calc(100% - 100px)" }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                >
                  {renderTab()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Overlay views (parent detail, bids, bid detail) */}
            <AnimatePresence>
              {overlay && (
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 280 }}
                  className="absolute inset-0 bg-background z-30"
                  style={{ top: 44 }}
                >
                  {overlay.type === "parent-detail" && (
                    <ParentDetailView
                      parent={overlay.parent}
                      onBack={() => setOverlay(null)}
                      onBidSubmitted={(bidData) => { addBid(bidData); setOverlay(null); }}
                    />
                  )}
                  {overlay.type === "bids-list" && (
                    <BidsListView
                      bids={bids.filter((b) => b.parentId === 1)}
                      onBack={() => setOverlay(null)}
                      onSelectBid={(bid) => setOverlay({ type: "bid-detail", bid })}
                    />
                  )}
                  {overlay.type === "bid-detail" && (
                    <BidDetailView
                      bid={bids.find((b) => b.id === overlay.bid.id) ?? overlay.bid}
                      onBack={() => setOverlay({ type: "bids-list" })}
                      onUpdate={(id, changes) => updateBid(id, changes)}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border px-2 pb-5 pt-2">
              <div className="flex items-center">
                {TABS.map(({ id, icon: Icon, labelKey }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className="flex-1 flex flex-col items-center gap-1 py-1 transition-colors"
                  >
                    {id === "log" ? (
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all -mt-6 ${
                          activeTab === id
                            ? "bg-primary shadow-primary/40 scale-110"
                            : "bg-primary/80 shadow-primary/20"
                        }`}
                      >
                        <Icon size={22} className="text-primary-foreground" />
                      </div>
                    ) : (
                      <div
                        className={`p-2 rounded-xl transition-all ${
                          activeTab === id ? "bg-primary/10" : ""
                        }`}
                      >
                        <Icon
                          size={20}
                          className={activeTab === id ? "text-primary" : "text-muted-foreground"}
                        />
                      </div>
                    )}
                    <span
                      className={`text-xs font-semibold ${
                        id === "log" ? "mt-1" : ""
                      } ${activeTab === id ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {t(labelKey)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <LanguagePicker open={langPickerOpen} onClose={() => setLangPickerOpen(false)} />
            <ProfileEditModal
              open={profileEditOpen}
              profile={profile}
              onClose={() => setProfileEditOpen(false)}
              onSave={setProfile}
            />
          </>
        )}

        {/* Splash & Login overlays */}
        <AnimatePresence>
          {phase === "splash" && <SplashScreen onComplete={handleSplashComplete} />}
          {phase === "login" && <LoginScreen onLogin={handleLogin} onSignUp={handleSignUp} />}
          {phase === "onboarding" && (
            <OnboardingScreen
              onComplete={handleOnboardingComplete}
              initialRole={onboardingPreview.initialRole}
              initialStep={onboardingPreview.initialStep}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
