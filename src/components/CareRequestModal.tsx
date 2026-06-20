import { useEffect, useState } from "react";
import { CheckCircle, Sparkles, X } from "lucide-react-native";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { DEFAULT_CARE_REQUEST } from "../demo/careFlow";
import type { CareRequestForm } from "../types/careFlow";
import { useLanguage } from "../LanguageContext";
import { colors, radius } from "../theme";

type CareRequestModalProps = {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
};

const FIELDS: { key: keyof CareRequestForm; labelKey: "careRequest.childName" | "careRequest.childAge" | "careRequest.location" | "careRequest.schedule" | "careRequest.preferredLanguage" | "careRequest.careNeeds" | "careRequest.budgetRange" | "careRequest.startDate" | "careRequest.specialNotes"; multiline?: boolean }[] = [
  { key: "childName", labelKey: "careRequest.childName" },
  { key: "childAge", labelKey: "careRequest.childAge" },
  { key: "location", labelKey: "careRequest.location" },
  { key: "schedule", labelKey: "careRequest.schedule" },
  { key: "preferredLanguage", labelKey: "careRequest.preferredLanguage" },
  { key: "careNeeds", labelKey: "careRequest.careNeeds", multiline: true },
  { key: "budgetRange", labelKey: "careRequest.budgetRange" },
  { key: "startDate", labelKey: "careRequest.startDate" },
  { key: "specialNotes", labelKey: "careRequest.specialNotes", multiline: true },
];

export function CareRequestModal({ open, onClose, onSent }: CareRequestModalProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState<CareRequestForm>(DEFAULT_CARE_REQUEST);
  const [step, setStep] = useState<"form" | "sent" | "proposals">("form");

  useEffect(() => {
    if (!open) return;
    setForm(DEFAULT_CARE_REQUEST);
    setStep("form");
  }, [open]);

  if (!open) return null;

  const handleSend = () => {
    setStep("sent");
    setTimeout(() => {
      setStep("proposals");
      onSent();
    }, 1200);
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t("careRequest.title")}</Text>
              <Text style={styles.subtitle}>{t("careRequest.subtitle")}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>

          {step === "form" && (
            <>
              <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
                {FIELDS.map(({ key, labelKey, multiline }) => (
                  <View key={key} style={styles.field}>
                    <Text style={styles.label}>{t(labelKey)}</Text>
                    <TextInput
                      style={[styles.input, multiline && styles.inputMultiline]}
                      value={form[key]}
                      onChangeText={(text) => setForm((f) => ({ ...f, [key]: text }))}
                      multiline={multiline}
                      textAlignVertical={multiline ? "top" : "center"}
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                ))}
              </ScrollView>
              <Pressable style={styles.sendBtn} onPress={handleSend}>
                <Text style={styles.sendBtnText}>{t("careRequest.send")}</Text>
              </Pressable>
            </>
          )}

          {step === "sent" && (
            <View style={styles.centerBox}>
              <CheckCircle size={32} color={colors.yellow} />
              <Text style={styles.centerTitle}>{t("careRequest.sentTitle")}</Text>
              <Text style={styles.centerBody}>{t("careRequest.sentBody")}</Text>
            </View>
          )}

          {step === "proposals" && (
            <View style={styles.centerBox}>
              <View style={styles.sparkleCircle}>
                <Sparkles size={28} color={colors.yellow} />
              </View>
              <Text style={styles.centerTitle}>{t("careRequest.proposalsReceived")}</Text>
              <Text style={styles.centerBody}>{t("careRequest.proposalsHint")}</Text>
              <Pressable style={[styles.sendBtn, { marginTop: 16, width: "100%" }]} onPress={onClose}>
                <Text style={styles.sendBtnText}>{t("careRequest.viewProposals")}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    paddingBottom: 28,
  },
  header: { flexDirection: "row", alignItems: "flex-start", paddingTop: 20, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  closeBtn: { padding: 6 },
  formScroll: { maxHeight: 420 },
  formContent: { gap: 12, paddingBottom: 12 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  inputMultiline: { minHeight: 72, paddingTop: 12 },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  sendBtnText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
  centerBox: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 8 },
  centerTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 12, textAlign: "center" },
  centerBody: { fontSize: 13, color: colors.muted, marginTop: 8, textAlign: "center", lineHeight: 20 },
  sparkleCircle: {
    backgroundColor: colors.yellowSoft,
    borderRadius: 999,
    padding: 16,
  },
});
