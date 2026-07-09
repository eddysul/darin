import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "./BabyLogIcon";
import { SharedCaregiversRow } from "./SharedCaregiversRow";
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
          <View style={styles.sharedWrap}>
            <SharedCaregiversRow onPress={onOpenProfile} size="sm" />
          </View>
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
  sharedWrap: { marginTop: 8 },
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
