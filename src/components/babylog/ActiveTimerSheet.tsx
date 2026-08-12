import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "../../theme";
import type { ActiveTimer, TimerSide } from "../../types/activeTimer";
import {
  elapsedMsNow,
  formatElapsedClock,
  msToMinutes,
  sideLabel,
} from "../../types/activeTimer";
import { useAppSettings } from "../../context/AppSettingsContext";
import { volumeFromMl, volumeToMl } from "../../utils/measurementFormat";
type Props = {
  visible: boolean;
  timer: ActiveTimer | null;
  onClose: () => void;
  onChangeSide: (side: TimerSide) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: (opts?: { amount?: string }) => void;
  allowSideSwitch?: boolean;
  saving?: boolean;
};

const SIDE_OPTIONS: TimerSide[] = ["left", "right", "both"];

const TITLES: Record<ActiveTimer["kind"], string> = {
  breastfeeding: "모유수유 타이머",
  sleep: "수면 타이머",
  pump: "유축 타이머",
  tummy: "터미타임 타이머",
  play: "놀이 타이머",
};

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
}: Props) {
  const { settings } = useAppSettings();
  const [tick, setTick] = useState(0);
  const [finishingPump, setFinishingPump] = useState(false);
  const [pumpAmount, setPumpAmount] = useState("");

  useEffect(() => {
    if (!visible || !timer || timer.status !== "running") return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [visible, timer?.id, timer?.status]);

  useEffect(() => {
    if (!visible) {
      setFinishingPump(false);
      setPumpAmount("");
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
    const live =
      timer.status === "running" && timer.side === "left"
        ? Math.max(0, Date.now() - Date.parse(timer.segmentStartedAt))
        : 0;
    return timer.leftMs + live;
  }, [timer, tick]);

  const rightElapsed = useMemo(() => {
    if (!timer) return 0;
    void tick;
    const live =
      timer.status === "running" && timer.side === "right"
        ? Math.max(0, Date.now() - Date.parse(timer.segmentStartedAt))
        : 0;
    return timer.rightMs + live;
  }, [timer, tick]);

  if (!timer) return null;

  const needsSide = timer.kind === "breastfeeding" || timer.kind === "pump";
  const paused = timer.status === "paused";

  const handleStopPress = () => {
    if (timer.kind === "pump" && !finishingPump) {
      setFinishingPump(true);
      return;
    }
    onStop(
      timer.kind === "pump"
        ? {
            amount: pumpAmount.trim()
              ? volumeToMl(pumpAmount.trim(), settings.units.volume)
              : undefined,
          }
        : undefined,
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <View style={styles.liveDot} />
            <Text style={styles.title}>{TITLES[timer.kind]}</Text>
            <Text style={styles.badge}>{paused ? "일시정지" : "진행 중"}</Text>
          </View>

          <Text style={styles.clock}>{formatElapsedClock(elapsed)}</Text>
          <Text style={styles.subClock}>
            {msToMinutes(elapsed)}분 · 시작 {timer.startTime}
            {needsSide && timer.side ? ` · ${sideLabel(timer.side)}` : ""}
          </Text>

          {needsSide ? (
            <>
              {allowSideSwitch ? (
                <>
                  <Text style={styles.fieldLabel}>수유/유축 쪽</Text>
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
              {timer.kind === "breastfeeding" ? (
                <Text style={styles.sideSplit}>
                  좌 {formatElapsedClock(leftElapsed)} · 우 {formatElapsedClock(rightElapsed)}
                </Text>
              ) : null}
            </>
          ) : null}

          {finishingPump ? (
            <>
              <Text style={styles.fieldLabel}>유축량 ({settings.units.volume})</Text>
              <TextInput
                style={styles.input}
                value={pumpAmount}
                onChangeText={setPumpAmount}
                keyboardType="numeric"
                placeholder="예: 90"
                placeholderTextColor={colors.faint}
                autoFocus
              />
              <View style={styles.suggestRow}>
                {["40", "60", "80", "100", "120"].map((ml) => {
                  const displayAmount = volumeFromMl(ml, settings.units.volume);
                  return (
                  <Pressable
                    key={ml}
                    style={[styles.suggestChip, pumpAmount === displayAmount && styles.chipSel]}
                    onPress={() => setPumpAmount(displayAmount)}
                  >
                    <Text
                      style={[styles.chipText, pumpAmount === displayAmount && styles.chipTextSel]}
                    >{`${displayAmount}${settings.units.volume}`}</Text>
                  </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <View style={styles.actions}>
            <Pressable disabled={saving} style={[styles.btn, styles.btnGhost, saving && styles.btnDisabled]} onPress={onClose}>
              <Text style={styles.btnGhostText}>닫기</Text>
            </Pressable>
            {paused ? (
              <Pressable disabled={saving} style={[styles.btn, styles.btnSecondary, saving && styles.btnDisabled]} onPress={onResume}>
                <Text style={styles.btnSecondaryText}>재개</Text>
              </Pressable>
            ) : (
              <Pressable disabled={saving} style={[styles.btn, styles.btnSecondary, saving && styles.btnDisabled]} onPress={onPause}>
                <Text style={styles.btnSecondaryText}>일시정지</Text>
              </Pressable>
            )}
            <Pressable disabled={saving} style={[styles.btn, styles.btnPrimary, saving && styles.btnDisabled]} onPress={handleStopPress}>
              <Text style={styles.btnPrimaryText}>
                {saving ? "저장 중" : finishingPump ? "저장" : "종료"}
              </Text>
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
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
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
    color: colors.amber,
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
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  suggestChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.card,
  },
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
