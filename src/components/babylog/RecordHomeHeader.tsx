import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "./BabyLogIcon";
import { useBabyLog } from "../../context/BabyLogContext";
import { colors } from "../../theme";

type Props = {
  onOpenProfile: () => void;
};

export function RecordHomeHeader({ onOpenProfile }: Props) {
  const insets = useSafeAreaInsets();
  const { babyName, babyBirthMeta } = useBabyLog();

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.row}>
        <View style={styles.avatarCircle}>
          <BabyLogIcon kind="baby" size={26} color={colors.amber} />
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{babyName}</Text>
          <Text style={styles.age}>{babyBirthMeta}</Text>
          <Pressable style={styles.sharedRow} onPress={onOpenProfile}>
            <View style={styles.avatarStack}>
              {[colors.amber, "#7c83fd", "#5CB87A"].map((tone, i) => (
                <View key={tone} style={[styles.miniAvatar, i > 0 && styles.miniOverlap]}>
                  <BabyLogIcon kind="profile" size={10} color={tone} strokeWidth={2.2} />
                </View>
              ))}
            </View>
            <Text style={styles.sharedText}>엄마 · 아빠 · 시터와 공유 중</Text>
          </Pressable>
        </View>

        <Pressable style={styles.profileBtn} onPress={onOpenProfile}>
          <BabyLogIcon kind="profile" size={18} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 16 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, paddingTop: 2 },
  name: { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  age: { fontSize: 13, color: colors.muted, marginTop: 2, fontWeight: "500" },
  sharedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  avatarStack: { flexDirection: "row" },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.cardHi,
    borderWidth: 1.5,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  miniOverlap: { marginLeft: -6 },
  sharedText: { fontSize: 11, color: colors.faint, fontWeight: "600" },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
