import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "../../theme";

type Props = {
  visible: boolean;
  todayLogCount: number;
  onClose: () => void;
  onSelectQuestion: (question: string) => void;
};

const EMPTY_QUESTIONS = [
  "어떤 기록부터 남기면 좋을까?",
  "수유 기록은 어떻게 남기면 좋을까?",
  "수면 기록은 어떻게 보면 좋을까?",
];

const ACTIVE_QUESTIONS = [
  "오늘 기록 요약해줘",
  "수유 간격 봐줘",
  "수면 패턴 봐줘",
  "최근 7일 변화 알려줘",
];

export function ConsultPromptSheet({
  visible,
  todayLogCount,
  onClose,
  onSelectQuestion,
}: Props) {
  const insets = useSafeAreaInsets();
  const questions = todayLogCount === 0 ? EMPTY_QUESTIONS : ACTIVE_QUESTIONS;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>무엇을 도와드릴까요?</Text>
          <Text style={styles.subtitle}>
            {todayLogCount === 0
              ? "오늘 기록이 아직 없어요. 이렇게 시작해 볼까요?"
              : `오늘 기록 ${todayLogCount}개를 바탕으로 물어볼 수 있어요.`}
          </Text>
          <View style={styles.list}>
            {questions.map((q) => (
              <Pressable
                key={q}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => onSelectQuestion(q)}
              >
                <Text style={styles.rowText}>{q}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
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
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
    marginBottom: 14,
  },
  list: { gap: 8 },
  row: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowPressed: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  rowText: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  closeBtn: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 12,
  },
  closeText: { fontSize: 14, fontWeight: "700", color: colors.muted },
});
