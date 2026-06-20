import { Image } from "expo-image";
import { StyleSheet, View, type ViewStyle } from "react-native";

type AvatarProps = {
  src: string;
  size?: number;
  style?: ViewStyle;
};

export function Avatar({ src, size = 40, style }: AvatarProps) {
  const uri = src.startsWith("http") || src.startsWith("file:")
    ? src
    : `https://images.unsplash.com/${src}?w=${size * 2}&h=${size * 2}&fit=crop&auto=format`;

  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }, style]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
    </View>
  );
}
