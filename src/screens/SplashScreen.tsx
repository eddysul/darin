import { useEffect } from "react";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { ScreenBackground } from "../components/ScreenBackground";
import { colors } from "../theme";

type SplashScreenProps = {
  onComplete: () => void;
};

export function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <ScreenBackground style={styles.root}>
      <View style={styles.center}>
        <Image source={require("../../assets/darin-logo.png")} style={styles.logo} contentFit="contain" />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  logo: { width: "100%", maxWidth: 280, height: 220 },
});
