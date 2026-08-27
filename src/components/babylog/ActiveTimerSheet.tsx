import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme";
import type { ActiveTimer, TimerSide } from "../../types/activeTimer";
import {
  elapsedMsNow,
  formatElapsedClock,
  msToMinutes,
  sideLabel,
} from "../../types/activeTimer";
import { useAppSettings } from "../../context/AppSettingsContext";
import { volumeToMl } from "../../utils/measurementFormat";
import { AmountInput, isPositiveAmount } from "../inputs/AmountInput";
import { useLanguage } from "../../LanguageContext";
type TimerAmounts = { amount?: string; amountValue?: string; amountUnit?: string; amountText?: string; leftAmount?: string; rightAmount?: string; leftAmountValue?: string; leftAmountUnit?: string; leftAmountText?: string; rightAmountValue?: string; rightAmountUnit?: string; rightAmountText?: string };
type Props = {
  visible: boolean;
  timer: ActiveTimer | null;
  onClose: () => void;
  onChangeSide: (side: TimerSide) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: (opts?: TimerAmounts) => void;
  allowSideSwitch?: boolean;
  saving?: boolean;
  sessionLabel?: string;
};

// One side runs at a time; switching banks the current side before starting the other.
const SIDE_OPTIONS: TimerSide[] = ["left", "right"];

const TITLE_KEYS = {
  breastfeeding: "record.timer.breastfeeding",
  formula: "record.timer.formula",
  storedMilk: "record.timer.storedMilk",
  sleep: "record.timer.sleep",
  pump: "record.timer.pump",
  tummy: "record.timer.tummy",
  play: "record.timer.play",
  contraction: "record.contraction.title",
} as const;

export function ActiveTimerSheet({
  visible,
  timer,
  onClose,
  onChangeSide,
  onPause,
  onResume,
  onStop,
  allowSideSwitch = true,
  saving = false,
  sessionLabel,
}: Props) {
  const { t } = useLanguage();
  const { settings } = useAppSettings();
  const [tick, setTick] = useState(0);
  const [leftAmount, setLeftAmount] = useState("");
  const [rightAmount, setRightAmount] = useState("");
  const [feedingAmount, setFeedingAmount] = useState("");
  const [volumeUnit, setVolumeUnit] = useState<"ml" | "oz">(settings.units.volume);

  useEffect(() => {
    if (!visible || !timer || timer.status !== "running") return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [visible, timer?.id, timer?.status]);

  useEffect(() => {
    if (!visible) {
      setLeftAmount("");
      setRightAmount("");
      setFeedingAmount("");
      setVolumeUnit(settings.units.volume);
    }
  }, [visible]);

  const elapsed = useMemo(() => {
    if (!timer) return 0;
    void tick;
    return elapsedMsNow(timer);
  }, [timer, tick]);

  const leftElapsed = useMemo(() => {
    if (!timer) return 0;
    void tick;
    const segment = timer.status === "running" ? Math.max(0, Date.now() - Date.parse(timer.segmentStartedAt)) : 0;
    const live = timer.side === "left" ? segment : timer.side === "both" ? Math.floor(segment / 2) : 0;
    return timer.leftMs + live;
  }, [timer, tick]);

  const rightElapsed = useMemo(() => {
    if (!timer) return 0;
    void tick;
    const segment = timer.status === "running" ? Math.max(0, Date.now() - Date.parse(timer.segmentStartedAt)) : 0;
    const live = timer.side === "right" ? segment : timer.side === "both" ? Math.ceil(segment / 2) : 0;
    return timer.rightMs + live;
  }, [timer, tick]);

  if (!timer) return null;

  const needsSide = timer.kind === "breastfeeding" || timer.kind === "pump";
  const needsFeedingAmount = timer.kind === "formula" || timer.kind === "storedMilk";
  const paused = timer.status === "paused";

  const canonical = (value: string) => value ? volumeToMl(value, volumeUnit) : undefined;
  const handleStopPress = () => {
    onStop(
      needsFeedingAmount
        ? {
            amount: canonical(feedingAmount), amountValue: feedingAmount, amountUnit: volumeUnit, amountText: `${feedingAmount} ${volumeUnit}`,
          }
        : timer.kind === "pump"
          ? {
              leftAmount: canonical(leftAmount), rightAmount: canonical(rightAmount),
              leftAmountValue: leftAmount || undefined, leftAmountUnit: leftAmount ? volumeUnit : undefined, leftAmountText: leftAmount ? `${leftAmount} ${volumeUnit}` : undefined,
              rightAmountValue: rightAmount || undefined, rightAmountUnit: rightAmount ? volumeUnit : undefined, rightAmountText: rightAmount ? `${rightAmount} ${volumeUnit}` : undefined,
            }
        : undefined,
    );
  };
  const canSave = !needsFeedingAmount || isPositiveAmount(feedingAmount);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <View style={styles.liveDot} />
            <Text style={styles.title}>{t(TITLE_KEYS[timer.kind])}</Text>
            <Text style={styles.badge}>{sessionLabel ?? t(paused ? "record.timer.paused" : "record.timer.inProgress")}</Text>
          </View>

          <Text style={styles.clock}>{formatElapsedClock(elapsed)}</Text>
          <Text style={styles.subClock}>
            {t("record.timer.summary", { minutes: msToMinutes(elapsed), time: timer.startTime })}
            {needsSide && timer.side ? ` · ${sideLabel(timer.side)}` : ""}
          </Text>

          {needsSide ? (
            <>
              {allowSideSwitch ? (
                <>
                  <Text style={styles.fieldLabel}>{t("record.timer.side")}</Text>
                  <View style={styles.chipRow}>
                    {SIDE_OPTIONS.map((side) => (
                      <Pressable
                        key={side}
                        style={[styles.chip, timer.side === side && styles.chipSel]}
                        onPress={() => onChangeSide(side)}
                      >
                        <Text style={[styles.chipText, timer.side === side && styles.chipTextSel]}>
                          {sideLabel(side)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
              {(timer.kind === "breastfeeding" || timer.kind === "pump") ? (
                <Text style={styles.sideSplit}>
                  {t("record.timer.sideSummary", { left: formatElapsedClock(leftElapsed), right: formatElapsedClock(rightElapsed) })}
                </Text>
              ) : null}
            </>
          ) : null}

          {timer.kind === "pump" ? (
            <>
              <AmountInput label={t("record.timer.leftPump")} value={leftAmount} unit={volumeUnit} unitOptions={["ml", "oz"]} allowCustomUnit={false} onChangeValue={setLeftAmount} onChangeUnit={(unit) => setVolumeUnit((unit || settings.units.volume) as "ml" | "oz")} />
              <AmountInput label={t("record.timer.rightPump")} value={rightAmount} unit={volumeUnit} unitOptions={["ml", "oz"]} allowCustomUnit={false} onChangeValue={setRightAmount} onChangeUnit={(unit) => setVolumeUnit((unit || settings.units.volume) as "ml" | "oz")} />
              <Text style={styles.totalAmount}>{t("record.timer.totalPump", { amount: (Number.parseFloat(leftAmount) || 0) + (Number.parseFloat(rightAmount) || 0), unit: volumeUnit })}</Text>
            </>
          ) : null}

          {needsFeedingAmount ? <AmountInput label={t("record.timer.feedingAmount")} value={feedingAmount} unit={volumeUnit} unitOptions={["ml", "oz"]} allowCustomUnit={false} onChangeValue={setFeedingAmount} onChangeUnit={(unit) => setVolumeUnit((unit || settings.units.volume) as "ml" | "oz")} error={!feedingAmount ? t("record.timer.amountRequired") : undefined} /> : null}

          <View style={styles.actions}>
            <Pressable disabled={saving} style={[styles.btn, styles.btnGhost, saving && styles.btnDisabled]} onPress={onClose}>
              <Text style={styles.btnGhostText}>{t("record.timer.close")}</Text>
            </Pressable>
            {paused ? (
              <Pressable disabled={saving} style={[styles.btn, styles.btnSecondary, saving && styles.btnDisabled]} onPress={onResume}>
                <Text style={styles.btnSecondaryText}>{t("record.timer.resume")}</Text>
              </Pressable>
            ) : (
              <Pressable disabled={saving} style={[styles.btn, styles.btnSecondary, saving && styles.btnDisabled]} onPress={onPause}>
                <Text style={styles.btnSecondaryText}>{t("record.timer.pause")}</Text>
              </Pressable>
            )}
            <Pressable disabled={saving || !canSave} style={[styles.btn, styles.btnPrimary, (saving || !canSave) && styles.btnDisabled]} onPress={handleStopPress}>
              <Text style={styles.btnPrimaryText}>
                {t(saving ? "record.timer.saving" : "record.timer.endSave")}
              </Text>
            </Pressable>
          </View>
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
    maxHeight: "90%",
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
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amber,
  },
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
  chipTextSel: { color: colors.amberDark },
  sideSplit: {
    marginTop: 10,
    textAlign: "center",
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  amountRow: { flexDirection: "row", gap: 8 },
  amountField: { flex: 1 },
  totalAmount: { marginTop: 10, textAlign: "center", color: colors.text, fontSize: 13, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8, marginTop: 22 },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  btnGhost: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 14 },
  btnSecondary: { backgroundColor: colors.amberSoft },
  btnSecondaryText: { color: colors.text, fontWeight: "800", fontSize: 14 },
  btnPrimary: { backgroundColor: colors.amber },
  btnPrimaryText: { color: colors.amberDark, fontWeight: "800", fontSize: 14 },
  btnDisabled: { opacity: 0.55 },
});
