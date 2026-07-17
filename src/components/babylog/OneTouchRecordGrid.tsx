import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BabyLogCategoryId } from "../../constants/babyLogCategories";
import { getCategory } from "../../constants/babyLogCategories";
import { colors, radius } from "../../theme";
import { BabyLogIcon } from "./BabyLogIcon";

export type OneTouchAction =
  | "feeding"
  | "sleep"
  | "diaper"
  | "bowel"
  | "food"
  | "med"
  | "temp"
  | "memo";

type Props = {
  sleepActive: boolean;
  disabled?: boolean;
  onSelect: (action: OneTouchAction) => void;
};

const ACTIONS: {
  id: OneTouchAction;
  label: string;
  cat: BabyLogCategoryId;
  hint?: string;
}[] = [
  { id: "feeding", label: "수유", cat: "formula" },
  { id: "sleep", label: "수면", cat: "sleep" },
  { id: "diaper", label: "기저귀", cat: "diaper", hint: "소변" },
  { id: "bowel", label: "배변", cat: "diaper", hint: "대변" },
  { id: "food", label: "이유식·식사", cat: "food" },
  { id: "med", label: "약", cat: "med" },
  { id: "temp", label: "체온", cat: "temp" },
  { id: "memo", label: "메모", cat: "memo" },
];

export function OneTouchRecordGrid({ sleepActive, disabled, onSelect }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.title}>빠른 기록</Text>
          <Text style={styles.subtitle}>한 번 누르면 지금 시간으로 바로 기록돼요</Text>
        </View>
        <View style={styles.nowBadge}>
          <Text style={styles.nowBadgeText}>원터치</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {ACTIONS.map((action) => {
          const category = getCategory(action.cat);
          const activeSleep = action.id === "sleep" && sleepActive;
          return (
            <Pressable
              key={action.id}
              disabled={disabled}
              style={({ pressed }) => [
                styles.button,
                activeSleep && styles.sleepButton,
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
              ]}
              onPress={() => onSelect(action.id)}
              accessibilityLabel={`${activeSleep ? "수면 종료" : action.label} 기록`}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: `${category.color}20` },
                  activeSleep && styles.sleepIconWrap,
                ]}
              >
                <BabyLogIcon catId={action.cat} size={22} color={category.color} strokeWidth={2} />
              </View>
              <Text style={[styles.label, activeSleep && styles.sleepLabel]}>
                {activeSleep ? "수면 종료" : action.label}
              </Text>
              <Text style={styles.hint}>
                {activeSleep ? "눌러서 시간 계산" : action.hint ?? "지금 기록"}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  subtitle: { marginTop: 3, fontSize: 12, color: colors.faint },
  nowBadge: {
    borderRadius: 999,
    backgroundColor: colors.amberSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  nowBadgeText: { color: colors.amberDark, fontSize: 11, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  button: {
    width: "22.5%",
    minHeight: 106,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.8 },
  disabled: { opacity: 0.45 },
  sleepButton: { borderColor: "#7C83FD", backgroundColor: "rgba(124,131,253,0.08)" },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  sleepIconWrap: { borderWidth: 1, borderColor: "rgba(124,131,253,0.35)" },
  label: { fontSize: 12.5, fontWeight: "800", color: colors.text, textAlign: "center" },
  sleepLabel: { color: "#6269D9" },
  hint: { marginTop: 3, fontSize: 9.5, color: colors.faint, textAlign: "center" },
});
