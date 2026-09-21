import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { useLanguage } from "../../LanguageContext";
import { colors, radius } from "../../theme";
import type {
  InviteComposerStep,
  InviteFamilyRole,
  InviteRequestKind,
  InviteSearchHit,
} from "../../types/inviteSearch";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

type Props = {
  visible: boolean;
  hit: InviteSearchHit | null;
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onSend: (input: { requestType: InviteRequestKind; role: InviteFamilyRole }) => void;
};

export function InviteComposerSheet({ visible, hit, submitting, error, onClose, onSend }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [step, setStep] = useState<InviteComposerStep>("relationship");
  const [requestType, setRequestType] = useState<InviteRequestKind | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setStep("relationship");
    setRequestType(null);
    dragY.setValue(0);
  }, [visible, hit?.userId, hit?.darinId, dragY]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          dragY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 64) {
            onClose();
            return;
          }
          Animated.timing(dragY, { toValue: 0, duration: 160, useNativeDriver: true }).start();
        },
      }),
    [dragY, onClose],
  );

  if (!hit) return null;

  const chooseFamily = () => {
    setRequestType("family");
    setStep("confirm");
  };
  const chooseFriend = () => {
    setRequestType("friend");
    setStep("confirm");
  };
  const send = () => {
    if (submitting || !requestType) return;
    onSend({ requestType, role: "editor" });
  };

  const title = step === "relationship" ? t("family.critical.112") : t("family.critical.146");
  const confirmCopy = requestType === "friend"
    ? t("family.critical.120", { name: hit.displayName })
    : t("family.critical.121", { name: hit.displayName });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("family.critical.140")}
        />
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY: dragY }] },
          ]}
        >
          <View {...pan.panHandlers}>
            <View style={styles.handle} />
            <View style={styles.header}>
              {step !== "relationship" ? (
                <Pressable
                  style={styles.headerSide}
                  onPress={() => setStep("relationship")}
                  accessibilityRole="button"
                  accessibilityLabel={t("family.critical.141")}
                >
                  <Text style={styles.headerSideText}>{t("family.critical.141")}</Text>
                </Pressable>
              ) : <View style={styles.headerSide} />}
              <Text style={styles.title} accessibilityRole="header">{title}</Text>
              <Pressable
                style={styles.headerSide}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t("family.critical.140")}
              >
                <Text style={styles.headerSideText}>{t("family.critical.140")}</Text>
              </Pressable>
            </View>
          </View>

          {step === "relationship" ? (
            <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={t("family.critical.144")}>
              <OptionRow
                testID="invite-choice-family"
                icon="family"
                label={t("family.critical.113")}
                description={t("family.critical.114")}
                onPress={chooseFamily}
              />
              <OptionRow
                testID="invite-choice-friend"
                icon="handshake"
                label={t("family.critical.115")}
                description={t("family.critical.116")}
                onPress={chooseFriend}
              />
            </View>
          ) : null}

          {step === "confirm" || step === "submitting" ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmTitle}>{confirmCopy}</Text>
              {requestType === "family" ? (
                <Text style={styles.confirmMeta}>{t("family.critical.177")}</Text>
              ) : null}
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              <View style={styles.actions}>
                <Pressable
                  style={styles.secondary}
                  onPress={onClose}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.cancel")}
                >
                  <Text style={styles.secondaryText}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable
                  testID="invite-send"
                  style={[styles.primary, submitting && styles.disabled]}
                  onPress={send}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: submitting, busy: submitting }}
                  accessibilityLabel={t("family.critical.123")}
                >
                  {submitting
                    ? <ActivityIndicator color={colors.primaryForeground} />
                    : <Text style={styles.primaryText}>{t("family.critical.123")}</Text>}
                </Pressable>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

function OptionRow({
  testID,
  icon,
  label,
  description,
  active,
  onPress,
}: {
  testID?: string;
  icon?: "family" | "handshake";
  label: string;
  description: string;
  active?: boolean;
  onPress: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Pressable
      testID={testID}
      style={[styles.option, active && styles.optionActive]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: Boolean(active) }}
      accessibilityLabel={active ? `${label}. ${t("family.critical.143")}` : label}
    >
      {icon ? (
        <View style={[styles.optionIcon, active && styles.optionIconActive]}>
          <BabyLogIcon kind={icon} size={18} color={active ? colors.amberText : colors.muted} />
        </View>
      ) : null}
      <View style={styles.optionCopy}>
        <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{label}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <View style={[styles.radio, active && styles.radioActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(46,42,38,0.32)" },
  sheet: {
    maxHeight: "55%",
    minHeight: "35%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center", marginTop: 9, marginBottom: 4 },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center" },
  headerSide: { width: 56, minHeight: TOUCH_MIN, justifyContent: "center" },
  headerSideText: { color: colors.amberText, fontSize: 14, fontWeight: "700" },
  title: { flex: 1, textAlign: "center", color: colors.text, fontSize: 16, fontWeight: "800" },
  list: { gap: 8, paddingBottom: 8 },
  option: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionActive: { borderColor: colors.border, backgroundColor: colors.accentSoft },
  optionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.cardHi },
  optionIconActive: { backgroundColor: colors.accentSoft },
  optionCopy: { flex: 1, minWidth: 0 },
  optionLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  optionLabelActive: { color: colors.accentStrong },
  optionDescription: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border },
  radioActive: { borderColor: colors.accentStrong, backgroundColor: colors.accentStrong },
  confirm: { gap: 10, paddingBottom: 8 },
  confirmTitle: { color: colors.text, fontSize: 16, fontWeight: "800", lineHeight: 22 },
  confirmMeta: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, padding: 10, borderRadius: radius.md, fontSize: 13 },
  actions: { flexDirection: "row", gap: 8, marginTop: 6 },
  secondary: {
    flex: 1,
    minHeight: TOUCH_MIN,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  primary: {
    flex: 1,
    minHeight: TOUCH_MIN,
    borderRadius: radius.md,
    backgroundColor: colors.primaryCoral,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colors.primaryForeground, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.48 },
});
