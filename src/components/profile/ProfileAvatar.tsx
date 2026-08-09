import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { colors } from "../../theme";

export function ProfileAvatar({
  uri,
  size = 88,
  fallback = "profile",
  editable = false,
  onPress,
  label = "사진 추가",
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
  const content = (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit={imageFit} contentPosition="center" transition={120} />
      ) : (
        <BabyLogIcon kind={fallback} size={Math.round(size * 0.42)} color={colors.amber} />
      )}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.press}>
      {content}
      {editable ? <Text style={styles.caption}>{uri ? "사진 변경" : "사진 추가"}</Text> : null}
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
  caption: { color: colors.amber, fontSize: 12.5, fontWeight: "700" },
});
