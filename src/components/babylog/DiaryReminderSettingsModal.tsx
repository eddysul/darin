import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "../../context/AppSettingsContext";
import { NotificationRepository } from "../../repositories/NotificationRepository";
import { AuthRepository } from "../../repositories/AuthRepository";
import { colors, radius } from "../../theme";
import type { DiaryReminderSettings } from "../../types/diaryReminder";
import { REMINDER_PRESETS } from "../../types/diaryReminder";
import {
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
import { registerCurrentPushToken } from "../../utils/pushNotifications";

type Props = {
  visible: boolean;
  value: DiaryReminderSettings;
  babyName?: string;
  babyId?: string | null;
  onClose: () => void;
  onSave: (settings: DiaryReminderSettings) => void;
  onTestNotification?: () => void;
};

type SectionId = "all" | "diary" | "care" | "family" | "invite" | "quiet";

const permissionLabel: Record<ReminderPermissionStatus, string> = {
  granted: "허용됨",
  denied: "거부됨",
  not_determined: "아직 요청하지 않음",
  unavailable: "사용할 수 없음",
};

export function DiaryReminderSettingsModal({
  visible,
  value,
  babyName = "아기",
  babyId = null,
  onClose,
  onSave,
  onTestNotification,
}: Props) {
  const insets = useSafeAreaInsets();
  const { settings, setSettings } = useAppSettings();
  const [draft, setDraft] = useState(value);
  const [permission, setPermission] = useState<ReminderPermissionStatus>("not_determined");
  const [expanded, setExpanded] = useState<SectionId | null>("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const careEnabled = settings.notifications.feedingEnabled || settings.notifications.sleepEnabled;
  const allEnabled = draft.enabled
    || careEnabled
    || Boolean(draft.familyActivityEnabled)
    || Boolean(draft.inviteActivityEnabled)
    || Boolean(draft.quietHoursEnabled);

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setExpanded("all");
    setMessage("");
    void getReminderPermissionStatus().then(setPermission).catch(() => setPermission("unavailable"));
    if (!babyId) return;
    void NotificationRepository.getSettings(babyId)
      .then((server) => {
        if (!server) return;
        setDraft((current) => ({
          ...current,
          enabled: server.diaryReminderEnabled,
          hour: server.diaryReminderHour,
          minute: server.diaryReminderMinute,
          familyActivityEnabled: server.familyActivityEnabled,
          inviteActivityEnabled: server.inviteActivityEnabled,
          quietHoursEnabled: server.quietHoursEnabled,
          showPreview: server.showPreview,
        }));
      })
      .catch(() => setMessage("서버 설정을 불러오지 못했어요. 기기 설정은 계속 사용할 수 있어요."));
    // Opening the sheet is the only load trigger. Saving must not start another fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [babyId, visible]);

  const previewBody = useMemo(() => `자기 전 ${babyName}와의 순간을 남겨보세요.`, [babyName]);

  const persistReminder = async (next: DiaryReminderSettings) => {
    setDraft(next);
    onSave(next);
    setBusy(true);
    setMessage("");
    try {
      await syncDiaryReminderNotifications(next, {
        title: "오늘 하루 어땠나요?",
        body: previewBody,
      });
      if (babyId) {
        const user = await AuthRepository.getUser();
        if (user) {
          await NotificationRepository.updateSettings({
            userId: user.id,
            babyId,
            diaryReminderEnabled: next.enabled,
            diaryReminderHour: next.hour,
            diaryReminderMinute: next.minute,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            familyActivityEnabled: next.familyActivityEnabled ?? true,
            inviteActivityEnabled: next.inviteActivityEnabled ?? true,
            quietHoursEnabled: next.quietHoursEnabled ?? false,
            quietHoursStart: next.quietHoursStart ?? "22:00",
            quietHoursEnd: next.quietHoursEnd ?? "07:00",
            showPreview: next.showPreview ?? true,
          });
        }
      }
    } catch {
      setMessage("일부 설정을 저장하지 못했어요. 연결을 확인하고 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const enableWithPermission = async () => {
    setBusy(true);
    try {
      const status = await requestReminderPermission();
      setPermission(status);
      if (status !== "granted") return false;
      void registerCurrentPushToken();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const toggleAll = async (next: boolean) => {
    if (next && !(await enableWithPermission())) {
      setExpanded("all");
      return;
    }
    if (!next) await cancelDiaryReminderNotifications();
    setSettings((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        feedingEnabled: next ? current.notifications.feedingEnabled : false,
        sleepEnabled: next ? current.notifications.sleepEnabled : false,
      },
    }));
    const nextDraft: DiaryReminderSettings = next
      ? { ...draft, enabled: true }
      : {
          ...draft,
          enabled: false,
          familyActivityEnabled: false,
          inviteActivityEnabled: false,
          quietHoursEnabled: false,
        };
    setExpanded(next ? "all" : null);
    await persistReminder(nextDraft);
  };

  const toggleDiary = async (next: boolean) => {
    if (next && !(await enableWithPermission())) return;
    setExpanded(next ? "diary" : null);
    await persistReminder({ ...draft, enabled: next });
  };

  const toggleCare = (next: boolean) => {
    setSettings((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        feedingEnabled: next,
        sleepEnabled: next,
      },
    }));
    setExpanded(next ? "care" : null);
  };

  const toggleReminderField = (
    id: "family" | "invite" | "quiet",
    key: "familyActivityEnabled" | "inviteActivityEnabled" | "quietHoursEnabled",
    next: boolean,
  ) => {
    setExpanded(next ? id : null);
    void persistReminder({ ...draft, [key]: next });
  };

  const setReminderTime = (hour: number, minute: number) => {
    void persistReminder({ ...draft, hour, minute });
  };

  const setQuietTime = (key: "quietHoursStart" | "quietHoursEnd", time: string) => {
    void persistReminder({ ...draft, [key]: time });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}><Text style={styles.headerButton}>닫기</Text></Pressable>
          <Text style={styles.headerTitle}>알림 설정</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>받고 싶은 알림만 켜고, 필요한 설정은 바로 아래에서 조정하세요.</Text>

          <NotificationRow
            id="all"
            title="전체 알림"
            description="알림 권한과 미리보기를 확인해요."
            enabled={allEnabled}
            expanded={expanded === "all"}
            busy={busy}
            onToggle={(next) => void toggleAll(next)}
            onExpand={() => setExpanded(expanded === "all" ? null : "all")}
          >
            <DetailLine label="권한 상태" value={permissionLabel[permission]} />
            <DetailLine label="미리보기" value={draft.showPreview === false ? "끔" : "켬"} />
            <View style={styles.inlineSwitchRow}>
              <Text style={styles.detailLabel}>잠금 화면 미리보기</Text>
              <Switch
                value={draft.showPreview !== false}
                onValueChange={(showPreview) => void persistReminder({ ...draft, showPreview })}
                disabled={busy}
              />
            </View>
            {permission !== "granted" ? (
              <Pressable style={styles.secondaryButton} onPress={() => void openDeviceNotificationSettings()}>
                <Text style={styles.secondaryButtonText}>시스템 설정 열기</Text>
              </Pressable>
            ) : null}
          </NotificationRow>

          <NotificationRow
            id="diary"
            title="일기 리마인더"
            description="하루를 돌아볼 시간을 알려드려요."
            enabled={draft.enabled}
            expanded={expanded === "diary"}
            busy={busy}
            onToggle={(next) => void toggleDiary(next)}
            onExpand={() => setExpanded(expanded === "diary" ? null : "diary")}
          >
            <DetailLine label="요일" value="매일" />
            <Text style={styles.detailLabel}>시간</Text>
            <View style={styles.choiceWrap}>
              {REMINDER_PRESETS.map((preset) => {
                const selected = matchesReminderPreset(draft.hour, draft.minute) === preset.id;
                return (
                  <Pressable key={preset.id} style={[styles.choice, selected && styles.choiceOn]} onPress={() => setReminderTime(preset.hour, preset.minute)} disabled={busy}>
                    <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{preset.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.detailFoot}>현재 {formatReminderTime(draft.hour, draft.minute)} · 매일 예약</Text>
            {onTestNotification ? (
              <Pressable style={styles.secondaryButton} onPress={onTestNotification}>
                <Text style={styles.secondaryButtonText}>알림 미리보기 보내기</Text>
              </Pressable>
            ) : null}
          </NotificationRow>

          <NotificationRow
            id="care"
            title="수유·수면 알림"
            description="다음 돌봄 시간을 놓치지 않게 도와요."
            enabled={careEnabled}
            expanded={expanded === "care"}
            busy={busy}
            onToggle={toggleCare}
            onExpand={() => setExpanded(expanded === "care" ? null : "care")}
          >
            <IntervalSetting label="수유 간격" value={settings.notifications.feedingIntervalMinutes} options={[120, 180, 240]} onChange={(feedingIntervalMinutes) => setSettings((current) => ({ ...current, notifications: { ...current.notifications, feedingEnabled: true, feedingIntervalMinutes } }))} />
            <IntervalSetting label="수면 간격" value={settings.notifications.sleepIntervalMinutes} options={[90, 120, 180]} onChange={(sleepIntervalMinutes) => setSettings((current) => ({ ...current, notifications: { ...current.notifications, sleepEnabled: true, sleepIntervalMinutes } }))} />
          </NotificationRow>

          <NotificationRow
            id="family"
            title="가족 소식"
            description="가족이 남긴 댓글과 반응을 알려드려요."
            enabled={draft.familyActivityEnabled ?? true}
            expanded={expanded === "family"}
            busy={busy}
            onToggle={(next) => toggleReminderField("family", "familyActivityEnabled", next)}
            onExpand={() => setExpanded(expanded === "family" ? null : "family")}
          >
            <DetailLine label="댓글 알림" value="켬" />
            <DetailLine label="반응 알림" value="켬" />
          </NotificationRow>

          <NotificationRow
            id="invite"
            title="초대/참여 알림"
            description="초대한 가족이나 친구의 참여 소식을 받아요."
            enabled={draft.inviteActivityEnabled ?? true}
            expanded={expanded === "invite"}
            busy={busy}
            onToggle={(next) => toggleReminderField("invite", "inviteActivityEnabled", next)}
            onExpand={() => setExpanded(expanded === "invite" ? null : "invite")}
          >
            <Text style={styles.detailBody}>초대 수락과 가족 참여 상태가 바뀌면 알려드려요.</Text>
          </NotificationRow>

          <NotificationRow
            id="quiet"
            title="조용한 시간대"
            description="정한 시간에는 가족 소식 알림을 쉬어요."
            enabled={draft.quietHoursEnabled ?? false}
            expanded={expanded === "quiet"}
            busy={busy}
            onToggle={(next) => toggleReminderField("quiet", "quietHoursEnabled", next)}
            onExpand={() => setExpanded(expanded === "quiet" ? null : "quiet")}
          >
            <TimeSetting label="시작 시간" value={draft.quietHoursStart ?? "22:00"} options={["21:00", "22:00", "23:00"]} onChange={(time) => setQuietTime("quietHoursStart", time)} />
            <TimeSetting label="종료 시간" value={draft.quietHoursEnd ?? "07:00"} options={["06:00", "07:00", "08:00"]} onChange={(time) => setQuietTime("quietHoursEnd", time)} />
          </NotificationRow>

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function NotificationRow({
  id,
  title,
  description,
  enabled,
  expanded,
  busy,
  onToggle,
  onExpand,
  children,
}: {
  id: SectionId;
  title: string;
  description: string;
  enabled: boolean;
  expanded: boolean;
  busy: boolean;
  onToggle: (next: boolean) => void;
  onExpand: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowHeader}>
        <Pressable
          style={styles.rowCopy}
          onPress={onExpand}
          disabled={!enabled}
          accessibilityRole="button"
          accessibilityState={{ expanded: enabled && expanded, disabled: !enabled }}
          accessibilityLabel={`${title} 상세 ${expanded ? "접기" : "펼치기"}`}
        >
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowDescription}>{description}</Text>
          {enabled ? <Text style={styles.expandHint}>{expanded ? "접기 ︿" : "자세히 보기 ﹀"}</Text> : null}
        </Pressable>
        <Switch
          testID={`notification-toggle-${id}`}
          value={enabled}
          onValueChange={onToggle}
          disabled={busy}
          trackColor={{ false: colors.border, true: colors.amber }}
          thumbColor="#FFFFFF"
        />
      </View>
      {enabled && expanded ? <View style={styles.details}>{children}</View> : null}
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailLine}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function IntervalSetting({ label, value, options, onChange }: { label: string; value: number; options: number[]; onChange: (value: number) => void }) {
  return (
    <View style={styles.optionBlock}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.choiceWrap}>{options.map((option) => <Pressable key={option} style={[styles.choice, value === option && styles.choiceOn]} onPress={() => onChange(option)}><Text style={[styles.choiceText, value === option && styles.choiceTextOn]}>{option / 60}시간</Text></Pressable>)}</View>
    </View>
  );
}

function TimeSetting({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.optionBlock}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.choiceWrap}>{options.map((option) => <Pressable key={option} style={[styles.choice, value === option && styles.choiceOn]} onPress={() => onChange(option)}><Text style={[styles.choiceText, value === option && styles.choiceTextOn]}>{option}</Text></Pressable>)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 48, paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerButton: { minWidth: 52, color: colors.amber, fontSize: 15, fontWeight: "800" },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "800" },
  headerSpacer: { width: 52 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  intro: { marginBottom: 4, color: colors.muted, fontSize: 13, lineHeight: 20 },
  rowCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: "hidden" },
  rowHeader: { minHeight: 78, paddingHorizontal: 14, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  rowDescription: { marginTop: 4, color: colors.muted, fontSize: 11.5, lineHeight: 17 },
  expandHint: { marginTop: 6, color: colors.amberDark, fontSize: 11, fontWeight: "700" },
  details: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.backgroundSecondary, gap: 12 },
  detailLine: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  detailLabel: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" },
  detailValue: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  detailBody: { color: colors.muted, fontSize: 12.5, lineHeight: 20 },
  detailFoot: { color: colors.faint, fontSize: 11.5, lineHeight: 18 },
  inlineSwitchRow: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  optionBlock: { gap: 8 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choice: { minHeight: 34, justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, backgroundColor: colors.card },
  choiceOn: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  choiceText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  choiceTextOn: { color: colors.amberDark },
  secondaryButton: { minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  message: { padding: 12, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
