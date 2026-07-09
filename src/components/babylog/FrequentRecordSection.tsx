import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon, ShortcutIcon } from "./BabyLogIcon";
import { FrequentEditSheet } from "./FrequentEditSheet";
import type { BabyLogCategoryId } from "../../constants/babyLogCategories";
import {
  getFrequentShortcutMeta,
  shortcutToCategoryId,
  type FrequentShortcutId,
} from "../../constants/frequentShortcuts";
import type { DefaultFeedingMethod } from "../../types/careSetup";
import { colors, radius } from "../../theme";

type Props = {
  shortcuts: FrequentShortcutId[];
  defaultFeedingMethod: DefaultFeedingMethod;
  onSelect: (catId: BabyLogCategoryId) => void;
  onSaveShortcuts: (next: FrequentShortcutId[]) => void;
};

function feedingCatForMethod(method: DefaultFeedingMethod): BabyLogCategoryId {
  if (method === "formula") return "formula";
  if (method === "pumped_milk") return "pump";
  return "breast";
}

export function FrequentRecordSection({
  shortcuts,
  defaultFeedingMethod,
  onSelect,
  onSaveShortcuts,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);

  const handlePress = (id: FrequentShortcutId) => {
    if (id === "feeding") {
      if (defaultFeedingMethod === "mixed" || defaultFeedingMethod === "not_sure") {
        Alert.alert("수유 기록", "어떤 수유인가요?", [
          { text: "모유", onPress: () => onSelect("breast") },
          { text: "분유", onPress: () => onSelect("formula") },
          { text: "유축", onPress: () => onSelect("pump") },
          { text: "취소", style: "cancel" },
        ]);
        return;
      }
      onSelect(feedingCatForMethod(defaultFeedingMethod));
      return;
    }
    const catId = shortcutToCategoryId(id);
    if (catId) onSelect(catId);
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>오늘 자주 쓰는 기록</Text>
        <Pressable style={styles.editBtn} hitSlop={8} onPress={() => setEditOpen(true)}>
          <BabyLogIcon kind="edit" size={13} color={colors.faint} />
          <Text style={styles.edit}>편집</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {shortcuts.map((id) => {
          const meta = getFrequentShortcutMeta(id);
          return (
            <Pressable key={id} style={styles.card} onPress={() => handlePress(id)}>
              <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
                <ShortcutIcon id={id} size={20} color={meta.accent} />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.cardTitle}>{meta.title}</Text>
                <Text style={styles.cardSub}>{meta.subtitle}</Text>
              </View>
              <BabyLogIcon kind="chevron" size={18} color={colors.faint} strokeWidth={2} />
            </Pressable>
          );
        })}
      </View>

      <FrequentEditSheet
        visible={editOpen}
        selected={shortcuts}
        onClose={() => setEditOpen(false)}
        onSave={onSaveShortcuts}
      />
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
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  edit: { fontSize: 12.5, color: colors.faint, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "46%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
    shadowColor: "#2E2A26",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: { flex: 1 },
  cardTitle: { fontSize: 14.5, fontWeight: "800", color: colors.text },
  cardSub: { fontSize: 11, color: colors.faint, marginTop: 2, fontWeight: "500" },
});
