import { useState, type ReactNode } from "react";
import {
  Baby,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Home,
  MessageCircle,
  Pencil,
  Shield,
  Sparkles,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getParentProfile } from "../demo/parentProfile";
import { useLanguage } from "../LanguageContext";
import { Avatar } from "./Avatar";
import { ChildCareSnapshotModal } from "./ChildCareSnapshotModal";
import { colors, radius } from "../theme";

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          {icon}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <View style={styles.chipRow}>
      {items.map((item) => (
        <View key={item} style={styles.chip}>
          <Text style={styles.chipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function VerificationBadge({ label, verified }: { label: string; verified: boolean }) {
  return (
    <View style={[styles.verifyBadge, verified && styles.verifyBadgeActive]}>
      {verified && <CheckCircle2 size={12} color={colors.yellow} />}
      <Text style={[styles.verifyText, verified && styles.verifyTextActive]}>{label}</Text>
    </View>
  );
}

type Props = {
  avatarSrc?: string;
  onEditProfile?: () => void;
};

export function ParentProfileView({ avatarSrc = "photo-1438761681033-6461ffad8d80", onEditProfile }: Props) {
  const { locale, t } = useLanguage();
  const data = getParentProfile(locale);
  const [expanded, setExpanded] = useState(false);
  const [childSnapshotOpen, setChildSnapshotOpen] = useState(false);

  return (
    <>
      <View style={styles.headerCard}>
        {onEditProfile && (
          <Pressable style={styles.editBtn} onPress={onEditProfile} hitSlop={8}>
            <Pencil size={16} color={colors.text} />
          </Pressable>
        )}

        <Pressable
          style={styles.headerBody}
          onPress={() => setExpanded((prev) => !prev)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <View style={styles.headerRow}>
            <Avatar src={avatarSrc} size={64} />
            <View style={styles.headerText}>
              <Text style={styles.headerName}>{data.header.name}</Text>
              <Text style={styles.headerMeta}>{data.header.relationship}</Text>
              <Text style={styles.headerMeta}>{data.header.location}</Text>
              <View style={styles.headerChips}>
                <View style={styles.langChip}>
                  <Text style={styles.langChipText}>{data.header.languages}</Text>
                </View>
                <View style={styles.contactChip}>
                  <MessageCircle size={11} color={colors.muted} />
                  <Text style={styles.contactChipText}>{data.header.preferredContact}</Text>
                </View>
              </View>
            </View>
            <View style={styles.chevronWrap}>
              {expanded ? (
                <ChevronUp size={18} color={colors.muted} />
              ) : (
                <ChevronDown size={18} color={colors.muted} />
              )}
            </View>
          </View>

          {!expanded && (
            <View style={styles.summaryBlock}>
              <Text style={styles.summarySecondary}>
                {data.communication.reportLanguage} · {data.communication.reportFrequency}
              </Text>
              <Text style={styles.summarySecondary}>{data.household.neighborhood} · {data.household.careLocation}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <SectionCard title={t("parentProfile.childSnapshot")} icon={<Baby size={15} color={colors.muted} />}>
        <View style={styles.snapshotRow}>
          <Avatar src="photo-1594608661623-aa0bd3a69d98" size={44} />
          <View style={styles.snapshotBody}>
            <Text style={styles.snapshotName}>{data.childSnapshot.name}</Text>
            <Text style={styles.snapshotAge}>{data.childSnapshot.age}</Text>
          </View>
        </View>
        <ChipList items={[...data.childSnapshot.allergies, ...data.childSnapshot.conditions]} />
        <Text style={styles.subLabel}>{t("parentProfile.routine")}</Text>
        <ChipList items={data.childSnapshot.routine} />
        <Pressable style={styles.snapshotBtn} onPress={() => setChildSnapshotOpen(true)}>
          <Sparkles size={14} color={colors.yellow} />
          <Text style={styles.snapshotBtnText}>{t("parentProfile.viewSnapshot")}</Text>
          <ChevronRight size={14} color={colors.muted} style={styles.snapshotBtnIcon} />
        </Pressable>
      </SectionCard>

      {expanded && (
        <>
          <SectionCard title={t("parentProfile.communication")} icon={<MessageCircle size={15} color={colors.muted} />}>
            <InfoRow label={t("parentProfile.reportLanguage")} value={data.communication.reportLanguage} />
            <InfoRow label={t("parentProfile.reportFrequency")} value={data.communication.reportFrequency} />
            <InfoRow label={t("parentProfile.updateStyle")} value={data.communication.updateStyle} />
            <Text style={styles.subLabel}>{t("parentProfile.importantUpdates")}</Text>
            <ChipList items={data.communication.importantUpdates} />
          </SectionCard>

          <SectionCard title={t("parentProfile.careStyle")} icon={<Sparkles size={15} color={colors.muted} />}>
            {data.careStyle.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </SectionCard>

          <SectionCard title={t("parentProfile.household")} icon={<Home size={15} color={colors.muted} />}>
            <InfoRow label={t("parentProfile.neighborhood")} value={data.household.neighborhood} />
            <InfoRow label={t("parentProfile.careLocation")} value={data.household.careLocation} />
            <InfoRow label={t("parentProfile.pets")} value={data.household.pets} />
            <InfoRow label={t("parentProfile.householdLanguage")} value={data.household.householdLanguage} />
          </SectionCard>

          <SectionCard title={t("parentProfile.trust")} icon={<Shield size={15} color={colors.muted} />}>
            <View style={styles.verifyRow}>
              <VerificationBadge label={t("parentProfile.phoneVerified")} verified={data.verification.phone} />
              <VerificationBadge label={t("parentProfile.emailVerified")} verified={data.verification.email} />
              <VerificationBadge label={t("parentProfile.paymentReady")} verified={data.verification.payment} />
              <VerificationBadge label={t("parentProfile.profileComplete")} verified={data.verification.profileComplete} />
            </View>
          </SectionCard>

          <View style={styles.privacyCard}>
            <Shield size={14} color={colors.yellow} />
            <Text style={styles.privacyText}>{t("parentProfile.privacyNotice")}</Text>
          </View>
        </>
      )}

      <ChildCareSnapshotModal open={childSnapshotOpen} onClose={() => setChildSnapshotOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: "hidden",
  },
  headerBody: { padding: 18 },
  editBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  headerRow: { flexDirection: "row", gap: 14, alignItems: "flex-start", paddingRight: 28 },
  headerText: { flex: 1 },
  chevronWrap: { paddingTop: 4 },
  headerName: { fontSize: 20, fontWeight: "700", color: colors.text },
  headerMeta: { fontSize: 13, color: colors.muted, marginTop: 3 },
  headerChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  langChip: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  langChipText: { fontSize: 11, fontWeight: "600", color: colors.text },
  contactChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  contactChipText: { fontSize: 11, fontWeight: "500", color: colors.muted },
  summaryBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  summarySecondary: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  section: { marginBottom: 14 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  infoRow: { gap: 2 },
  infoLabel: { fontSize: 11, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.3 },
  infoValue: { fontSize: 14, lineHeight: 20, color: colors.text, fontWeight: "500" },
  subLabel: { fontSize: 11, fontWeight: "600", color: colors.muted, marginTop: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { fontSize: 12, fontWeight: "500", color: colors.text },
  snapshotRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  snapshotBody: { flex: 1 },
  snapshotName: { fontSize: 15, fontWeight: "700", color: colors.text },
  snapshotAge: { fontSize: 12, color: colors.muted, marginTop: 2 },
  snapshotBtn: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  snapshotBtnText: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.text },
  snapshotBtnIcon: { marginLeft: "auto" },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.text,
    marginTop: 7,
  },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.text },
  verifyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  verifyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.backgroundSecondary,
  },
  verifyBadgeActive: {
    backgroundColor: colors.yellowSoft,
    borderColor: colors.yellow,
  },
  verifyText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  verifyTextActive: { color: colors.text },
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 16,
  },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.muted },
});
