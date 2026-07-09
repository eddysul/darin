import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon } from "./BabyLogIcon";
import { LogCategoryIcon } from "./LogCategoryIcon";
import { MAIN_LOG_CATEGORY_IDS } from "../../constants/mainLogCategories";
import { getCategory } from "../../constants/babyLogCategories";
import type { CustomCategory, LogCategoryKey } from "../../types/logCategory";
import { customCategoryKey } from "../../types/logCategory";
import { colors, radius } from "../../theme";

/** ~2 rows at 4 columns per row */
const COLLAPSED_COUNT = 8;

type GridItem =
  | { kind: "builtin"; catId: (typeof MAIN_LOG_CATEGORY_IDS)[number] }
  | { kind: "custom"; custom: CustomCategory }
  | { kind: "new" };

type Props = {
  customCategories: CustomCategory[];
  onSelect: (catKey: LogCategoryKey) => void;
  onNewPress: () => void;
};

export function MoreRecordGrid({ customCategories, onSelect, onNewPress }: Props) {
  const [expanded, setExpanded] = useState(false);

  const allItems = useMemo<GridItem[]>(() => {
    const items: GridItem[] = MAIN_LOG_CATEGORY_IDS.map((catId) => ({ kind: "builtin", catId }));
    for (const custom of customCategories) {
      items.push({ kind: "custom", custom });
    }
    items.push({ kind: "new" });
    return items;
  }, [customCategories]);

  const visibleItems = expanded ? allItems : allItems.slice(0, COLLAPSED_COUNT);
  const canExpand = allItems.length > COLLAPSED_COUNT;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>기록하기</Text>
        {canExpand && (
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
            <Text style={styles.viewAll}>{expanded ? "접기" : "전체 보기 ›"}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.grid}>
        {visibleItems.map((item) => {
          if (item.kind === "builtin") {
            return (
              <Pressable key={item.catId} style={styles.cell} onPress={() => onSelect(item.catId)}>
                <BabyLogIcon catId={item.catId} size={22} />
                <Text style={styles.label} numberOfLines={1}>
                  {getCategory(item.catId).label}
                </Text>
              </Pressable>
            );
          }

          if (item.kind === "custom") {
            const key = customCategoryKey(item.custom.id);
            return (
              <Pressable key={item.custom.id} style={styles.cell} onPress={() => onSelect(key)}>
                <LogCategoryIcon categoryKey={key} customCategories={customCategories} size={22} />
                <Text style={styles.label} numberOfLines={1}>
                  {item.custom.label}
                </Text>
              </Pressable>
            );
          }

          return (
            <Pressable key="new" style={styles.cell} onPress={onNewPress}>
              <BabyLogIcon kind="new" size={22} color={colors.amber} />
              <Text style={styles.label}>신규</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 22 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  viewAll: { fontSize: 13, color: colors.amber, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: {
    width: "22%",
    flexGrow: 1,
    flexBasis: "21%",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 6,
    shadowColor: "#2E2A26",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: { fontSize: 11, color: colors.muted, fontWeight: "600", textAlign: "center" },
});
