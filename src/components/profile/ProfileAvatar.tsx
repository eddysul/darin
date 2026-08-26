import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { colors } from "../../theme";
import { useLanguage } from "../../LanguageContext";

export function ProfileAvatar({
  uri,
  size = 88,
  fallback = "profile",
  editable = false,
  onPress,
  label,
  imageFit = "cover",
}: {
  uri?: string | null;
  size?: number;
  fallback?: "profile" | "baby";
  editable?: boolean;
  onPress?: () => void;
  label?: string;
  imageFit?: "cover" | "contain";
}) {
  const { t } = useLanguage();
  const addLabel = t("chrome.critical.031");
  const changeLabel = t("chrome.critical.032");
  const resolvedLabel = label ?? addLabel;
  const content = (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit={imageFit} contentPosition="center" transition={120} />
      ) : (
        <BabyLogIcon kind={fallback} size={Math.round(size * 0.42)} color={colors.amberText} />
      )}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={resolvedLabel} style={styles.press}>
      {content}
      {editable ? <Text style={styles.caption}>{uri ? changeLabel : addLabel}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { alignItems: "center", gap: 8 },
  wrap: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  caption: { color: colors.amberText, fontSize: 12.5, fontWeight: "700" },
});
