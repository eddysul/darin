import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "../../theme";
import { formatDurationMinutes, formatHHmm, formatTimeOfDay, parseHHmm } from "../../utils/timePicker";
import { formatDateKey, parseDateKey } from "../../utils/dateKey";

export { formatDurationMinutes, formatHHmm, formatTimeOfDay, parseHHmm } from "../../utils/timePicker";

const ITEM_HEIGHT = 44;
const HOURS_12 = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const PERIODS = ["오전", "오후"];

export function TimeOfDayPickerField({ label, valueHHmm, placeholder = "시간 선택", onPress, disabled = false, error }: { label: string; valueHHmm?: string | null; placeholder?: string; onPress: () => void; disabled?: boolean; error?: string }) {
  const hasValue = Boolean(parseHHmm(valueHHmm));
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={[styles.field, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label} ${hasValue ? formatTimeOfDay(valueHHmm) : placeholder}`}>
        <Text style={[styles.fieldValue, !hasValue && styles.placeholder]}>{formatTimeOfDay(valueHHmm, placeholder)}</Text>
        <Text style={styles.fieldArrow}>›</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function DurationPickerField({ label, valueMinutes, placeholder = "기간 선택", onPress, disabled = false, error }: { label: string; valueMinutes?: number | null; placeholder?: string; onPress: () => void; disabled?: boolean; error?: string }) {
  const hasValue = valueMinutes != null && Number.isFinite(valueMinutes) && valueMinutes > 0;
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={[styles.field, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label} ${formatDurationMinutes(valueMinutes, placeholder)}`}>
        <Text style={[styles.fieldValue, !hasValue && styles.placeholder]}>{formatDurationMinutes(valueMinutes, placeholder)}</Text>
        <Text style={styles.fieldArrow}>›</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function DatePickerField({ label, valueDateKey, placeholder = "날짜 선택", onPress, disabled = false }: { label: string; valueDateKey?: string | null; placeholder?: string; onPress: () => void; disabled?: boolean }) {
  const hasValue = /^\d{4}-\d{2}-\d{2}$/.test(valueDateKey ?? "");
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={[styles.field, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="button">
        <Text style={[styles.fieldValue, !hasValue && styles.placeholder]}>{hasValue ? valueDateKey : placeholder}</Text>
        <Text style={styles.fieldArrow}>›</Text>
      </Pressable>
    </View>
  );
}

export function VolumePickerField({ label, value, unit = "ml", placeholder = "양 선택", onPress, disabled = false, error }: { label: string; value?: string | null; unit?: string; placeholder?: string; onPress: () => void; disabled?: boolean; error?: string }) {
  const numeric = Number.parseFloat(value ?? "");
  const hasValue = Number.isFinite(numeric) && numeric >= 0;
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={[styles.field, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label} ${hasValue ? `${value}${unit}` : placeholder}`}>
        <Text style={[styles.fieldValue, !hasValue && styles.placeholder]}>{hasValue ? `${value}${unit}` : placeholder}</Text>
        <Text style={styles.fieldArrow}>›</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function TimePickerSheet({ visible, valueHHmm, title = "시간 선택", onCancel, onConfirm, onClear }: { visible: boolean; valueHHmm?: string | null; title?: string; onCancel: () => void; onConfirm: (valueHHmm: string) => void; onClear?: () => void }) {
  const insets = useSafeAreaInsets();
  const [periodIndex, setPeriodIndex] = useState(0);
  const [hour12, setHour12] = useState(12);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const parsed = parseHHmm(valueHHmm) ?? { hour: 12, minute: 0 };
    setPeriodIndex(parsed.hour < 12 ? 0 : 1);
    setHour12(parsed.hour % 12 || 12);
    setMinute(parsed.minute);
  }, [valueHHmm, visible]);

  if (!visible) return null;
  const confirm = () => {
    const hour24 = periodIndex === 0 ? hour12 % 12 : (hour12 % 12) + 12;
    onConfirm(formatHHmm(hour24, minute));
  };
  return (
    <PickerOverlay title={title} onCancel={onCancel} onConfirm={confirm} bottomInset={insets.bottom} help="선택한 시각을 24시간 형식으로 안전하게 저장해요." onClear={onClear}>
      <View style={styles.wheelArea}>
        <View pointerEvents="none" style={styles.selection} />
        <WheelColumn options={PERIODS} selectedIndex={periodIndex} onSelect={setPeriodIndex} label="오전 오후" />
        <WheelColumn options={HOURS_12} selectedIndex={hour12 - 1} onSelect={(index) => setHour12(index + 1)} label="시" />
        <WheelColumn options={MINUTES} selectedIndex={minute} onSelect={setMinute} label="분" />
      </View>
      <View style={styles.wheelLabels}><Text style={styles.wheelLabel}>오전/오후</Text><Text style={styles.wheelLabel}>시</Text><Text style={styles.wheelLabel}>분</Text></View>
    </PickerOverlay>
  );
}

export function DurationPickerSheet({ visible, valueMinutes, title = "기간 선택", minMinutes = 1, maxMinutes = 24 * 60 - 1, onCancel, onConfirm, onClear }: { visible: boolean; valueMinutes?: number | null; title?: string; minMinutes?: number; maxMinutes?: number; onCancel: () => void; onConfirm: (valueMinutes: number) => void; onClear?: () => void }) {
  const insets = useSafeAreaInsets();
  const maxHours = Math.floor(maxMinutes / 60);
  const hours = Array.from({ length: maxHours + 1 }, (_, index) => String(index));
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(15);

  useEffect(() => {
    if (!visible) return;
    const total = Math.max(minMinutes, Math.min(maxMinutes, Math.round(valueMinutes ?? 15)));
    setHour(Math.floor(total / 60));
    setMinute(total % 60);
  }, [maxMinutes, minMinutes, valueMinutes, visible]);

  if (!visible) return null;
  const confirm = () => onConfirm(Math.max(minMinutes, Math.min(maxMinutes, hour * 60 + minute)));
  return (
    <PickerOverlay title={title} onCancel={onCancel} onConfirm={confirm} bottomInset={insets.bottom} help="선택한 기간은 총 분 단위로 저장해요." onClear={onClear}>
      <View style={styles.wheelArea}>
        <View pointerEvents="none" style={styles.selection} />
        <WheelColumn options={hours} selectedIndex={hour} onSelect={setHour} label="시간" />
        <WheelColumn options={MINUTES} selectedIndex={minute} onSelect={setMinute} label="분" />
      </View>
      <View style={styles.wheelLabels}><Text style={styles.wheelLabel}>시간</Text><Text style={styles.wheelLabel}>분</Text></View>
    </PickerOverlay>
  );
}

export function DatePickerSheet({ visible, valueDateKey, title = "날짜 선택", minYear = 1900, maxYear = new Date().getFullYear() + 10, onCancel, onConfirm, onClear }: { visible: boolean; valueDateKey?: string | null; title?: string; minYear?: number; maxYear?: number; onCancel: () => void; onConfirm: (valueDateKey: string) => void; onClear?: () => void }) {
  const insets = useSafeAreaInsets();
  const fallback = new Date();
  const initial = /^\d{4}-\d{2}-\d{2}$/.test(valueDateKey ?? "") ? parseDateKey(valueDateKey!) : fallback;
  const years = Array.from({ length: Math.max(1, maxYear - minYear + 1) }, (_, index) => String(minYear + index));
  const months = Array.from({ length: 12 }, (_, index) => String(index + 1));
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth() + 1);
  const [day, setDay] = useState(initial.getDate());
  const maxDay = new Date(year, month, 0).getDate();
  const days = Array.from({ length: maxDay }, (_, index) => String(index + 1));

  useEffect(() => {
    if (!visible) return;
    const next = /^\d{4}-\d{2}-\d{2}$/.test(valueDateKey ?? "") ? parseDateKey(valueDateKey!) : new Date();
    setYear(Math.max(minYear, Math.min(maxYear, next.getFullYear())));
    setMonth(next.getMonth() + 1);
    setDay(next.getDate());
  }, [maxYear, minYear, valueDateKey, visible]);

  useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [day, maxDay]);

  if (!visible) return null;
  return (
    <PickerOverlay
      title={title}
      onCancel={onCancel}
      onConfirm={() => onConfirm(formatDateKey(new Date(year, month - 1, Math.min(day, maxDay)), "midnight"))}
      bottomInset={insets.bottom}
      help="년·월·일을 위아래로 스크롤해서 선택해 주세요."
      onClear={onClear}
    >
      <View style={styles.wheelArea}>
        <View pointerEvents="none" style={styles.selection} />
        <WheelColumn options={years} selectedIndex={Math.max(0, year - minYear)} onSelect={(index) => setYear(minYear + index)} label="년" />
        <WheelColumn options={months} selectedIndex={month - 1} onSelect={(index) => setMonth(index + 1)} label="월" />
        <WheelColumn options={days} selectedIndex={Math.min(day, maxDay) - 1} onSelect={(index) => setDay(index + 1)} label="일" />
      </View>
      <View style={styles.wheelLabels}><Text style={styles.wheelLabel}>년</Text><Text style={styles.wheelLabel}>월</Text><Text style={styles.wheelLabel}>일</Text></View>
    </PickerOverlay>
  );
}

export function VolumePickerSheet({ visible, value, title = "양 선택", unit = "ml", max = 500, step = 5, allowZero = false, onCancel, onConfirm, onClear }: { visible: boolean; value?: string | null; title?: string; unit?: string; max?: number; step?: number; allowZero?: boolean; onCancel: () => void; onConfirm: (value: string) => void; onClear?: () => void }) {
  const insets = useSafeAreaInsets();
  const minimum = allowZero ? 0 : step;
  const options = Array.from({ length: Math.floor((max - minimum) / step) + 1 }, (_, index) => `${minimum + index * step}`);
  const initial = Math.max(minimum, Math.min(max, Math.round((Number.parseFloat(value ?? "") || minimum) / step) * step));
  const [selectedIndex, setSelectedIndex] = useState(0);
  useEffect(() => {
    if (!visible) return;
    setSelectedIndex(Math.max(0, options.indexOf(String(initial))));
  }, [initial, visible]);
  if (!visible) return null;
  return (
    <PickerOverlay title={title} onCancel={onCancel} onConfirm={() => onConfirm(options[selectedIndex] ?? String(minimum))} bottomInset={insets.bottom} help={`선택한 양은 ${unit} 단위로 저장해요.`} onClear={onClear}>
      <View style={styles.singleWheelArea}>
        <View pointerEvents="none" style={styles.selection} />
        <WheelColumn options={options} selectedIndex={selectedIndex} onSelect={setSelectedIndex} label={unit} />
      </View>
      <Text style={styles.singleWheelLabel}>{unit}</Text>
    </PickerOverlay>
  );
}

function PickerOverlay({ title, onCancel, onConfirm, onClear, bottomInset, help, children }: { title: string; onCancel: () => void; onConfirm: () => void; onClear?: () => void; bottomInset: number; help: string; children: React.ReactNode }) {
  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="선택 취소" />
      <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 12) }]}>
        <View style={styles.header}>
          <Pressable style={styles.action} onPress={onCancel}><Text style={styles.cancel}>취소</Text></Pressable>
          <Text style={styles.title}>{title}</Text>
          <Pressable style={styles.action} onPress={onConfirm}><Text style={styles.done}>완료</Text></Pressable>
        </View>
        {children}
        <Text style={styles.help}>{help}</Text>
        {onClear ? <Pressable style={styles.clearButton} onPress={onClear}><Text style={styles.clearText}>선택 지우기</Text></Pressable> : null}
      </View>
    </View>
  );
}

function WheelColumn({ options, selectedIndex, onSelect, label }: { options: string[]; selectedIndex: number; onSelect: (index: number) => void; label: string }) {
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
  }, [selectedIndex]);
  const selectOffset = (offsetY: number) => onSelect(Math.max(0, Math.min(options.length - 1, Math.round(offsetY / ITEM_HEIGHT))));
  return (
    <ScrollView
      ref={scrollRef}
      style={styles.wheelColumn}
      contentContainerStyle={styles.wheelContent}
      contentOffset={{ x: 0, y: selectedIndex * ITEM_HEIGHT }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      nestedScrollEnabled
      accessibilityLabel={label}
      onMomentumScrollEnd={(event) => selectOffset(event.nativeEvent.contentOffset.y)}
      onScrollEndDrag={(event) => selectOffset(event.nativeEvent.contentOffset.y)}
    >
      {options.map((option, index) => <View key={option} style={styles.wheelItem}><Text style={[styles.wheelText, index === selectedIndex && styles.wheelTextSelected]}>{option}</Text></View>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fieldBlock: { gap: 7, marginTop: 14 },
  fieldLabel: { color: colors.faint, fontSize: 12, fontWeight: "700" },
  field: { minHeight: 46, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 12 },
  fieldValue: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
  placeholder: { color: colors.faint, fontWeight: "500" },
  fieldArrow: { color: colors.faint, fontSize: 22 },
  disabled: { opacity: 0.5 },
  error: { color: colors.dangerText, fontSize: 11.5, lineHeight: 17 },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(22,18,16,0.38)" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.card, overflow: "hidden" },
  header: { minHeight: 52, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  action: { width: 64, minHeight: 44, alignItems: "center", justifyContent: "center" },
  cancel: { color: colors.muted, fontSize: 15, fontWeight: "700" },
  done: { color: colors.amberText, fontSize: 15, fontWeight: "800" },
  title: { flex: 1, textAlign: "center", color: colors.text, fontSize: 16, fontWeight: "800" },
  wheelArea: { height: ITEM_HEIGHT * 5, marginHorizontal: 18, flexDirection: "row" },
  selection: { position: "absolute", left: 0, right: 0, top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT, borderRadius: 10, backgroundColor: colors.backgroundSecondary, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  wheelColumn: { flex: 1, height: ITEM_HEIGHT * 5 },
  wheelContent: { paddingVertical: ITEM_HEIGHT * 2 },
  wheelItem: { height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center" },
  wheelText: { color: colors.muted, fontSize: 18, fontWeight: "600" },
  wheelTextSelected: { color: colors.text, fontSize: 21, fontWeight: "800" },
  wheelLabels: { marginHorizontal: 18, flexDirection: "row" },
  wheelLabel: { flex: 1, textAlign: "center", color: colors.faint, fontSize: 10.5, fontWeight: "700" },
  singleWheelArea: { alignSelf: "center", width: 180, height: ITEM_HEIGHT * 5 },
  singleWheelLabel: { textAlign: "center", color: colors.faint, fontSize: 11, fontWeight: "700" },
  help: { marginTop: 12, paddingHorizontal: 20, textAlign: "center", color: colors.muted, fontSize: 12, lineHeight: 18 },
  clearButton: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  clearText: { color: colors.faint, fontSize: 12.5, fontWeight: "700" },
});
