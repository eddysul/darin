import { Platform, StyleSheet, Text, View } from "react-native";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { useLanguage } from "../../LanguageContext";
import { colors, fontScaleCap, radius } from "../../theme";

export function ProfileQuoteCard() {
  const { t } = useLanguage();

  return (
    <View style={styles.card}>
      <View style={styles.heart}>
        <BabyLogIcon kind="heart" size={16} color={colors.brandCoral} fill={colors.brandCoral} strokeWidth={1.8} />
      </View>
      <Text style={styles.copy} maxFontSizeMultiplier={fontScaleCap.chrome}>
        {t("memory.critical.234")}
      </Text>
      <Text style={styles.brand} maxFontSizeMultiplier={fontScaleCap.chrome}>
        {t("memory.critical.235")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heart: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  brand: {
    flexShrink: 0,
    color: colors.accentStrong,
    fontSize: 15,
    fontFamily: Platform.OS === "ios" ? "Snell Roundhand" : undefined,
    fontStyle: Platform.OS === "ios" ? "normal" : "italic",
    fontWeight: "600",
  },
});
