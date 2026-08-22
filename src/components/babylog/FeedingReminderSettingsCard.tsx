import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useLanguage } from "../../LanguageContext";
import { CareReminderRepository } from "../../repositories/CareReminderRepository";
import { colors, radius } from "../../theme";
import type { FeedingReminderBundle } from "../../types/careReminder";
import type { FamilyRole } from "../../types/family";
import { getPushPermissionState, registerCurrentPushToken, requestPushPermission } from "../../utils/pushNotifications";
import { elapsedMinutesSince, feedingReminderProgress, feedingReminderStatusKey } from "../../utils/careReminderStatus";
import { DurationPickerField, DurationPickerSheet } from "../inputs/TimePickerFields";

type Props = {
  babyId: string | null;
  myRole: FamilyRole;
  active?: boolean;
  allCommand?: { enabled: boolean; sequence: number };
  quietHours?: { enabled: boolean; start: string; end: string };
  onDeliveryStateChange?: (enabled: boolean) => void;
};

export function FeedingReminderSettingsCard({
  babyId,
  myRole,
  active = true,
  allCommand,
  quietHours,
  onDeliveryStateChange,
}: Props) {
  const { t } = useLanguage();
  const { settings, setSettings } = useAppSettings();
  const legacySetting = useRef({
    enabled: settings.notifications.feedingEnabled,
    intervalMinutes: settings.notifications.feedingIntervalMinutes,
  });
  const [bundle, setBundle] = useState<FeedingReminderBundle>({ setting: null, preference: null, state: null });
  const [permission, setPermission] = useState<Awaited<ReturnType<typeof getPushPermissionState>>>("not_determined");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const canEditShared = myRole === "owner" || myRole === "admin" || myRole === "editor" || myRole === "caregiver";

  const cacheBundle = useCallback((next: FeedingReminderBundle) => {
    setBundle(next);
    const sharedEnabled = next.setting?.enabled ?? false;
    const deliveryEnabled = next.preference?.deliveryEnabled ?? false;
    setSettings((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        feedingEnabled: sharedEnabled,
        feedingIntervalMinutes: next.setting?.intervalMinutes ?? current.notifications.feedingIntervalMinutes,
        feedingDeliveryEnabled: deliveryEnabled,
        feedingDeliveryRestoreEnabled: deliveryEnabled || current.notifications.feedingDeliveryRestoreEnabled,
      },
    }));
    onDeliveryStateChange?.(deliveryEnabled);
  }, [onDeliveryStateChange, setSettings]);

  const refresh = useCallback(async () => {
    if (!active || !babyId) return;
    setLoading(true);
    setMessage("");
    try {
      const permissionState = await getPushPermissionState();
      setPermission(permissionState);
      const next = await CareReminderRepository.migrateLegacyFeedingSetting(
        babyId,
        legacySetting.current.enabled,
        legacySetting.current.intervalMinutes,
      );
      cacheBundle(next);
      if (next.preference?.deliveryEnabled) {
        if (permissionState === "granted") {
          if (!(await registerCurrentPushToken())) setMessage(t("diary.feedingReminder.tokenError"));
        } else {
          onDeliveryStateChange?.(false);
        }
      }
    } catch {
      setMessage(t("diary.feedingReminder.loadError"));
    } finally {
      setLoading(false);
    }
  }, [active, babyId, cacheBundle, onDeliveryStateChange, t]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [active]);

  const ensureDeliveryReady = async () => {
    const nextPermission = await requestPushPermission();
    setPermission(nextPermission);
    if (nextPermission !== "granted") {
      setMessage(t("diary.feedingReminder.permissionNeeded"));
      return false;
    }
    if (!(await registerCurrentPushToken())) {
      setMessage(t("diary.feedingReminder.tokenError"));
      return false;
    }
    return true;
  };

  const savePreference = async (deliveryEnabled: boolean, explicit = true) => {
    if (!babyId) return false;
    if (deliveryEnabled && !(await ensureDeliveryReady())) return false;
    const preference = await CareReminderRepository.saveMyFeedingPreference(babyId, {
      deliveryEnabled,
      quietHoursEnabled: bundle.preference?.quietHoursEnabled ?? false,
      quietStart: bundle.preference?.quietStart ?? null,
      quietEnd: bundle.preference?.quietEnd ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
    const next = { ...bundle, preference };
    setBundle(next);
    setSettings((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        feedingDeliveryEnabled: deliveryEnabled,
        feedingDeliveryRestoreEnabled: explicit ? deliveryEnabled : current.notifications.feedingDeliveryRestoreEnabled,
      },
    }));
    onDeliveryStateChange?.(deliveryEnabled);
    return true;
  };

  useEffect(() => {
    if (!active || !babyId || !allCommand || loading) return;
    if (!allCommand.enabled && bundle.preference?.deliveryEnabled) {
      void savePreference(false, false).catch(() => setMessage(t("diary.feedingReminder.saveError")));
    } else if (
      allCommand.enabled
      && !bundle.preference?.deliveryEnabled
      && settings.notifications.feedingDeliveryRestoreEnabled
      && bundle.setting?.enabled
    ) {
      void savePreference(true, false).catch(() => setMessage(t("diary.feedingReminder.saveError")));
    }
    // sequence intentionally makes each explicit global-toggle action observable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCommand?.sequence]);

  useEffect(() => {
    if (!active || !babyId || !quietHours || !bundle.preference) return;
    const current = bundle.preference;
    if (
      current.quietHoursEnabled === quietHours.enabled
      && current.quietStart === quietHours.start
      && current.quietEnd === quietHours.end
    ) return;
    void CareReminderRepository.saveMyFeedingPreference(babyId, {
      deliveryEnabled: current.deliveryEnabled,
      quietHoursEnabled: quietHours.enabled,
      quietStart: quietHours.start,
      quietEnd: quietHours.end,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    }).then((preference) => setBundle((value) => ({ ...value, preference })))
      .catch(() => setMessage(t("diary.feedingReminder.saveError")));
  }, [active, babyId, bundle.preference, quietHours, t]);

  const toggleShared = async (enabled: boolean) => {
    if (!babyId || !canEditShared || busy) return;
    setBusy(true); setMessage("");
    try {
      if (enabled && !(await ensureDeliveryReady())) return;
      const setting = await CareReminderRepository.saveFeedingSetting(babyId, {
        enabled,
        intervalMinutes: bundle.setting?.intervalMinutes ?? settings.notifications.feedingIntervalMinutes,
      });
      let next: FeedingReminderBundle = { ...bundle, setting };
      if (enabled) next = await CareReminderRepository.getFeedingBundle(babyId);
      cacheBundle(next);
    } catch {
      setMessage(t("diary.feedingReminder.saveError"));
    } finally { setBusy(false); }
  };

  const toggleDelivery = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true); setMessage("");
    try { await savePreference(enabled); }
    catch { setMessage(t("diary.feedingReminder.saveError")); }
    finally { setBusy(false); }
  };

  const saveInterval = async (minutes: number) => {
    setPickerOpen(false);
    if (!babyId || !canEditShared) return;
    setBusy(true); setMessage("");
    try {
      const setting = await CareReminderRepository.saveFeedingSetting(babyId, {
        enabled: bundle.setting?.enabled ?? false,
        intervalMinutes: minutes,
      });
      cacheBundle({ ...bundle, setting, state: (await CareReminderRepository.getFeedingBundle(babyId)).state });
    } catch { setMessage(t("diary.feedingReminder.saveError")); }
    finally { setBusy(false); }
  };

  const intervalMinutes = bundle.setting?.intervalMinutes ?? settings.notifications.feedingIntervalMinutes;
  const progress = feedingReminderProgress(bundle.state?.lastRelevantLogAt ?? null, intervalMinutes, clock);
  const statusKey = feedingReminderStatusKey(progress);
  const elapsed = elapsedMinutesSince(bundle.state?.lastRelevantLogAt ?? null, clock);
  const statusLabel = t(`diary.feedingReminder.status.${statusKey}`);
  const elapsedText = elapsed === null ? null : elapsed >= 60
    ? t("diary.feedingReminder.elapsedHours", { hours: Math.floor(elapsed / 60), minutes: elapsed % 60 })
    : t("diary.feedingReminder.elapsedMinutes", { minutes: elapsed });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("diary.feedingReminder.title")}</Text>
      <Text style={styles.body}>{t("diary.feedingReminder.intro")}</Text>
      {!babyId ? <Text style={styles.message}>{t("diary.feedingReminder.accountRequired")}</Text> : null}
      <View style={styles.switchRow}>
        <View style={styles.copy}>
          <Text style={styles.label}>{t("diary.feedingReminder.sharedToggle")}</Text>
          {!canEditShared ? <Text style={styles.hint}>{t("diary.feedingReminder.viewerReadOnly")}</Text> : null}
        </View>
        <Switch value={bundle.setting?.enabled ?? false} onValueChange={(value) => void toggleShared(value)} disabled={!babyId || !canEditShared || busy || loading} />
      </View>

      <Text style={styles.sectionTitle}>{t("diary.feedingReminder.sharedSection")}</Text>
      <DurationPickerField
        label={t("diary.feedingReminder.interval")}
        valueMinutes={intervalMinutes}
        onPress={() => setPickerOpen(true)}
        disabled={!babyId || !canEditShared || busy || loading}
      />

      <Text style={styles.sectionTitle}>{t("diary.feedingReminder.mySection")}</Text>
      <View style={styles.switchRow}>
        <View style={styles.copy}>
          <Text style={styles.label}>{t("diary.feedingReminder.deliveryToggle")}</Text>
          {permission !== "granted" ? <Text style={styles.permission}>{t("diary.feedingReminder.permissionNeeded")}</Text> : null}
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
          {elapsedText ? <Text style={styles.statusBody}>{t("diary.feedingReminder.lastFeed", { elapsed: elapsedText })}</Text> : null}
          <Text style={styles.statusBody}>{t("diary.feedingReminder.intervalBasis", { minutes: intervalMinutes })}</Text>
        </View>
      ) : null}
      <Text style={styles.notice}>{t("diary.feedingReminder.reference")}</Text>
      <Text style={styles.notice}>{t("diary.feedingReminder.signals")}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {loading ? <Text style={styles.hint}>{t("diary.feedingReminder.loading")}</Text> : null}

      <DurationPickerSheet
        visible={pickerOpen}
        valueMinutes={intervalMinutes}
        title={t("diary.feedingReminder.interval")}
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
