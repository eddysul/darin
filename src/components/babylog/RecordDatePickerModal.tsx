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
            {WEEKDAYS.map((weekday) => <View key={weekday} style={styles.weekdayCell}><Text style={styles.weekday}>{weekday}</Text></View>)}
            {days.map((day, index) => {
              if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
              const key = formatDateKey(day, "midnight");
              const disabled = key < earliestKey || key > latestKey;
              const active = key === selectedDateKey;
              return (
                <CalendarDayCell
                  key={key}
                  label={String(day.getDate())}
                  isSelected={active}
                  isDisabled={disabled}
                  onPress={() => {
                    onSelect(key);
                    onClose();
                  }}
                />
              );
            })}
          </View>
          <Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>닫기</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CalendarDayCell({ label, isSelected, isDisabled, onPress }: { label: string; isSelected: boolean; isDisabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.dayCell, isDisabled && styles.disabled]}
      disabled={isDisabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}일`}
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
    >
      <View style={[styles.dayPill, isSelected && styles.dayPillSelected]}>
        <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{label}</Text>
      </View>
    </Pressable>
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
  grid: { width: 44 * 7, alignSelf: "center", flexDirection: "row", flexWrap: "wrap" },
  weekdayCell: { width: 44, height: 28, alignItems: "center", justifyContent: "center" },
  weekday: { color: colors.faint, fontSize: 11, lineHeight: 16, fontWeight: "700", textAlign: "center", includeFontPadding: false },
  dayCell: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dayPill: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  dayPillSelected: { backgroundColor: colors.amber },
  dayText: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "600", textAlign: "center", includeFontPadding: false },
  dayTextSelected: { color: "#fff", fontWeight: "800" },
  disabled: { opacity: 0.25 },
  close: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.full, backgroundColor: colors.cardHi },
  closeText: { color: colors.text, fontWeight: "800" },
});
