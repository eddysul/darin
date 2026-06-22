import { CheckCircle, X } from "lucide-react-native";
import { useState } from "react";
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
import { PressSlide } from "./PressSlide";
import { useLanguage } from "../LanguageContext";
import type { IncomingCareRequest } from "../types/incomingCareRequest";
import { colors, radius } from "../theme";

export type CareProposalForm = {
  proposedRate: string;
  availability: string;
  careStyle: string;
  experienceNote: string;
  message: string;
  backgroundCheck: boolean;
  cprCertified: boolean;
  licenseUploaded: boolean;
};

type Props = {
  open: boolean;
  request: IncomingCareRequest | null;
  onClose: () => void;
  onSubmit: (form: CareProposalForm) => void;
};

const DEFAULT_FORM: CareProposalForm = {
  proposedRate: "$22/hr",
  availability: "Mon–Fri, 3 PM–8 PM",
  careStyle: "Gentle routine-based care with bilingual updates",
  experienceNote: "8 years postpartum and infant care",
  message:
    "I can support Emma's afternoon routine, including feeding, nap transition, light play, and bilingual Korean/English updates. I can start next Monday.",
  backgroundCheck: true,
  cprCertified: true,
  licenseUploaded: true,
};

export function CareProposalModal({ open, request, onClose, onSubmit }: Props) {
  const { t } = useLanguage();
  const [form, setForm] = useState<CareProposalForm>(DEFAULT_FORM);

  const set = <K extends keyof CareProposalForm>(key: K, value: CareProposalForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    onSubmit(form);
    setForm(DEFAULT_FORM);
  };

  if (!request) return null;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("careProposal.title")}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.familyLabel}>
            {request.familyName} · {request.childName}, {request.childAge}
          </Text>

          <Field label={t("careProposal.proposedRate")}>
            <TextInput
              style={styles.input}
              value={form.proposedRate}
              onChangeText={(v) => set("proposedRate", v)}
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label={t("careProposal.availability")}>
            <TextInput
              style={styles.input}
              value={form.availability}
              onChangeText={(v) => set("availability", v)}
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label={t("careProposal.careStyle")}>
            <TextInput
              style={styles.input}
              value={form.careStyle}
              onChangeText={(v) => set("careStyle", v)}
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label={t("careProposal.experienceNote")}>
            <TextInput
              style={styles.input}
              value={form.experienceNote}
              onChangeText={(v) => set("experienceNote", v)}
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Field label={t("careProposal.message")}>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.message}
              onChangeText={(v) => set("message", v)}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              placeholderTextColor={colors.muted}
            />
          </Field>

          <Text style={styles.credentialTitle}>{t("careProposal.credentials")}</Text>
          {(
            [
              ["backgroundCheck", t("careProposal.backgroundCheck")],
              ["cprCertified", t("careProposal.cprCertified")],
              ["licenseUploaded", t("careProposal.licenseUploaded")],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} style={styles.checkRow} onPress={() => set(key, !form[key])}>
              <View style={[styles.checkbox, form[key] && styles.checkboxActive]}>
                {form[key] && <CheckCircle size={14} color={colors.yellow} />}
              </View>
              <Text style={styles.checkLabel}>{label}</Text>
            </Pressable>
          ))}

          <PressSlide style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitText}>{t("careProposal.send")}</Text>
          </PressSlide>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  scroll: { padding: 20, paddingBottom: 40 },
  familyLabel: { fontSize: 14, color: colors.muted, marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  textarea: { minHeight: 110, paddingTop: 12 },
  credentialTitle: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 8, marginBottom: 12 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inputBg,
  },
  checkboxActive: { borderColor: colors.yellow, backgroundColor: colors.yellowSoft },
  checkLabel: { flex: 1, fontSize: 13, color: colors.text },
  submitBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  submitText: { fontSize: 15, fontWeight: "700", color: colors.primaryForeground },
});
