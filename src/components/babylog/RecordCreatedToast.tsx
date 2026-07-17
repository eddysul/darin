import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme";

type Props = {
  visible: boolean;
  title: string;
  body?: string;
  onPress: () => void;
  onDismiss: () => void;
};

export function RecordCreatedToast({ visible, title, body = "탭해서 수정", onPress, onDismiss }: Props) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, 3200);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <Pressable style={styles.toast} onPress={onPress}>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.cta}>{body} →</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 18,
    left: 16,
    right: 16,
    zIndex: 70,
    backgroundColor: "rgba(30,32,42,0.96)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  body: { gap: 4 },
  title: { fontSize: 13.5, fontWeight: "800", color: "#FFFFFF" },
  cta: { fontSize: 12, fontWeight: "700", color: colors.amber },
});
