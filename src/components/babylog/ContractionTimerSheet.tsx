import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme";
import type { ActiveTimer } from "../../types/activeTimer";
import { elapsedMsNow, formatElapsedClock } from "../../types/activeTimer";
import type { BabyLogEntry } from "../../types/babyLog";
import { useLanguage } from "../../LanguageContext";
import { parseDateKey } from "../../utils/dateKey";
import { formatLocalizedDate } from "../../utils/localeFormat";
import {
  CONTRACTION_INTENSITY,
  contractionIntensityLabel,
  formatContractionSpan,
  groupContractionsByDate,
  isContractionLog,
  todayContractionSummary,
} from "../../utils/contractionLog";
import { formatDisplayTime } from "../../utils/logSummary";

type Props = {
  visible: boolean;
  timer: ActiveTimer | null;
  logs: BabyLogEntry[];
  dateKey: string;
  saving?: boolean;
  onClose: () => void;
  onStart: () => void;
  onStop: (opts: { chip?: string; notes?: string }) => void;
  onEdit: (entry: BabyLogEntry) => void;
  onDelete?: (entry: BabyLogEntry) => void;
};

export function ContractionTimerSheet({
  visible,
  timer,
  logs,
  dateKey,
  saving = false,
  onClose,
  onStart,
  onStop,
  onEdit,
  onDelete,
}: Props) {
  const { t, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const [tick, setTick] = useState(0);
  const [chip, setChip] = useState("");
  const [notes, setNotes] = useState("");

  const running = Boolean(timer && timer.status === "running");

  useEffect(() => {
    if (!visible || !running) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [visible, running, timer?.id]);

  useEffect(() => {
    if (!visible) {
      setChip("");
      setNotes("");
    }
  }, [visible]);

  const elapsed = useMemo(() => {
    if (!timer) return 0;
    void tick;
    return elapsedMsNow(timer);
  }, [timer, tick]);

  const contractionLogs = useMemo(() => logs.filter(isContractionLog), [logs]);
  const groups = useMemo(() => groupContractionsByDate(contractionLogs), [contractionLogs]);
  const summary = useMemo(() => todayContractionSummary(contractionLogs, dateKey), [contractionLogs, dateKey]);

  const confirmDelete = (entry: BabyLogEntry) => {
    if (!onDelete) return;
    Alert.alert(t("home.timeline.deleteTitle"), t("home.timeline.deleteBody"), [
      { text: t("home.timeline.cancel"), style: "cancel" },
      { text: t("home.timeline.delete"), style: "destructive", onPress: () => onDelete(entry) },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
              <View style={styles.titleRow}>
                {running ? <View style={styles.liveDot} /> : null}
                <Text style={styles.title}>{t("record.contraction.title")}</Text>
                {running ? <Text style={styles.badge}>{t("record.contraction.running")}</Text> : null}
              </View>
              <Text style={styles.body}>{t("record.contraction.body")}</Text>
              <Text style={styles.safety}>{t("record.contraction.safetyRecord")}</Text>
              <Text style={styles.safety}>{t("record.contraction.safetyContact")}</Text>

              <Text style={styles.clock}>{formatElapsedClock(elapsed)}</Text>
              {running ? (
                <Text style={styles.subClock}>
                  {t("record.contraction.startedAt", { time: timer?.startTime ?? "" })}
                </Text>
              ) : null}

              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{t("record.contraction.todayCount")}</Text>
                  <Text style={styles.summaryValue}>{t("home.summary.count", { count: summary.count })}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{t("record.contraction.lastDuration")}</Text>
                  <Text style={styles.summaryValue}>
                    {summary.lastDurationSeconds == null
                      ? t("home.summary.none")
                      : formatContractionSpan(t, summary.lastDurationSeconds)}
                  </Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{t("record.contraction.lastInterval")}</Text>
                  <Text style={styles.summaryValue}>
                    {summary.lastIntervalSeconds == null
                      ? t("record.contraction.first")
                      : formatContractionSpan(t, summary.lastIntervalSeconds)}
                  </Text>
                </View>
              </View>
              {summary.avgIntervalSeconds != null ? (
                <Text style={styles.avgHint}>
                  {t("record.contraction.avgInterval")} · {formatContractionSpan(t, summary.avgIntervalSeconds)}
                </Text>
              ) : null}

              <Text style={styles.fieldLabel}>{t("record.contraction.intensity")}</Text>
              <View style={styles.chipRow}>
                {CONTRACTION_INTENSITY.map((option) => (
                  <Pressable
                    key={option}
                    style={[styles.chip, chip === option && styles.chipSel]}
                    onPress={() => setChip((current) => (current === option ? "" : option))}
                  >
                    <Text style={[styles.chipText, chip === option && styles.chipTextSel]}>
                      {contractionIntensityLabel(t, option)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t("record.detail.memo")}</Text>
              <TextInput
                style={[styles.input, styles.notes]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder={t("record.contraction.memoPlaceholder")}
                placeholderTextColor={colors.faint}
              />

              <View style={styles.actions}>
                <Pressable disabled={saving} style={[styles.btn, styles.btnGhost, saving && styles.btnDisabled]} onPress={onClose}>
                  <Text style={styles.btnGhostText}>{t("record.timer.close")}</Text>
                </Pressable>
                {running ? (
                  <Pressable
                    disabled={saving}
                    style={[styles.btn, styles.btnPrimary, saving && styles.btnDisabled]}
                    onPress={() => onStop({ chip: chip || undefined, notes: notes.trim() || undefined })}
                  >
                    <Text style={styles.btnPrimaryText}>
                      {t(saving ? "record.timer.saving" : "record.contraction.end")}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable disabled={saving} style={[styles.btn, styles.btnPrimary, saving && styles.btnDisabled]} onPress={onStart}>
                    <Text style={styles.btnPrimaryText}>{t("record.contraction.start")}</Text>
                  </Pressable>
                )}
              </View>

              <Text style={styles.listTitle}>{t("record.contraction.recent")}</Text>
              {groups.length === 0 ? (
                <Text style={styles.empty}>{t("record.contraction.none")}</Text>
              ) : (
                groups.map((group) => (
                  <View key={group.dateKey || "none"} style={styles.group}>
                    <Text style={styles.groupTitle}>
                      {group.dateKey
                        ? formatLocalizedDate(parseDateKey(group.dateKey), locale, { weekday: "short", month: "numeric", day: "numeric" })
                        : ""}
                    </Text>
                    {group.items.map((item) => (
                      <View key={item.id} style={styles.row}>
                        <Pressable style={styles.rowCopy} onPress={() => onEdit(item)}>
                          <Text style={styles.rowTime}>{formatDisplayTime(item.time)}</Text>
                          <Text style={styles.rowMeta}>
                            {[
                              `${t("record.contraction.duration")} ${formatContractionSpan(t, item.durationSeconds)}`,
                              item.intervalSeconds == null
                                ? t("record.contraction.first")
                                : `${t("record.contraction.interval")} ${formatContractionSpan(t, item.intervalSeconds)}`,
                              item.chip ? contractionIntensityLabel(t, item.chip) : null,
                            ].filter(Boolean).join(" · ")}
                          </Text>
                          {item.notes ? <Text style={styles.rowNotes} numberOfLines={2}>{item.notes}</Text> : null}
                        </Pressable>
                        {onDelete ? (
                          <Pressable
                            style={styles.deleteBtn}
                            onPress={() => confirmDelete(item)}
                            accessibilityRole="button"
                            accessibilityLabel={t("home.timeline.delete")}
                          >
                            <Text style={styles.deleteText}>{t("home.timeline.delete")}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%",
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetContent: { paddingHorizontal: 22, paddingBottom: 28 },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 4,
    alignSelf: "center",
    marginVertical: 10,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  title: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.text },
  badge: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.amberText,
    backgroundColor: colors.amberSoft,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "600", marginBottom: 8 },
  safety: { color: colors.faint, fontSize: 12, lineHeight: 18, marginBottom: 6 },
  clock: {
    fontSize: 44,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -1,
    textAlign: "center",
    marginTop: 8,
  },
  subClock: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
  },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  summaryCard: {
    flex: 1,
    minHeight: 58,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "center",
  },
  summaryLabel: { color: colors.faint, fontSize: 10.5, fontWeight: "700" },
  summaryValue: { marginTop: 3, color: colors.text, fontSize: 13, fontWeight: "800" },
  avgHint: { color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  fieldLabel: {
    fontSize: 12,
    color: colors.faint,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSel: { backgroundColor: colors.amber, borderColor: colors.amber },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: "700" },
  chipTextSel: { color: colors.brandCoralForeground },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  notes: { minHeight: 72, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 8, marginTop: 18 },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 14 },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.primaryForeground, fontWeight: "800", fontSize: 14 },
  btnDisabled: { opacity: 0.55 },
  listTitle: { marginTop: 22, marginBottom: 8, fontSize: 15, fontWeight: "800", color: colors.text },
  empty: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  group: { marginBottom: 12 },
  groupTitle: { color: colors.faint, fontSize: 12, fontWeight: "800", marginBottom: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  rowCopy: { flex: 1 },
  rowTime: { color: colors.text, fontSize: 14, fontWeight: "800" },
  rowMeta: { marginTop: 2, color: colors.muted, fontSize: 12, fontWeight: "600" },
  rowNotes: { marginTop: 4, color: colors.faint, fontSize: 12 },
  deleteBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  deleteText: { color: colors.dangerText, fontSize: 12, fontWeight: "800" },
});
