import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon } from "./BabyLogIcon";
import { colors } from "../../theme";

type Props = {
  visible: boolean;
  onPress: () => void;
  onDismiss: () => void;
};

export function PushToast({ visible, onPress, onDismiss }: Props) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, 3200);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <Pressable style={styles.toast} onPress={onPress}>
      <BabyLogIcon kind="bell" size={20} color={colors.amber} />
      <View style={styles.body}>
        <Text style={styles.title}>콩이로그</Text>
        <Text style={styles.sub}>오늘 하루 어땠나요? 일기를 남겨보세요</Text>
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
  title: { fontSize: 12.5, fontWeight: "700", color: colors.text },
  sub: { fontSize: 11.5, color: colors.faint, marginTop: 2 },
});
