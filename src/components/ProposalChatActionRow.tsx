import { ClipboardList, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../LanguageContext";
import { colors, radius } from "../theme";

type Props = {
  onAskDarin: () => void;
  onCarePlan: () => void;
};

export function ProposalChatActionRow({ onAskDarin, onCarePlan }: Props) {
  const { t } = useLanguage();

  return (
    <View style={styles.row}>
      <Pressable style={styles.btn} onPress={onAskDarin}>
        <Sparkles size={14} color={colors.yellow} />
        <Text style={styles.btnText}>{t("negotiation.askDarin")}</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={onCarePlan}>
        <ClipboardList size={14} color={colors.text} />
        <Text style={styles.btnText}>{t("carePlan.title")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginBottom: 10 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  btnText: { fontSize: 13, fontWeight: "600", color: colors.text },
});
