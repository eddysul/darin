import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon, ShortcutIcon } from "./BabyLogIcon";
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>자주 쓰는 기록 편집</Text>
          <Text style={styles.subtitle}>최대 {MAX_FREQUENT_SHORTCUTS}개까지 선택 · {draft.length}개 선택됨</Text>

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

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={styles.btnGhostText}>취소</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, draft.length === 0 && styles.btnDisabled]}
              disabled={draft.length === 0}
              onPress={() => {
                onSave(draft);
                onClose();
              }}
            >
              <Text style={styles.btnPrimaryText}>저장</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: "82%",
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 4,
    alignSelf: "center",
    marginVertical: 10,
  },
  title: { fontSize: 17, fontWeight: "800", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 12.5, color: colors.faint, marginBottom: 14 },
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
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  btnGhost: { backgroundColor: colors.card },
  btnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 14.5 },
  btnPrimary: { backgroundColor: colors.amber },
  btnPrimaryText: { color: colors.amberDark, fontWeight: "700", fontSize: 14.5 },
  btnDisabled: { opacity: 0.45 },
});
