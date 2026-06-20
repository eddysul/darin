import { Calendar, MapPin, Clock, X } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../LanguageContext";
import { colors, radius } from "../theme";

type ScheduleTrialModalProps = {
  open: boolean;
  onClose: () => void;
  onPropose: () => void;
  suggestedTime?: string;
};

export function ScheduleTrialModal({
  open,
  onClose,
  onPropose,
  suggestedTime = "Friday 4 PM",
}: ScheduleTrialModalProps) {
  const { t } = useLanguage();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <X size={18} color={colors.muted} />
          </Pressable>
          <Text style={styles.title}>{t("negotiation.trialTitle")}</Text>
          <View style={styles.row}>
            <Calendar size={14} color={colors.text} />
            <Text style={styles.rowText}>
              {t("negotiation.trialSuggested")}: {suggestedTime}
            </Text>
          </View>
          <View style={styles.row}>
            <Clock size={14} color={colors.muted} />
            <Text style={styles.rowSub}>{t("negotiation.trialDuration")}</Text>
          </View>
          <View style={styles.row}>
            <MapPin size={14} color={colors.muted} />
            <Text style={styles.rowSub}>{t("negotiation.trialLocation")}</Text>
          </View>
          <Text style={styles.purpose}>{t("negotiation.trialPurpose")}</Text>
          <Pressable style={styles.primaryBtn} onPress={onPropose}>
            <Text style={styles.primaryBtnText}>{t("negotiation.proposeTrial")}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryBtnText}>{t("negotiation.cancel")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  closeBtn: { position: "absolute", top: 12, right: 12, padding: 4 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  rowText: { fontSize: 14, fontWeight: "600", color: colors.text, flex: 1 },
  rowSub: { fontSize: 13, color: colors.muted, flex: 1 },
  purpose: { fontSize: 13, color: colors.muted, lineHeight: 20, marginTop: 8, marginBottom: 16 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryBtnText: { fontSize: 14, fontWeight: "600", color: colors.primaryForeground },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.backgroundSecondary,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "600", color: colors.text },
});
