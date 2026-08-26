import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useLanguage } from "../../LanguageContext";
import { CareReminderRepository } from "../../repositories/CareReminderRepository";
import { colors, radius } from "../../theme";
import type { CareReminderBundle, CareReminderType } from "../../types/careReminder";
import type { FamilyRole } from "../../types/family";
import { getPushPermissionState, registerCurrentPushToken, requestPushPermission } from "../../utils/pushNotifications";
import { elapsedMinutesSince, feedingReminderProgress, feedingReminderStatusKey } from "../../utils/careReminderStatus";
import { DurationPickerField, DurationPickerSheet } from "../inputs/TimePickerFields";
import { isFeatureVisible } from "../../config/featureFlags";

type Props = {
  reminderType?: CareReminderType;
  babyId: string | null;
  myRole: FamilyRole;
  active?: boolean;
  allCommand?: { enabled: boolean; sequence: number };
  quietHours?: { enabled: boolean; start: string; end: string };
  onDeliveryStateChange?: (enabled: boolean) => void;
};

export function FeedingReminderSettingsCard({
  reminderType = "feeding",
  babyId,
  myRole,
  active = true,
  allCommand,
  quietHours,
  onDeliveryStateChange,
}: Props) {
  const featureName = reminderType === "feeding" ? "feedingReminder" : "sleepReminder";
  const reminderVisible = isFeatureVisible(featureName);
  const copyPrefix = reminderType === "feeding" ? "diary.feedingReminder" : "diary.sleepReminder";
  const { t } = useLanguage();
  const { settings, setSettings } = useAppSettings();
  const legacySetting = useRef({
    enabled: reminderType === "feeding" ? settings.notifications.feedingEnabled : settings.notifications.sleepEnabled,
    intervalMinutes: reminderType === "feeding" ? settings.notifications.feedingIntervalMinutes : settings.notifications.sleepIntervalMinutes,
  });
  const [bundle, setBundle] = useState<CareReminderBundle>({ setting: null, preference: null, state: null });
  const [permission, setPermission] = useState<Awaited<ReturnType<typeof getPushPermissionState>>>("not_determined");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const canEditShared = myRole === "owner" || myRole === "admin" || myRole === "editor" || myRole === "caregiver";

  const cacheBundle = useCallback((next: CareReminderBundle) => {
    setBundle(next);
    const sharedEnabled = next.setting?.enabled ?? false;
    const deliveryEnabled = next.preference?.deliveryEnabled ?? false;
    setSettings((current) => reminderType === "feeding" ? ({
      ...current, notifications: { ...current.notifications,
        feedingEnabled: sharedEnabled,
        feedingIntervalMinutes: next.setting?.intervalMinutes ?? current.notifications.feedingIntervalMinutes,
        feedingDeliveryEnabled: deliveryEnabled,
        feedingDeliveryRestoreEnabled: deliveryEnabled || current.notifications.feedingDeliveryRestoreEnabled,
      },
    }) : ({
      ...current, notifications: { ...current.notifications,
        sleepEnabled: sharedEnabled,
        sleepIntervalMinutes: next.setting?.intervalMinutes ?? current.notifications.sleepIntervalMinutes,
        sleepDeliveryEnabled: deliveryEnabled,
        sleepDeliveryRestoreEnabled: deliveryEnabled || current.notifications.sleepDeliveryRestoreEnabled,
      },
    }));
    onDeliveryStateChange?.(deliveryEnabled);
  }, [onDeliveryStateChange, reminderType, setSettings]);

  const refresh = useCallback(async () => {
    if (!reminderVisible || !active || !babyId) return;
    setLoading(true);
    setMessage("");
    try {
      const permissionState = await getPushPermissionState();
      setPermission(permissionState);
      const next = reminderType === "feeding"
        ? await CareReminderRepository.migrateLegacyFeedingSetting(babyId, legacySetting.current.enabled, legacySetting.current.intervalMinutes)
        : await CareReminderRepository.migrateLegacySleepSetting(babyId, legacySetting.current.enabled, legacySetting.current.intervalMinutes);
      cacheBundle(next);
      if (next.preference?.deliveryEnabled) {
        if (permissionState === "granted") {
          if (!(await registerCurrentPushToken())) setMessage(t(`${copyPrefix}.tokenError`));
        } else {
          onDeliveryStateChange?.(false);
        }
      }
    } catch {
      setMessage(t(`${copyPrefix}.loadError`));
    } finally {
      setLoading(false);
    }
  }, [active, babyId, cacheBundle, copyPrefix, onDeliveryStateChange, reminderType, reminderVisible, t]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!reminderVisible || !active) return;
    const timer = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [active, reminderVisible]);

  const ensureDeliveryReady = async () => {
    const nextPermission = await requestPushPermission();
    setPermission(nextPermission);
    if (nextPermission !== "granted") {
      setMessage(t(`${copyPrefix}.permissionNeeded`));
      return false;
    }
    if (!(await registerCurrentPushToken())) {
      setMessage(t(`${copyPrefix}.tokenError`));
      return false;
    }
    return true;
  };

  const savePreference = async (deliveryEnabled: boolean, explicit = true) => {
    if (!babyId) return false;
    if (deliveryEnabled && !(await ensureDeliveryReady())) return false;
    const preference = await CareReminderRepository.saveMyPreference(babyId, reminderType, {
      deliveryEnabled,
      quietHoursEnabled: bundle.preference?.quietHoursEnabled ?? false,
      quietStart: bundle.preference?.quietStart ?? null,
      quietEnd: bundle.preference?.quietEnd ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
    const next = { ...bundle, preference };
    setBundle(next);
    setSettings((current) => reminderType === "feeding" ? ({
      ...current, notifications: { ...current.notifications,
        feedingDeliveryEnabled: deliveryEnabled,
        feedingDeliveryRestoreEnabled: explicit ? deliveryEnabled : current.notifications.feedingDeliveryRestoreEnabled,
      },
    }) : ({
      ...current, notifications: { ...current.notifications,
        sleepDeliveryEnabled: deliveryEnabled,
        sleepDeliveryRestoreEnabled: explicit ? deliveryEnabled : current.notifications.sleepDeliveryRestoreEnabled,
      },
    }));
    onDeliveryStateChange?.(deliveryEnabled);
    return true;
  };

  useEffect(() => {
    if (!reminderVisible || !active || !babyId || !allCommand || loading) return;
    if (!allCommand.enabled && bundle.preference?.deliveryEnabled) {
      void savePreference(false, false).catch(() => setMessage(t(`${copyPrefix}.saveError`)));
    } else if (
      allCommand.enabled
      && !bundle.preference?.deliveryEnabled
      && (reminderType === "feeding" ? settings.notifications.feedingDeliveryRestoreEnabled : settings.notifications.sleepDeliveryRestoreEnabled)
      && bundle.setting?.enabled
    ) {
      void savePreference(true, false).catch(() => setMessage(t(`${copyPrefix}.saveError`)));
    }
    // sequence intentionally makes each explicit global-toggle action observable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCommand?.sequence]);

  useEffect(() => {
    if (!reminderVisible || !active || !babyId || !quietHours || !bundle.preference) return;
    const current = bundle.preference;
    if (
      current.quietHoursEnabled === quietHours.enabled
      && current.quietStart === quietHours.start
      && current.quietEnd === quietHours.end
    ) return;
    void CareReminderRepository.saveMyPreference(babyId, reminderType, {
      deliveryEnabled: current.deliveryEnabled,
      quietHoursEnabled: quietHours.enabled,
      quietStart: quietHours.start,
      quietEnd: quietHours.end,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    }).then((preference) => setBundle((value) => ({ ...value, preference })))
      .catch(() => setMessage(t(`${copyPrefix}.saveError`)));
  }, [active, babyId, bundle.preference, copyPrefix, quietHours, reminderType, reminderVisible, t]);

  const toggleShared = async (enabled: boolean) => {
    if (!babyId || !canEditShared || busy) return;
    setBusy(true); setMessage("");
    try {
      if (enabled && !(await ensureDeliveryReady())) return;
      const setting = await CareReminderRepository.saveSetting(babyId, reminderType, {
        enabled,
        intervalMinutes: bundle.setting?.intervalMinutes ?? (reminderType === "feeding"
          ? settings.notifications.feedingIntervalMinutes
          : settings.notifications.sleepIntervalMinutes),
      });
      let next: CareReminderBundle = { ...bundle, setting };
      if (enabled) next = await CareReminderRepository.getBundle(babyId, reminderType);
      cacheBundle(next);
    } catch {
      setMessage(t(`${copyPrefix}.saveError`));
    } finally { setBusy(false); }
  };

  const toggleDelivery = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true); setMessage("");
    try { await savePreference(enabled); }
    catch { setMessage(t(`${copyPrefix}.saveError`)); }
    finally { setBusy(false); }
  };

  const saveInterval = async (minutes: number) => {
    setPickerOpen(false);
    if (!babyId || !canEditShared) return;
    setBusy(true); setMessage("");
    try {
      const setting = await CareReminderRepository.saveSetting(babyId, reminderType, {
        enabled: bundle.setting?.enabled ?? false,
        intervalMinutes: minutes,
      });
      cacheBundle({ ...bundle, setting, state: (await CareReminderRepository.getBundle(babyId, reminderType)).state });
    } catch { setMessage(t(`${copyPrefix}.saveError`)); }
    finally { setBusy(false); }
  };

  const intervalMinutes = bundle.setting?.intervalMinutes ?? (reminderType === "feeding" ? settings.notifications.feedingIntervalMinutes : settings.notifications.sleepIntervalMinutes);
  const progress = feedingReminderProgress(bundle.state?.lastRelevantLogAt ?? null, intervalMinutes, clock);
  const statusKey = feedingReminderStatusKey(progress);
  const elapsed = elapsedMinutesSince(bundle.state?.lastRelevantLogAt ?? null, clock);
  const statusLabel = t(`${copyPrefix}.status.${statusKey}`);
  const elapsedText = elapsed === null ? null : elapsed >= 60
    ? t(`${copyPrefix}.elapsedHours`, { hours: Math.floor(elapsed / 60), minutes: elapsed % 60 })
    : t(`${copyPrefix}.elapsedMinutes`, { minutes: elapsed });

  if (!reminderVisible) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t(`${copyPrefix}.title`)}</Text>
      <Text style={styles.body}>{t(`${copyPrefix}.intro`)}</Text>
      {!babyId ? <Text style={styles.message}>{t(`${copyPrefix}.accountRequired`)}</Text> : null}
      <View style={styles.switchRow}>
        <View style={styles.copy}>
          <Text style={styles.label}>{t(`${copyPrefix}.sharedToggle`)}</Text>
          {!canEditShared ? <Text style={styles.hint}>{t(`${copyPrefix}.viewerReadOnly`)}</Text> : null}
        </View>
        <Switch value={bundle.setting?.enabled ?? false} onValueChange={(value) => void toggleShared(value)} disabled={!babyId || !canEditShared || busy || loading} />
      </View>

      <Text style={styles.sectionTitle}>{t(`${copyPrefix}.sharedSection`)}</Text>
      <DurationPickerField
        label={t(`${copyPrefix}.interval`)}
        valueMinutes={intervalMinutes}
        onPress={() => setPickerOpen(true)}
        disabled={!babyId || !canEditShared || busy || loading}
      />

      <Text style={styles.sectionTitle}>{t(`${copyPrefix}.mySection`)}</Text>
      <View style={styles.switchRow}>
        <View style={styles.copy}>
          <Text style={styles.label}>{t(`${copyPrefix}.deliveryToggle`)}</Text>
          {permission !== "granted" ? <Text style={styles.permission}>{t(`${copyPrefix}.permissionNeeded`)}</Text> : null}
        </View>
        <Switch
          value={Boolean(bundle.preference?.deliveryEnabled && permission === "granted")}
          onValueChange={(value) => void toggleDelivery(value)}
          disabled={!babyId || !bundle.setting?.enabled || busy || loading}
        />
      </View>

      {bundle.state?.lastRelevantLogAt ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>{statusLabel}</Text>
          {elapsedText ? <Text style={styles.statusBody}>{t(`${copyPrefix}.lastFeed`, { elapsed: elapsedText })}</Text> : null}
          <Text style={styles.statusBody}>{t(`${copyPrefix}.intervalBasis`, { minutes: intervalMinutes })}</Text>
        </View>
      ) : null}
      <Text style={styles.notice}>{t(`${copyPrefix}.reference`)}</Text>
      <Text style={styles.notice}>{t(`${copyPrefix}.signals`)}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {loading ? <Text style={styles.hint}>{t(`${copyPrefix}.loading`)}</Text> : null}

      <DurationPickerSheet
        visible={pickerOpen}
        valueMinutes={intervalMinutes}
        title={t(`${copyPrefix}.interval`)}
        minMinutes={15}
        maxMinutes={720}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(minutes) => void saveInterval(minutes)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 6 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  copy: { flex: 1, gap: 3 },
  label: { color: colors.text, fontSize: 14, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 12 },
  permission: { color: colors.dangerText, fontSize: 12 },
  statusCard: { backgroundColor: colors.backgroundSecondary, borderRadius: radius.md, padding: 13, gap: 4 },
  statusTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  statusBody: { color: colors.muted, fontSize: 12 },
  notice: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  message: { color: colors.dangerText, fontSize: 12, lineHeight: 17 },
});
