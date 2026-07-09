import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "./BabyLogIcon";
import { SharedCaregiversRow } from "./SharedCaregiversRow";
import { useBabyLog } from "../../context/BabyLogContext";
import { colors, radius } from "../../theme";

type Props = {
  onOpenProfile: () => void;
  onOpenShared?: () => void;
};

export function AppHeader({ onOpenProfile, onOpenShared }: Props) {
  const insets = useSafeAreaInsets();
  const { babyName, babyBadge } = useBabyLog();

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.chip}>
            <BabyLogIcon kind="baby" size={16} color={colors.amber} />
            <Text style={styles.chipText}>{babyName}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{babyBadge}</Text>
            </View>
          </View>
          <View style={styles.sharedWrap}>
            <SharedCaregiversRow onPress={onOpenShared ?? onOpenProfile} />
          </View>
        </View>
        <Pressable style={styles.profileBtn} onPress={onOpenProfile}>
          <BabyLogIcon kind="profile" size={16} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  left: { flex: 1 },
  chip: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  chipText: { color: colors.amber, fontWeight: "700", fontSize: 15 },
  badge: {
    backgroundColor: colors.amberSoft,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: colors.amber, fontSize: 12, fontWeight: "600" },
  sharedWrap: { marginTop: 8 },
  profileBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
});
