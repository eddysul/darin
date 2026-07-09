import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBabyLog } from "../../context/BabyLogContext";
import { colors, radius } from "../../theme";

type Props = {
  onOpenProfile: () => void;
  onOpenShared?: () => void;
};

export function AppHeader({ onOpenProfile, onOpenShared }: Props) {
  const insets = useSafeAreaInsets();
  const { babyName, babyEmoji, babyBadge } = useBabyLog();

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {babyEmoji} {babyName}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{babyBadge}</Text>
            </View>
          </View>
          <Pressable style={styles.sharedRow} onPress={onOpenShared ?? onOpenProfile}>
            <View style={styles.avatarStack}>
              {["👩", "👨", "🧑‍🍼"].map((emoji, i) => (
                <View key={emoji} style={[styles.avatar, i > 0 && styles.avatarOverlap]}>
                  <Text style={styles.avatarEmoji}>{emoji}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.sharedText}>엄마·아빠·시터와 공유 중</Text>
          </Pressable>
        </View>
        <Pressable style={styles.profileBtn} onPress={onOpenProfile}>
          <Text style={styles.profileEmoji}>👶</Text>
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
  sharedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  avatarStack: { flexDirection: "row" },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.cardHi,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOverlap: { marginLeft: -7 },
  avatarEmoji: { fontSize: 10 },
  sharedText: { fontSize: 11.5, color: colors.faint, fontWeight: "600" },
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
  profileEmoji: { fontSize: 15 },
});
