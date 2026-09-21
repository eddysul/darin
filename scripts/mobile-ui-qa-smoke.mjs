import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [tabs, navTypes, menu, navigator, theme, consult, notifications, mediaViewer, growthChart, report, formField, emailAuth, appConfig, expoConfig, appRoot, packageJson, recordGrid, timeline, memoryDetail, memoryComments, stickerVault, memoriesScreen, rhythmCard] = await Promise.all([
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
  read("app.json"),
  read("App.tsx"),
  read("package.json"),
  read("src/components/babylog/OneTouchRecordGrid.tsx"),
  read("src/components/babylog/TodayTimeline.tsx"),
  read("src/screens/MemoryDetailScreen.tsx"),
  read("src/components/memories/MemoryCommentsSheet.tsx"),
  read("src/components/babylog/BabyStickerVaultModal.tsx"),
  read("src/screens/tabs/MemoriesScreen.tsx"),
  read("src/components/babylog/OverviewRhythmCard.tsx"),
]);

assert.ok(tabs.includes('{ kind: "micAction" }'), "Mic remains an independent center action");
assert.ok(!navTypes.includes("Mic:"), "Mic is not a navigation route");
assert.ok(!tabs.toLowerCase().includes("capsule"), "tab bar does not add a moving capsule indicator");
assert.ok(tabs.includes("outputRange: [1, 1.04]") && tabs.includes("width: 56"), "Mic uses the approved compact active treatment");
assert.ok(tabs.includes("voiceOpen && allowVoice && styles.centerLabelActive"), "Mic label is emphasized only while its action is active");
assert.ok(tabs.includes("voicePressProgress") && tabs.includes("outputRange: [1, 0.96]"), "Mic has restrained press feedback");
assert.ok(tabs.includes("voicePulseProgress") && tabs.includes("isRecording"), "Mic pulse follows actual recording state");
assert.ok(tabs.includes("styles.tabItemPressed"), "regular tabs keep their layout and add press-only feedback");
assert.ok(tabs.includes("friendOnly ? null : <CustomTabBar"), "friend-only root hides the single-destination tab bar");
assert.ok(!tabs.match(/setVoiceOpen\(false\);[\s\S]{0,100}navigation\.navigate\("Record"\)/), "closing Mic does not force a tab change");
assert.ok(menu.includes('onOpenSettings("account")'), "account settings use the existing native stack destination");
assert.ok(navigator.includes("https://${appLinkHost}"), "configured HTTPS app-link prefix is registered");
assert.ok(appConfig.includes("associatedDomains") && appConfig.includes("intentFilters"), "iOS Universal Links and Android App Links are configured together");

assert.ok(theme.includes("const PRIMARY_CORAL = TEXT_PRIMARY"), "primary CTA uses charcoal on white");
assert.ok(theme.includes('primaryForeground: "#FFFFFF"'), "primary CTA foreground remains white");
assert.ok(theme.includes("brandCoralForeground: VOICE_AMBER_STRONG"), "light selected chips use strong amber text");
assert.ok(theme.includes("DynamicColorIOS") && theme.includes("PlatformColor"), "semantic tokens adapt to native light and dark appearances");
assert.ok(theme.includes('background: "#121212"') && theme.includes('card: "#1C1C1C"'), "dark mode uses neutral near-black surfaces");
assert.ok(expoConfig.includes('"userInterfaceStyle": "automatic"'), "native apps follow the system appearance");
assert.ok(expoConfig.includes('"expo-system-ui"') && packageJson.includes('"expo-system-ui"'), "Android system appearance support is configured and installed");
assert.ok(expoConfig.includes('"dark"') && expoConfig.includes('"#121212"'), "native splash screens include a dark appearance");
assert.ok(appRoot.includes('<StatusBar style="auto" />'), "status-bar content follows the active appearance");
assert.ok(navigator.includes("DarkTheme") && navigator.includes("theme={navigationTheme}"), "native navigation headers and transitions use the active theme");

assert.ok(formField.includes("accessibilityLabelledBy"), "FormField binds visible labels to inputs");
assert.ok(emailAuth.includes("<FormField"), "email authentication uses the shared FormField");
assert.ok(consult.includes("<FlatList") && notifications.includes("<FlatList"), "unbounded consult and notification lists are virtualized");
assert.ok(consult.includes("if (reduceMotion) return") && mediaViewer.includes("reduceMotion ? 1 : withSpring"), "motion-heavy paths respect Reduce Motion");
assert.ok(mediaViewer.includes('name: "zoomIn"') && mediaViewer.includes('name: "resetZoom"'), "photo zoom exposes accessibility actions without changing the viewer UI");
assert.ok(growthChart.includes('accessibilityRole="image"') && report.includes('accessibilityValue={{ text:'), "visual reports expose screen-reader summaries");
assert.ok(recordGrid.includes("longPressProgress") && recordGrid.includes("duration: 380"), "record tiles show long-press progress without changing actions");
assert.ok(timeline.includes("rowEnterY") && timeline.includes("animateDelete"), "today timeline animates highlighted inserts and confirmed removals");
assert.ok(memoryDetail.includes("<MemoryCommentsSheet") && memoryComments.includes('commentStatus') && memoryComments.includes('busy: working'), "comments expose submitting and success states in the active sheet");
assert.ok(memoriesScreen.includes("localDataScope?.userId") && memoriesScreen.includes("accountId, babyId, [...feedBabyIds].sort()") && memoriesScreen.includes("loadedFeedScopeKey === feedScopeToken"), "memory cards display only for their authoritative account/baby feed scope");
assert.ok(memoriesScreen.includes("feedScopeKeyRef.current !== requestedScopeKey || feedLoadRunRef.current !== requestRun"), "late memory feed responses cannot overwrite a new scope or newer load");
assert.ok(memoriesScreen.includes("feedScopeVersionRef.current.version + 1"), "returning to an earlier feed identity still requires a fresh authorization-backed load");
assert.ok(memoriesScreen.includes("visible={feedReady && Boolean(commentsCard)}") && memoriesScreen.includes("visible={feedReady && Boolean(lightbox)}"), "memory overlays do not expose previous-scope posts");
assert.ok(rhythmCard.includes("fontScale >= 1.4") && rhythmCard.includes("styles.headLargeText") && rhythmCard.includes("largeText ? [0, 12, 24]"), "rhythm title/actions and time guides adapt to accessibility text sizes");
assert.ok(stickerVault.includes("styles.cardPressed") && stickerVault.includes("styles.optionChipPressed"), "sticker selection and options have press feedback");
assert.ok(notifications.includes("cardMainPressed"), "notification read actions react immediately on press");

console.log("mobile-ui-qa-smoke: approved navigation, accessibility, contrast, motion, and virtualization invariants passed");
