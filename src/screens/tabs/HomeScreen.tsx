import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, CheckCircle, ChevronRight, FileText, Globe, MessageCircle, Send, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { CarePlanModal } from "../../components/CarePlanModal";
import { CareInboxModal } from "../../components/CareInboxModal";
import { ScreenScrollView } from "../../components/ScreenScrollView";
import { useCareFlow } from "../../context/CareFlowContext";
import { CAREGIVER_MATCHES } from "../../demo/caregivers";
import { useApp } from "../../context/AppContext";
import { useLanguage } from "../../LanguageContext";
import { colors, gradients, radius } from "../../theme";

export function HomeScreen() {
  const { profile, dailyReport } = useApp();
  const { locale, t } = useLanguage();
  const { activeRelationship, matchConfirmed, carePlan } = useCareFlow();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxStartThreadId, setInboxStartThreadId] = useState<number | null>(null);
  const [carePlanOpen, setCarePlanOpen] = useState(false);

  const activeCaregiver = activeRelationship
    ? CAREGIVER_MATCHES.find((c) => c.id === activeRelationship.caregiverId)
    : null;
  const chatCaregiverId = activeRelationship?.caregiverId ?? CAREGIVER_MATCHES[0].id;

  const openInbox = () => {
    setInboxStartThreadId(null);
    setInboxOpen(true);
  };

  const openJiyeonChat = () => {
    setInboxStartThreadId(chatCaregiverId);
    setInboxOpen(true);
  };

  const closeInbox = () => {
    setInboxOpen(false);
    setInboxStartThreadId(null);
  };

  const firstName = profile.name.split(" ")[0];
  const reportPreview = dailyReport ? (locale === "ko" ? dailyReport.reportKo : dailyReport.reportEn) : null;
  const replyDraft = dailyReport?.parentReplyDraft ?? t("home.draftText");

  return (
    <>
    <ScreenScrollView contentContainerStyle={styles.content}>
      <LinearGradient colors={[...gradients.hero]} style={styles.hero}>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.greeting}>{t("home.greeting")}</Text>
            <Text style={styles.name}>{firstName} 👋</Text>
          </View>
          <Avatar src={profile.avatar} size={48} />
        </View>
        <View style={styles.caregiverCard}>
          <Avatar src={activeCaregiver?.img ?? "photo-1544005313-94ddf0286df2"} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.caregiverLabel}>{t("home.emmaWith")}</Text>
            <Text style={styles.caregiverName}>
              {activeCaregiver
                ? `${activeCaregiver.name} · ${activeRelationship?.schedule ?? t("home.until")}`
                : `Ji-yeon Park · ${t("home.until")}`}
            </Text>
          </View>
          <CheckCircle size={18} color={matchConfirmed ? colors.yellow : colors.muted} />
        </View>
      </LinearGradient>

      {matchConfirmed && activeRelationship && activeCaregiver && (
        <View style={styles.activeCareCard}>
          <Text style={styles.activeCareTitle}>{t("home.activeCareTitle")}</Text>
          <Text style={styles.activeCareName}>
            {activeCaregiver.name} · {activeRelationship.schedule}
          </Text>
          <Text style={styles.activeCareSub}>{t("home.activeCareDetail")}</Text>
          <View style={styles.activeCareActions}>
            <Pressable style={styles.activePrimaryBtn} onPress={openJiyeonChat}>
              <Text style={styles.activePrimaryBtnText}>{t("home.openChat")}</Text>
            </Pressable>
            <Pressable style={styles.activeSecondaryBtn} onPress={() => setCarePlanOpen(true)}>
              <Text style={styles.activeSecondaryBtnText}>{t("home.viewCarePlan")}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Pressable style={styles.chatEntry} onPress={openInbox}>
        <View style={styles.chatEntryIcon}>
          <MessageCircle size={18} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chatEntryTitle}>{t("home.openChat")}</Text>
          <Text style={styles.chatEntrySub}>{t("home.openChatSub")}</Text>
        </View>
        <ChevronRight size={18} color={colors.muted} />
      </Pressable>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("home.todaysReport")}</Text>
          {dailyReport && (
            <View style={styles.aiBadge}>
              <Sparkles size={11} color={colors.yellow} />
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
            {dailyReport && (
              <View style={styles.aiPill}>
                <Sparkles size={11} color={colors.yellow} />
                <Text style={styles.aiPillText}>AI</Text>
              </View>
            )}
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
            { icon: MessageCircle, label: t("home.messageNanny"), onPress: openJiyeonChat },
            { icon: Calendar, label: t("home.schedulePickup") },
            { icon: Globe, label: t("home.translateReport") },
            { icon: FileText, label: t("home.viewHistory") },
          ].map(({ icon: Icon, label, onPress }) => (
            <Pressable key={label} style={styles.actionCard} onPress={onPress}>
              <View style={styles.actionIcon}>
                <Icon size={18} color={colors.text} />
              </View>
              <Text style={styles.actionLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("home.aiDraftReply")}</Text>
        <View style={styles.draftCard}>
          <Text style={styles.draftHint}>
            <Sparkles size={11} color={colors.yellow} /> {t("home.suggestedMessage")}
          </Text>
          <Text style={styles.draftText}>&ldquo;{replyDraft}&rdquo;</Text>
          <View style={styles.draftActions}>
            <Pressable style={styles.primaryBtn}>
              <Send size={14} color={colors.primaryForeground} />
              <Text style={styles.primaryBtnText}>{t("home.send")}</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>{t("home.edit")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScreenScrollView>

    <CareInboxModal visible={inboxOpen} onClose={closeInbox} startThreadId={inboxStartThreadId} />
    <CarePlanModal open={carePlanOpen} plan={carePlan} onClose={() => setCarePlanOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  hero: {
    marginHorizontal: 16,
    marginTop: 8,
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
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatEntry: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatEntryIcon: {
    backgroundColor: colors.yellowSoft,
    borderRadius: 12,
    padding: 8,
  },
  chatEntryTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  chatEntrySub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  caregiverLabel: { fontSize: 12, color: colors.muted },
  caregiverName: { fontSize: 14, fontWeight: "600", color: colors.text },
  activeCareCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.yellow,
    padding: 16,
  },
  activeCareTitle: { fontSize: 12, fontWeight: "700", color: colors.text, marginBottom: 4 },
  activeCareName: { fontSize: 14, fontWeight: "700", color: colors.text },
  activeCareSub: { fontSize: 11, color: colors.muted, marginTop: 4 },
  activeCareActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  activePrimaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  activePrimaryBtnText: { fontSize: 12, fontWeight: "600", color: colors.primaryForeground },
  activeSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.backgroundSecondary,
  },
  activeSecondaryBtnText: { fontSize: 12, fontWeight: "600", color: colors.text },
  section: { marginHorizontal: 16, marginTop: 24 },
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
    backgroundColor: colors.yellowSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  aiBadgeText: { fontSize: 11, fontWeight: "600", color: colors.text },
  reportMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  metaLabel: { fontSize: 12, color: colors.muted },
  metaValue: { fontSize: 14, fontWeight: "600", color: colors.text },
  aiPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.yellowSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  aiPillText: { fontSize: 11, fontWeight: "600", color: colors.text },
  reportBody: { fontSize: 14, lineHeight: 22, color: colors.muted },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
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
  actionIcon: { backgroundColor: colors.backgroundSecondary, borderRadius: 12, padding: 8 },
  actionLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },
  draftCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
    borderTopColor: colors.yellow,
    padding: 16,
  },
  draftHint: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  draftText: { fontSize: 14, lineHeight: 22, color: colors.text, fontStyle: "italic" },
  draftActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  primaryBtnText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
  secondaryBtn: {
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.md,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "600", color: colors.text },
});
