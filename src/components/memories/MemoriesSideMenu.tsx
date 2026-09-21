import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon, type MiscIconKey } from "../babylog/BabyLogIcon";
import { ProfileAvatar } from "../profile/ProfileAvatar";
import { useLanguage } from "../../LanguageContext";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { colors, fontScaleCap } from "../../theme";
import type { MemoryCriticalKey } from "../../i18nMemoriesCriticalMessages";

const OPEN_MS = 240;
const PANEL_RATIO = 0.75;
const ROW_MIN = 58;

type Item = {
  key: MemoryCriticalKey;
  icon: MiscIconKey;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  babyName?: string;
  babyAvatarUri?: string | null;
  hasBaby: boolean;
  showInvite: boolean;
  onClose: () => void;
  onOpenBabyProfile: () => void;
  onOpenMyProfile: () => void;
  onOpenFamily: () => void;
  onOpenInvite: () => void;
  onOpenSettings: () => void;
  onRestoreFocus?: () => void;
};

function MemoriesSideMenuInner({
  visible,
  babyName,
  babyAvatarUri,
  hasBaby,
  showInvite,
  onClose,
  onOpenBabyProfile,
  onOpenMyProfile,
  onOpenFamily,
  onOpenInvite,
  onOpenSettings,
  onRestoreFocus,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const reduceMotion = useReduceMotion();
  const { width: screenWidth } = useWindowDimensions();
  const panelWidth = Math.round(screenWidth * PANEL_RATIO);
  const duration = reduceMotion ? 0 : OPEN_MS;
  const [mounted, setMounted] = useState(visible);
  const panelRef = useRef<View>(null);
  const pendingRef = useRef<(() => void) | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const translateX = useSharedValue(panelWidth);
  const dim = useSharedValue(0);
  const dragStart = useSharedValue(0);

  const finishClose = useCallback(() => {
    mountedRef.current = false;
    setMounted(false);
    busyRef.current = false;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next) next();
    else onRestoreFocus?.();
  }, [onRestoreFocus]);

  const closeTo = useCallback((action?: () => void) => {
    if (busyRef.current) return;
    busyRef.current = true;
    pendingRef.current = action ?? null;
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => closeTo(), [closeTo]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeTo();
      return true;
    });
    return () => sub.remove();
  }, [closeTo, visible]);

  useEffect(() => {
    if (visible) {
      busyRef.current = false;
      pendingRef.current = null;
      mountedRef.current = true;
      setMounted(true);
      translateX.value = panelWidth;
      dim.value = 0;
      translateX.value = withTiming(0, { duration, easing: Easing.out(Easing.cubic) });
      dim.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
      return;
    }
    if (!mountedRef.current) return;
    translateX.value = withTiming(panelWidth, { duration, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
    dim.value = withTiming(0, { duration, easing: Easing.in(Easing.cubic) });
  }, [dim, duration, finishClose, panelWidth, translateX, visible]);

  useEffect(() => {
    if (!visible || !mounted) return;
    const timer = setTimeout(() => {
      const tag = findNodeHandle(panelRef.current);
      if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
    }, duration + 40);
    return () => clearTimeout(timer);
  }, [duration, mounted, visible]);

  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetX(12)
    .failOffsetY([-24, 24])
    .onBegin(() => {
      dragStart.value = translateX.value;
    })
    .onUpdate((event) => {
      const next = Math.min(panelWidth, Math.max(0, dragStart.value + event.translationX));
      translateX.value = next;
      dim.value = 1 - next / panelWidth;
    })
    .onEnd((event) => {
      const shouldClose = translateX.value > panelWidth * 0.22 || event.velocityX > 780;
      if (shouldClose) runOnJS(requestClose)();
      else {
        translateX.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
        dim.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
      }
    }), [dim, dragStart, panelWidth, requestClose, translateX]);

  const items: Item[] = [
    ...(hasBaby ? [{ key: "memory.critical.209" as const, icon: "baby" as const, onPress: () => closeTo(onOpenBabyProfile) }] : []),
    { key: "memory.critical.210", icon: "profile", onPress: () => closeTo(onOpenMyProfile) },
    ...(hasBaby ? [{ key: "memory.critical.211" as const, icon: "family" as const, onPress: () => closeTo(onOpenFamily) }] : []),
    ...(hasBaby && showInvite ? [{ key: "memory.critical.212" as const, icon: "userPlus" as const, onPress: () => closeTo(onOpenInvite) }] : []),
  ];

  const displayName = babyName?.trim() || t("memory.critical.213");

  if (!mounted) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none" accessibilityViewIsModal>
      <Pressable
        style={styles.dismissHit}
        onPress={() => closeTo()}
        accessibilityRole="button"
        accessibilityLabel={t("memory.critical.208")}
      >
        <Reanimated.View pointerEvents="none" style={[styles.dim, dimStyle]} />
      </Pressable>
      <GestureDetector gesture={pan}>
        <Reanimated.View
          style={[
            styles.panel,
            {
              width: panelWidth,
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 12),
            },
            panelStyle,
          ]}
        >
          <View ref={panelRef} style={styles.panelInner}>
            <Pressable
              style={({ pressed }) => [styles.identity, pressed && hasBaby && styles.pressed]}
              onPress={hasBaby ? () => closeTo(onOpenBabyProfile) : undefined}
              accessibilityRole={hasBaby ? "button" : "header"}
              accessibilityLabel={displayName}
              disabled={!hasBaby}
            >
              <ProfileAvatar uri={babyAvatarUri} size={56} fallback="baby" />
              <View style={styles.identityCopy}>
                <Text style={styles.identityName} numberOfLines={2} maxFontSizeMultiplier={fontScaleCap.chrome}>
                  {displayName}
                </Text>
                <Text style={styles.identityMeta} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>
                  {t("memory.critical.001")}
                </Text>
              </View>
            </Pressable>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} bounces={false}>
              {items.map((item) => (
                <Pressable
                  key={item.key}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  onPress={item.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={t(item.key)}
                >
                  <View style={styles.rowIcon}>
                    <BabyLogIcon kind={item.icon} size={24} color={colors.text} />
                  </View>
                  <Text style={styles.rowLabel} maxFontSizeMultiplier={fontScaleCap.control}>{t(item.key)}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.divider} />
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => closeTo(onOpenSettings)}
                accessibilityRole="button"
                accessibilityLabel={t("memory.critical.214")}
              >
                <View style={styles.rowIcon}>
                  <BabyLogIcon kind="settings" size={24} color={colors.text} />
                </View>
                <Text style={styles.rowLabel} maxFontSizeMultiplier={fontScaleCap.control}>{t("memory.critical.214")}</Text>
              </Pressable>
            </View>
          </View>
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

export const MemoriesSideMenu = memo(MemoriesSideMenuInner);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
  },
  dismissHit: {
    ...StyleSheet.absoluteFillObject,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: -6, height: 0 },
    elevation: 18,
  },
  panelInner: { flex: 1 },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  identityCopy: { flex: 1, minWidth: 0 },
  identityName: { color: colors.text, fontSize: 19, fontWeight: "600", letterSpacing: -0.3 },
  identityMeta: { marginTop: 4, color: colors.muted, fontSize: 13, fontWeight: "500" },
  list: { flex: 1 },
  listContent: { paddingBottom: 8 },
  footer: { paddingBottom: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 24, marginBottom: 6 },
  row: {
    minHeight: ROW_MIN,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.55 },
  rowIcon: { width: 24, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "600" },
});
