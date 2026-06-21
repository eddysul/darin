import { CheckCircle } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PressSlide } from "./PressSlide";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../LanguageContext";
import { colors, radius } from "../theme";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function BidModal({ open, onClose }: Props) {
  const { profile, setProfile } = useApp();
  const { t } = useLanguage();

  const [rate, setRate] = useState(profile.bidRate ?? profile.weeklyRate ?? "");
  const [note, setNote] = useState(profile.bidNote ?? "");
  const [submitted, setSubmitted] = useState(false);
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setRate(profile.bidRate ?? profile.weeklyRate ?? "");
      setNote(profile.bidNote ?? "");
      setSubmitted(false);
      checkAnim.setValue(0);
    }
  }, [open, profile]);

  const handleSubmit = () => {
    if (!rate.trim()) return;
    setProfile({ ...profile, bidRate: rate.trim(), bidNote: note.trim(), weeklyRate: rate.trim() });
    setSubmitted(true);
    Animated.spring(checkAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 10 }).start();
    setTimeout(() => onClose(), 1400);
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {submitted ? (
            <View style={styles.success}>
              <Animated.View style={{ transform: [{ scale: checkAnim }] }}>
                <CheckCircle size={42} color={colors.sage} />
              </Animated.View>
              <Text style={styles.successTitle}>{t("profile.bidSubmitted")} ✓</Text>
              <Text style={styles.successRate}>{rate}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>{profile.bidRate ? t("profile.updateBid") : t("profile.submitBid")}</Text>
              <Text style={styles.subtitle}>{t("caregiverSetup.subtitle")}</Text>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>{t("profile.bidRate")} *</Text>
                <TextInput
                  style={styles.input}
                  value={rate}
                  onChangeText={setRate}
                  placeholder={t("profile.bidRatePlaceholder")}
                  placeholderTextColor={colors.muted}
                />
                <Text style={styles.label}>{t("profile.bidNote")}</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={note}
                  onChangeText={setNote}
                  placeholder={t("profile.bidNotePlaceholder")}
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </ScrollView>
              <View style={styles.actions}>
                <Pressable style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelText}>{t("profile.cancel")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, !rate.trim() && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={!rate.trim()}
                >
                  <Text style={styles.submitText}>
                    {profile.bidRate ? t("profile.updateBid") : t("profile.submitBid")}
                  </Text>
                </Pressable>
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
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 36,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: 20 },
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
    marginBottom: 16,
  },
  textarea: { minHeight: 90, paddingTop: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: "#8E8E93",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  success: { alignItems: "center", paddingVertical: 28 },
  successTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: 14 },
  successRate: { fontSize: 22, fontWeight: "800", color: colors.gold, marginTop: 6 },
});
