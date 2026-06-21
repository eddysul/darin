import { LinearGradient } from "expo-linear-gradient";
import { Baby, Bell, Calendar, CheckCircle, CreditCard, FileText, Globe, MessageCircle, PenLine, Users } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { CaregiverContractModal } from "../../components/CaregiverContractModal";
import { PaymentModal } from "../../components/PaymentModal";
import { PressSlide } from "../../components/PressSlide";
import { useApp } from "../../context/AppContext";
import { useLanguage } from "../../LanguageContext";
import type { IncomingRequest } from "../../types/interview";
import type { WeeklyPayment } from "../../types/payment";
import { colors, gradients, radius } from "../../theme";

export function HomeScreen() {
  const { profile, dailyReport, scheduledInterviews, completeInterview, setPendingTab, weeklyPayments } = useApp();
  const [contractRequest, setContractRequest] = useState<IncomingRequest | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<WeeklyPayment | null>(null);
  const [activeTab, setActiveTab] = useState<"interviews" | "payments">("interviews");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);
  const { locale, t } = useLanguage();
  const firstName = profile.name.split(" ")[0];
  const reportPreview = dailyReport ? (locale === "ko" ? dailyReport.reportKo : dailyReport.reportEn) : null;
  const ko = locale === "ko";

  const activeContract = scheduledInterviews.find((i) => i.status === "contract_signed");
  const currentPayment = weeklyPayments[0] ?? null;

  if (profile.role === "caregiver") {
    return <CaregiverHomeScreen contractRequest={contractRequest} setContractRequest={setContractRequest} />;
  }

  const openPayment = (p: WeeklyPayment) => {
    setSelectedPayment(p);
    setPaymentOpen(true);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Animated.View style={{ opacity: fadeAnim }}>
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
              <Text style={styles.caregiverLabel}>{ko ? "케어기버" : "Caregiver"}</Text>
              <Text style={styles.caregiverName}>Ji-yeon Park · {t("home.until")}</Text>
            </View>
            <CheckCircle size={18} color={colors.sage} />
          </View>
        )}
      </LinearGradient>

      {/* Interview / Payment tab bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabItem, activeTab === "interviews" && styles.tabItemActive]}
          onPress={() => setActiveTab("interviews")}
        >
          <Calendar size={14} color={activeTab === "interviews" ? colors.navy : colors.muted} />
          <Text style={[styles.tabLabel, activeTab === "interviews" && styles.tabLabelActive]}>
            {ko ? "인터뷰" : "Interviews"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabItem, activeTab === "payments" && styles.tabItemActive, !activeContract && styles.tabItemDisabled]}
          onPress={() => activeContract && setActiveTab("payments")}
        >
          <CreditCard size={14} color={activeTab === "payments" ? colors.navy : colors.muted} />
          <Text style={[styles.tabLabel, activeTab === "payments" && styles.tabLabelActive, !activeContract && { color: colors.muted, opacity: 0.4 }]}>
            {ko ? "결제" : "Payments"}
          </Text>
        </Pressable>
      </View>

      {/* Interviews tab */}
      {activeTab === "interviews" && (
        <View style={styles.section}>
          {scheduledInterviews.length === 0 ? (
            <View style={styles.emptyTab}>
              <Calendar size={24} color={colors.muted} />
              <Text style={styles.emptyTabText}>{ko ? "예정된 인터뷰가 없습니다" : "No pending interviews"}</Text>
            </View>
          ) : (
            scheduledInterviews.map((interview) => {
              const isScheduled = interview.status === "scheduled";
              const isSigned = interview.status === "contract_signed";
              const statusColor = isScheduled ? colors.gold : isSigned ? colors.sage : "#6B7FA8";
              const statusLabel = isScheduled
                ? (ko ? "예정됨" : "Scheduled")
                : isSigned
                  ? (ko ? "계약 완료" : "Contract signed")
                  : (ko ? "서명 대기" : "Ready to sign");
              return (
                <View key={interview.id} style={[styles.interviewCard, { borderColor: statusColor }]}>
                  <Avatar src={interview.caregiverAvatar} size={44} />
                  <View style={{ flex: 1 }}>
                    <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
                      <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                    <Text style={styles.interviewName}>{interview.caregiverName}</Text>
                    <Text style={styles.interviewTime}>
                      {ko ? interview.slotLabelKo : interview.slotLabelEn}
                    </Text>
                  </View>
                  {isScheduled && (
                    <PressSlide style={styles.completeBtn} onPress={() => completeInterview(interview.id)}>
                      <CheckCircle size={15} color="#fff" />
                      <Text style={styles.completeBtnText}>{ko ? "완료" : "Done"}</Text>
                    </PressSlide>
                  )}
                  {interview.status === "completed" && (
                    <PressSlide style={styles.signBtn} onPress={() => setPendingTab("Profile")}>
                      <PenLine size={14} color="#fff" />
                      <Text style={styles.signBtnText}>{ko ? "서명" : "Sign"}</Text>
                    </PressSlide>
                  )}
                  {isSigned && <CheckCircle size={18} color={colors.sage} />}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Payments tab — only visible when contract signed */}
      {activeTab === "payments" && activeContract && (
        <View style={styles.section}>
          {currentPayment ? (
            <View style={[styles.paymentCard, currentPayment.status === "paid" && styles.paymentCardPaid]}>
              <View style={styles.paymentLeft}>
                <CreditCard size={18} color={currentPayment.status === "paid" ? colors.sage : colors.gold} />
                <View>
                  <Text style={styles.paymentWeek}>{ko ? currentPayment.weekLabelKo : currentPayment.weekLabel}</Text>
                  <Text style={styles.paymentAmount}>{currentPayment.amount}</Text>
                  <Text style={styles.paymentDue}>{ko ? `마감: ${currentPayment.dueDateKo}` : `Due: ${currentPayment.dueDate}`}</Text>
                </View>
              </View>
              {currentPayment.status === "paid" ? (
                <View style={styles.paidBadge}>
                  <CheckCircle size={13} color={colors.sage} />
                  <Text style={styles.paidText}>{t("payment.received")}</Text>
                </View>
              ) : (
                <PressSlide style={styles.payBtn} onPress={() => openPayment(currentPayment)}>
                  <Text style={styles.payBtnText}>{t("payment.pay")}</Text>
                </PressSlide>
              )}
            </View>
          ) : (
            <View style={styles.emptyTab}>
              <CreditCard size={24} color={colors.muted} />
              <Text style={styles.emptyTabText}>{ko ? "결제 정보가 없습니다" : "No payment information"}</Text>
            </View>
          )}
        </View>
      )}

      {/* Today's report */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("home.todaysReport")}</Text>
        <View style={styles.card}>
          <View style={styles.reportMeta}>
            <Avatar src="photo-1544005313-94ddf0286df2" size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>{t("home.from")}</Text>
              <Text style={styles.metaValue}>
                {dailyReport ? `${dailyReport.date} · ${dailyReport.savedAt}` : "June 20 · 5:42 PM"}
              </Text>
            </View>
          </View>
          <Text style={styles.reportBody}>
            {reportPreview ??
              (ko
                ? "Log 탭에서 기록을 추가하고 일일 리포트를 생성해 보세요."
                : "Add entries in the Log tab and generate a daily report to see it here.")}
          </Text>
        </View>
      </View>

      {/* Quick actions */}
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
      </Animated.View>

      <PaymentModal
        open={paymentOpen}
        payment={selectedPayment}
        onClose={() => setPaymentOpen(false)}
      />
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
  const { profile, incomingRequests, acceptRequest, weeklyPayments } = useApp();
  const { locale, t } = useLanguage();
  const ko = locale === "ko";
  const firstName = profile.name.split(" ")[0];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState<"interviews" | "payments">("interviews");
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const pending = incomingRequests.filter((r) => r.status === "pending");
  const accepted = incomingRequests.filter((r) => r.status === "accepted" || r.status === "contract_signed");
  const activeContract = incomingRequests.find((r) => r.status === "contract_signed");
  const currentPayment = weeklyPayments[0] ?? null;
  const allInterviews = [...pending, ...accepted];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Animated.View style={{ opacity: fadeAnim }}>
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

      {/* Interview / Payment tab bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabItem, activeTab === "interviews" && styles.tabItemActive]}
          onPress={() => setActiveTab("interviews")}
        >
          <Calendar size={14} color={activeTab === "interviews" ? colors.navy : colors.muted} />
          <Text style={[styles.tabLabel, activeTab === "interviews" && styles.tabLabelActive]}>
            {ko ? "인터뷰" : "Interviews"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabItem, activeTab === "payments" && styles.tabItemActive, !activeContract && styles.tabItemDisabled]}
          onPress={() => activeContract && setActiveTab("payments")}
        >
          <CreditCard size={14} color={activeTab === "payments" ? colors.navy : colors.muted} />
          <Text style={[styles.tabLabel, activeTab === "payments" && styles.tabLabelActive, !activeContract && { color: colors.muted, opacity: 0.4 }]}>
            {ko ? "급여" : "Payments"}
          </Text>
        </Pressable>
      </View>

      {/* Interviews tab */}
      {activeTab === "interviews" && (
        <View style={styles.section}>
          {allInterviews.length === 0 ? (
            <View style={styles.emptyTab}>
              <Calendar size={24} color={colors.muted} />
              <Text style={styles.emptyTabText}>{ko ? "예정된 인터뷰가 없습니다" : "No pending interviews"}</Text>
            </View>
          ) : (
            <>
              {pending.map((req) => (
                <View key={req.id} style={[styles.interviewCard, { borderColor: colors.gold }]}>
                  <Avatar src={req.parentAvatar} size={44} />
                  <View style={{ flex: 1 }}>
                    <View style={[styles.statusPill, { backgroundColor: `${colors.gold}18` }]}>
                      <Text style={[styles.statusPillText, { color: colors.gold }]}>{ko ? "인터뷰 요청" : "Interview Request"}</Text>
                    </View>
                    <Text style={styles.interviewName}>{req.parentName}</Text>
                    <Text style={styles.interviewTime}>{ko ? req.slotLabelKo : req.slotLabelEn}</Text>
                    <Text style={styles.interviewSubtext}>
                      {req.liveIn ? (ko ? "입주" : "Live-in") : (ko ? "출퇴근" : "Live-out")} · {req.budget}
                    </Text>
                  </View>
                  <View style={styles.requestActions}>
                    <PressSlide style={styles.acceptBtn} onPress={() => acceptRequest(req.id)}>
                      <Text style={styles.acceptBtnText}>{t("caregiver.home.accept")}</Text>
                    </PressSlide>
                    <PressSlide style={styles.declineBtn}>
                      <Text style={styles.declineBtnText}>{t("caregiver.home.decline")}</Text>
                    </PressSlide>
                  </View>
                </View>
              ))}
              {accepted.map((req) => {
                const isSigned = req.status === "contract_signed";
                const hasParentSig = !!req.parentSignature;
                const statusColor = isSigned ? colors.sage : colors.gold;
                const statusLabel = isSigned
                  ? t("caregiver.home.contractSigned")
                  : hasParentSig ? t("caregiver.home.contractReady") : t("caregiver.home.accepted");
                return (
                  <View key={req.id} style={[styles.interviewCard, { borderColor: statusColor }]}>
                    <View style={[styles.interviewIcon, { backgroundColor: `${statusColor}18` }]}>
                      <Users size={18} color={statusColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
                        <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
                      </View>
                      <Text style={styles.interviewName}>{req.parentName}</Text>
                      <Text style={styles.interviewTime}>{ko ? req.slotLabelKo : req.slotLabelEn}</Text>
                    </View>
                    {hasParentSig && !isSigned && (
                      <PressSlide style={styles.signBtn} onPress={() => setContractRequest(req)}>
                        <PenLine size={13} color="#fff" />
                        <Text style={styles.signBtnText}>{ko ? "서명" : "Sign"}</Text>
                      </PressSlide>
                    )}
                    {isSigned && <CheckCircle size={18} color={colors.sage} />}
                  </View>
                );
              })}
            </>
          )}
        </View>
      )}

      {/* Payments tab — only visible when contract signed */}
      {activeTab === "payments" && activeContract && (
        <View style={styles.section}>
          {currentPayment ? (
            <View style={[styles.paymentCard, currentPayment.status === "paid" && styles.paymentCardPaid]}>
              <View style={styles.paymentLeft}>
                <CreditCard size={18} color={currentPayment.status === "paid" ? colors.sage : "#f59e0b"} />
                <View>
                  <Text style={styles.paymentWeek}>{ko ? currentPayment.weekLabelKo : currentPayment.weekLabel}</Text>
                  <Text style={styles.paymentAmount}>{currentPayment.amount}</Text>
                  <Text style={styles.paymentDue}>{ko ? `마감: ${currentPayment.dueDateKo}` : `Due: ${currentPayment.dueDate}`}</Text>
                </View>
              </View>
              {currentPayment.status === "paid" ? (
                <View style={styles.paidBadge}>
                  <CheckCircle size={13} color={colors.sage} />
                  <Text style={styles.paidText}>{t("payment.caregiverPaid")}</Text>
                </View>
              ) : (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingText}>{t("payment.caregiverPending")}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyTab}>
              <CreditCard size={24} color={colors.muted} />
              <Text style={styles.emptyTabText}>{ko ? "결제 정보가 없습니다" : "No payment information"}</Text>
            </View>
          )}
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

      </Animated.View>
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
  interviewSubtext: { fontSize: 12, color: colors.muted, marginTop: 2 },

  completeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  completeBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  signBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.sage,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  signBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  reportMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  metaLabel: { fontSize: 12, color: colors.muted },
  metaValue: { fontSize: 14, fontWeight: "600", color: colors.text },
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

  requestActions: { gap: 6, alignItems: "flex-end" },
  acceptBtn: {
    backgroundColor: colors.sage,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: "center",
  },
  acceptBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  declineBtn: {
    backgroundColor: colors.champagne,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  declineBtnText: { fontSize: 13, fontWeight: "600", color: colors.muted },

  // Payment card
  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  paymentCardPaid: { borderColor: `${colors.sage}40` },
  paymentLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  paymentWeek: { fontSize: 12, color: colors.muted },
  paymentAmount: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 2 },
  payBtn: {
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: "center",
  },
  payBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: `${colors.sage}18`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  paidText: { fontSize: 12, fontWeight: "700", color: colors.sage },
  pendingBadge: {
    backgroundColor: "#FFF9EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "#f59e0b40",
  },
  pendingText: { fontSize: 12, fontWeight: "700", color: "#f59e0b" },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },

  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  tabItemActive: {
    backgroundColor: `${colors.navy}12`,
  },
  tabItemDisabled: { opacity: 0.45 },
  tabLabel: { fontSize: 13, fontWeight: "600", color: colors.muted },
  tabLabelActive: { color: colors.navy },

  statusPill: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  statusPillText: { fontSize: 11, fontWeight: "700" },

  paymentDue: { fontSize: 11, color: colors.muted, marginTop: 2 },

  emptyTab: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 32,
  },
  emptyTabText: { fontSize: 14, color: colors.muted, fontWeight: "500" },
});
