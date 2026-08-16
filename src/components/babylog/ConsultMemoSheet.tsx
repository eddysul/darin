import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "../../theme";
import { formatDateKey } from "../../utils/dateKey";
import { formatHHmm, parseHHmm } from "../../utils/timePicker";
import {
  DatePickerField,
  DatePickerSheet,
  TimeOfDayPickerField,
  TimePickerSheet,
} from "../inputs/TimePickerFields";

const HIT = Platform.OS === "android" ? 48 : 44;

type Props = {
  visible: boolean;
  initialText?: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (input: { notes: string; remindAt?: Date }) => void;
};

function defaultRemindAt() {
  return new Date(Date.now() + 60 * 60 * 1000);
}

export function ConsultMemoSheet({ visible, initialText = "", saving = false, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState(initialText);
  const [remind, setRemind] = useState(false);
  const [remindDate, setRemindDate] = useState(formatDateKey(defaultRemindAt(), "midnight"));
  const [remindTime, setRemindTime] = useState(formatHHmm(defaultRemindAt().getHours(), defaultRemindAt().getMinutes()));
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const next = defaultRemindAt();
    setNotes(initialText);
    setRemind(false);
    setRemindDate(formatDateKey(next, "midnight"));
    setRemindTime(formatHHmm(next.getHours(), next.getMinutes()));
    setDateOpen(false);
    setTimeOpen(false);
    setError(null);
  }, [visible, initialText]);

  const remindAt = (): Date | null => {
    const parsed = parseHHmm(remindTime);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(remindDate) || !parsed) return null;
    const [year, month, day] = remindDate.split("-").map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1, parsed.hour, parsed.minute, 0, 0);
  };

  const submit = () => {
    const trimmed = notes.trim();
    if (!trimmed) {
      setError("메모 내용을 적어 주세요.");
      return;
    }
    if (!remind) {
      onSave({ notes: trimmed });
      return;
    }
    const fireAt = remindAt();
    if (!fireAt) {
      setError("알림 날짜와 시간을 모두 선택해 주세요.");
      return;
    }
    if (fireAt.getTime() <= Date.now() + 15_000) {
      setError("알림 시간은 지금부터 조금 뒤로 잡아 주세요.");
      return;
    }
    onSave({ notes: trimmed, remindAt: fireAt });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>메모 남기기</Text>
          <Text style={styles.subtitle}>기록 탭에 저장되고, 원하면 그때 알림으로 다시 알려드려요.</Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {error ? (
              <Text nativeID="consult-memo-error" style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <Text style={styles.label}>내용</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={(value) => {
                setNotes(value);
                if (error) setError(null);
              }}
              placeholder="상담에서 기억해 두고 싶은 내용을 적어요"
              placeholderTextColor={colors.faint}
              multiline
              textAlignVertical="top"
              editable={!saving}
              accessibilityLabel="메모 내용"
            />
            {initialText.trim() && notes.trim() !== initialText.trim() ? (
              <Pressable
                style={styles.ghostBtn}
                onPress={() => setNotes(initialText)}
                accessibilityRole="button"
                accessibilityLabel="마지막 답변 넣기"
              >
                <Text style={styles.ghostText}>마지막 답변 넣기</Text>
              </Pressable>
            ) : null}

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>알림으로 리마인드</Text>
                <Text style={styles.toggleBody}>정한 시간에 이 메모를 다시 알려드려요.</Text>
              </View>
              <Switch
                value={remind}
                onValueChange={(value) => {
                  setRemind(value);
                  if (error) setError(null);
                }}
                disabled={saving}
                trackColor={{ false: colors.border, true: colors.amber }}
                accessibilityLabel="알림으로 리마인드"
              />
            </View>

            {remind ? (
              <>
                <DatePickerField label="알림 날짜" valueDateKey={remindDate} onPress={() => setDateOpen(true)} />
                <TimeOfDayPickerField label="알림 시간" valueHHmm={remindTime} onPress={() => setTimeOpen(true)} />
              </>
            ) : null}
          </ScrollView>

          <Pressable
            style={[styles.primaryBtn, saving && styles.disabled]}
            onPress={submit}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={remind ? "메모 저장하고 알림 맞추기" : "메모 저장"}
          >
            <Text style={styles.primaryText}>{saving ? "저장 중…" : remind ? "저장하고 알림 맞추기" : "메모 저장"}</Text>
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="취소">
            <Text style={styles.closeText}>취소</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <DatePickerSheet
        visible={dateOpen}
        valueDateKey={remindDate}
        title="알림 날짜"
        onCancel={() => setDateOpen(false)}
        onConfirm={(value) => {
          setRemindDate(value);
          setDateOpen(false);
        }}
      />
      <TimePickerSheet
        visible={timeOpen}
        valueHHmm={remindTime}
        title="알림 시간"
        onCancel={() => setTimeOpen(false)}
        onConfirm={(value) => {
          setRemindTime(value);
          setTimeOpen(false);
        }}
      />
      </>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: "88%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginVertical: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 12 },
  body: { paddingBottom: 8 },
  label: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 8 },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  ghostBtn: {
    alignSelf: "flex-start",
    minHeight: HIT,
    justifyContent: "center",
    marginTop: 4,
  },
  ghostText: { fontSize: 13, fontWeight: "700", color: colors.amberText },
  toggleRow: {
    minHeight: 58,
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleCopy: { flex: 1 },
  toggleTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  toggleBody: { marginTop: 3, fontSize: 12, lineHeight: 17, color: colors.muted },
  error: { marginBottom: 10, fontSize: 13, lineHeight: 19, fontWeight: "700", color: colors.dangerText },
  primaryBtn: {
    minHeight: HIT,
    marginTop: 12,
    backgroundColor: colors.amber,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colors.amberDark, fontWeight: "800", fontSize: 14.5 },
  disabled: { opacity: 0.55 },
  closeBtn: { minHeight: HIT, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 14, fontWeight: "700", color: colors.muted },
});
