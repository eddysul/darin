import { useEffect, useState, type ReactNode } from "react";
import {
  Baby,
  CheckCircle,
  HeartPulse,
  Pencil,
  Share2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { EMMA_CHILD_PROFILE } from "../demo/childProfile";
import { CHILD_NOTE_TYPES, type ChildNoteType, type ChildProfile, type ChildSpecialNote } from "../types/childProfile";
import { useLanguage } from "../LanguageContext";
import { Avatar } from "./Avatar";
import { colors, radius } from "../theme";

type ChildCareSnapshotModalProps = {
  open: boolean;
  child?: ChildProfile;
  onClose: () => void;
};

export function ChildCareSnapshotModal({
  open,
  child = EMMA_CHILD_PROFILE,
  onClose,
}: ChildCareSnapshotModalProps) {
  const { t } = useLanguage();
  const [notes, setNotes] = useState<ChildSpecialNote[]>(child.specialNotes);
  const [noteType, setNoteType] = useState<ChildNoteType>("Allergy");
  const [noteText, setNoteText] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNotes(child.specialNotes);
    setNoteType("Allergy");
    setNoteText("");
    setToast(null);
  }, [open, child.specialNotes]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    setNotes((prev) => [
      ...prev,
      { id: `note-${Date.now()}`, type: noteType, text: noteText.trim() },
    ]);
    setNoteText("");
  };

  if (!open) return null;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{t("childSnapshot.title")}</Text>
              <Text style={styles.subtitle}>{t("childSnapshot.subtitle")}</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable style={styles.iconBtn} onPress={() => showToast(t("childSnapshot.editToast"))}>
                <Pencil size={16} color={colors.text} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={onClose}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <Avatar src={child.avatar} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={styles.heroName}>{child.preferredName ?? child.name}</Text>
                <Text style={styles.heroMeta}>{child.age}</Text>
              </View>
              <View style={styles.trustBadge}>
                <ShieldCheck size={12} color={colors.yellow} />
                <Text style={styles.trustBadgeText}>{t("childSnapshot.trustBadge")}</Text>
              </View>
            </View>

            <Section title={t("childSnapshot.basicInfo")} icon={Baby}>
              <InfoRow label={t("childSnapshot.name")} value={child.name} />
              <InfoRow label={t("childSnapshot.age")} value={child.age} />
              <InfoRow label={t("childSnapshot.dob")} value={child.dateOfBirth} />
              <InfoRow label={t("childSnapshot.gender")} value={child.gender} />
              <InfoRow label={t("childSnapshot.bloodType")} value={child.bloodType} />
              <InfoRow label={t("childSnapshot.preferredName")} value={child.preferredName ?? "—"} />
            </Section>

            <Section title={t("childSnapshot.healthSafety")} icon={HeartPulse} highlight>
              <InfoRow label={t("childSnapshot.allergies")} value={child.allergies.join(", ")} />
              <InfoRow label={t("childSnapshot.conditions")} value={child.conditions.join(", ")} />
              <InfoRow label={t("childSnapshot.medication")} value={child.medications.join(", ")} />
              <InfoRow label={t("childSnapshot.foodRestrictions")} value={child.foodRestrictions.join(", ")} />
              <InfoRow label={t("childSnapshot.doctorClinic")} value={child.doctorClinic} />
              <InfoRow label={t("childSnapshot.emergencyContact")} value={child.emergencyContact} />
              <View style={styles.chipRow}>
                {["Allergy", "Condition", "Medication", "Food restriction"].map((label) => (
                  <Pressable key={label} style={styles.healthChip} onPress={() => showToast(t("childSnapshot.editToast"))}>
                    <Text style={styles.healthChipText}>{label}</Text>
                    <Text style={styles.healthChipEdit}>{t("childSnapshot.edit")}</Text>
                  </Pressable>
                ))}
              </View>
            </Section>

            <Section title={t("childSnapshot.specialNotes")} icon={Sparkles}>
              {notes.map((note) => (
                <View key={note.id} style={styles.noteItem}>
                  <Text style={styles.noteType}>{note.type}</Text>
                  <Text style={styles.noteText}>{note.text}</Text>
                </View>
              ))}
              <Text style={styles.fieldLabel}>{t("childSnapshot.noteType")}</Text>
              <View style={styles.typeChips}>
                {CHILD_NOTE_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.typeChip, noteType === type && styles.typeChipActive]}
                    onPress={() => setNoteType(type)}
                  >
                    <Text style={[styles.typeChipText, noteType === type && styles.typeChipTextActive]}>{type}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.noteInput}
                placeholder={t("childSnapshot.notePlaceholder")}
                placeholderTextColor={colors.muted}
                value={noteText}
                onChangeText={setNoteText}
                multiline
              />
              <Pressable style={styles.saveNoteBtn} onPress={handleSaveNote}>
                <Text style={styles.saveNoteBtnText}>{t("childSnapshot.saveNote")}</Text>
              </Pressable>
            </Section>

            <Section title={t("childSnapshot.dailyRoutine")}>
              <InfoRow label={t("childSnapshot.feeding")} value={child.routine.feeding} />
              <InfoRow label={t("childSnapshot.nap")} value={child.routine.nap} />
              <InfoRow label={t("childSnapshot.diaper")} value={child.routine.diaper} />
              <InfoRow label={t("childSnapshot.comfortMethod")} value={child.routine.comfortMethod} />
              <InfoRow label={t("childSnapshot.favoriteActivity")} value={child.routine.favoriteActivity} />
            </Section>

            <Section title={t("childSnapshot.carePreferences")}>
              <InfoRow label={t("childSnapshot.languages")} value={child.carePreferences.languages.join(" / ")} />
              <InfoRow label={t("childSnapshot.dailyReportLanguage")} value={child.carePreferences.dailyReportLanguage} />
              <InfoRow label={t("childSnapshot.updateTopics")} value={child.carePreferences.updateTopics.join(", ")} />
              <InfoRow label={t("childSnapshot.communicationStyle")} value={child.carePreferences.communicationStyle} />
              <InfoRow label={t("childSnapshot.reportFrequency")} value={child.carePreferences.reportFrequency} />
            </Section>

            <Section title={t("childSnapshot.authorizedPickup")}>
              {child.authorizedPickup.map((person) => (
                <View key={person.name} style={styles.pickupRow}>
                  <CheckCircle size={14} color={colors.text} />
                  <Text style={styles.pickupText}>
                    {person.name} — {person.relationship}
                  </Text>
                </View>
              ))}
              <Text style={styles.pickupNotice}>{t("childSnapshot.pickupNotice")}</Text>
            </Section>

            <View style={styles.privacyBox}>
              <ShieldCheck size={14} color={colors.yellow} />
              <Text style={styles.privacyText}>{t("childSnapshot.privacyNotice")}</Text>
            </View>

            <View style={styles.actions}>
              <Pressable style={styles.secondaryAction} onPress={() => showToast(t("childSnapshot.editToast"))}>
                <Pencil size={14} color={colors.text} />
                <Text style={styles.secondaryActionText}>{t("childSnapshot.editInfo")}</Text>
              </Pressable>
              <Pressable style={styles.primaryAction} onPress={() => showToast(t("childSnapshot.shareToast"))}>
                <Share2 size={14} color={colors.primaryForeground} />
                <Text style={styles.primaryActionText}>{t("childSnapshot.shareCaregiver")}</Text>
              </Pressable>
            </View>
          </ScrollView>

          {toast && (
            <View style={styles.toast}>
              <CheckCircle size={14} color={colors.yellow} />
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Section({
  title,
  icon: Icon,
  highlight,
  children,
}: {
  title: string;
  icon?: typeof Baby;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.section, highlight && styles.sectionHighlight]}>
      <View style={styles.sectionTitleRow}>
        {Icon && <Icon size={14} color={highlight ? colors.yellow : colors.text} />}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
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

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "94%",
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: 20,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 10 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: { flex: 1, paddingRight: 12 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  headerActions: { flexDirection: "row", gap: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
    padding: 14,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroName: { fontSize: 16, fontWeight: "700", color: colors.text },
  heroMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.yellowSoft,
    borderWidth: 1,
    borderColor: colors.yellow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  trustBadgeText: { fontSize: 9, fontWeight: "700", color: colors.text },
  section: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  sectionHighlight: { backgroundColor: colors.yellowSoft, borderColor: colors.border },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 8 },
  infoLabel: { fontSize: 12, color: colors.muted, flex: 1 },
  infoValue: { fontSize: 12, fontWeight: "600", color: colors.text, flex: 1.2, textAlign: "right" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  healthChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  healthChipText: { fontSize: 11, fontWeight: "600", color: colors.text },
  healthChipEdit: { fontSize: 10, color: colors.muted, textDecorationLine: "underline" },
  noteItem: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 8,
  },
  noteType: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.text,
    backgroundColor: colors.yellowSoft,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginBottom: 6,
    overflow: "hidden",
  },
  noteText: { fontSize: 13, lineHeight: 19, color: colors.text },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 8, marginBottom: 8 },
  typeChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  typeChipActive: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  typeChipText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  typeChipTextActive: { color: colors.text },
  noteInput: {
    minHeight: 72,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: "top",
  },
  saveNoteBtn: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  saveNoteBtnText: { fontSize: 13, fontWeight: "600", color: colors.primaryForeground },
  pickupRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  pickupText: { fontSize: 13, fontWeight: "600", color: colors.text },
  pickupNotice: { fontSize: 11, color: colors.muted, marginTop: 4, fontStyle: "italic" },
  privacyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
    padding: 14,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.muted },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  primaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  primaryActionText: { fontSize: 13, fontWeight: "600", color: colors.primaryForeground },
  secondaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    backgroundColor: colors.backgroundSecondary,
  },
  secondaryActionText: { fontSize: 13, fontWeight: "600", color: colors.text },
  toast: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: radius.lg,
    padding: 12,
  },
  toastText: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.text },
});
