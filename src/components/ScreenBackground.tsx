import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, type ViewProps } from "react-native";
import { gradients } from "../theme";

export function ScreenBackground({ children, style, ...props }: ViewProps) {
  return (
    <LinearGradient colors={[...gradients.screen]} style={[styles.root, style]} {...props}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
