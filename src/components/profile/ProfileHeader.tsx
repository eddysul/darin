import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { useLanguage } from "../../LanguageContext";
import { colors, fontScaleCap } from "../../theme";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

type Props = {
  title: string;
  onBack?: () => void;
  onMore?: () => void;
};

export function ProfileHeader({ title, onBack, onMore }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
      <Pressable
        style={styles.side}
        onPress={onBack}
        disabled={!onBack}
        accessibilityRole="button"
        accessibilityLabel={t("chrome.critical.023")}
        hitSlop={10}
      >
        {onBack ? <ChevronLeft size={27} color={colors.text} strokeWidth={2.2} /> : null}
      </Pressable>
      <Text
        style={styles.title}
        numberOfLines={1}
        maxFontSizeMultiplier={fontScaleCap.chrome}
      >
        {title}
      </Text>
      <Pressable
        style={styles.side}
        onPress={onMore}
        disabled={!onMore}
        accessibilityRole="button"
        accessibilityLabel={t("memory.critical.236")}
        hitSlop={10}
      >
        {onMore ? <BabyLogIcon kind="more" size={22} color={colors.text} strokeWidth={2} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 52,
    paddingHorizontal: 4,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.background,
  },
  side: {
    width: 48,
    minHeight: TOUCH_MIN,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    minHeight: TOUCH_MIN,
    textAlign: "center",
    textAlignVertical: "center",
    paddingTop: 10,
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
});
