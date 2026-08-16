import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "./BabyLogIcon";
import { SharedCaregiversRow } from "./SharedCaregiversRow";
import { useBabyLog } from "../../context/BabyLogContext";
import { colors, fontScaleCap, radius } from "../../theme";
import { BabySwitcher } from "./BabySwitcher";
import { NotificationBellButton } from "../NotificationBellButton";

type Props = {
  onOpenProfile: () => void;
  onOpenSettings?: () => void;
  onOpenShared?: () => void;
  onOpenNotifications?: () => void;
};

export function AppHeader({ onOpenProfile, onOpenSettings, onOpenShared, onOpenNotifications }: Props) {
  const insets = useSafeAreaInsets();
  const { babyName, babyBadge } = useBabyLog();

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.chip}>
            <BabySwitcher compact />
            <View style={styles.badge}>
              <Text style={styles.badgeText} maxFontSizeMultiplier={fontScaleCap.chrome}>{babyBadge}</Text>
            </View>
          </View>
          <View style={styles.sharedWrap}>
            <SharedCaregiversRow onPress={onOpenShared ?? onOpenProfile} />
          </View>
        </View>
        <View style={styles.actions}>
          {onOpenNotifications ? <NotificationBellButton onPress={onOpenNotifications} /> : null}
          <Pressable
          style={styles.profileBtn}
          onPress={onOpenSettings ?? onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel={onOpenSettings ? "설정 열기" : "아기 프로필 및 가족 관리"}
        >
          <BabyLogIcon kind={onOpenSettings ? "settings" : "profile"} size={18} color={colors.muted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  left: { flex: 1 },
  chip: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  chipText: { color: colors.amberText, fontWeight: "700", fontSize: 15 },
  badge: {
    backgroundColor: colors.amberSoft,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: colors.amberText, fontSize: 12, fontWeight: "600" },
  sharedWrap: { marginTop: 8 },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
});
