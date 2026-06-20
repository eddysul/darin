import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Baby,
  Calendar,
  CheckCircle,
  ChevronRight,
  CreditCard,
  DollarSign,
  Edit3,
  FileText,
  Globe,
  Home,
  Milk,
  PenLine,
  Plus,
  Tag,
  UserCog,
} from "lucide-react-native";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../components/Avatar";
import { BidModal } from "../../components/BidModal";
import { ContractSigningModal } from "../../components/ContractSigningModal";
import { PressScale } from "../../components/PressScale";
import { useApp } from "../../context/AppContext";
import { useLanguage } from "../../LanguageContext";
import type { ScheduledInterview } from "../../types/interview";
import { colors, radius } from "../../theme";

export function ProfileScreen() {
  const {
    profile,
    setLangPickerOpen,
    setProfileEditOpen,
    scheduledInterviews,
    pendingContractInterviewId,
    clearPendingContractInterview,
  } = useApp();
  const { locale, t } = useLanguage();
  const ko = locale === "ko";
  const [contractInterview, setContractInterview] = useState<ScheduledInterview | null>(null);
  const [bidOpen, setBidOpen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, []);

  // Auto-open contract modal when navigated here after marking interview complete
  useEffect(() => {
    if (pendingContractInterviewId) {
      const interview = scheduledInterviews.find((i) => i.id === pendingContractInterviewId);
      if (interview && interview.status === "completed") {
        setContractInterview(interview);
        clearPendingContractInterview();
      }
    }
  }, [pendingContractInterviewId, scheduledInterviews, clearPendingContractInterview]);

  const children = [{ name: "Emma", age: locale === "ko" ? "2세 4개월" : "2 yrs 4 mo", img: "photo-1594608661623-aa0bd3a69d98" }];

  const settings = [
    {
      icon: Globe,
      label: t("profile.langPref"),
      value: locale === "ko" ? t("profile.langValueKo") : t("profile.langValueEn"),
      onPress: () => setLangPickerOpen(true),
    },
    { icon: Bell, label: t("profile.notifications"), value: t("profile.notifValue") },
    { icon: CreditCard, label: t("profile.billing"), value: t("profile.billingValue") },
  ];

  const statusLabel = (status: ScheduledInterview["status"]) =>
    status === "scheduled"
      ? t("interview.statusScheduled")
      : status === "completed"
        ? t("interview.statusCompleted")
        : t("interview.statusSigned");

  const statusColor = (status: ScheduledInterview["status"]) =>
    status === "scheduled" ? colors.gold : status === "completed" ? "#6B7FA8" : colors.sage;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Animated.View style={{ opacity: fadeAnim }}>
      {/* Hero */}
      <View style={styles.hero}>
        <PressScale style={styles.editBtn} onPress={() => setProfileEditOpen(true)}>
          <UserCog size={18} color={colors.muted} />
        </PressScale>
        <View style={styles.heroRow}>
          <Avatar src={profile.avatar} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.role}>
              {profile.role === "caregiver" ? t("profile.roleCaregiver") : t("profile.roleParent")} · {profile.location}
            </Text>
            {profile.languages && (
              <View style={styles.langs}>
                {profile.languages.split(",").map((lang) => (
                  <Text key={lang.trim()} style={styles.langChip}>
                    {lang.trim()}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Children */}
      {profile.role === "parent" && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("profile.children")}</Text>
            <PressScale style={styles.addBtn}>
              <Plus size={14} color={colors.gold} />
              <Text style={styles.addText}>{t("profile.add")}</Text>
            </PressScale>
          </View>
          {children.map((child) => (
            <View key={child.name} style={styles.childCard}>
              <Avatar src={child.img} size={44} />
              <View>
                <Text style={styles.childName}>{child.name}</Text>
                <Text style={styles.childAge}>{child.age}</Text>
              </View>
              <ChevronRight size={16} color={colors.muted} style={{ marginLeft: "auto" }} />
            </View>
          ))}
        </View>
      )}

      {/* Interviews & Contracts — all statuses */}
      {profile.role === "parent" && scheduledInterviews.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profile.interviews")}</Text>
          {scheduledInterviews.map((interview) => {
            const color = statusColor(interview.status);
            return (
              <View key={interview.id} style={styles.interviewCard}>
                <View style={styles.interviewTop}>
                  <Avatar src={interview.caregiverAvatar} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.interviewName}>{interview.caregiverName}</Text>
                    <Text style={styles.interviewTime}>
                      {ko ? interview.slotLabelKo : interview.slotLabelEn}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${color}18` }]}>
                      <Text style={[styles.statusText, { color }]}>{statusLabel(interview.status)}</Text>
                    </View>
                  </View>
                </View>

                {interview.status === "completed" && (
                  <PressScale
                    style={styles.actionBtnPrimary}
                    onPress={() => setContractInterview(interview)}
                  >
                    <PenLine size={16} color="#fff" />
                    <Text style={styles.actionBtnPrimaryText}>{t("contract.reviewSign")}</Text>
                  </PressScale>
                )}

                {interview.status === "contract_signed" && (
                  <View style={styles.signedRow}>
                    <CheckCircle size={16} color={colors.sage} />
                    <Text style={styles.signedText}>
                      {t("contract.signedWith")} {interview.caregiverName}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Care Request card */}
      {profile.role === "parent" && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>{t("profile.careRequest")}</Text>
            <Pressable style={styles.editLink} onPress={() => setProfileEditOpen(true)}>
              <Text style={styles.editLinkText}>{t("profile.editProfile")}</Text>
            </Pressable>
          </View>
          <PressScale style={styles.careCard} onPress={() => setProfileEditOpen(true)}>
            {[
              { icon: Baby, color: "#ec4899", label: t("profile.dueDate"), value: profile.dueDate || "—" },
              { icon: DollarSign, color: "#22c55e", label: t("profile.budget"), value: profile.budget || "—" },
              { icon: Home, color: "#8b5cf6", label: t("profile.liveIn"), value: profile.liveIn ? t("profile.liveInYes") : t("profile.liveInNo") },
              { icon: Calendar, color: "#f59e0b", label: t("profile.experience"), value: profile.experience || "—" },
              { icon: Milk, color: "#243036", label: t("profile.breastfeeding"), value: profile.breastfeeding ? t("profile.breastfeedingYes") : t("profile.breastfeedingNo") },
              { icon: FileText, color: "#64748b", label: t("profile.notes"), value: profile.notes || "—" },
            ].map(({ icon: Icon, color, label, value }, i) => (
              <View key={label} style={[styles.careRow, i > 0 && styles.careRowBorder]}>
                <View style={[styles.careIcon, { backgroundColor: `${color}18` }]}>
                  <Icon size={15} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.careLabel}>{label}</Text>
                  <Text style={styles.careValue}>{value}</Text>
                </View>
              </View>
            ))}
          </PressScale>
        </View>
      )}

      {/* Caregiver professional profile */}
      {profile.role === "caregiver" && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>{t("profile.professionalProfile")}</Text>
            <Pressable style={styles.editLink} onPress={() => setProfileEditOpen(true)}>
              <Text style={styles.editLinkText}>{t("profile.editProfile")}</Text>
            </Pressable>
          </View>
          <PressScale style={styles.careCard} onPress={() => setProfileEditOpen(true)}>
            {[
              { icon: Calendar, color: "#f59e0b", label: t("profile.experience"), value: profile.experience || "—" },
              { icon: FileText, color: "#8b5cf6", label: t("onboarding.specialty"), value: profile.specialty || "—" },
              { icon: DollarSign, color: "#22c55e", label: t("profile.weeklyRate"), value: profile.weeklyRate || "—" },
              { icon: Home, color: "#6B7FA8", label: t("profile.availability"), value: profile.availability || "—" },
              { icon: Baby, color: "#ec4899", label: t("profile.liveIn"), value: profile.liveIn ? t("profile.liveInYes") : t("profile.liveInNo") },
              { icon: Milk, color: "#243036", label: t("profile.breastfeeding"), value: profile.breastfeeding ? t("profile.breastfeedingYes") : t("profile.breastfeedingNo") },
            ].map(({ icon: Icon, color, label, value }, i) => (
              <View key={label} style={[styles.careRow, i > 0 && styles.careRowBorder]}>
                <View style={[styles.careIcon, { backgroundColor: `${color}18` }]}>
                  <Icon size={15} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.careLabel}>{label}</Text>
                  <Text style={styles.careValue}>{value}</Text>
                </View>
              </View>
            ))}
          </PressScale>
          {profile.licenseNumber && (
            <View style={[styles.careCard, { marginTop: 10 }]}>
              <View style={styles.careRow}>
                <View style={[styles.careIcon, { backgroundColor: `${colors.gold}18` }]}>
                  <FileText size={15} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.careLabel}>{t("onboarding.licenseNumber")}</Text>
                  <Text style={styles.careValue}>{profile.licenseNumber}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Caregiver Bid card */}
      {profile.role === "caregiver" && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>{t("profile.myBid")}</Text>
            <PressScale style={styles.editLink} onPress={() => setBidOpen(true)}>
              <Edit3 size={13} color={colors.gold} />
              <Text style={[styles.editLinkText, { marginLeft: 4 }]}>
                {profile.bidRate ? t("profile.updateBid") : t("profile.submitBid")}
              </Text>
            </PressScale>
          </View>
          <PressScale style={styles.bidCard} onPress={() => setBidOpen(true)}>
            <View style={styles.bidTopRow}>
              <View style={[styles.careIcon, { backgroundColor: `${colors.gold}18` }]}>
                <Tag size={16} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.careLabel}>{t("profile.bidRate")}</Text>
                <Text style={styles.bidRate}>
                  {profile.bidRate ?? <Text style={styles.noBid}>{t("profile.noBid")}</Text>}
                </Text>
              </View>
              {profile.bidRate && (
                <View style={styles.bidActiveBadge}>
                  <Text style={styles.bidActiveBadgeText}>{t("profile.bidActive")}</Text>
                </View>
              )}
            </View>
            {profile.bidNote ? (
              <View style={styles.bidNoteRow}>
                <Text style={styles.bidNoteText}>{profile.bidNote}</Text>
              </View>
            ) : null}
          </PressScale>
        </View>
      )}

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("profile.settings")}</Text>
        <View style={styles.settingsCard}>
          {settings.map(({ icon: Icon, label, value, onPress }, i) => (
            <PressScale
              key={label}
              style={[styles.settingRow, i > 0 && styles.settingBorder]}
              onPress={onPress}
              scale={0.98}
            >
              <View style={styles.settingIcon}>
                <Icon size={16} color={colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{label}</Text>
                <Text style={styles.settingValue}>{value}</Text>
              </View>
              <ChevronRight size={14} color={colors.muted} />
            </PressScale>
          ))}
        </View>
      </View>

      </Animated.View>

      <ContractSigningModal
        open={contractInterview !== null}
        interview={contractInterview}
        onClose={() => setContractInterview(null)}
        onSigned={() => setContractInterview(null)}
      />
      <BidModal open={bidOpen} onClose={() => setBidOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  hero: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 16,
  },
  editBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.champagne,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  heroRow: { flexDirection: "row", gap: 16, paddingRight: 40 },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  role: { fontSize: 14, color: colors.muted, marginTop: 4 },
  langs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  langChip: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.gold,
    backgroundColor: colors.champagne,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },
  sectionTitleInline: { marginBottom: 0 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addText: { fontSize: 14, fontWeight: "600", color: colors.gold },
  editLink: { paddingVertical: 4, paddingHorizontal: 2 },
  editLinkText: { fontSize: 14, fontWeight: "600", color: colors.gold },
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  childName: { fontSize: 14, fontWeight: "600", color: colors.text },
  childAge: { fontSize: 12, color: colors.muted },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  infoLine: { fontSize: 14, color: colors.text },
  infoBold: { fontWeight: "600" },
  licenseImg: { width: 160, height: 100, borderRadius: radius.md, marginTop: 8 },
  settingsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  settingBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  settingIcon: { backgroundColor: colors.champagne, borderRadius: 12, padding: 8 },
  settingLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  settingValue: { fontSize: 12, color: colors.muted, marginTop: 2 },
  careCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  careRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  careRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  careIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  careLabel: { fontSize: 11, color: colors.muted, marginBottom: 2 },
  careValue: { fontSize: 14, fontWeight: "600", color: colors.text },
  bidCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.gold,
    padding: 16,
    overflow: "hidden",
  },
  bidTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  bidRate: { fontSize: 20, fontWeight: "800", color: colors.gold, marginTop: 2 },
  noBid: { fontSize: 14, fontWeight: "500", color: colors.muted },
  bidActiveBadge: {
    backgroundColor: `${colors.gold}18`,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bidActiveBadgeText: { fontSize: 11, fontWeight: "700", color: colors.gold },
  bidNoteRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bidNoteText: { fontSize: 13, color: colors.text, lineHeight: 20, opacity: 0.8 },
  interviewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  interviewTop: { flexDirection: "row", gap: 12, marginBottom: 12 },
  interviewName: { fontSize: 15, fontWeight: "700", color: colors.text },
  interviewTime: { fontSize: 13, color: colors.muted, marginTop: 2 },
  statusBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
  actionBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.sage,
  },
  actionBtnPrimaryText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  signedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  signedText: { fontSize: 13, fontWeight: "600", color: colors.sage },
});
