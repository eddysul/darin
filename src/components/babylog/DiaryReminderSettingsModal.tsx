import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DiaryReminderSettings } from "../../types/diaryReminder";
import { DEFAULT_DIARY_REMINDER } from "../../types/diaryReminder";
import { formatReminderTime } from "../../utils/diaryReminderStore";
import { colors, radius } from "../../theme";

type Props = {
  visible: boolean;
  value: DiaryReminderSettings;
  onClose: () => void;
  onSave: (settings: DiaryReminderSettings) => void;
  /** Prototype: simulate push → open compose */
  onTestNotification?: () => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 15, 20, 30, 40, 45, 50];

export function DiaryReminderSettingsModal({
  visible,
  value,
  onClose,
  onSave,
  onTestNotification,
}: Props) {
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(value.enabled);
  const [hour, setHour] = useState(value.hour);
  const [minute, setMinute] = useState(value.minute);

  useEffect(() => {
    if (!visible) return;
    setEnabled(value.enabled);
    setHour(value.hour);
    setMinute(value.minute);
  }, [visible, value]);

  const handleSave = () => {
    onSave({
      ...value,
      enabled,
      hour,
      minute,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.headerBtn}>닫기</Text>
          </Pressable>
          <Text style={styles.headerTitle}>일기 알림</Text>
          <Pressable onPress={handleSave} hitSlop={10}>
            <Text style={styles.saveBtn}>저장</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>앱 내 일기 알림 (데모)</Text>
                <Text style={styles.toggleSub}>
                  앱이 열려 있을 때 동작해요 · 실제 OS 푸시는 Coming soon
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: colors.border, true: colors.amber }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <Text style={styles.sectionLabel}>알림 시간</Text>
          <Text style={styles.previewTime}>{formatReminderTime(hour, minute)}</Text>

          <Text style={styles.fieldLabel}>시</Text>
          <View style={styles.chipRow}>
            {HOURS.filter((h) => h >= 18 || h <= 9).map((h) => {
              const active = hour === h;
              return (
                <Pressable
                  key={h}
                  style={[styles.chip, active && styles.chipActive, !enabled && styles.chipDisabled]}
                  onPress={() => enabled && setHour(h)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {String(h).padStart(2, "0")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.fieldHint}>저녁·밤 시간을 우선 보여요. 다른 시간은 아래에서 고르세요.</Text>
          <View style={styles.chipRow}>
            {HOURS.filter((h) => h > 9 && h < 18).map((h) => {
              const active = hour === h;
              return (
                <Pressable
                  key={h}
                  style={[styles.chip, active && styles.chipActive, !enabled && styles.chipDisabled]}
                  onPress={() => enabled && setHour(h)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {String(h).padStart(2, "0")}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>분</Text>
          <View style={styles.chipRow}>
            {MINUTES.map((m) => {
              const active = minute === m;
              return (
                <Pressable
                  key={m}
                  style={[styles.chip, active && styles.chipActive, !enabled && styles.chipDisabled]}
                  onPress={() => enabled && setMinute(m)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {String(m).padStart(2, "0")}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.exampleCard}>
            <Text style={styles.exampleTag}>앱 내 알림 예시</Text>
            <Text style={styles.exampleTitle}>오늘 하루 어땠나요?</Text>
            <Text style={styles.exampleBody}>자기 전에 콩이와의 순간을 남겨보세요 ✍️</Text>
            <Text style={[styles.exampleBody, { marginTop: 10 }]}>
              알림을 누르면 목록이 아니라 오늘 일기 작성 화면으로 바로 열려요.
            </Text>
          </View>

          {onTestNotification ? (
            <Pressable
              style={styles.testBtn}
              onLongPress={() => {
                onTestNotification();
                onClose();
              }}
              delayLongPress={650}
              hitSlop={4}
            >
              <Text style={styles.testBtnText}>· · ·</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.resetBtn}
            onPress={() => {
              setEnabled(DEFAULT_DIARY_REMINDER.enabled);
              setHour(DEFAULT_DIARY_REMINDER.hour);
              setMinute(DEFAULT_DIARY_REMINDER.minute);
            }}
          >
            <Text style={styles.resetBtnText}>기본값으로 (매일 밤 10시)</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { fontSize: 15, fontWeight: "600", color: colors.muted },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  saveBtn: { fontSize: 15, fontWeight: "800", color: colors.amber },
  content: { paddingHorizontal: 18, paddingTop: 16 },
  card: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 18,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleCopy: { flex: 1 },
  toggleTitle: { fontSize: 14.5, fontWeight: "800", color: colors.text },
  toggleSub: { fontSize: 12, color: colors.faint, marginTop: 3, lineHeight: 18 },
  sectionLabel: { fontSize: 13, fontWeight: "800", color: colors.text },
  previewTime: { fontSize: 20, fontWeight: "800", color: colors.amber, marginTop: 6, marginBottom: 14 },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.faint,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
  },
  fieldHint: { fontSize: 11.5, color: colors.faint, marginBottom: 8, marginTop: -2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
  },
  chipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  chipTextActive: { color: colors.text },
  exampleCard: {
    marginTop: 8,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  exampleTag: { fontSize: 11, fontWeight: "800", color: colors.amber, marginBottom: 8 },
  exampleTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  exampleBody: { fontSize: 12.5, color: colors.muted, marginTop: 4, lineHeight: 19 },
  testBtn: {
    marginTop: 28,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  testBtnText: { fontSize: 11, fontWeight: "600", color: colors.border, letterSpacing: 2 },
  resetBtn: { marginTop: 4, paddingVertical: 10, alignItems: "center" },
  resetBtnText: { fontSize: 12.5, fontWeight: "600", color: colors.faint },
});
