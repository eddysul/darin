import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon, ShortcutIcon } from "./BabyLogIcon";
import { BottomSheet } from "./sheets/BottomSheet";
import { sheetStyles } from "./sheets/sheetStyles";
import {
  FREQUENT_SHORTCUT_OPTIONS,
  MAX_FREQUENT_SHORTCUTS,
  getFrequentShortcutMeta,
  type FrequentShortcutId,
} from "../../constants/frequentShortcuts";
import { colors, radius } from "../../theme";

type Props = {
  visible: boolean;
  selected: FrequentShortcutId[];
  onClose: () => void;
  onSave: (next: FrequentShortcutId[]) => void;
};

export function FrequentEditSheet({ visible, selected, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<FrequentShortcutId[]>(selected);

  useEffect(() => {
    if (visible) setDraft(selected);
  }, [visible, selected]);

  const toggle = (id: FrequentShortcutId) => {
    setDraft((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_FREQUENT_SHORTCUTS) return prev;
      return [...prev, id];
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="compact">
      <Text style={sheetStyles.title}>자주 쓰는 기록 편집</Text>
      <Text style={sheetStyles.subtitle}>
        최대 {MAX_FREQUENT_SHORTCUTS}개까지 선택 · {draft.length}개 선택됨
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
        {FREQUENT_SHORTCUT_OPTIONS.map((id) => {
          const meta = getFrequentShortcutMeta(id);
          const active = draft.includes(id);
          const disabled = !active && draft.length >= MAX_FREQUENT_SHORTCUTS;
          return (
            <Pressable
              key={id}
              style={[styles.option, active && styles.optionActive, disabled && styles.optionDisabled]}
              onPress={() => !disabled && toggle(id)}
            >
              <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
                <ShortcutIcon id={id} size={20} color={meta.accent} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{meta.title}</Text>
                <Text style={styles.optionSub}>{meta.subtitle}</Text>
              </View>
              {active && <BabyLogIcon kind="check" size={18} color={colors.amber} strokeWidth={2.4} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={sheetStyles.actions}>
        <Pressable style={[sheetStyles.btn, sheetStyles.btnGhost]} onPress={onClose}>
          <Text style={sheetStyles.btnGhostText}>취소</Text>
        </Pressable>
        <Pressable
          style={[sheetStyles.btn, sheetStyles.btnPrimary, draft.length === 0 && sheetStyles.btnDisabled]}
          disabled={draft.length === 0}
          onPress={() => {
            onSave(draft);
            onClose();
          }}
        >
          <Text style={sheetStyles.btnPrimaryText}>저장</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 8, paddingBottom: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  optionActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  optionDisabled: { opacity: 0.45 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  optionSub: { fontSize: 11, color: colors.faint, marginTop: 2 },
});
