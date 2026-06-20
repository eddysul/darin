import { useEffect, useState } from "react";
import { CheckCircle, Send, Sparkles, X } from "lucide-react-native";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { CaregiverMatch } from "../demo/caregivers";
import { useLanguage } from "../LanguageContext";
import { colors, radius } from "../theme";

type ContactMessageModalProps = {
  open: boolean;
  caregiver: CaregiverMatch | null;
  mode: "contact" | "request";
  onClose: () => void;
  onSent: () => void;
};

export function ContactMessageModal({ open, caregiver, mode, onClose, onSent }: ContactMessageModalProps) {
  const { locale, t } = useLanguage();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open || !caregiver) return;
    setMessage(locale === "ko" ? caregiver.contactDraftKo : caregiver.contactDraftEn);
    setSent(false);
  }, [open, caregiver, locale]);

  if (!caregiver) return null;

  const handleSend = () => {
    setSent(true);
    setTimeout(() => {
      onSent();
      onClose();
      setSent(false);
    }, 1400);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {mode === "contact" ? t("match.contactTitle") : t("match.requestCareTitle")}
              </Text>
              <Text style={styles.subtitle}>{caregiver.name}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>

          {sent ? (
            <View style={styles.successBox}>
              <CheckCircle size={28} color={colors.yellow} />
              <Text style={styles.successTitle}>{t("match.requestSentTitle")}</Text>
              <Text style={styles.successBody}>{t("match.requestSentBody")}</Text>
            </View>
          ) : (
            <>
              <View style={styles.aiHint}>
                <Sparkles size={14} color={colors.yellow} />
                <Text style={styles.aiHintText}>{t("match.suggestedFirstMessage")}</Text>
              </View>
              <TextInput
                style={styles.input}
                multiline
                value={message}
                onChangeText={setMessage}
                placeholderTextColor={colors.muted}
              />
              <Pressable style={styles.sendBtn} onPress={handleSend}>
                <Send size={16} color={colors.primaryForeground} />
                <Text style={styles.sendBtnText}>{t("match.sendRequest")}</Text>
              </Pressable>
            </>
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
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    paddingBottom: 28,
  },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  closeBtn: { padding: 6 },
  aiHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.yellowSoft,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 12,
  },
  aiHintText: { fontSize: 12, fontWeight: "600", color: colors.text, flex: 1 },
  input: {
    minHeight: 120,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  sendBtnText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
  successBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  successTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  successBody: { fontSize: 13, color: colors.muted, textAlign: "center", lineHeight: 20 },
});
