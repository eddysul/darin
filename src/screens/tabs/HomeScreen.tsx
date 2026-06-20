import { LinearGradient } from "expo-linear-gradient";
import { Baby, Bell, Calendar, CheckCircle, FileText, Globe, MessageCircle, PenLine, Send, Sparkles, Users } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { CaregiverContractModal } from "../../components/CaregiverContractModal";
import { PressScale } from "../../components/PressScale";
import { useApp } from "../../context/AppContext";
import { useLanguage } from "../../LanguageContext";
import type { IncomingRequest } from "../../types/interview";
import { colors, gradients, radius } from "../../theme";

export function HomeScreen() {
  const { profile, dailyReport, scheduledInterviews, completeInterview, setPendingTab, incomingRequests, acceptRequest } = useApp();
  const [contractRequest, setContractRequest] = useState<IncomingRequest | null>(null);
  const { locale, t } = useLanguage();
  const firstName = profile.name.split(" ")[0];
  const reportPreview = dailyReport ? (locale === "ko" ? dailyReport.reportKo : dailyReport.reportEn) : null;
  const replyDraft = dailyReport?.parentReplyDraft ?? t("home.draftText");
  const ko = locale === "ko";

  const scheduledOnHome = scheduledInterviews.filter((i) => i.status === "scheduled");
  const postInterview = scheduledInterviews.filter(
    (i) => i.status === "completed" || i.status === "contract_signed",
  );
  const activeContract = scheduledInterviews.find((i) => i.status === "contract_signed");

  if (profile.role === "caregiver") {
    return <CaregiverHomeScreen contractRequest={contractRequest} setContractRequest={setContractRequest} />;
  }

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
        {activeContract ? (
          <View style={styles.caregiverCard}>
            <View style={styles.caregiverIcon}>
              <Baby size={20} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.caregiverLabel}>{t("home.myCaregiver")}</Text>
              <Text style={styles.caregiverName}>
                {activeContract.caregiverName} · {activeContract.contractFields?.weeklyPay ?? activeContract.weeklyPay}
              </Text>
            </View>
            <CheckCircle size={18} color={colors.sage} />
          </View>
        ) : (
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
        )}
      </LinearGradient>

      {scheduledOnHome.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("home.interviewsSection")}</Text>
          {scheduledOnHome.map((interview) => (
            <View key={interview.id} style={styles.interviewCard}>
              <Avatar src={interview.caregiverAvatar} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.interviewLabel}>{t("home.upcomingInterview")}</Text>
                <Text style={styles.interviewName}>{interview.caregiverName}</Text>
                <Text style={styles.interviewTime}>
                  {ko ? interview.slotLabelKo : interview.slotLabelEn}
                </Text>
              </View>
              <PressScale style={styles.completeBtn} onPress={() => completeInterview(interview.id)}>
                <CheckCircle size={14} color={colors.text} />
                <Text style={styles.completeBtnText}>{t("interview.markComplete")}</Text>
              </PressScale>
            </View>
          ))}
        </View>
      )}

      {postInterview.map((interview) => (
        <View key={interview.id} style={styles.section}>
          <View style={styles.interviewCard}>
            <View style={styles.interviewIcon}>
              <Calendar size={18} color={interview.status === "contract_signed" ? colors.sage : colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.interviewLabel}>
                {interview.status === "contract_signed"
                  ? t("home.contractSigned")
                  : t("home.readyToSign")}
              </Text>
              <Text style={styles.interviewName}>{interview.caregiverName}</Text>
              <Text style={styles.interviewTime}>
                {interview.status === "completed"
                  ? t("home.signOnProfile")
                  : t("home.contractActive")}
              </Text>
            </View>
            {interview.status === "completed" && (
              <PressScale style={styles.profileLinkBtn} onPress={() => setPendingTab("Profile")}>
                <PenLine size={14} color="#fff" />
                <Text style={styles.profileLinkText}>{t("contract.sign")}</Text>
              </PressScale>
            )}
            {interview.status === "contract_signed" && (
              <CheckCircle size={18} color={colors.sage} />
            )}
          </View>
        </View>
      ))}

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

// ─── Caregiver Home ───────────────────────────────────────────────────────────

function CaregiverHomeScreen({
  contractRequest,
  setContractRequest,
}: {
  contractRequest: IncomingRequest | null;
  setContractRequest: (r: IncomingRequest | null) => void;
}) {
  const { profile, incomingRequests, acceptRequest } = useApp();
  const { locale, t } = useLanguage();
  const ko = locale === "ko";
  const firstName = profile.name.split(" ")[0];

  const pending = incomingRequests.filter((r) => r.status === "pending");
  const accepted = incomingRequests.filter((r) => r.status === "accepted" || r.status === "contract_signed");
  const activeContract = incomingRequests.find((r) => r.status === "contract_signed");

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <LinearGradient colors={[...gradients.hero]} style={styles.hero}>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.greeting}>{t("caregiver.home.greeting")}</Text>
            <Text style={styles.name}>{firstName} 👋</Text>
          </View>
          <Avatar src={profile.avatar} size={48} />
        </View>
        {activeContract ? (
          <View style={styles.caregiverCard}>
            <View style={styles.caregiverIcon}>
              <CheckCircle size={20} color={colors.sage} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.caregiverLabel}>{t("caregiver.home.contractSigned")}</Text>
              <Text style={styles.caregiverName}>
                {activeContract.parentName} · {activeContract.contractFields?.weeklyPay ?? activeContract.budget}
              </Text>
            </View>
            <CheckCircle size={18} color={colors.sage} />
          </View>
        ) : (
          <View style={styles.caregiverCard}>
            <View style={styles.caregiverIcon}>
              <Bell size={20} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.caregiverLabel}>{t("caregiver.home.requests")}</Text>
              <Text style={styles.caregiverName}>
                {pending.length > 0
                  ? `${pending.length} ${ko ? "개의 새 요청" : "new request(s)"}`
                  : t("caregiver.home.noRequests")}
              </Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* Pending interview requests */}
      {pending.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("caregiver.home.requests")}</Text>
          {pending.map((req) => (
            <View key={req.id} style={[styles.interviewCard, { borderColor: colors.gold }]}>
              <Avatar src={req.parentAvatar} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.interviewLabel}>{ko ? "인터뷰 요청" : "Interview Request"}</Text>
                <Text style={styles.interviewName}>{req.parentName}</Text>
                <Text style={styles.interviewTime}>{ko ? req.slotLabelKo : req.slotLabelEn}</Text>
                <Text style={styles.interviewSubtext}>
                  {req.liveIn ? (ko ? "입주" : "Live-in") : (ko ? "출퇴근" : "Live-out")} · {req.budget}
                </Text>
              </View>
              <View style={styles.requestActions}>
                <PressScale
                  style={styles.acceptBtn}
                  onPress={() => acceptRequest(req.id)}
                  scale={0.95}
                >
                  <Text style={styles.acceptBtnText}>{t("caregiver.home.accept")}</Text>
                </PressScale>
                <PressScale style={styles.declineBtn} scale={0.95}>
                  <Text style={styles.declineBtnText}>{t("caregiver.home.decline")}</Text>
                </PressScale>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Accepted / signed */}
      {accepted.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{ko ? "진행 중" : "In Progress"}</Text>
          {accepted.map((req) => {
            const isSigned = req.status === "contract_signed";
            const hasParentSig = !!req.parentSignature;
            return (
              <View key={req.id} style={[styles.interviewCard, { borderColor: isSigned ? colors.sage : colors.gold }]}>
                <View style={[styles.interviewIcon, { backgroundColor: isSigned ? `${colors.sage}18` : colors.champagne }]}>
                  <Users size={18} color={isSigned ? colors.sage : colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.interviewLabel, { color: isSigned ? colors.sage : colors.gold }]}>
                    {isSigned
                      ? t("caregiver.home.contractSigned")
                      : hasParentSig
                        ? t("caregiver.home.contractReady")
                        : t("caregiver.home.accepted")}
                  </Text>
                  <Text style={styles.interviewName}>{req.parentName}</Text>
                  <Text style={styles.interviewTime}>{ko ? req.slotLabelKo : req.slotLabelEn}</Text>
                </View>
                {hasParentSig && !isSigned && (
                  <PressScale
                    style={styles.profileLinkBtn}
                    onPress={() => setContractRequest(req)}
                    scale={0.95}
                  >
                    <PenLine size={13} color="#fff" />
                    <Text style={styles.profileLinkText}>{ko ? "서명" : "Sign"}</Text>
                  </PressScale>
                )}
                {isSigned && <CheckCircle size={18} color={colors.sage} />}
              </View>
            );
          })}
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("home.quickActions")}</Text>
        <View style={styles.actionsGrid}>
          {[
            { icon: MessageCircle, label: ko ? "메시지" : "Messages", bg: "#F0F3FA", fg: "#6B7FA8" },
            { icon: Calendar, label: ko ? "일정 관리" : "Schedule", bg: colors.champagne, fg: colors.gold },
            { icon: FileText, label: ko ? "돌봄 기록" : "Care Log", bg: "#EEF5F0", fg: colors.sage },
            { icon: Globe, label: ko ? "번역" : "Translate", bg: "#FFF9EB", fg: colors.gold },
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

      <CaregiverContractModal
        open={contractRequest !== null}
        request={contractRequest}
        onClose={() => setContractRequest(null)}
      />
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
  interviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 14,
    marginBottom: 10,
  },
  interviewIcon: { backgroundColor: colors.champagne, borderRadius: 12, padding: 10 },
  interviewLabel: { fontSize: 11, fontWeight: "600", color: colors.gold, marginBottom: 2 },
  interviewName: { fontSize: 15, fontWeight: "700", color: colors.text },
  interviewTime: { fontSize: 13, color: colors.muted, marginTop: 2 },
  completeBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.champagne,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 88,
  },
  completeBtnText: { fontSize: 10, fontWeight: "700", color: colors.text, textAlign: "center" },
  profileLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.sage,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  profileLinkText: { fontSize: 12, fontWeight: "700", color: "#fff" },
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
  interviewSubtext: { fontSize: 12, color: colors.muted, marginTop: 2 },
  requestActions: { gap: 6, alignItems: "flex-end" },
  acceptBtn: {
    backgroundColor: colors.sage,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  acceptBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  declineBtn: {
    backgroundColor: colors.champagne,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  declineBtnText: { fontSize: 12, fontWeight: "600", color: colors.muted },
});
