import { CheckCircle, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
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
import { buildContractPreview } from "../demo/contractTemplate";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../LanguageContext";
import type { IncomingRequest } from "../types/interview";
import { colors, radius } from "../theme";

type Props = {
  open: boolean;
  request: IncomingRequest | null;
  onClose: () => void;
};

export function CaregiverContractModal({ open, request, onClose }: Props) {
  const { profile, caregiverSignContract } = useApp();
  const { locale, t } = useLanguage();
  const ko = locale === "ko";
  const [signature, setSignature] = useState(profile.name);
  const [notes, setNotes] = useState("");
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (open) {
      setSignature(profile.name);
      setNotes("");
      setSigned(false);
    }
  }, [open, profile.name]);

  if (!request || !request.contractFields) return null;

  const alreadySigned = !!request.caregiverSignature;

  const preview = buildContractPreview({
    parent: {
      name: request.parentName,
      location: request.parentLocation,
      avatar: request.parentAvatar,
      role: "parent",
      liveIn: request.liveIn,
      notes: request.notes,
    },
    caregiverName: profile.name,
    fields: request.contractFields,
    signature: request.parentSignature ?? request.parentName,
    locale,
  });

  const handleSign = () => {
    if (!signature.trim()) return;
    caregiverSignContract(request.id, signature.trim(), notes.trim());
    setSigned(true);
    setTimeout(() => onClose(), 1600);
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {signed || alreadySigned ? (
            <View style={styles.success}>
              <CheckCircle size={36} color={colors.sage} />
              <Text style={styles.successTitle}>{t("caregiverContract.signed")}</Text>
              <Text style={styles.successBody}>{request.parentName}</Text>
            </View>
          ) : (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.title}>{t("caregiverContract.title")}</Text>
                <Pressable style={styles.closeBtn} onPress={onClose}>
                  <X size={18} color={colors.muted} />
                </Pressable>
              </View>
              <View style={styles.parentSignedBadge}>
                <CheckCircle size={13} color={colors.sage} />
                <Text style={styles.parentSignedText}>
                  {t("caregiverContract.parentSigned")} · {request.parentName}
                </Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.scroll}>
                <Text style={styles.sectionLabel}>Contract Preview</Text>
                <View style={styles.previewBox}>
                  <Text style={styles.previewText}>{preview}</Text>
                </View>

                <Text style={styles.label}>{t("caregiverContract.addNotes")}</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t("caregiverContract.notesPlaceholder")}
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                <Text style={styles.label}>{t("caregiverContract.yourSignature")}</Text>
                <TextInput
                  style={styles.input}
                  value={signature}
                  onChangeText={setSignature}
                  placeholder={profile.name}
                  placeholderTextColor={colors.muted}
                />
              </ScrollView>

              <View style={styles.actions}>
                <PressSlide style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelText}>{ko ? "닫기" : "Close"}</Text>
                </PressSlide>
                <PressSlide
                  style={[styles.signBtn, !signature.trim() && styles.signBtnDisabled]}
                  onPress={handleSign}
                  disabled={!signature.trim()}
                >
                  <Text style={styles.signText}>{ko ? "제출 · 서명" : "Submit & Sign"}</Text>
                </PressSlide>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  closeBtn: { padding: 4 },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 32,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  scroll: { flex: 1, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
  parentSignedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: `${colors.sage}18`,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  parentSignedText: { fontSize: 12, fontWeight: "600", color: colors.sage },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.gold, marginBottom: 10 },
  previewBox: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  previewText: {
    fontSize: 12,
    lineHeight: 20,
    color: colors.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
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
    marginBottom: 14,
  },
  textarea: { minHeight: 72, paddingTop: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
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
