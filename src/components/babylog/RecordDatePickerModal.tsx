import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { colors, radius } from "../../theme";
import { formatDateKey, offsetDateKey, parseDateKey } from "../../utils/dateKey";
import { getMonthMatrix } from "../../utils/trialCalendar";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const WHEEL_ITEM_HEIGHT = 44;

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
  const [wheelOpen, setWheelOpen] = useState(false);
  const [wheelYear, setWheelYear] = useState(selected.getFullYear());
  const [wheelMonth, setWheelMonth] = useState(selected.getMonth() + 1);
  const [wheelDay, setWheelDay] = useState(selected.getDate());
  const todayKey = formatDateKey();
  const earliestKey = minDateKey ?? offsetDateKey(todayKey, -365);
  const latestKey = maxDateKey ?? todayKey;

  useEffect(() => {
    if (!visible) return;
    const next = parseDateKey(selectedDateKey);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setWheelOpen(false);
    setWheelYear(next.getFullYear());
    setWheelMonth(next.getMonth() + 1);
    setWheelDay(next.getDate());
  }, [selectedDateKey, visible]);

  const days = useMemo(() => getMonthMatrix(year, month), [month, year]);
  const earliest = parseDateKey(earliestKey);
  const latest = parseDateKey(latestKey);
  const yearOptions = useMemo(
    () => Array.from(
      { length: latest.getFullYear() - earliest.getFullYear() + 1 },
      (_, index) => earliest.getFullYear() + index,
    ),
    [earliestKey, latestKey],
  );
  const monthOptions = useMemo(() => {
    const first = wheelYear === earliest.getFullYear() ? earliest.getMonth() + 1 : 1;
    const last = wheelYear === latest.getFullYear() ? latest.getMonth() + 1 : 12;
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }, [earliestKey, latestKey, wheelYear]);
  const dayOptions = useMemo(() => {
    const lastInMonth = new Date(wheelYear, wheelMonth, 0).getDate();
    const first = wheelYear === earliest.getFullYear() && wheelMonth === earliest.getMonth() + 1
      ? earliest.getDate()
      : 1;
    const last = wheelYear === latest.getFullYear() && wheelMonth === latest.getMonth() + 1
      ? latest.getDate()
      : lastInMonth;
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }, [earliestKey, latestKey, wheelMonth, wheelYear]);

  useEffect(() => {
    if (!monthOptions.includes(wheelMonth)) {
      setWheelMonth(monthOptions[wheelMonth < monthOptions[0] ? 0 : monthOptions.length - 1]);
    }
  }, [monthOptions, wheelMonth]);

  useEffect(() => {
    if (!dayOptions.includes(wheelDay)) {
      setWheelDay(dayOptions[wheelDay < dayOptions[0] ? 0 : dayOptions.length - 1]);
    }
  }, [dayOptions, wheelDay]);

  const openWheel = () => {
    const current = parseDateKey(selectedDateKey);
    const day = current.getFullYear() === year && current.getMonth() === month
      ? current.getDate()
      : 1;
    setWheelYear(year);
    setWheelMonth(month + 1);
    setWheelDay(day);
    setWheelOpen(true);
  };

  const confirmWheel = () => {
    const draft = formatDateKey(new Date(wheelYear, wheelMonth - 1, wheelDay), "midnight");
    const nextKey = draft < earliestKey ? earliestKey : draft > latestKey ? latestKey : draft;
    onSelect(nextKey);
    onClose();
  };
  const moveMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {wheelOpen ? (
            <>
              <View style={styles.wheelHeader}>
                <Pressable style={styles.wheelHeaderButton} onPress={() => setWheelOpen(false)}><Text style={styles.wheelCancel}>취소</Text></Pressable>
                <Text style={styles.modalTitle}>날짜 선택</Text>
                <Pressable style={styles.wheelHeaderButton} onPress={confirmWheel}><Text style={styles.wheelDone}>완료</Text></Pressable>
              </View>
              <View style={styles.wheelArea}>
                <View pointerEvents="none" style={styles.wheelSelection} />
                <WheelColumn values={yearOptions} value={wheelYear} suffix="년" onChange={setWheelYear} accessibilityLabel="연도" />
                <WheelColumn values={monthOptions} value={wheelMonth} suffix="월" onChange={setWheelMonth} accessibilityLabel="월" />
                <WheelColumn values={dayOptions} value={wheelDay} suffix="일" onChange={setWheelDay} accessibilityLabel="일" />
              </View>
              <Text style={styles.wheelHelp}>년·월·일을 위아래로 스크롤해서 선택해 주세요.</Text>
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>{title}</Text>
              <View style={styles.header}>
                <View style={styles.navGroup}>
                  <Pressable accessibilityLabel="이전 해" style={styles.arrow} onPress={() => moveMonth(-12)}><Text style={styles.yearArrowText}>«</Text></Pressable>
                  <Pressable accessibilityLabel="이전 달" style={styles.arrow} onPress={() => moveMonth(-1)}><Text style={styles.arrowText}>‹</Text></Pressable>
                </View>
                <Pressable style={styles.dateHeaderButton} onPress={openWheel} accessibilityRole="button" accessibilityLabel="년 월 일 스크롤 선택 열기">
                  <Text style={styles.dateHeaderPart}>{year}년</Text>
                  <Text style={styles.dateHeaderPart}>{month + 1}월</Text>
                  <Text style={styles.dateHeaderPart}>
                    {selected.getFullYear() === year && selected.getMonth() === month ? selected.getDate() : 1}일
                  </Text>
                  <Text style={styles.dateHeaderChevron}>⌄</Text>
                </Pressable>
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
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function WheelColumn({ values, value, suffix, onChange, accessibilityLabel }: { values: number[]; value: number; suffix: string; onChange: (value: number) => void; accessibilityLabel: string }) {
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, values.indexOf(value));

  useEffect(() => {
    const timer = setTimeout(() => ref.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated: false }), 0);
    return () => clearTimeout(timer);
  }, [index]);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.max(0, Math.min(values.length - 1, Math.round(event.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT)));
    onChange(values[nextIndex]);
  };

  return (
    <ScrollView
      ref={ref}
      style={styles.wheelColumn}
      contentContainerStyle={styles.wheelContent}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ITEM_HEIGHT}
      decelerationRate="fast"
      onMomentumScrollEnd={settle}
      onScrollEndDrag={settle}
      accessibilityLabel={accessibilityLabel}
    >
      {values.map((item) => (
        <View key={item} style={styles.wheelItem}>
          <Text style={[styles.wheelText, item === value && styles.wheelTextSelected]}>{item}{suffix}</Text>
        </View>
      ))}
    </ScrollView>
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
  arrow: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: colors.cardHi },
  arrowText: { color: colors.text, fontSize: 23 },
  yearArrowText: { color: colors.muted, fontSize: 17, fontWeight: "800" },
  dateHeaderButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8, borderRadius: radius.full, backgroundColor: colors.cardHi },
  dateHeaderPart: { color: colors.text, fontSize: 13, fontWeight: "800" },
  dateHeaderChevron: { color: colors.amber, fontSize: 14, fontWeight: "900", marginLeft: 1 },
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
  wheelHeader: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wheelHeaderButton: { minWidth: 52, minHeight: 44, alignItems: "center", justifyContent: "center" },
  wheelCancel: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  wheelDone: { color: colors.amber, fontSize: 14, fontWeight: "900" },
  wheelArea: { height: WHEEL_ITEM_HEIGHT * 5, flexDirection: "row", position: "relative", overflow: "hidden" },
  wheelSelection: { position: "absolute", left: 0, right: 0, top: WHEEL_ITEM_HEIGHT * 2, height: WHEEL_ITEM_HEIGHT, borderRadius: radius.md, backgroundColor: colors.amberSoft, borderWidth: 1, borderColor: colors.border },
  wheelColumn: { flex: 1, height: WHEEL_ITEM_HEIGHT * 5 },
  wheelContent: { paddingVertical: WHEEL_ITEM_HEIGHT * 2 },
  wheelItem: { height: WHEEL_ITEM_HEIGHT, alignItems: "center", justifyContent: "center" },
  wheelText: { color: colors.muted, fontSize: 16, fontWeight: "600" },
  wheelTextSelected: { color: colors.text, fontSize: 19, fontWeight: "900" },
  wheelHelp: { color: colors.faint, fontSize: 11.5, lineHeight: 17, textAlign: "center" },
});
