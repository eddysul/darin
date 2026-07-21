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
  const { babyName, babyBadge, babyBirthMeta, careSetup } = useBabyLog();
  const dDay = babyBadge.match(/D\+\d+/)?.[0];
  const birthWeight = careSetup.child.birthWeight?.trim();

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.row}>
        <View style={styles.avatarCircle}>
          <BabyLogIcon kind="baby" size={26} color={colors.amber} />
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{babyName}</Text>
            {dDay ? <Text style={styles.dayBadge}>{dDay}</Text> : null}
          </View>
          <Text style={styles.age}>{babyBirthMeta}{birthWeight ? ` · ${birthWeight}kg` : ""}</Text>
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
  wrap: { paddingHorizontal: 20, paddingBottom: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4A3428",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 21, fontWeight: "800", color: colors.text, letterSpacing: -0.35 },
  dayBadge: { color: colors.amber, backgroundColor: colors.amberSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: "800", overflow: "hidden" },
  age: { fontSize: 13, color: colors.muted, marginTop: 2, fontWeight: "500" },
  sharedWrap: { marginTop: 8 },
  profileBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
