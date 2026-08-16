import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme";

type Props = {
  title: string;
  expanded: boolean;
  canExpand: boolean;
  onToggle: () => void;
  expandLabel?: string;
  collapseLabel?: string;
};

export function ExpandableSectionHeader({
  title,
  expanded,
  canExpand,
  onToggle,
  expandLabel = "전체 보기 ›",
  collapseLabel = "접기",
}: Props) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {canExpand && (
        <Pressable onPress={onToggle} hitSlop={8}>
          <Text style={styles.action}>{expanded ? collapseLabel : expandLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  action: { fontSize: 13, color: colors.amberText, fontWeight: "700" },
});
