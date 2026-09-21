import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { useLanguage } from "../../LanguageContext";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { ProfileRepository } from "../../repositories/ProfileRepository";
import { canInvite, type FamilyRole } from "../../types/family";
import { colors, radius } from "../../theme";
import { familyErrorMessage } from "../../utils/familyDisplay";
import { inviteUrl } from "../../utils/inviteCode";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;
type VisibleInviteType = "family" | "baby_friend";

type Props = {
  visible: boolean;
  babyId?: string | null;
  babyName: string;
  myFamilyRole: FamilyRole;
  onClose: () => void;
  onAccepted?: (babyId?: string | null) => void;
};

export function InviteCodeSheet({ visible, babyId, babyName, myFamilyRole, onClose, onAccepted }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const isAdmin = canInvite(myFamilyRole);
  const [inviteType, setInviteType] = useState<VisibleInviteType>(isAdmin ? "family" : "baby_friend");
  const [inviteCode, setInviteCode] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);
  const [enteredCode, setEnteredCode] = useState("");
  const [codePreview, setCodePreview] = useState<{
    code: string;
    babyId: string | null;
    babyName: string | null;
    inviterName: string;
    inviteType: VisibleInviteType;
  } | null>(null);
  const [codeWorking, setCodeWorking] = useState(false);
  const [error, setError] = useState("");

  const createInviteCode = async () => {
    if (!babyId || !isAdmin || creatingCode) return;
    setCreatingCode(true);
    setError("");
    try {
      const row = await FamilyRepository.createInviteCode({
        babyId,
        inviteType,
        role: "editor",
        relationshipLabel: inviteType === "family" ? "가족" : "친구",
      });
      if (!row?.code) throw new Error(t("family.critical.022"));
      setInviteCode(row.code);
    } catch (cause) {
      setError(cause instanceof Error ? familyErrorMessage(t, cause.message) : t("family.critical.022"));
    } finally {
      setCreatingCode(false);
    }
  };

  const previewEnteredCode = async () => {
    const code = enteredCode.trim().toUpperCase();
    if (!code || codeWorking) return;
    setCodeWorking(true);
    setError("");
    setCodePreview(null);
    try {
      const row = await FamilyRepository.previewInviteCode(code);
      if (!row?.is_valid) {
        throw new Error(row?.invalid_reason === "expired" ? t("family.critical.030") : t("family.critical.031"));
      }
      if (row.invite_type === "darin_friend") throw new Error(t("family.critical.032"));
      setCodePreview({
        code,
        babyId: row.baby_id,
        babyName: row.baby_name,
        inviterName: row.inviter_name,
        inviteType: row.invite_type,
      });
    } catch (cause) {
      setError(cause instanceof Error ? familyErrorMessage(t, cause.message) : t("family.critical.033"));
    } finally {
      setCodeWorking(false);
    }
  };

  const acceptEnteredCode = async () => {
    if (!codePreview || codeWorking) return;
    setCodeWorking(true);
    setError("");
    try {
      const profile = await ProfileRepository.getMyDisplayProfile();
      if (!profile) throw new Error(t("family.critical.034"));
      const accepted = await FamilyRepository.acceptInviteCode({
        code: codePreview.code,
        displayName: profile.displayName,
        nickname: profile.nickname,
        relation: profile.defaultRelation ?? "가족",
      });
      if (!accepted) throw new Error(t("family.critical.035"));
      setEnteredCode("");
      setCodePreview(null);
      Alert.alert(
        t("family.critical.036"),
        accepted.invite_type === "family" ? t("family.critical.037") : t("family.critical.038"),
      );
      onAccepted?.(accepted.baby_id);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? familyErrorMessage(t, cause.message) : t("family.critical.035"));
    } finally {
      setCodeWorking(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("family.critical.140")} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{t("family.critical.133")}</Text>
              <Pressable style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("family.critical.140")}>
                <Text style={styles.closeText}>{t("family.critical.140")}</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              {isAdmin ? (
                <>
                  <Text style={styles.section}>{t("family.critical.060")}</Text>
                  <Text style={styles.hint}>{t("family.critical.061")}</Text>
                  {(["family", "baby_friend"] as const).map((type) => (
                    <Pressable
                      key={type}
                      style={[styles.option, inviteType === type && styles.optionActive]}
                      onPress={() => {
                        setInviteType(type);
                        setInviteCode("");
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: inviteType === type }}
                    >
                      <BabyLogIcon kind={type === "family" ? "family" : "handshake"} size={18} color={inviteType === type ? colors.amberText : colors.muted} />
                      <Text style={styles.optionLabel}>{type === "family" ? t("family.critical.113") : t("family.critical.115")}</Text>
                    </Pressable>
                  ))}
                  {inviteType === "family" ? (
                    <Text style={styles.hint}>{t("family.critical.177")}</Text>
                  ) : null}
                  {inviteCode ? (
                    <>
                      <View style={styles.codePill}><Text style={styles.codeText}>{inviteCode}</Text></View>
                      <View style={styles.rowActions}>
                        <Pressable style={styles.secondary} onPress={() => void Clipboard.setStringAsync(inviteCode).then(() => Alert.alert(t("family.critical.023"), t("family.critical.024")))}>
                          <Text style={styles.secondaryText}>{t("family.critical.062")}</Text>
                        </Pressable>
                        <Pressable style={styles.secondary} onPress={() => void Clipboard.setStringAsync(inviteUrl(inviteCode)).then(() => Alert.alert(t("family.critical.025"), t("family.critical.026")))}>
                          <Text style={styles.secondaryText}>{t("family.critical.063")}</Text>
                        </Pressable>
                      </View>
                      <Pressable
                        style={styles.primary}
                        onPress={() => void Share.share({
                          message: t("family.critical.027", {
                            babyName,
                            kind: inviteType === "family" ? t("family.critical.028") : t("family.critical.029"),
                            link: inviteUrl(inviteCode),
                            code: inviteCode,
                          }),
                        })}
                      >
                        <Text style={styles.primaryText}>{t("family.critical.064")}</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable style={[styles.secondary, creatingCode && styles.disabled]} onPress={() => void createInviteCode()} disabled={creatingCode}>
                      {creatingCode ? <ActivityIndicator color={colors.amberText} /> : <Text style={styles.secondaryText}>{t("family.critical.066")}</Text>}
                    </Pressable>
                  )}
                </>
              ) : null}

              <Text style={[styles.section, isAdmin && styles.sectionSpaced]}>{t("family.critical.078")}</Text>
              <Text style={styles.hint}>{t("family.critical.079")}</Text>
              <TextInput
                style={styles.input}
                value={enteredCode}
                onChangeText={(value) => {
                  setEnteredCode(value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24));
                  setCodePreview(null);
                  setError("");
                }}
                placeholder={t("family.critical.080")}
                placeholderTextColor={colors.faint}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => void previewEnteredCode()}
                accessibilityLabel={t("family.critical.078")}
              />
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              {codePreview ? (
                <View style={styles.preview}>
                  <Text style={styles.optionLabel}>{codePreview.inviteType === "family" ? t("family.critical.009") : t("family.critical.010")}</Text>
                  {codePreview.babyName ? <Text style={styles.hint}>{t("family.critical.081", { name: codePreview.babyName })}</Text> : null}
                  <Text style={styles.hint}>{t("family.critical.082", { name: codePreview.inviterName })}</Text>
                  <Pressable style={[styles.primary, codeWorking && styles.disabled]} disabled={codeWorking} onPress={() => void acceptEnteredCode()}>
                    {codeWorking ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryText}>{t("family.critical.084")}</Text>}
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={[styles.secondary, (!enteredCode.trim() || codeWorking) && styles.disabled]}
                  disabled={!enteredCode.trim() || codeWorking}
                  onPress={() => void previewEnteredCode()}
                >
                  {codeWorking ? <ActivityIndicator color={colors.amberText} /> : <Text style={styles.secondaryText}>{t("family.critical.085")}</Text>}
                </Pressable>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(46,42,38,0.32)" },
  sheet: {
    maxHeight: "78%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center", marginTop: 9 },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center" },
  title: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "800" },
  close: { minWidth: 44, minHeight: TOUCH_MIN, alignItems: "flex-end", justifyContent: "center" },
  closeText: { color: colors.amberText, fontSize: 13, fontWeight: "800" },
  body: { gap: 10, paddingBottom: 12 },
  section: { color: colors.text, fontSize: 15, fontWeight: "800" },
  sectionSpaced: { marginTop: 8 },
  hint: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  option: {
    minHeight: TOUCH_MIN,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionActive: { borderColor: colors.border, backgroundColor: colors.accentSoft },
  optionLabel: { color: colors.text, fontSize: 14, fontWeight: "800" },
  chips: { flexDirection: "row", gap: 8 },
  chip: { minHeight: TOUCH_MIN, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  chipActive: { borderColor: colors.border, backgroundColor: colors.accentSoft },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.accentStrong },
  input: { minHeight: TOUCH_MIN, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.cardHi, fontSize: 15 },
  codePill: { minHeight: TOUCH_MIN, borderRadius: radius.md, backgroundColor: colors.cardHi, alignItems: "center", justifyContent: "center" },
  codeText: { fontSize: 18, fontWeight: "800", letterSpacing: 2, color: colors.text },
  rowActions: { flexDirection: "row", gap: 8 },
  secondary: { flex: 1, minHeight: TOUCH_MIN, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  primary: { minHeight: TOUCH_MIN, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.primaryForeground, fontWeight: "800" },
  preview: { gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.cardHi },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, padding: 10, borderRadius: radius.md, fontSize: 13 },
  disabled: { opacity: 0.48 },
});
