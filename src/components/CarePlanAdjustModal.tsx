import { useEffect, useState } from "react";
import { X } from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { DEFAULT_CARE_PLAN_ADJUST } from "../demo/careFlow";
import type { CarePlanAdjustForm } from "../types/careFlow";
import { useLanguage } from "../LanguageContext";
import { colors, radius } from "../theme";

type CarePlanAdjustModalProps = {
  open: boolean;
  onClose: () => void;
  onSend: (form: CarePlanAdjustForm) => void;
};

const NEED_KEYS = [
  { key: "feeding" as const, labelKey: "negotiation.needFeeding" as const },
  { key: "napRoutine" as const, labelKey: "negotiation.needNap" as const },
  { key: "lightPlay" as const, labelKey: "negotiation.needPlay" as const },
  { key: "bilingualReports" as const, labelKey: "negotiation.needReports" as const },
  { key: "lightHousekeeping" as const, labelKey: "negotiation.needHousekeeping" as const },
];

export function CarePlanAdjustModal({ open, onClose, onSend }: CarePlanAdjustModalProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState<CarePlanAdjustForm>(DEFAULT_CARE_PLAN_ADJUST);

  useEffect(() => {
    if (open) setForm(DEFAULT_CARE_PLAN_ADJUST);
  }, [open]);

  const toggleNeed = (key: keyof CarePlanAdjustForm["careNeeds"]) => {
    setForm((prev) => ({
      ...prev,
      careNeeds: { ...prev.careNeeds, [key]: !prev.careNeeds[key] },
    }));
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <X size={18} color={colors.muted} />
          </Pressable>

          <Text style={styles.title}>{t("negotiation.adjustTitle")}</Text>
          <Text style={styles.subtitle}>{t("negotiation.adjustSubtitle")}</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Field label={t("chat.schedule")} value={form.schedule} onChange={(v) => setForm({ ...form, schedule: v })} />
            <Field label={t("chat.rate")} value={form.rate} onChange={(v) => setForm({ ...form, rate: v })} />
            <Field label={t("negotiation.trialSession")} value={form.trialSession} onChange={(v) => setForm({ ...form, trialSession: v })} />
            <Field label={t("chat.startDate")} value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />

            <Text style={styles.sectionLabel}>{t("carePlan.careNeeds")}</Text>
            <View style={styles.checks}>
              {NEED_KEYS.map(({ key, labelKey }) => (
                <Pressable
                  key={key}
                  style={[styles.checkRow, form.careNeeds[key] && styles.checkRowActive]}
                  onPress={() => toggleNeed(key)}
                >
                  <View style={[styles.checkbox, form.careNeeds[key] && styles.checkboxActive]} />
                  <Text style={styles.checkLabel}>{t(labelKey)}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>{t("negotiation.messageToCaregiver")}</Text>
            <TextInput
              style={styles.messageInput}
              value={form.message}
              onChangeText={(message) => setForm({ ...form, message })}
              multiline
              placeholderTextColor={colors.muted}
            />
          </ScrollView>

          <Pressable style={styles.sendBtn} onPress={() => onSend(form)}>
            <Text style={styles.sendBtnText}>{t("negotiation.sendUpdate")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.fieldInput} value={value} onChangeText={onChange} placeholderTextColor={colors.muted} />
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
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 10 },
  closeBtn: { position: "absolute", top: 12, right: 12, zIndex: 2, padding: 8 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 8 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 12 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 8 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  fieldInput: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 8, marginBottom: 8 },
  checks: { gap: 8, marginBottom: 12 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  checkRowActive: { borderColor: colors.yellow, backgroundColor: colors.yellowSoft },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  checkboxActive: { backgroundColor: colors.yellow, borderColor: colors.yellow },
  checkLabel: { fontSize: 13, fontWeight: "500", color: colors.text },
  messageInput: {
    minHeight: 80,
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
  sendBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  sendBtnText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
});
