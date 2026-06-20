import { useEffect, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { colors } from "../theme";

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

export function WebAppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.cssText;
    const prevBody = body.style.cssText;

    html.style.height = "100%";
    body.style.height = "100%";
    body.style.margin = "0";
    body.style.overflow = "hidden";
    body.style.backgroundColor = "#EAEAEA";

    return () => {
      html.style.cssText = prevHtml;
      body.style.cssText = prevBody;
    };
  }, []);

  if (Platform.OS !== "web") return <>{children}</>;

  return (
    <View style={styles.webRoot}>
      <View style={styles.phoneFrame}>
        <View style={styles.phoneScreen}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webRoot: {
    flex: 1,
    minHeight: "100vh" as unknown as number,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: "#EAEAEA",
  },
  phoneFrame: {
    width: PHONE_WIDTH,
    maxWidth: "100%",
    height: PHONE_HEIGHT,
    maxHeight: "calc(100vh - 48px)" as unknown as number,
    borderRadius: 44,
    padding: 8,
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#3A3A3C",
    overflow: "hidden",
    ...(Platform.select({
      web: {
        boxShadow: "0 28px 80px rgba(47, 74, 69, 0.22)",
      },
    }) as object),
  },
  phoneScreen: {
    flex: 1,
    borderRadius: 34,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
});
