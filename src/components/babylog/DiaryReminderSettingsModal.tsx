import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DiaryReminderRepeat, DiaryReminderSettings } from "../../types/diaryReminder";
import { DEFAULT_DIARY_REMINDER, REMINDER_PRESETS } from "../../types/diaryReminder";
import {
  formatNextReminderLabel,
  formatReminderTime,
  matchesReminderPreset,
} from "../../utils/diaryReminderStore";
import {
  cancelDiaryReminderNotifications,
  getReminderPermissionStatus,
  openDeviceNotificationSettings,
  requestReminderPermission,
  syncDiaryReminderNotifications,
  type ReminderPermissionStatus,
} from "../../utils/diaryReminderNotifications";
import { colors, radius } from "../../theme";

type Props = {
  visible: boolean;
  value: DiaryReminderSettings;
  babyName?: string;
  onClose: () => void;
  onSave: (settings: DiaryReminderSettings) => void;
  /** Prototype: simulate in-app push → open compose (deep-link path) */
  onTestNotification?: () => void;
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_OPTIONS = [0, 10, 15, 20, 30, 40, 45, 50];

const REPEAT_OPTIONS: Array<{
  value: DiaryReminderRepeat;
  label: string;
  enabled: boolean;
}> = [
  { value: "daily", label: "매일", enabled: true },
  { value: "weekdays", label: "평일", enabled: false },
  { value: "weekend", label: "주말", enabled: false },
  { value: "custom", label: "요일 직접 선택", enabled: false },
];

export function DiaryReminderSettingsModal({
  visible,
  value,
  babyName = "아기",
  onClose,
  onSave,
  onTestNotification,
}: Props) {
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(value.enabled);
  const [hour, setHour] = useState(value.hour);
  const [minute, setMinute] = useState(value.minute);
  const [repeat, setRepeat] = useState<DiaryReminderRepeat>(value.repeat ?? "daily");
  const [permission, setPermission] = useState<ReminderPermissionStatus>("undetermined");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftHour, setDraftHour] = useState(value.hour);
  const [draftMinute, setDraftMinute] = useState(value.minute);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setEnabled(value.enabled);
    setHour(value.hour);
    setMinute(value.minute);
    setRepeat(value.repeat ?? "daily");
    setPickerOpen(false);
    void getReminderPermissionStatus().then(setPermission);
  }, [visible, value]);

  const presetId = matchesReminderPreset(hour, minute);
  const scheduleLabel = formatReminderTime(hour, minute);
  const nextLabel = formatNextReminderLabel(hour, minute);

  const previewBody = useMemo(
    () => `자기 전 ${babyName}와의 순간을 남겨보세요.`,
    [babyName],
  );

  const persist = async (next: DiaryReminderSettings) => {
    setBusy(true);
    try {
      await syncDiaryReminderNotifications(next, {
        title: "오늘 하루 어땠나요?",
        body: previewBody,
      });
      onSave(next);
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (nextEnabled: boolean) => {
    if (nextEnabled) {
      const status = await requestReminderPermission();
      setPermission(status);
      if (status !== "granted") {
        setEnabled(false);
        await cancelDiaryReminderNotifications();
        await persist({
          ...value,
          enabled: false,
          hour,
          minute,
          repeat,
        });
        return;
      }
    } else {
      await cancelDiaryReminderNotifications();
    }
    setEnabled(nextEnabled);
    await persist({
      ...value,
      enabled: nextEnabled,
      hour,
      minute,
      repeat,
    });
  };

  const applyTime = async (nextHour: number, nextMinute: number) => {
    setHour(nextHour);
    setMinute(nextMinute);
    await persist({
      ...value,
      enabled,
      hour: nextHour,
      minute: nextMinute,
      repeat,
    });
  };

  const handleSaveAndClose = async () => {
    await persist({
      ...value,
      enabled,
      hour,
      minute,
      repeat,
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
          <Pressable onPress={() => void handleSaveAndClose()} hitSlop={10} disabled={busy}>
            <Text style={styles.saveBtn}>완료</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>일기 알림</Text>
            <Text style={styles.heroBody}>매일 밤, 오늘의 순간을 잊지 않게 알려드릴게요.</Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>알림 켜기</Text>
              <Switch
                value={enabled}
                onValueChange={(next) => void handleToggle(next)}
                trackColor={{ false: colors.border, true: colors.amber }}
                thumbColor="#FFFFFF"
                disabled={busy}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>언제 알려드릴까요?</Text>
          <View style={styles.presetGrid}>
            {REMINDER_PRESETS.map((preset) => {
              const active = presetId === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  style={[
                    styles.presetChip,
                    active && styles.presetChipActive,
                    !enabled && styles.disabledSoft,
                  ]}
                  disabled={!enabled || busy}
                  onPress={() => void applyTime(preset.hour, preset.minute)}
                >
                  <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                    {preset.label}
                    {preset.recommended ? " 추천" : ""}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={[
                styles.presetChip,
                presetId === "custom" && styles.presetChipActive,
                !enabled && styles.disabledSoft,
              ]}
              disabled={!enabled || busy}
              onPress={() => {
                setDraftHour(hour);
                setDraftMinute(minute);
                setPickerOpen(true);
              }}
            >
              <Text
                style={[
                  styles.presetChipText,
                  presetId === "custom" && styles.presetChipTextActive,
                ]}
              >
                직접 설정
              </Text>
            </Pressable>
          </View>

          <View style={[styles.card, !enabled && styles.disabledSoft]}>
            <Text style={styles.cardEyebrow}>선택된 시간</Text>
            <Text style={styles.selectedTime}>{scheduleLabel}</Text>
            <Pressable
              style={styles.changeTimeBtn}
              disabled={!enabled || busy}
              onPress={() => {
                setDraftHour(hour);
                setDraftMinute(minute);
                setPickerOpen(true);
              }}
            >
              <Text style={styles.changeTimeText}>시간 변경하기</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>반복</Text>
          <View style={styles.repeatRow}>
            {REPEAT_OPTIONS.map((option) => {
              const active = repeat === option.value;
              const locked = !option.enabled;
              return (
                <Pressable
                  key={option.value}
                  style={[
                    styles.repeatChip,
                    active && styles.repeatChipActive,
                    (locked || !enabled) && styles.disabledSoft,
                  ]}
                  disabled={locked || !enabled || busy}
                  onPress={() => {
                    if (!option.enabled) return;
                    setRepeat(option.value);
                    void persist({
                      ...value,
                      enabled,
                      hour,
                      minute,
                      repeat: option.value,
                    });
                  }}
                >
                  <Text style={[styles.repeatChipText, active && styles.repeatChipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>MVP에서는 매일 알림만 예약돼요.</Text>

          <View style={styles.previewCard}>
            <Text style={styles.cardEyebrow}>알림 미리보기</Text>
            <Text style={styles.previewTitle}>오늘 하루 어땠나요?</Text>
            <Text style={styles.previewBody}>{previewBody}</Text>
            <Text style={styles.previewFoot}>
              알림을 누르면 목록이 아니라 오늘 일기 작성 화면으로 바로 열려요.
            </Text>
          </View>

          {enabled && permission !== "granted" ? (
            <View style={styles.permissionCard}>
              <Text style={styles.permissionTitle}>알림 권한이 꺼져 있어요.</Text>
              <Text style={styles.permissionBody}>
                기기 설정에서 알림을 허용해야 받을 수 있어요.
              </Text>
              <Pressable style={styles.settingsBtn} onPress={() => void openDeviceNotificationSettings()}>
                <Text style={styles.settingsBtnText}>설정 열기</Text>
              </Pressable>
            </View>
          ) : null}

          {enabled && permission === "granted" ? (
            <View style={styles.nextCard}>
              <Text style={styles.cardEyebrow}>다음 알림</Text>
              <Text style={styles.nextTime}>{nextLabel}</Text>
            </View>
          ) : null}

          {onTestNotification ? (
            <Pressable
              style={styles.testBtn}
              accessibilityRole="button"
              accessibilityLabel="알림 테스트"
              onPress={() => {
                onTestNotification();
                onClose();
              }}
            >
              <Text style={styles.testBtnText}>알림 테스트 · 오늘 일기 열기</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.resetBtn}
            onPress={() => {
              setEnabled(DEFAULT_DIARY_REMINDER.enabled);
              setHour(DEFAULT_DIARY_REMINDER.hour);
              setMinute(DEFAULT_DIARY_REMINDER.minute);
              setRepeat("daily");
              void persist({ ...DEFAULT_DIARY_REMINDER, lastFiredDateKey: value.lastFiredDateKey });
            }}
          >
            <Text style={styles.resetBtnText}>기본값으로 (매일 밤 10시)</Text>
          </Pressable>
        </ScrollView>

        {pickerOpen ? (
          <View style={styles.sheetOverlay}>
            <Pressable style={styles.sheetBackdrop} onPress={() => setPickerOpen(false)} />
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>시간 변경</Text>
              <Text style={styles.sheetSub}>원하는 시·분을 고른 뒤 적용해 주세요.</Text>

              <Text style={styles.pickerLabel}>시</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pickerRow}
              >
                {HOUR_OPTIONS.map((h) => {
                  const active = draftHour === h;
                  return (
                    <Pressable
                      key={h}
                      style={[styles.pickerChip, active && styles.pickerChipActive]}
                      onPress={() => setDraftHour(h)}
                    >
                      <Text style={[styles.pickerChipText, active && styles.pickerChipTextActive]}>
                        {String(h).padStart(2, "0")}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={styles.pickerLabel}>분</Text>
              <View style={styles.pickerRowWrap}>
                {MINUTE_OPTIONS.map((m) => {
                  const active = draftMinute === m;
                  return (
                    <Pressable
                      key={m}
                      style={[styles.pickerChip, active && styles.pickerChipActive]}
                      onPress={() => setDraftMinute(m)}
                    >
                      <Text style={[styles.pickerChipText, active && styles.pickerChipTextActive]}>
                        {String(m).padStart(2, "0")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={styles.applyBtn}
                onPress={() => {
                  setPickerOpen(false);
                  void applyTime(draftHour, draftMinute);
                }}
              >
                <Text style={styles.applyBtnText}>
                  {formatReminderTime(draftHour, draftMinute)} 적용
                </Text>
              </Pressable>
              {Platform.OS === "ios" ? <View style={{ height: 4 }} /> : null}
            </View>
          </View>
        ) : null}
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
  headerBtn: { fontSize: 15, fontWeight: "600", color: colors.muted, minWidth: 48 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  saveBtn: { fontSize: 15, fontWeight: "800", color: colors.amber, minWidth: 48, textAlign: "right" },
  content: { paddingHorizontal: 18, paddingTop: 16 },
  heroCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 16,
    marginBottom: 18,
  },
  heroTitle: { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  heroBody: { marginTop: 6, fontSize: 13.5, lineHeight: 20, color: colors.muted },
  toggleRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 10,
  },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  presetChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  presetChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  presetChipText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  presetChipTextActive: { color: colors.amber },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 18,
  },
  cardEyebrow: { fontSize: 11.5, fontWeight: "800", color: colors.amber, marginBottom: 6 },
  selectedTime: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  changeTimeBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.cardHi,
  },
  changeTimeText: { fontSize: 13, fontWeight: "700", color: colors.text },
  repeatRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  repeatChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  repeatChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  repeatChipText: { fontSize: 12.5, fontWeight: "700", color: colors.muted },
  repeatChipTextActive: { color: colors.amber },
  hint: { fontSize: 12, color: colors.faint, marginBottom: 16 },
  previewCard: {
    backgroundColor: "#FFF8F4",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
  },
  previewTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  previewBody: { marginTop: 6, fontSize: 13.5, lineHeight: 20, color: colors.muted },
  previewFoot: { marginTop: 12, fontSize: 12, lineHeight: 18, color: colors.faint },
  permissionCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
  },
  permissionTitle: { fontSize: 14, fontWeight: "800", color: colors.dangerText },
  permissionBody: { marginTop: 4, fontSize: 12.5, lineHeight: 18, color: colors.muted },
  settingsBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: colors.amber,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  settingsBtnText: { color: colors.amberDark, fontWeight: "800", fontSize: 13 },
  nextCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 8,
  },
  nextTime: { fontSize: 18, fontWeight: "800", color: colors.text },
  testBtn: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  testBtnText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  resetBtn: { marginTop: 8, paddingVertical: 10, alignItems: "center" },
  resetBtnText: { fontSize: 12.5, fontWeight: "600", color: colors.faint },
  disabledSoft: { opacity: 0.45 },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 30,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  sheetSub: { marginTop: 4, marginBottom: 14, fontSize: 12.5, color: colors.muted },
  pickerLabel: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.faint,
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 4,
  },
  pickerRow: { gap: 8, paddingRight: 8, marginBottom: 12 },
  pickerRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  pickerChip: {
    minWidth: 48,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  pickerChipText: { fontSize: 14, fontWeight: "700", color: colors.muted },
  pickerChipTextActive: { color: colors.text },
  applyBtn: {
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  applyBtnText: { color: colors.amberDark, fontWeight: "800", fontSize: 14.5 },
});
