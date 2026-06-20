import {
  Award,
  Calendar,
  ChevronLeft,
  Clock,
  DollarSign,
  MapPin,
  MessageCircle,
  Sparkles,
  Star,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../components/Avatar";
import { ScheduleInterviewModal } from "../components/ScheduleInterviewModal";
import { useApp } from "../context/AppContext";
import type { CaregiverMatch } from "../demo/caregivers";
import { getCaregiverRole } from "../i18n";
import { useLanguage } from "../LanguageContext";
import { colors, radius } from "../theme";

type Props = {
  caregiver: CaregiverMatch;
  onBack: () => void;
  onContact: () => void;
  onInterviewScheduled?: () => void;
};

export function CaregiverDetailScreen({ caregiver, onBack, onContact, onInterviewScheduled }: Props) {
  const insets = useSafeAreaInsets();
  const { locale, t } = useLanguage();
  const { scheduleInterview, getInterviewForCaregiver } = useApp();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const ko = locale === "ko";

  const existingInterview = getInterviewForCaregiver(caregiver.id);

  const location = ko ? caregiver.locationKo : caregiver.location;
  const experience = ko ? caregiver.experienceKo : caregiver.experienceEn;
  const certifications = ko ? caregiver.certificationsKo : caregiver.certificationsEn;
  const availability = ko ? caregiver.availableKo : caregiver.available;
  const strengths = ko ? caregiver.strengthsKo : caregiver.strengthsEn;

  const rows = [
    { icon: MapPin, label: t("caregiverDetail.location"), value: location },
    { icon: Award, label: t("caregiverDetail.experience"), value: experience },
    {
      icon: Sparkles,
      label: t("caregiverDetail.certifications"),
      value: certifications.join(" · "),
    },
    { icon: Clock, label: t("caregiverDetail.availability"), value: availability },
    { icon: DollarSign, label: t("caregiverDetail.weeklyPay"), value: caregiver.weeklyPay },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("caregiverDetail.title")}</Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Avatar src={caregiver.img} size={80} />
          <Text style={styles.name}>{caregiver.name}</Text>
          <Text style={styles.role}>{getCaregiverRole(locale, caregiver.role)}</Text>
          <View style={styles.ratingRow}>
            <Star size={14} color={colors.gold} fill={colors.gold} />
            <Text style={styles.rating}>{caregiver.rating}</Text>
            <Text style={styles.reviews}>({caregiver.reviews} {t("caregiverDetail.reviews")})</Text>
          </View>
        </View>

        <View style={styles.card}>
          {rows.map(({ icon: Icon, label, value }, i) => (
            <View key={label} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={styles.rowIcon}>
                <Icon size={16} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue}>{value}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("caregiverDetail.strengths")}</Text>
          <View style={styles.strengths}>
            {strengths.map((s) => (
              <View key={s} style={styles.strengthChip}>
                <Text style={styles.strengthText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        {existingInterview && (
          <View style={styles.scheduledBanner}>
            <Calendar size={16} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.scheduledLabel}>{t("interview.scheduled")}</Text>
              <Text style={styles.scheduledValue}>
                {ko ? existingInterview.slotLabelKo : existingInterview.slotLabelEn}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable style={styles.secondaryBtn} onPress={onContact}>
          <MessageCircle size={18} color={colors.text} />
          <Text style={styles.secondaryBtnText}>{t("caregiverDetail.contact")}</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={() => setScheduleOpen(true)}>
          <Calendar size={18} color={colors.text} />
          <Text style={styles.primaryBtnText}>
            {existingInterview ? t("interview.reschedule") : t("caregiverDetail.scheduleInterview")}
          </Text>
        </Pressable>
      </View>

      <ScheduleInterviewModal
        open={scheduleOpen}
        caregiver={caregiver}
        existingInterview={existingInterview}
        onClose={() => setScheduleOpen(false)}
        onConfirm={(slot) => {
          scheduleInterview(
            { id: caregiver.id, name: caregiver.name, img: caregiver.img, weeklyPay: caregiver.weeklyPay },
            slot,
          );
          onInterviewScheduled?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backSpacer: { width: 44 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.text },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  hero: { alignItems: "center", marginBottom: 20 },
  name: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 14 },
  role: { fontSize: 14, color: colors.muted, marginTop: 4 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  rating: { fontSize: 14, fontWeight: "700", color: colors.text },
  reviews: { fontSize: 13, color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 16,
  },
  row: { flexDirection: "row", gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.champagne,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 11, color: colors.muted, marginBottom: 3 },
  rowValue: { fontSize: 14, fontWeight: "600", color: colors.text, lineHeight: 20 },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 10 },
  strengths: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  strengthChip: {
    backgroundColor: colors.champagne,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  strengthText: { fontSize: 13, fontWeight: "500", color: colors.text },
  scheduledBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.champagne,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 14,
    marginTop: 8,
  },
  scheduledLabel: { fontSize: 11, fontWeight: "600", color: colors.gold, marginBottom: 2 },
  scheduledValue: { fontSize: 14, fontWeight: "700", color: colors.text },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.champagne,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "700", color: colors.text },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
  },
  primaryBtnText: { fontSize: 14, fontWeight: "700", color: colors.text },
});
