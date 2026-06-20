import { LinearGradient } from "expo-linear-gradient";
import { Baby, Calendar, CheckCircle, FileText, Globe, MessageCircle, Send, Sparkles } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { useApp } from "../../context/AppContext";
import { useLanguage } from "../../LanguageContext";
import { colors, gradients, radius } from "../../theme";

export function HomeScreen() {
  const { profile, dailyReport } = useApp();
  const { locale, t } = useLanguage();
  const firstName = profile.name.split(" ")[0];
  const reportPreview = dailyReport ? (locale === "ko" ? dailyReport.reportKo : dailyReport.reportEn) : null;
  const replyDraft = dailyReport?.parentReplyDraft ?? t("home.draftText");

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <LinearGradient colors={[...gradients.hero]} style={styles.hero}>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.greeting}>{t("home.greeting")}</Text>
            <Text style={styles.name}>{firstName} 👋</Text>
          </View>
          <Avatar src={profile.avatar} size={48} />
        </View>
        <View style={styles.caregiverCard}>
          <View style={styles.caregiverIcon}>
            <Baby size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.caregiverLabel}>{t("home.emmaWith")}</Text>
            <Text style={styles.caregiverName}>Ji-yeon Park · {t("home.until")}</Text>
          </View>
          <CheckCircle size={18} color={colors.sage} />
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("home.todaysReport")}</Text>
          {dailyReport && (
            <View style={styles.aiBadge}>
              <Sparkles size={11} color={colors.gold} />
              <Text style={styles.aiBadgeText}>{t("report.aiTranslated")}</Text>
            </View>
          )}
        </View>
        <View style={styles.card}>
          <View style={styles.reportMeta}>
            <Avatar src="photo-1544005313-94ddf0286df2" size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>{t("home.from")}</Text>
              <Text style={styles.metaValue}>
                {dailyReport ? `${dailyReport.date} · ${dailyReport.savedAt}` : "June 20 · 5:42 PM"}
              </Text>
            </View>
            <View style={styles.aiPill}>
              <Sparkles size={11} color={colors.gold} />
              <Text style={styles.aiPillText}>AI</Text>
            </View>
          </View>
          <Text style={styles.reportBody}>
            {reportPreview ??
              (locale === "ko"
                ? "Log 탭에서 음성 메모를 추가하고 일일 리포트를 생성해 보세요."
                : "Generate a daily report from the Log tab to see Emma's AI-translated update here.")}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("home.quickActions")}</Text>
        <View style={styles.actionsGrid}>
          {[
            { icon: MessageCircle, label: t("home.messageNanny"), bg: "#F0F3FA", fg: "#6B7FA8" },
            { icon: Calendar, label: t("home.schedulePickup"), bg: colors.champagne, fg: colors.gold },
            { icon: Globe, label: t("home.translateReport"), bg: "#EEF5F0", fg: colors.sage },
            { icon: FileText, label: t("home.viewHistory"), bg: "#FFF9EB", fg: colors.gold },
          ].map(({ icon: Icon, label, bg, fg }) => (
            <Pressable key={label} style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: bg }]}>
                <Icon size={18} color={fg} />
              </View>
              <Text style={styles.actionLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("home.aiDraftReply")}</Text>
        <View style={styles.card}>
          <Text style={styles.draftHint}>
            <Sparkles size={11} color={colors.gold} /> {t("home.suggestedMessage")}
          </Text>
          <Text style={styles.draftText}>&ldquo;{replyDraft}&rdquo;</Text>
          <View style={styles.draftActions}>
            <Pressable style={styles.primaryBtn}>
              <Send size={14} color={colors.text} />
              <Text style={styles.primaryBtnText}>{t("home.send")}</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>{t("home.edit")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 24 },
  hero: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontSize: 14, color: colors.muted },
  name: { fontSize: 24, fontWeight: "700", color: colors.text, marginTop: 2 },
  caregiverCard: {
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: radius.lg,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  caregiverIcon: { backgroundColor: colors.champagne, borderRadius: 12, padding: 8 },
  caregiverLabel: { fontSize: 12, color: colors.muted },
  caregiverName: { fontSize: 14, fontWeight: "600", color: colors.text },
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.champagne,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  aiBadgeText: { fontSize: 11, fontWeight: "600", color: colors.gold },
  reportMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  metaLabel: { fontSize: 12, color: colors.muted },
  metaValue: { fontSize: 14, fontWeight: "600", color: colors.text },
  aiPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.champagne,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  aiPillText: { fontSize: 11, fontWeight: "600", color: colors.gold },
  reportBody: { fontSize: 14, lineHeight: 22, color: colors.text, opacity: 0.85 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionCard: {
    width: "47%",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionIcon: { borderRadius: 12, padding: 8 },
  actionLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },
  draftHint: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  draftText: { fontSize: 14, lineHeight: 22, color: colors.text, opacity: 0.85, fontStyle: "italic" },
  draftActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  primaryBtnText: { fontSize: 14, fontWeight: "600", color: colors.text },
  secondaryBtn: {
    paddingHorizontal: 16,
    backgroundColor: colors.champagne,
    borderRadius: radius.md,
    justifyContent: "center",
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "600", color: colors.muted },
});
