import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from "react-native";
import { ErrorState } from "../components/states/FeedbackStates";
import { useLanguage } from "../LanguageContext";
import { colors } from "../theme";

/** Matches `assets/darin-logo.png` / native splash imageset (1024×768). */
const LOGO_ASPECT_RATIO = 1024 / 768;

type SplashScreenProps = {
  onComplete: () => void;
  routingError?: string | null;
  routingBusy?: boolean;
  onRetryRouting?: () => void;
};

export function SplashScreen({
  onComplete,
  routingError,
  routingBusy,
  onRetryRouting,
}: SplashScreenProps) {
  const { t } = useLanguage();
  // Native Expo splash pins the image view edge-to-edge with aspect-fit (contain).
  const screenWidth = Dimensions.get("window").width;
  const logoWidth = Math.min(screenWidth, 430);
  const logoHeight = logoWidth / LOGO_ASPECT_RATIO;
  const [routing, setRouting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRouting(true);
      onComplete();
    }, 2600);
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
        {routingError ? (
          <View style={styles.errorWrap}>
            <ErrorState
              title={t("chrome.critical.001")}
              body={routingError}
              retryLabel={t("chrome.critical.002")}
              onRetry={onRetryRouting}
              busy={routingBusy}
            />
          </View>
        ) : routing ? (
          <View style={styles.busy} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.amberText} />
            <Text style={styles.busyLabel}>{t("chrome.critical.003")}</Text>
          </View>
        ) : null}
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
  busy: {
    position: "absolute",
    bottom: 96,
    alignItems: "center",
    gap: 10,
  },
  errorWrap: {
    position: "absolute",
    bottom: 72,
    left: 24,
    right: 24,
  },
  busyLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
});
