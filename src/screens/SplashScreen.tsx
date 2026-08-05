import { useEffect } from "react";
import { Image } from "expo-image";
import { Dimensions, StyleSheet, View } from "react-native";

/** Matches `assets/darin-logo.png` / native splash imageset (1024×768). */
const LOGO_ASPECT_RATIO = 1024 / 768;

type SplashScreenProps = {
  onComplete: () => void;
};

export function SplashScreen({ onComplete }: SplashScreenProps) {
  // Native Expo splash pins the image view edge-to-edge with aspect-fit (contain).
  const screenWidth = Dimensions.get("window").width;
  const logoWidth = Math.min(screenWidth, 430);
  const logoHeight = logoWidth / LOGO_ASPECT_RATIO;

  useEffect(() => {
    const timer = setTimeout(onComplete, 2600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Image
          source={require("../../assets/darin-logo.png")}
          style={{ width: logoWidth, height: logoHeight }}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
    // Match app.json splash.backgroundColor / iOS SplashScreenBackground
    backgroundColor: "#FFFFFF",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    // Nudge slightly below true center to match native splash feel
    paddingTop: 28,
  },
});
