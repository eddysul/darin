import { Globe, MessageSquare, Sparkles, Wand2, X } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../LanguageContext";
import { colors, radius } from "../theme";

type Props = {
  open: boolean;
  onClose: () => void;
  onDraftReply: () => void;
  onTranslateChat: () => void;
  onSummarizeAgreement: () => void;
  onSuggestQuestions: () => void;
};

const ACTIONS = [
  { key: "draftReply", icon: Wand2, accent: false },
  { key: "translateChat", icon: Globe, accent: false },
  { key: "summarizeAgreement", icon: Sparkles, accent: true },
  { key: "suggestQuestions", icon: MessageSquare, accent: false },
] as const;

export function ProposalAskDarinSheet({
  open,
  onClose,
  onDraftReply,
  onTranslateChat,
  onSummarizeAgreement,
  onSuggestQuestions,
}: Props) {
  const { t } = useLanguage();

  const handlers = {
    draftReply: onDraftReply,
    translateChat: onTranslateChat,
    summarizeAgreement: onSummarizeAgreement,
    suggestQuestions: onSuggestQuestions,
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Sparkles size={18} color={colors.yellow} />
              <Text style={styles.title}>{t("negotiation.askDarin")}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>{t("proposalAsk.subtitle")}</Text>

          {ACTIONS.map(({ key, icon: Icon, accent }) => (
            <Pressable
              key={key}
              style={styles.action}
              onPress={() => {
                handlers[key]();
                onClose();
              }}
            >
              <View style={[styles.actionIcon, accent && styles.actionIconAccent]}>
                <Icon size={16} color={accent ? colors.yellow : colors.text} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>{t(`proposalAsk.${key}`)}</Text>
                <Text style={styles.actionDesc}>{t(`proposalAsk.${key}Desc`)}</Text>
              </View>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
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
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 16 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconAccent: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  actionDesc: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 },
});
