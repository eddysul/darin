import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../../theme";
import { formatDateKey, offsetDateKey, parseDateKey } from "../../utils/dateKey";
import { formatMonthTitle, getMonthMatrix } from "../../utils/trialCalendar";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function RecordDatePickerModal({
  visible,
  selectedDateKey,
  minDateKey,
  maxDateKey,
  title = "날짜 선택",
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedDateKey: string;
  minDateKey?: string;
  maxDateKey?: string;
  title?: string;
  onSelect: (dateKey: string) => void;
  onClose: () => void;
}) {
  const selected = parseDateKey(selectedDateKey);
  const [year, setYear] = useState(selected.getFullYear());
  const [month, setMonth] = useState(selected.getMonth());
  const todayKey = formatDateKey();
  const earliestKey = minDateKey ?? offsetDateKey(todayKey, -365);
  const latestKey = maxDateKey ?? todayKey;

  useEffect(() => {
    if (!visible) return;
    const next = parseDateKey(selectedDateKey);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }, [selectedDateKey, visible]);

  const days = useMemo(() => getMonthMatrix(year, month), [month, year]);
  const moveMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.header}>
            <View style={styles.navGroup}>
              <Pressable accessibilityLabel="이전 해" style={styles.arrow} onPress={() => moveMonth(-12)}><Text style={styles.yearArrowText}>«</Text></Pressable>
              <Pressable accessibilityLabel="이전 달" style={styles.arrow} onPress={() => moveMonth(-1)}><Text style={styles.arrowText}>‹</Text></Pressable>
            </View>
            <Text style={styles.title}>{formatMonthTitle(year, month, true)}</Text>
            <View style={styles.navGroup}>
              <Pressable accessibilityLabel="다음 달" style={styles.arrow} onPress={() => moveMonth(1)}><Text style={styles.arrowText}>›</Text></Pressable>
              <Pressable accessibilityLabel="다음 해" style={styles.arrow} onPress={() => moveMonth(12)}><Text style={styles.yearArrowText}>»</Text></Pressable>
            </View>
          </View>
          <View style={styles.grid}>
            {WEEKDAYS.map((weekday) => <Text key={weekday} style={styles.weekday}>{weekday}</Text>)}
            {days.map((day, index) => {
              if (!day) return <View key={`empty-${index}`} style={styles.day} />;
              const key = formatDateKey(day, "midnight");
              const disabled = key < earliestKey || key > latestKey;
              const active = key === selectedDateKey;
              return (
                <Pressable
                  key={key}
                  style={[styles.day, active && styles.dayActive, disabled && styles.disabled]}
                  disabled={disabled}
                  onPress={() => {
                    onSelect(key);
                    onClose();
                  }}
                >
                  <Text style={[styles.dayText, active && styles.dayTextActive]}>{day.getDate()}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>닫기</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(43,31,24,0.38)", justifyContent: "center", paddingHorizontal: 14, paddingVertical: 22 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 14 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: "900", textAlign: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navGroup: { flexDirection: "row", gap: 2 },
  title: { color: colors.text, fontSize: 14, fontWeight: "800" },
  arrow: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: colors.cardHi },
  arrowText: { color: colors.text, fontSize: 23 },
  yearArrowText: { color: colors.muted, fontSize: 17, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: "14.2857%", textAlign: "center", color: colors.faint, fontSize: 11, fontWeight: "700", paddingVertical: 6 },
  day: { width: "14.2857%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  dayActive: { backgroundColor: colors.amber },
  dayText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  dayTextActive: { color: "#fff", fontWeight: "800" },
  disabled: { opacity: 0.25 },
  close: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.full, backgroundColor: colors.cardHi },
  closeText: { color: colors.text, fontWeight: "800" },
});
