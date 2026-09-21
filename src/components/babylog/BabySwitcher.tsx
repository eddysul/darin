import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useBabyLog } from "../../context/BabyLogContext";
import type { RootStackParamList } from "../../navigation/types";
import { BabyProfileRepository } from "../../repositories/BabyProfileRepository";
import type { BabyRow } from "../../types/database";
import { colors, fontScaleCap, radius } from "../../theme";
import { isPregnancyStage } from "../../utils/childDisplay";
import { BabyLogIcon } from "./BabyLogIcon";
import { useLanguage } from "../../LanguageContext";
import type { MessageKey } from "../../i18n";
import { caughtErrorMessage } from "../../utils/familyDisplay";

function TogetherChipLabel({ label, count }: { label: string; count: number }) {
  const token = String(count);
  const index = label.indexOf(token);
  if (index < 0) {
    return (
      <Text style={styles.togetherChipText} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>
        {label}
      </Text>
    );
  }
  return (
    <Text style={styles.togetherChipText} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>
      {label.slice(0, index)}
      <Text style={styles.togetherChipCount}>{token}</Text>
      {label.slice(index + token.length)}
    </Text>
  );
}

function babyAgeLabel(baby: Pick<BabyRow, "birth_date" | "child_status">, t: (key: MessageKey, params?: Record<string, string | number>) => string): string {
  if (isPregnancyStage({ childStatus: baby.child_status, birthDate: baby.birth_date ?? undefined })) {
    return t("home.switcher.pregnant");
  }
  if (!baby.birth_date) return t("home.switcher.noBirthDate");
  const birth = new Date(`${baby.birth_date}T00:00:00`);
  if (!Number.isFinite(birth.getTime())) return baby.birth_date;
  const days = Math.floor((Date.now() - birth.getTime()) / 86_400_000);
  if (days < 0) return `D-${Math.abs(days)}`;
  if (days < 31) return `D+${days}`;
  const months = Math.max(1, Math.floor(days / 30.4375));
  if (months < 24) return t("home.switcher.months", { count: months });
  return t("home.switcher.years", { count: Math.floor(months / 12) });
}

type SwitcherVariant = "default" | "switchButton" | "identity" | "profileName" | "chevron" | "togetherChip";

type TogetherCopy = {
  countLabel?: string;
  title?: string;
  subtitle?: string;
};

export function BabySwitcher({
  compact = false,
  variant = "default",
  togetherCopy,
}: {
  compact?: boolean;
  variant?: SwitcherVariant;
  togetherCopy?: TogetherCopy;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const { babies, activeBabyId, babyName, switchActiveBaby, logAuthor } = useBabyLog();
  const together = variant === "togetherChip";
  const togetherCountLabel = togetherCopy?.countLabel ?? t("home.switcher.togetherCount", { count: babies.length });
  const sheetTitle = together ? (togetherCopy?.title ?? t("home.switcher.togetherTitle")) : t("home.switcher.title");
  const sheetSubtitle = together ? (togetherCopy?.subtitle ?? t("home.switcher.togetherSubtitle")) : t("home.switcher.subtitle");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingBabyId, setPendingBabyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const switchAttemptRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all(babies.map(async (baby) => {
      const profile = await BabyProfileRepository.getBabyProfile(baby.id).catch(() => null);
      return [baby.id, profile?.avatarUrl ?? profile?.photoUrl ?? baby.photo_url ?? ""] as const;
    })).then((entries) => {
      if (!cancelled) setAvatarUrls(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [babies, open]);

  useEffect(() => () => {
    switchAttemptRef.current += 1;
  }, []);

  const selectBaby = (babyId: string) => {
    if (busy) return;
    setError("");
    if (babyId === activeBabyId) {
      setOpen(false);
      return;
    }

    const attempt = ++switchAttemptRef.current;
    setBusy(true);
    setPendingBabyId(babyId);
    // Full account/baby hydration can take time. It must not leave a modal
    // intercepting every touch while the scoped data loads in the background.
    setOpen(false);
    void switchActiveBaby(babyId)
      .then((selectedBaby) => {
        if (attempt !== switchAttemptRef.current) return;
        if (!selectedBaby) throw new Error(t("home.switcher.accessError"));
      })
      .catch((cause) => {
        if (attempt !== switchAttemptRef.current) return;
        setError(caughtErrorMessage(t, cause, "home.switcher.error"));
        setOpen(true);
      })
      .finally(() => {
        if (attempt !== switchAttemptRef.current) return;
        setBusy(false);
        setPendingBabyId(null);
      });
  };

  return (
    <>
      <Pressable
        style={[styles.trigger, compact && styles.triggerCompact, variant === "switchButton" && styles.switchTrigger, variant === "identity" && styles.identityTrigger, variant === "profileName" && styles.profileNameTrigger, variant === "chevron" && styles.chevronTrigger, together && styles.togetherChip]}
        onPress={() => setOpen(true)}
        hitSlop={compact || variant === "switchButton" || variant === "profileName" || variant === "chevron" || together ? { top: 12, bottom: 12, left: 12, right: 12 } : undefined}
        accessibilityRole="button"
        accessibilityLabel={together ? t("home.a11y.openTogetherBabies", { count: babies.length }) : t("home.a11y.switchBaby", { babyName })}
      >
        {variant === "chevron" ? (
          <Text style={styles.chevronOnly}>⌄</Text>
        ) : together ? (
          <>
            <BabyLogIcon kind="baby" size={13} color={colors.amberText} strokeWidth={2} />
            <TogetherChipLabel label={togetherCountLabel} count={babies.length} />
            <Text style={styles.togetherChipChevron}>›</Text>
          </>
        ) : (
          <>
            {variant === "switchButton" || variant === "identity" || variant === "profileName" ? null : <BabyLogIcon kind="baby" size={compact ? 15 : 17} color={colors.amberText} />}
            <Text style={[styles.triggerText, compact && styles.triggerTextCompact, variant === "switchButton" && styles.switchTriggerText, variant === "identity" && styles.identityTriggerText, variant === "profileName" && styles.profileNameTriggerText]} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>{variant === "switchButton" ? t("home.switcher.button") : babyName}</Text>
            <Text style={[styles.chevron, variant === "switchButton" && styles.switchChevron, variant === "identity" && styles.identityChevron, variant === "profileName" && styles.profileNameChevron]}>⌄</Text>
          </>
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, together && styles.togetherSheet]}>
            {together ? null : <View style={styles.handle} />}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleCopy}>
                <Text style={[styles.title, together && styles.togetherTitle]}>{sheetTitle}</Text>
                <Text style={styles.subtitle}>{sheetSubtitle}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={t("home.switcher.close")}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.list} contentContainerStyle={[styles.listContent, together && styles.togetherList]}>
              {babies.length ? babies.map((baby) => {
                const selected = baby.id === activeBabyId;
                const avatarUrl = avatarUrls[baby.id];
                return (
                    <Pressable
                      key={baby.id}
                      style={together ? [styles.togetherRow, selected && styles.togetherRowActive] : [styles.babyRow, selected && styles.babyRowActive]}
                      disabled={busy}
                      onPress={() => selectBaby(baby.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${baby.name}, ${babyAgeLabel(baby, t)}`}
                      accessibilityState={{ selected, disabled: busy, busy: pendingBabyId === baby.id }}
                    >
                      <View style={together ? styles.togetherIcon : styles.babyIcon}>
                        {avatarUrl ? <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : <BabyLogIcon kind="baby" size={together ? 22 : 28} color={selected ? colors.amber : colors.muted} />}
                      </View>
                      <View style={styles.babyCopy}>
                        <Text style={[styles.babyName, together && styles.togetherName, selected && !together && styles.babyNameActive]} numberOfLines={1}>{baby.name}</Text>
                        {together ? (
                          <Text style={styles.togetherMeta}>{babyAgeLabel(baby, t)}</Text>
                        ) : (
                          <View style={styles.babyMetaRow}>
                            <Text style={styles.babyMeta}>{babyAgeLabel(baby, t)}</Text>
                            <Text style={styles.metaDot}>·</Text>
                            <BabyLogIcon kind="profile" size={15} color={colors.amberText} strokeWidth={2.1} />
                            <Text style={styles.sharedText}>
                              {t(baby.created_by && baby.created_by === logAuthor.userId ? "home.switcher.mine" : "home.switcher.shared")}
                            </Text>
                          </View>
                        )}
                      </View>
                      {pendingBabyId === baby.id ? (
                        <View style={styles.selectedCircle}><ActivityIndicator size="small" color={colors.brandCoralForeground} /></View>
                      ) : together ? <Text style={styles.togetherChevron}>›</Text> : selected ? <View style={styles.selectedCircle}><Text style={styles.selectedCheck}>✓</Text></View> : null}
                    </Pressable>
                );
              }) : <Text style={styles.empty}>{t("home.switcher.empty")}</Text>}
              {together ? null : (
                <Pressable style={styles.addButton} onPress={() => { setOpen(false); setError(""); navigation.navigate("BabyProfile", { mode: "create" }); }} disabled={busy}>
                  <View style={styles.addIcon}><Text style={styles.addIconText}>＋</Text></View>
                  <Text style={styles.addButtonText}>{t("home.switcher.add")}</Text>
                </Pressable>
              )}
            </ScrollView>
            {together ? (
              <Pressable style={styles.togetherAdd} onPress={() => { setOpen(false); setError(""); navigation.navigate("BabyProfile", { mode: "create" }); }} disabled={busy} accessibilityRole="button" accessibilityLabel={t("home.switcher.add")}>
                <Text style={styles.togetherAddText}>＋  {t("home.switcher.add")}</Text>
              </Pressable>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { maxWidth: 210, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: colors.amberSoft },
  triggerCompact: {
    alignSelf: "flex-start",
    minHeight: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  switchTrigger: {
    alignSelf: "flex-start",
    minHeight: 0,
    maxWidth: undefined,
    paddingHorizontal: 7,
    paddingVertical: 4,
    gap: 2,
  },
  triggerText: { flexShrink: 1, color: colors.amberText, fontSize: 15, fontWeight: "800" },
  switchTriggerText: { fontSize: 11, fontWeight: "800" },
  triggerTextCompact: { fontSize: 14 }, chevron: { color: colors.amberText, fontSize: 14, fontWeight: "800" },
  switchChevron: { fontSize: 11 },
  identityTrigger: {
    maxWidth: 210,
    minHeight: 48,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    gap: 7,
  },
  identityTriggerText: { color: colors.text, fontSize: 18, fontWeight: "800" },
  identityChevron: { color: colors.muted, fontSize: 16, fontWeight: "700" },
  profileNameTrigger: {
    maxWidth: 180,
    minHeight: 32,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    gap: 4,
  },
  profileNameTriggerText: { color: colors.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  profileNameChevron: { color: colors.muted, fontSize: 18, fontWeight: "600", marginTop: 2 },
  chevronTrigger: {
    maxWidth: 32,
    minWidth: 28,
    minHeight: Platform.OS === "android" ? 48 : 44,
    paddingHorizontal: 0,
    paddingRight: 2,
    backgroundColor: "transparent",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  chevronOnly: { color: colors.muted, fontSize: 16, lineHeight: 18, fontWeight: "600", marginTop: 2 },
  overlay: { flex: 1, justifyContent: "flex-end" }, backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(33,25,22,0.38)" },
  sheet: { maxHeight: "88%", backgroundColor: colors.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, paddingBottom: 34 },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 18 },
  sheetTitleCopy: { flex: 1 },
  title: { fontSize: 24, fontWeight: "900", color: colors.text },
  subtitle: { marginTop: 7, color: colors.muted, fontSize: 14, lineHeight: 20 },
  closeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cardHi, alignItems: "center", justifyContent: "center" },
  closeText: { color: colors.muted, fontSize: 31, lineHeight: 33, fontWeight: "300" },
  list: { maxHeight: 500 },
  listContent: { gap: 10, paddingBottom: 2 },
  babyRow: { minHeight: 84, flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 22, backgroundColor: colors.cardHi, borderWidth: 1.5, borderColor: "transparent" },
  babyRowActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  babyIcon: { width: 58, height: 58, borderRadius: 29, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  babyCopy: { flex: 1, minWidth: 0 },
  babyName: { fontSize: 19, fontWeight: "800", color: colors.text },
  babyNameActive: { color: colors.amberText },
  babyMetaRow: { marginTop: 5, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  babyMeta: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  metaDot: { color: colors.faint, fontSize: 13 },
  sharedText: { color: colors.muted, fontSize: 12.5, fontWeight: "600" },
  selectedCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  selectedCheck: { color: colors.brandCoralForeground, fontSize: 24, lineHeight: 27, fontWeight: "800" },
  addButton: { minHeight: 66, marginTop: 2, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  addIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.amber, alignItems: "center", justifyContent: "center" },
  addIconText: { color: colors.amberText, fontSize: 22, lineHeight: 24, fontWeight: "500" },
  addButtonText: { color: colors.amberText, fontSize: 16, fontWeight: "800" },
  label: { marginTop: 10, marginBottom: 6, color: colors.text, fontSize: 12.5, fontWeight: "800" }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.card, paddingHorizontal: 12, color: colors.text, fontSize: 15 },
  avatarWrap: { alignItems: "center", marginBottom: 6 },
  genderRow: { flexDirection: "row", gap: 8 }, genderChip: { minHeight: 44, minWidth: 74, alignItems: "center", justifyContent: "center", borderRadius: radius.full, borderWidth: 1, borderColor: colors.border }, genderChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft }, genderText: { color: colors.muted, fontWeight: "700" }, genderTextActive: { color: colors.amberText },
  error: { marginTop: 10, color: colors.dangerText, fontSize: 12 }, actionRow: { flexDirection: "row", gap: 8, marginTop: 18 }, secondary: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.full, borderWidth: 1, borderColor: colors.border }, secondaryText: { color: colors.muted, fontWeight: "800" }, primary: { flex: 2, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.full, backgroundColor: colors.primary }, primaryText: { color: colors.primaryForeground, fontWeight: "800" },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center", paddingVertical: 18 },
  togetherChip: {
    maxWidth: 240,
    minHeight: 0,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
    backgroundColor: colors.amberSoft,
    alignSelf: "flex-start",
  },
  togetherChipText: { flexShrink: 1, color: colors.amberText, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  togetherChipCount: { color: "#4A4035", fontSize: 12, lineHeight: 16, fontWeight: "800" },
  togetherChipChevron: { color: colors.amberText, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  togetherSheet: { paddingTop: 18 },
  togetherTitle: { fontSize: 22, fontWeight: "800" },
  togetherList: { gap: 0, paddingBottom: 8 },
  togetherRow: {
    minHeight: Platform.OS === "android" ? 72 : 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  togetherRowActive: { backgroundColor: "transparent" },
  togetherIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.chip,
    borderWidth: 1,
    borderColor: colors.border,
  },
  togetherName: { fontSize: 16, fontWeight: "800" },
  togetherMeta: { marginTop: 3, color: colors.muted, fontSize: 13, fontWeight: "600" },
  togetherChevron: { color: colors.faint, fontSize: 22, fontWeight: "300" },
  togetherAdd: {
    minHeight: Platform.OS === "android" ? 52 : 48,
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: colors.amberSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  togetherAddText: { color: colors.amberText, fontSize: 15, fontWeight: "800" },
});
