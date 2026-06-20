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

function HomeTab({ profile, dailyReport }: { profile: UserProfile; dailyReport: DailyReport | null }) {
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

function MatchTab() {
  const { locale, t } = useLanguage();
  const filters = [
    t("match.filterAll"),
    t("match.filterBilingual"),
    t("match.filterWeekday"),
    t("match.filterInfant"),
    t("match.filterCertified"),
  ];

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="mx-4 mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Nunito, sans-serif" }}>
              {t("match.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">{t("match.subtitle")}</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-[#B8860B] bg-[#FFF4D8] px-2.5 py-1.5 rounded-full flex items-center gap-1">
            <Sparkles size={11} />
            {t("match.aiRecommended")}
          </span>
        </div>
      </div>

      <div className="mx-4 flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-3 shadow-sm">
        <Search size={16} className="text-muted-foreground" />
        <input
          className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          placeholder={t("match.placeholder")}
        />
      </div>

      <div className="px-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {filters.map((f, idx) => (
          <button
            key={f}
            type="button"
            className={`whitespace-nowrap text-xs rounded-full px-3.5 py-2 font-semibold border transition-colors ${
              idx === 0
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 mx-4">
        {CAREGIVER_MATCHES.map((c) => (
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
                <span
                  key={reason}
                  className="bg-secondary text-foreground/80 text-xs rounded-full px-2.5 py-1 font-medium"
                >
                  {reason}
                </span>
              ))}
            </div>

            <div className="flex gap-1.5 flex-wrap mt-2">
              {c.languages.map((lang) => (
                <span key={lang} className="bg-[#F0F3FA] text-[#6B7FA8] text-xs rounded-full px-2 py-0.5 font-medium flex items-center gap-1">
                  <Globe size={10} />
                  {lang}
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
        ))}
      </div>
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

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [phase, setPhase] = useState<AppPhase>(() => getDevPreviewPhase() ?? "splash");
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

  const renderTab = () => {
    switch (activeTab) {
      case "home": return <HomeTab profile={profile} dailyReport={dailyReport} />;
      case "report": return <ReportTab dailyReport={dailyReport} />;
      case "log": return <LogTab dailyReport={dailyReport} onSaveReport={handleSaveReport} />;
      case "match": return <MatchTab />;
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
