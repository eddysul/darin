import type { ReactNode } from "react";
import {
  CheckCircle,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Avatar } from "./Avatar";
import type { CaregiverMatch } from "../demo/caregivers";
import { getCaregiverRole } from "../i18n";
import { useLanguage } from "../LanguageContext";
import {
  getBackgroundCheckLabel,
  getCredentialLabel,
  getCredentialStatusLabel,
  isBackgroundCheckComplete,
} from "../utils/caregiverLabels";
import { colors, radius } from "../theme";

type CaregiverDetailSheetProps = {
  open: boolean;
  caregiver: CaregiverMatch | null;
  onClose: () => void;
  onContact: () => void;
  onRequestCare: () => void;
};

export function CaregiverDetailSheet({
  open,
  caregiver,
  onClose,
  onContact,
  onRequestCare,
}: CaregiverDetailSheetProps) {
  const { locale, t } = useLanguage();

  if (!caregiver) return null;

  const about = locale === "ko" ? caregiver.aboutKo : caregiver.aboutEn;
  const experience = locale === "ko" ? caregiver.experienceKo : caregiver.experienceEn;
  const aiExplanation = locale === "ko" ? caregiver.aiExplanationKo : caregiver.aiExplanationEn;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <X size={18} color={colors.muted} />
          </Pressable>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <Avatar src={caregiver.img} size={72} />
              <Text style={styles.name}>{caregiver.name}</Text>
              <Text style={styles.role}>{getCaregiverRole(locale, caregiver.role)}</Text>
              <View style={styles.heroMeta}>
                <Star size={12} color={colors.yellow} fill={colors.yellow} />
                <Text style={styles.metaText}>{caregiver.rating} · {caregiver.reviews} {t("match.reviews")}</Text>
              </View>
              <View style={styles.heroRow}>
                <MapPin size={12} color={colors.muted} />
                <Text style={styles.metaText}>{caregiver.distance} · {caregiver.location}</Text>
              </View>
              <View style={styles.heroRow}>
                <Clock size={12} color={colors.muted} />
                <Text style={styles.metaText}>{caregiver.available}</Text>
              </View>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreText}>{caregiver.matchScore}% {t("match.matchScore")}</Text>
              </View>
              <View style={styles.trustBadge}>
                <ShieldCheck size={12} color={colors.text} />
                <Text style={styles.trustText}>
                  {isBackgroundCheckComplete(caregiver.backgroundCheckStatus ?? "not_submitted")
                    ? t("match.backgroundChecked")
                    : getBackgroundCheckLabel(caregiver.backgroundCheckStatus ?? "not_submitted", t)}
                </Text>
              </View>
            </View>

            <Section title={t("match.whyRecommended")} ai>
              <Text style={styles.body}>{aiExplanation}</Text>
            </Section>

            <Section title={t("match.about")}>
              <Text style={styles.body}>{about}</Text>
            </Section>

            <Section title={t("match.experience")}>
              <Text style={styles.body}>{experience}</Text>
            </Section>

            <Section title={t("match.languagesSection")}>
              <View style={styles.chips}>
                {caregiver.languages.map((lang) => (
                  <Text key={lang} style={styles.chip}>{lang}</Text>
                ))}
              </View>
            </Section>

            <Section title={t("match.verifiedCredentials")}>
              {(caregiver.credentials ?? []).map((cred) => {
                const bgStatus = caregiver.backgroundCheckStatus ?? "not_submitted";
                const label =
                  cred.id === "background_check"
                    ? getBackgroundCheckLabel(bgStatus, t)
                    : getCredentialStatusLabel(cred.status, t);
                const verified = cred.id === "background_check"
                  ? isBackgroundCheckComplete(bgStatus)
                  : cred.status === "verified";

                return (
                  <View key={cred.id} style={styles.credentialRow}>
                    <CheckCircle size={14} color={verified ? colors.text : colors.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.credentialLabel}>{getCredentialLabel(cred.id, t)}</Text>
                      <Text style={styles.credentialStatus}>{label}</Text>
                    </View>
                  </View>
                );
              })}
            </Section>

            <Section title={t("match.parentReviews")}>
              {(caregiver.parentReviews ?? []).map((review) => (
                <View key={review.author} style={styles.reviewCard}>
                  <View style={styles.reviewTop}>
                    <Text style={styles.reviewAuthor}>{review.author}</Text>
                    <Text style={styles.reviewDate}>{review.date}</Text>
                  </View>
                  <View style={styles.reviewStars}>
                    <Star size={11} color={colors.yellow} fill={colors.yellow} />
                    <Text style={styles.reviewRating}>{review.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.reviewText}>{review.text}</Text>
                </View>
              ))}
            </Section>

            <View style={styles.rateBox}>
              <Text style={styles.rateLabel}>{t("match.hourlyRate")}</Text>
              <Text style={styles.rateValue}>{caregiver.price}</Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.secondaryBtn} onPress={onContact}>
              <Text style={styles.secondaryBtnText}>{t("match.contact")}</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={onRequestCare}>
              <Text style={styles.primaryBtnText}>{t("match.requestProposal")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, ai, children }: { title: string; ai?: boolean; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {ai && <Sparkles size={12} color={colors.yellow} />} {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "92%",
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
  },
  closeBtn: { position: "absolute", top: 12, right: 12, zIndex: 2, padding: 8 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 16 },
  hero: { alignItems: "center", paddingTop: 8, paddingBottom: 8 },
  name: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 12 },
  role: { fontSize: 14, color: colors.muted, marginTop: 4 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  metaText: { fontSize: 13, color: colors.muted },
  scoreBadge: {
    marginTop: 12,
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  scoreText: { fontSize: 12, fontWeight: "700", color: colors.text },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  trustText: { fontSize: 11, fontWeight: "600", color: colors.text },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 22, color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  credentialRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  credentialLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  credentialStatus: { fontSize: 12, color: colors.muted, marginTop: 2 },
  reviewCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  reviewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewAuthor: { fontSize: 13, fontWeight: "600", color: colors.text },
  reviewDate: { fontSize: 11, color: colors.muted },
  reviewStars: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  reviewRating: { fontSize: 11, fontWeight: "600", color: colors.text },
  reviewText: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 6 },
  rateBox: {
    marginTop: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rateLabel: { fontSize: 13, fontWeight: "600", color: colors.muted },
  rateValue: { fontSize: 16, fontWeight: "700", color: colors.text },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "600", color: colors.text },
  primaryBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  primaryBtnText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
});
