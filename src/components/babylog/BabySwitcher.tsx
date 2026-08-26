import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

export function BabySwitcher({ compact = false, variant = "default" }: { compact?: boolean; variant?: "default" | "switchButton" }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const { babies, activeBabyId, babyName, switchActiveBaby, logAuthor } = useBabyLog();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});

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

  return (
    <>
      <Pressable
        style={[styles.trigger, compact && styles.triggerCompact, variant === "switchButton" && styles.switchTrigger]}
        onPress={() => setOpen(true)}
        hitSlop={compact || variant === "switchButton" ? { top: 12, bottom: 12, left: 8, right: 8 } : undefined}
        accessibilityRole="button"
        accessibilityLabel={t("home.a11y.switchBaby", { babyName })}
      >
        {variant === "switchButton" ? null : <BabyLogIcon kind="baby" size={compact ? 15 : 17} color={colors.amberText} />}
        <Text style={[styles.triggerText, compact && styles.triggerTextCompact, variant === "switchButton" && styles.switchTriggerText]} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>{variant === "switchButton" ? t("home.switcher.button") : babyName}</Text>
        <Text style={[styles.chevron, variant === "switchButton" && styles.switchChevron]}>⌄</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleCopy}>
                <Text style={styles.title}>{t("home.switcher.title")}</Text>
                <Text style={styles.subtitle}>{t("home.switcher.subtitle")}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={t("home.switcher.close")}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {babies.length ? babies.map((baby) => {
                const selected = baby.id === activeBabyId;
                const avatarUrl = avatarUrls[baby.id];
                return (
                    <Pressable
                      key={baby.id}
                      style={[styles.babyRow, selected && styles.babyRowActive]}
                      disabled={busy}
                      onPress={() => {
                        setBusy(true);
                        setError("");
                        void switchActiveBaby(baby.id)
                          .then((selected) => {
                            if (!selected) throw new Error(t("home.switcher.accessError"));
                            setOpen(false);
                          })
                          .catch((cause) => setError(caughtErrorMessage(t, cause, "home.switcher.error")))
                          .finally(() => setBusy(false));
                      }}
                    >
                      <View style={styles.babyIcon}>
                        {avatarUrl ? <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : <BabyLogIcon kind="baby" size={28} color={selected ? colors.amber : colors.muted} />}
                      </View>
                      <View style={styles.babyCopy}>
                        <Text style={[styles.babyName, selected && styles.babyNameActive]} numberOfLines={1}>{baby.name}</Text>
                        <View style={styles.babyMetaRow}>
                          <Text style={styles.babyMeta}>{babyAgeLabel(baby, t)}</Text>
                          <Text style={styles.metaDot}>·</Text>
                          <BabyLogIcon kind="profile" size={15} color={colors.amberText} strokeWidth={2.1} />
                          <Text style={styles.sharedText}>
                            {t(baby.created_by && baby.created_by === logAuthor.userId ? "home.switcher.mine" : "home.switcher.shared")}
                          </Text>
                        </View>
                      </View>
                      {selected ? <View style={styles.selectedCircle}><Text style={styles.selectedCheck}>✓</Text></View> : null}
                    </Pressable>
                );
              }) : <Text style={styles.empty}>{t("home.switcher.empty")}</Text>}
              <Pressable style={styles.addButton} onPress={() => { setOpen(false); setError(""); navigation.navigate("BabyProfile", { mode: "create" }); }} disabled={busy}>
                <View style={styles.addIcon}><Text style={styles.addIconText}>＋</Text></View>
                <Text style={styles.addButtonText}>{t("home.switcher.add")}</Text>
              </Pressable>
            </ScrollView>
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
  selectedCheck: { color: colors.amberDark, fontSize: 24, lineHeight: 27, fontWeight: "800" },
  addButton: { minHeight: 66, marginTop: 2, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  addIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.amber, alignItems: "center", justifyContent: "center" },
  addIconText: { color: colors.amberText, fontSize: 22, lineHeight: 24, fontWeight: "500" },
  addButtonText: { color: colors.amberText, fontSize: 16, fontWeight: "800" },
  label: { marginTop: 10, marginBottom: 6, color: colors.text, fontSize: 12.5, fontWeight: "800" }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.card, paddingHorizontal: 12, color: colors.text, fontSize: 15 },
  avatarWrap: { alignItems: "center", marginBottom: 6 },
  genderRow: { flexDirection: "row", gap: 8 }, genderChip: { minHeight: 44, minWidth: 74, alignItems: "center", justifyContent: "center", borderRadius: radius.full, borderWidth: 1, borderColor: colors.border }, genderChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft }, genderText: { color: colors.muted, fontWeight: "700" }, genderTextActive: { color: colors.amberText },
  error: { marginTop: 10, color: colors.dangerText, fontSize: 12 }, actionRow: { flexDirection: "row", gap: 8, marginTop: 18 }, secondary: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.full, borderWidth: 1, borderColor: colors.border }, secondaryText: { color: colors.muted, fontWeight: "800" }, primary: { flex: 2, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.full, backgroundColor: colors.amber }, primaryText: { color: colors.amberDark, fontWeight: "800" },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center", paddingVertical: 18 },
});
