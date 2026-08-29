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
import { NotificationRepository } from "../../repositories/NotificationRepository";
import { AuthRepository } from "../../repositories/AuthRepository";
import { colors, radius } from "../../theme";
import type { DiaryReminderSettings } from "../../types/diaryReminder";
import {
  cancelDiaryReminderNotifications,
  getReminderPermissionStatus,
  openDeviceNotificationSettings,
  requestReminderPermission,
  syncDiaryReminderNotifications,
  type ReminderPermissionStatus,
} from "../../utils/diaryReminderNotifications";
import { registerCurrentPushToken } from "../../utils/pushNotifications";
import {
  formatTimeOfDay,
  TimeOfDayPickerField,
  TimePickerSheet,
} from "../inputs/TimePickerFields";
import { useLanguage } from "../../LanguageContext";
import type { FamilyRole } from "../../types/family";
import { FeedingReminderSettingsCard } from "./FeedingReminderSettingsCard";

type Props = {
  visible: boolean;
  value: DiaryReminderSettings;
  babyName?: string;
  babyId?: string | null;
  myRole?: FamilyRole;
  onClose: () => void;
  onSave: (settings: DiaryReminderSettings) => void;
  onTestNotification?: () => void;
};

type SectionId = "all" | "diary" | "family" | "invite" | "quiet";
type TimeTarget = "reminder" | "quietStart" | "quietEnd";

export function DiaryReminderSettingsModal({
  visible,
  value,
  babyName,
  babyId = null,
  myRole = "viewer",
  onClose,
  onSave,
  onTestNotification,
}: Props) {
  const insets = useSafeAreaInsets();
  const { locale, t } = useLanguage();
  const displayBabyName = babyName ?? t("diary.reminder.babyFallback");
  const [draft, setDraft] = useState(value);
  const [permission, setPermission] = useState<ReminderPermissionStatus>("not_determined");
  const [expanded, setExpanded] = useState<SectionId | null>("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [timeTarget, setTimeTarget] = useState<TimeTarget | null>(null);
  const [feedingDeliveryEnabled, setFeedingDeliveryEnabled] = useState(false);
  const [sleepDeliveryEnabled, setSleepDeliveryEnabled] = useState(false);
  const [allCommand, setAllCommand] = useState<{ enabled: boolean; sequence: number }>();

  const allEnabled = draft.enabled
    || feedingDeliveryEnabled
    || sleepDeliveryEnabled
    || Boolean(draft.familyActivityEnabled)
    || Boolean(draft.inviteActivityEnabled)
    || Boolean(draft.quietHoursEnabled);

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setExpanded("all");
    setMessage("");
    setTimeTarget(null);
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
      .catch(() => setMessage(t("diary.reminder.loadError")));
    // Opening the sheet is the only load trigger. Saving must not start another fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [babyId, t, visible]);

  const previewBody = useMemo(() => t("diary.reminder.previewBody", { babyName: displayBabyName }), [displayBabyName, t]);

  const persistReminder = async (next: DiaryReminderSettings) => {
    setDraft(next);
    onSave(next);
    setBusy(true);
    setMessage("");
    try {
      await syncDiaryReminderNotifications(next, {
        title: t("diary.reminder.previewTitle"),
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
      setMessage(t("diary.reminder.saveError"));
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
    const nextDraft: DiaryReminderSettings = next
      ? { ...draft, enabled: true, familyActivityEnabled: true, inviteActivityEnabled: true }
      : {
          ...draft,
          enabled: false,
          familyActivityEnabled: false,
          inviteActivityEnabled: false,
          quietHoursEnabled: false,
        };
    setExpanded(next ? "all" : null);
    setAllCommand((current) => ({ enabled: next, sequence: (current?.sequence ?? 0) + 1 }));
    await persistReminder(nextDraft);
  };

  const toggleDiary = async (next: boolean) => {
    if (next && !(await enableWithPermission())) return;
    setExpanded(next ? "diary" : null);
    await persistReminder({ ...draft, enabled: next });
  };

  const toggleReminderField = (
    id: "family" | "invite" | "quiet",
    key: "familyActivityEnabled" | "inviteActivityEnabled" | "quietHoursEnabled",
    next: boolean,
  ) => {
    setExpanded(next ? id : null);
    void persistReminder({ ...draft, [key]: next });
  };

  const pickerValue = timeTarget === "quietStart"
    ? draft.quietHoursStart ?? "22:00"
    : timeTarget === "quietEnd"
      ? draft.quietHoursEnd ?? "07:00"
      : `${String(draft.hour).padStart(2, "0")}:${String(draft.minute).padStart(2, "0")}`;

  const confirmTime = (valueHHmm: string) => {
    const [hour, minute] = valueHHmm.split(":").map(Number);
    const target = timeTarget;
    setTimeTarget(null);
    if (target === "quietStart") void persistReminder({ ...draft, quietHoursStart: valueHHmm });
    else if (target === "quietEnd") void persistReminder({ ...draft, quietHoursEnd: valueHHmm });
    else void persistReminder({ ...draft, hour, minute });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}><Text style={styles.headerButton}>{t("diary.reminder.close")}</Text></Pressable>
          <Text style={styles.headerTitle}>{t("diary.reminder.title")}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>{t("diary.reminder.intro")}</Text>

          <NotificationRow
            id="all"
            title={t("diary.reminder.all")}
            description={t("diary.reminder.allDesc")}
            enabled={allEnabled}
            expanded={expanded === "all"}
            busy={busy}
            onToggle={(next) => void toggleAll(next)}
            onExpand={() => setExpanded(expanded === "all" ? null : "all")}
          >
            <DetailLine label={t("diary.reminder.permissionStatus")} value={t(`diary.reminder.permission.${permission === "not_determined" ? "notDetermined" : permission}`)} />
            <DetailLine label={t("diary.reminder.preview")} value={t(draft.showPreview === false ? "diary.reminder.off" : "diary.reminder.on")} />
            <View style={styles.inlineSwitchRow}>
              <Text style={styles.detailLabel}>{t("diary.reminder.lockPreview")}</Text>
              <Switch
                value={draft.showPreview !== false}
                onValueChange={(showPreview) => void persistReminder({ ...draft, showPreview })}
                disabled={busy}
              />
            </View>
            {permission !== "granted" ? (
              <Pressable style={styles.secondaryButton} onPress={() => void openDeviceNotificationSettings()}>
                <Text style={styles.secondaryButtonText}>{t("diary.reminder.openSystem")}</Text>
              </Pressable>
            ) : null}
          </NotificationRow>

          <NotificationRow
            id="diary"
            title={t("diary.reminder.diary")}
            description={t("diary.reminder.diaryDesc")}
            enabled={draft.enabled}
            expanded={expanded === "diary"}
            busy={busy}
            onToggle={(next) => void toggleDiary(next)}
            onExpand={() => setExpanded(expanded === "diary" ? null : "diary")}
          >
            <DetailLine label={t("diary.reminder.day")} value={t("diary.reminder.everyDay")} />
            <Text style={styles.timePrompt}>{t("diary.reminder.when")}</Text>
            <Text style={styles.detailBody}>{t("diary.reminder.whenDesc")}</Text>
            <View style={styles.selectedTimeCard}>
              <Text style={styles.selectedTimeLabel}>{t("diary.reminder.selectedTime")}</Text>
              <Text style={styles.selectedTimeValue}>{t("diary.reminder.everyDayAt", { time: formatTimeOfDay(pickerValue, "", locale) })}</Text>
            </View>
            <Pressable style={styles.timeButton} onPress={() => setTimeTarget("reminder")} disabled={busy}>
              <Text style={styles.timeButtonText}>{t("diary.reminder.setTime")}</Text>
            </Pressable>
            {onTestNotification ? (
              <Pressable style={styles.secondaryButton} onPress={onTestNotification}>
                <Text style={styles.secondaryButtonText}>{t("diary.reminder.sendPreview")}</Text>
              </Pressable>
            ) : null}
          </NotificationRow>

          <FeedingReminderSettingsCard
            reminderType="feeding"
            babyId={babyId}
            myRole={myRole}
            active={visible}
            allCommand={allCommand}
            quietHours={{
              enabled: draft.quietHoursEnabled ?? false,
              start: draft.quietHoursStart ?? "22:00",
              end: draft.quietHoursEnd ?? "07:00",
            }}
            onDeliveryStateChange={setFeedingDeliveryEnabled}
          />

          <FeedingReminderSettingsCard
            reminderType="sleep"
            babyId={babyId}
            myRole={myRole}
            active={visible}
            allCommand={allCommand}
            quietHours={{
              enabled: draft.quietHoursEnabled ?? false,
              start: draft.quietHoursStart ?? "22:00",
              end: draft.quietHoursEnd ?? "07:00",
            }}
            onDeliveryStateChange={setSleepDeliveryEnabled}
          />

          <NotificationRow
            id="family"
            title={t("diary.reminder.family")}
            description={t("diary.reminder.familyDesc")}
            enabled={draft.familyActivityEnabled ?? true}
            expanded={expanded === "family"}
            busy={busy}
            onToggle={(next) => toggleReminderField("family", "familyActivityEnabled", next)}
            onExpand={() => setExpanded(expanded === "family" ? null : "family")}
          >
            <DetailLine label={t("diary.reminder.comment")} value={t("diary.reminder.on")} />
            <DetailLine label={t("diary.reminder.reaction")} value={t("diary.reminder.on")} />
          </NotificationRow>

          <NotificationRow
            id="invite"
            title={t("diary.reminder.invite")}
            description={t("diary.reminder.inviteDesc")}
            enabled={draft.inviteActivityEnabled ?? true}
            expanded={expanded === "invite"}
            busy={busy}
            onToggle={(next) => toggleReminderField("invite", "inviteActivityEnabled", next)}
            onExpand={() => setExpanded(expanded === "invite" ? null : "invite")}
          >
            <Text style={styles.detailBody}>{t("diary.reminder.inviteBody")}</Text>
          </NotificationRow>

          <NotificationRow
            id="quiet"
            title={t("diary.reminder.quiet")}
            description={t("diary.reminder.quietDesc")}
            enabled={draft.quietHoursEnabled ?? false}
            expanded={expanded === "quiet"}
            busy={busy}
            onToggle={(next) => toggleReminderField("quiet", "quietHoursEnabled", next)}
            onExpand={() => setExpanded(expanded === "quiet" ? null : "quiet")}
          >
            <TimeOfDayPickerField label={t("diary.reminder.startTime")} valueHHmm={draft.quietHoursStart ?? "22:00"} onPress={() => setTimeTarget("quietStart")} disabled={busy} />
            <TimeOfDayPickerField label={t("diary.reminder.endTime")} valueHHmm={draft.quietHoursEnd ?? "07:00"} onPress={() => setTimeTarget("quietEnd")} disabled={busy} />
          </NotificationRow>

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </ScrollView>

        <TimePickerSheet visible={timeTarget !== null} valueHHmm={pickerValue} onCancel={() => setTimeTarget(null)} onConfirm={confirmTime} />
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
  const { t } = useLanguage();
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowHeader}>
        <Pressable
          style={styles.rowCopy}
          onPress={onExpand}
          disabled={!enabled}
          accessibilityRole="button"
          accessibilityState={{ expanded: enabled && expanded, disabled: !enabled }}
          accessibilityLabel={t("diary.reminder.rowA11y", { title, state: t(expanded ? "diary.reminder.collapse" : "diary.reminder.expand") })}
        >
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowDescription}>{description}</Text>
          {enabled ? <Text style={styles.expandHint}>{t(expanded ? "diary.reminder.collapseHint" : "diary.reminder.detailsHint")}</Text> : null}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 48, paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerButton: { minWidth: 52, color: colors.amberText, fontSize: 15, fontWeight: "800" },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "800" },
  headerSpacer: { width: 52 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  intro: { marginBottom: 4, color: colors.muted, fontSize: 13, lineHeight: 20 },
  rowCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: "hidden" },
  rowHeader: { minHeight: 78, paddingHorizontal: 14, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  rowDescription: { marginTop: 4, color: colors.muted, fontSize: 11.5, lineHeight: 17 },
  expandHint: { marginTop: 6, color: colors.amberText, fontSize: 11, fontWeight: "700" },
  details: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.backgroundSecondary, gap: 12 },
  detailLine: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  detailLabel: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" },
  detailValue: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  detailBody: { color: colors.muted, fontSize: 12.5, lineHeight: 20 },
  detailFoot: { color: colors.faint, fontSize: 11.5, lineHeight: 18 },
  timePrompt: { color: colors.text, fontSize: 14, fontWeight: "800" },
  selectedTimeCard: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  selectedTimeLabel: { color: colors.faint, fontSize: 11.5, fontWeight: "700" },
  selectedTimeValue: { marginTop: 5, color: colors.text, fontSize: 19, fontWeight: "800" },
  timeButton: { minHeight: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.amber },
  timeButtonText: { color: colors.brandCoralForeground, fontSize: 14, fontWeight: "800" },
  inlineSwitchRow: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  secondaryButton: { minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  message: { padding: 12, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
