import { CheckCircle } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { PressSlide } from "./PressSlide";
import { buildContractPreview, defaultContractFields } from "../demo/contractTemplate";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../LanguageContext";
import type { ContractFields, ScheduledInterview } from "../types/interview";
import { colors, radius } from "../theme";

type Props = {
  open: boolean;
  interview: ScheduledInterview | null;
  onClose: () => void;
  onSigned: () => void;
};

export function ContractSigningModal({ open, interview, onClose, onSigned }: Props) {
  const { profile, signContract } = useApp();
  const { locale, t } = useLanguage();

  const [fields, setFields] = useState<ContractFields>(() =>
    defaultContractFields(profile, interview?.weeklyPay ?? ""),
  );
  const [signature, setSignature] = useState(profile.name);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (open && interview) {
      setFields(defaultContractFields(profile, interview.weeklyPay));
      setSignature(profile.name);
      setSigned(false);
    }
  }, [open, interview, profile]);

  if (!interview) return null;

  const preview = buildContractPreview({
    parent: profile,
    caregiverName: interview.caregiverName,
    fields,
    signature: signature.trim() || profile.name,
    locale,
  });

  const set = <K extends keyof ContractFields>(key: K, value: ContractFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  const handleSign = () => {
    if (!signature.trim()) return;
    signContract(interview.id, fields, signature.trim());
    setSigned(true);
    setTimeout(() => {
      onSigned();
      onClose();
    }, 1600);
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {signed ? (
            <View style={styles.success}>
              <CheckCircle size={36} color={colors.sage} />
              <Text style={styles.successTitle}>{t("contract.signedTitle")}</Text>
              <Text style={styles.successBody}>
                {interview.caregiverName}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>{t("contract.title")}</Text>
              <Text style={styles.subtitle}>
                {t("contract.subtitle")} {interview.caregiverName}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.sectionLabel}>{t("contract.fillFields")}</Text>

                <Field label={t("contract.startDate")}>
                  <TextInput
                    style={styles.input}
                    value={fields.startDate}
                    onChangeText={(v) => set("startDate", v)}
                    placeholderTextColor={colors.muted}
                  />
                </Field>

                <Field label={t("contract.weeklyPay")}>
                  <TextInput
                    style={styles.input}
                    value={fields.weeklyPay}
                    onChangeText={(v) => set("weeklyPay", v)}
                    placeholderTextColor={colors.muted}
                  />
                </Field>

                <View style={styles.toggleRow}>
                  <Text style={styles.label}>{t("profile.liveIn")}</Text>
                  <Switch
                    value={fields.liveIn}
                    onValueChange={(v) => set("liveIn", v)}
                    trackColor={{ false: colors.border, true: colors.gold }}
                    thumbColor="#fff"
                  />
                </View>

                <Field label={t("contract.workHours")}>
                  <TextInput
                    style={styles.input}
                    value={fields.workHours}
                    onChangeText={(v) => set("workHours", v)}
                    placeholderTextColor={colors.muted}
                  />
                </Field>

                <Field label={t("contract.specialTerms")}>
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={fields.specialTerms}
                    onChangeText={(v) => set("specialTerms", v)}
                    placeholder={t("contract.specialTermsPlaceholder")}
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </Field>

                <Text style={styles.sectionLabel}>{t("contract.preview")}</Text>
                <View style={styles.previewBox}>
                  <Text style={styles.previewText}>{preview}</Text>
                </View>

                <Field label={t("contract.signature")}>
                  <TextInput
                    style={styles.input}
                    value={signature}
                    onChangeText={setSignature}
                    placeholder={t("contract.signaturePlaceholder")}
                    placeholderTextColor={colors.muted}
                  />
                </Field>
              </ScrollView>

              <View style={styles.actions}>
                <PressSlide style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelText}>{t("profile.cancel")}</Text>
                </PressSlide>
                <PressSlide
                  style={[styles.signBtn, !signature.trim() && styles.signBtnDisabled]}
                  onPress={handleSign}
                  disabled={!signature.trim()}
                 
                >
                  <Text style={styles.signText}>{t("contract.sign")}</Text>
                </PressSlide>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
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
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 32,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.gold, marginBottom: 10, marginTop: 4 },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 },
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
  textarea: { minHeight: 72, paddingTop: 12 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  previewBox: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  previewText: { fontSize: 12, lineHeight: 20, color: colors.text, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.champagne,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  signBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.sage,
    alignItems: "center",
  },
  signBtnDisabled: { opacity: 0.4 },
  signText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  success: { alignItems: "center", paddingVertical: 32 },
  successTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 12 },
  successBody: { fontSize: 14, color: colors.muted, marginTop: 4 },
});
