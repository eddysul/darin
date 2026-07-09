import { Pressable, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon } from "./BabyLogIcon";
import { BABY_LOG_CATEGORIES, type BabyLogCategoryId } from "../../constants/babyLogCategories";
import { colors } from "../../theme";

type Props = {
  enabledCategoryIds?: BabyLogCategoryId[];
  onSelect: (catId: BabyLogCategoryId) => void;
};

export function CategoryGrid({ enabledCategoryIds, onSelect }: Props) {
  const categories = BABY_LOG_CATEGORIES.filter(
    (c) => !enabledCategoryIds?.length || enabledCategoryIds.includes(c.id),
  );

  return (
    <View style={styles.grid}>
      {categories.map((c) => (
        <Pressable key={c.id} style={styles.btn} onPress={() => onSelect(c.id)}>
          <View style={[styles.circle, { backgroundColor: c.color }]}>
            <BabyLogIcon catId={c.id} size={24} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text style={styles.lbl}>{c.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 18,
  },
  btn: {
    width: "25%",
    alignItems: "center",
    gap: 7,
    paddingVertical: 2,
    marginBottom: 14,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  lbl: { fontSize: 11.5, color: colors.faint, fontWeight: "500", textAlign: "center" },
});
