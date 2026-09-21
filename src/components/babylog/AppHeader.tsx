import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "./BabyLogIcon";
import { SharedCaregiversRow } from "./SharedCaregiversRow";
import { useBabyLog } from "../../context/BabyLogContext";
import { useCompactLayout } from "../../hooks/useCompactLayout";
import { colors, fontScaleCap, radius } from "../../theme";
import { BabySwitcher } from "./BabySwitcher";
import { NotificationBellButton } from "../NotificationBellButton";
import { useLanguage } from "../../LanguageContext";

type Props = {
  onOpenProfile: () => void;
  onOpenSettings?: () => void;
  onOpenShared?: () => void;
  onOpenNotifications?: () => void;
};

export function AppHeader({ onOpenProfile, onOpenSettings, onOpenShared, onOpenNotifications }: Props) {
  const insets = useSafeAreaInsets();
  const compact = useCompactLayout();
  const { babyBadge, babyName } = useBabyLog();
  const { t } = useLanguage();

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, compact ? 8 : 12) }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={[styles.chip, compact && styles.chipCompact]}>
            <Text style={styles.babyName} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>{babyName}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText} maxFontSizeMultiplier={fontScaleCap.chrome}>{babyBadge}</Text>
            </View>
          </View>
          <View style={styles.together}>
            <BabySwitcher variant="togetherChip" />
          </View>
          <SharedCaregiversRow onPress={onOpenShared ?? onOpenProfile} size="lg" label={t("chrome.critical.122")} />
        </View>
        <View style={styles.actions}>
          {onOpenNotifications ? <NotificationBellButton onPress={onOpenNotifications} /> : null}
          <Pressable
            style={styles.menuBtn}
            onPress={onOpenSettings ?? onOpenProfile}
            accessibilityRole="button"
            accessibilityLabel={onOpenSettings ? t("home.a11y.openSettings") : t("chrome.critical.025")}
          >
            <BabyLogIcon kind={onOpenSettings ? "menu" : "profile"} size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  left: { flex: 1, minWidth: 0 },
  chip: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  chipCompact: { flexDirection: "column", alignItems: "flex-start", gap: 6 },
  babyName: { maxWidth: 180, color: colors.text, fontSize: 18, fontWeight: "800" },
  together: { marginTop: 6, alignSelf: "flex-start" },
  badge: {
    backgroundColor: colors.amberSoft,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: colors.amberText, fontSize: 12, fontWeight: "600" },
  menuBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
});
