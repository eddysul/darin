import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon } from "./BabyLogIcon";
import { colors } from "../../theme";

type Props = {
  visible: boolean;
  title?: string;
  body?: string;
  onPress: () => void;
  onDismiss: () => void;
};

export function PushToast({
  visible,
  title = "오늘 하루 어땠나요?",
  body = "자기 전에 일기를 남겨보세요 ✍️",
  onPress,
  onDismiss,
}: Props) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, 4200);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <Pressable style={styles.toast} onPress={onPress}>
      <BabyLogIcon kind="bell" size={20} color={colors.amberText} />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub} numberOfLines={2}>
          {body}
        </Text>
        <Text style={styles.cta}>탭해서 오늘 일기 쓰기 →</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    zIndex: 60,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "rgba(30,32,42,0.96)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
  },
  body: { flex: 1 },
  title: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  sub: { fontSize: 12, color: "rgba(255,255,255,0.72)", marginTop: 3, lineHeight: 17 },
  cta: { fontSize: 11, fontWeight: "700", color: colors.amberText, marginTop: 6 },
});
