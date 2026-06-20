import { useState } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import { LanguagePicker } from "./components/LanguagePicker";
import {
  getReportContent,
  getLogEntries,
  getLogDraft,
  getCaregiverRole,
} from "./i18n";

type Tab = "home" | "report" | "log" | "match" | "profile";

const CAREGIVERS = [
  {
    id: 1,
    name: "Ji-yeon Park",
    role: "Certified Nanny",
    rating: 4.9,
    reviews: 47,
    location: "Gangnam-gu",
    distance: "1.2km",
    price: "₩18,000/hr",
    languages: ["Korean", "English"],
    tags: ["Infant Care", "Bilingual", "First Aid"],
    available: "Mon–Fri 3pm–8pm",
    img: "photo-1544005313-94ddf0286df2",
    verified: true,
  },
  {
    id: 2,
    name: "Sarah Kim",
    role: "Bilingual Babysitter",
    rating: 4.8,
    reviews: 33,
    location: "Mapo-gu",
    distance: "2.4km",
    price: "₩15,000/hr",
    languages: ["English", "Korean", "Japanese"],
    tags: ["Toddler", "Arts & Crafts", "CPR Certified"],
    available: "Weekends & Evenings",
    img: "photo-1438761681033-6461ffad8d80",
    verified: true,
  },
  {
    id: 3,
    name: "Min-jun Lee",
    role: "Daycare Teacher",
    rating: 4.7,
    reviews: 89,
    location: "Seodaemun-gu",
    distance: "3.1km",
    price: "₩420,000/mo",
    languages: ["Korean"],
    tags: ["Group Care", "Montessori", "Licensed"],
    available: "Mon–Fri 8am–6pm",
    img: "photo-1472099645785-5658abf4ff4e",
    verified: true,
  },
];

const REPORT = {
  child: "Emma",
  date: "June 20, 2025",
  caregiver: "Ji-yeon Park",
  summary:
    "Emma had a wonderful day today. She was in great spirits throughout the morning, finished her lunch enthusiastically, and had a solid nap. She showed some creativity during arts and crafts, and played happily in the park. A slight cough appeared after lunch — worth monitoring this evening.",
  items: [
    { icon: Utensils, label: "Meal", value: "Finished lunch well · Had afternoon snack", color: "text-amber-500", bg: "bg-amber-50" },
    { icon: Moon, label: "Sleep", value: "Nap 1hr 20min · Fell asleep easily", color: "text-indigo-400", bg: "bg-indigo-50" },
    { icon: Activity, label: "Activity", value: "Park play · Arts & crafts · Story time", color: "text-green-500", bg: "bg-green-50" },
    { icon: Heart, label: "Mood", value: "Happy · Energetic in the morning", color: "text-rose-400", bg: "bg-rose-50" },
    { icon: Thermometer, label: "Health", value: "Slight cough after lunch · No fever", color: "text-orange-400", bg: "bg-orange-50" },
  ],
  note: "Extra clothes needed tomorrow — Emma got paint on her shirt today!",
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

function HomeTab() {
  const { locale, t } = useLanguage();
  const report = getReportContent(locale);

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Header */}
      <div className="bg-primary rounded-3xl mx-4 mt-4 p-5 text-white relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -right-4 top-12 w-24 h-24 rounded-full bg-white/10" />
        <div className="flex items-center justify-between relative">
          <div>
            <p className="text-white/70 text-sm font-medium">{t("home.greeting")}</p>
            <h1 className="text-2xl font-bold mt-0.5" style={{ fontFamily: "Nunito, sans-serif" }}>
              Jisoo 👋
            </h1>
          </div>
          <div className="relative">
            <Avatar src="photo-1438761681033-6461ffad8d80" size={48} className="ring-2 ring-white/40" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full border-2 border-primary" />
          </div>
        </div>
        <div className="mt-4 bg-white/15 rounded-2xl p-3 flex items-center gap-3">
          <div className="bg-white/20 rounded-xl p-2">
            <Baby size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white/80 text-xs">{t("home.emmaWith")}</p>
            <p className="text-white font-semibold text-sm">
              Ji-yeon Park · {t("home.until")}
            </p>
          </div>
          <CheckCircle size={18} className="text-green-200" />
        </div>
      </div>

      {/* Today's Report Card */}
      <div className="mx-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground" style={{ fontFamily: "Nunito, sans-serif" }}>
            {t("home.todaysReport")}
          </h2>
        </div>
        <div className="bg-card rounded-3xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Avatar src="photo-1544005313-94ddf0286df2" size={36} />
            <div>
              <p className="text-xs text-muted-foreground">{t("home.from")}</p>
              <p className="text-sm font-semibold">June 20 · 5:42 PM</p>
            </div>
            <div className="ml-auto flex items-center gap-1 bg-green-50 text-green-600 text-xs rounded-full px-2.5 py-1">
              <Sparkles size={11} />
              AI
            </div>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{report.translation}</p>
          <div className="mt-3 flex gap-2 flex-wrap">
            {[t("home.tagLunch"), t("home.tagNap"), t("home.tagCough")].map((tag) => (
              <span
                key={tag}
                className={`text-xs rounded-full px-2.5 py-1 font-medium ${
                  tag.includes("⚠")
                    ? "bg-orange-50 text-orange-600"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mx-4">
        <h2 className="font-bold text-foreground mb-3" style={{ fontFamily: "Nunito, sans-serif" }}>
          {t("home.quickActions")}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: MessageCircle, label: t("home.messageNanny"), color: "bg-blue-50 text-blue-500" },
            { icon: Calendar, label: t("home.schedulePickup"), color: "bg-purple-50 text-purple-500" },
            { icon: Globe, label: t("home.translateReport"), color: "bg-green-50 text-green-500" },
            { icon: FileText, label: t("home.viewHistory"), color: "bg-amber-50 text-amber-500" },
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

      {/* Draft Reply */}
      <div className="mx-4">
        <h2 className="font-bold text-foreground mb-3" style={{ fontFamily: "Nunito, sans-serif" }}>
          {t("home.aiDraftReply")}
        </h2>
        <div className="bg-card border border-border rounded-3xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles size={11} className="text-primary" />
            {t("home.suggestedMessage")}
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed italic">
            &ldquo;{t("home.draftText")}&rdquo;
          </p>
          <div className="flex gap-2 mt-3">
            <button className="flex-1 bg-primary text-white rounded-xl py-2 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
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

function ReportTab() {
  const [expanded, setExpanded] = useState(false);
  const { locale, t } = useLanguage();
  const report = getReportContent(locale);
  const itemIcons = REPORT.items;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="mx-4 mt-4">
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Nunito, sans-serif" }}>
          {t("report.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("report.subtitle")}</p>
      </div>

      {/* Timeline */}
      {["June 20", "June 19", "June 18"].map((date, i) => (
        <div key={date} className="mx-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground">{date}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div
            className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm cursor-pointer"
            onClick={() => setExpanded(expanded === false ? true : false)}
          >
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar src="photo-1544005313-94ddf0286df2" size={36} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Ji-yeon Park</p>
                  <p className="text-xs text-muted-foreground">{t("report.submitted")}</p>
                </div>
                {i === 0 && (
                  <span className="bg-orange-50 text-orange-500 text-xs rounded-full px-2.5 py-1 font-medium flex items-center gap-1">
                    <AlertCircle size={11} />
                    {t("report.note")}
                  </span>
                )}
              </div>

              {/* Activity Pills */}
              <div className="grid grid-cols-3 gap-2">
                {itemIcons.slice(0, 3).map(({ icon: Icon, color, bg }, idx) => (
                  <div key={idx} className={`${bg} rounded-2xl p-2.5 flex flex-col items-center gap-1`}>
                    <Icon size={16} className={color} />
                    <span className={`text-xs font-semibold ${color}`}>{report.items[idx].label}</span>
                  </div>
                ))}
              </div>

              {/* Expanded */}
              {i === 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-sm text-foreground/80 leading-relaxed">{report.summary}</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {itemIcons.map(({ icon: Icon, color, bg }, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className={`${bg} rounded-xl p-1.5 mt-0.5`}>
                          <Icon size={14} className={color} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">{report.items[idx].label}</p>
                          <p className="text-sm">{report.items[idx].value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {report.note && (
                    <div className="mt-3 bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-start gap-2">
                      <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700">{report.note}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LogTab() {
  const [isRecording, setIsRecording] = useState(false);
  const [inputText, setInputText] = useState("");
  const [generated, setGenerated] = useState(false);
  const { locale, t } = useLanguage();
  const draftText = getLogDraft(locale);
  const logEntries = getLogEntries(locale);

  const handleGenerate = () => {
    if (inputText.trim()) setGenerated(true);
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="mx-4 mt-4">
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Nunito, sans-serif" }}>
          {t("log.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("log.subtitle")}</p>
      </div>

      {/* Voice Record */}
      <div className="mx-4 bg-card border border-border rounded-3xl p-4 shadow-sm">
        <p className="text-sm font-semibold mb-3">{t("log.voiceNote")}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRecording(!isRecording)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isRecording
                ? "bg-rose-500 shadow-lg shadow-rose-200 scale-110"
                : "bg-primary shadow-md shadow-primary/30"
            }`}
          >
            {isRecording ? <Pause size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
          </button>
          <div className="flex-1">
            {isRecording ? (
              <div>
                <p className="text-sm font-semibold text-rose-500">{t("log.recording")}</p>
                <div className="flex gap-0.5 mt-1.5 items-end h-6">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-rose-300 rounded-full"
                      style={{ height: `${Math.random() * 100}%` }}
                    />
                  ))}
                </div>
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

      {/* Text Input */}
      <div className="mx-4 bg-card border border-border rounded-3xl p-4 shadow-sm">
        <p className="text-sm font-semibold mb-2">{t("log.quickNotes")}</p>
        <textarea
          className="w-full bg-input-background rounded-2xl p-3 text-sm resize-none border-0 outline-none text-foreground placeholder:text-muted-foreground"
          rows={3}
          placeholder={t("log.placeholder")}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button
          onClick={handleGenerate}
          className="mt-2 w-full bg-primary text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Sparkles size={15} />
          {t("log.generateReport")}
        </button>
      </div>

      {/* Generated Report */}
      <AnimatePresence>
        {generated && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mx-4 bg-card border border-primary/20 rounded-3xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-primary/10 rounded-xl p-1.5">
                <Sparkles size={14} className="text-primary" />
              </div>
              <p className="text-sm font-semibold">{t("log.aiDraft")}</p>
              <span className="ml-auto text-xs text-muted-foreground">{t("log.readyToSend")}</span>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{draftText}</p>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 bg-primary text-white rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                <Send size={14} />
                {t("log.sendToParent")}
              </button>
              <button className="px-4 bg-secondary text-muted-foreground rounded-xl text-sm font-semibold">
                {t("home.edit")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Today's Log */}
      <div className="mx-4">
        <h2 className="font-bold text-foreground mb-3" style={{ fontFamily: "Nunito, sans-serif" }}>
          {t("log.todaysLog")}
        </h2>
        <div className="flex flex-col gap-2">
          {logEntries.map((entry, i) => {
            const colors: Record<string, string> = {
              meal: "bg-amber-50 text-amber-500",
              sleep: "bg-indigo-50 text-indigo-400",
              activity: "bg-green-50 text-green-500",
              health: "bg-orange-50 text-orange-400",
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
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Nunito, sans-serif" }}>
          {t("match.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("match.subtitle")}</p>
      </div>

      {/* Search */}
      <div className="mx-4 flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-3 shadow-sm">
        <Search size={16} className="text-muted-foreground" />
        <input
          className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          placeholder={t("match.placeholder")}
        />
      </div>

      {/* Filters */}
      <div className="px-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {filters.map((f, idx) => (
          <button
            key={f}
            className={`whitespace-nowrap text-xs rounded-full px-3.5 py-2 font-semibold border transition-colors ${
              idx === 0
                ? "bg-primary text-white border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3 mx-4">
        {CAREGIVERS.map((c) => (
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
                  <div className="absolute -bottom-1 -right-1 bg-accent rounded-full p-0.5">
                    <CheckCircle size={12} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm">{c.name}</p>
                  <div className="flex items-center gap-1 ml-auto">
                    <Star size={12} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-semibold">{c.rating}</span>
                    <span className="text-xs text-muted-foreground">({c.reviews})</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{getCaregiverRole(locale, c.role)}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
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

            <div className="flex gap-1.5 flex-wrap mt-3">
              {c.languages.map((lang) => (
                <span key={lang} className="bg-blue-50 text-blue-500 text-xs rounded-full px-2 py-0.5 font-medium flex items-center gap-1">
                  <Globe size={10} />
                  {lang}
                </span>
              ))}
              {c.tags.map((tag) => (
                <span key={tag} className="bg-secondary text-muted-foreground text-xs rounded-full px-2 py-0.5">
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <span className="font-bold text-primary text-sm">{c.price}</span>
              <button className="bg-primary text-white text-xs font-semibold rounded-xl px-4 py-1.5 hover:opacity-90 transition-opacity">
                {t("match.viewProfile")}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ProfileTab({ onOpenLanguagePicker }: { onOpenLanguagePicker: () => void }) {
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
  ];

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Profile Hero */}
      <div className="mx-4 mt-4 bg-card border border-border rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar src="photo-1438761681033-6461ffad8d80" size={64} className="ring-2 ring-primary/20" />
          <div>
            <h2 className="font-bold text-lg" style={{ fontFamily: "Nunito, sans-serif" }}>
              Jisoo Kim
            </h2>
            <p className="text-sm text-muted-foreground">{t("profile.parent")}</p>
            <div className="flex gap-1 mt-1.5">
              <span className="bg-blue-50 text-blue-500 text-xs rounded-full px-2 py-0.5 font-medium">🇰🇷 Korean</span>
              <span className="bg-blue-50 text-blue-500 text-xs rounded-full px-2 py-0.5 font-medium">🇺🇸 English</span>
            </div>
          </div>
        </div>
      </div>

      {/* Children */}
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
  const { t } = useLanguage();

  const renderTab = () => {
    switch (activeTab) {
      case "home": return <HomeTab />;
      case "report": return <ReportTab />;
      case "log": return <LogTab />;
      case "match": return <MatchTab />;
      case "profile": return <ProfileTab onOpenLanguagePicker={() => setLangPickerOpen(true)} />;
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50 flex items-center justify-center"
      style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
    >
      {/* Phone frame */}
      <div
        className="relative bg-background rounded-[2.5rem] overflow-hidden shadow-2xl shadow-orange-200/60 border border-orange-100"
        style={{ width: 390, height: 844, maxHeight: "100vh", maxWidth: "100vw" }}
      >
        {/* Status bar */}
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

        {/* Scrollable content */}
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

        {/* Bottom nav */}
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
                    <Icon size={22} className="text-white" />
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
