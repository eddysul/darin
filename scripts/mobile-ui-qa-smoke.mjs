import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [tabs, navTypes, menu, navigator, theme, consult, notifications, mediaViewer, growthChart, report, formField, emailAuth, appConfig] = await Promise.all([
  read("src/screens/MainTabs.tsx"),
  read("src/navigation/types.ts"),
  read("src/screens/tabs/MenuScreen.tsx"),
  read("src/navigation/MainNavigator.tsx"),
  read("src/theme.ts"),
  read("src/screens/tabs/ConsultScreen.tsx"),
  read("src/screens/NotificationCenterScreen.tsx"),
  read("src/components/memories/MemoryMediaViewer.tsx"),
  read("src/components/babylog/GrowthChart.tsx"),
  read("src/screens/tabs/BabyReportScreen.tsx"),
  read("src/components/forms/FormField.tsx"),
  read("src/components/auth/EmailAuthForm.tsx"),
  read("app.config.js"),
]);

assert.ok(tabs.includes('{ kind: "micAction" }'), "Mic remains an independent center action");
assert.ok(!navTypes.includes("Mic:"), "Mic is not a navigation route");
assert.ok(!tabs.toLowerCase().includes("capsule"), "tab bar does not add a moving capsule indicator");
assert.ok(tabs.includes("outputRange: [1, 1.04]") && tabs.includes("width: 56"), "Mic uses the approved compact active treatment");
assert.ok(tabs.includes("voiceOpen && allowVoice && styles.centerLabelActive"), "Mic label is emphasized only while its action is active");
assert.ok(tabs.includes("friendOnly ? null : <CustomTabBar"), "friend-only root hides the single-destination tab bar");
assert.ok(!tabs.match(/setVoiceOpen\(false\);[\s\S]{0,100}navigation\.navigate\("Record"\)/), "closing Mic does not force a tab change");
assert.ok(menu.includes('onOpenSettings("account")'), "account settings use the existing native stack destination");
assert.ok(navigator.includes("https://${appLinkHost}"), "configured HTTPS app-link prefix is registered");
assert.ok(appConfig.includes("associatedDomains") && appConfig.includes("intentFilters"), "iOS Universal Links and Android App Links are configured together");

assert.ok(theme.includes('const PRIMARY_CORAL = "#B65B55"'), "primary CTA keeps the approved dark coral");
assert.ok(theme.includes('primaryForeground: "#FFFFFF"'), "primary CTA foreground remains white");
assert.ok(theme.includes('brandCoralForeground: "#2E2A26"'), "solid brand-coral selected controls use a readable foreground token");

assert.ok(formField.includes("accessibilityLabelledBy"), "FormField binds visible labels to inputs");
assert.ok(emailAuth.includes("<FormField"), "email authentication uses the shared FormField");
assert.ok(consult.includes("<FlatList") && notifications.includes("<FlatList"), "unbounded consult and notification lists are virtualized");
assert.ok(consult.includes("if (reduceMotion) return") && mediaViewer.includes("reduceMotion ? 1 : withSpring"), "motion-heavy paths respect Reduce Motion");
assert.ok(mediaViewer.includes('name: "zoomIn"') && mediaViewer.includes('name: "resetZoom"'), "photo zoom exposes accessibility actions without changing the viewer UI");
assert.ok(growthChart.includes('accessibilityRole="image"') && report.includes('accessibilityValue={{ text:'), "visual reports expose screen-reader summaries");

console.log("mobile-ui-qa-smoke: approved navigation, accessibility, contrast, motion, and virtualization invariants passed");
