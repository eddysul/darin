import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "./BabyLogIcon";
import { useApp } from "../../context/AppContext";
import { useBabyLog } from "../../context/BabyLogContext";
import { BabyProfileRepository } from "../../repositories/BabyProfileRepository";
import { colors, fontScaleCap, type } from "../../theme";
import { formatRecordHeaderAge } from "../../utils/childDisplay";
import { useCompactLayout } from "../../hooks/useCompactLayout";
import { BabySwitcher } from "./BabySwitcher";
import { NotificationBellButton } from "../NotificationBellButton";

type Props = {
  onOpenProfile: () => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  embedded?: boolean;
};

export function RecordHomeHeader({ onOpenProfile, onOpenSettings, onOpenNotifications, embedded = false }: Props) {
  const insets = useSafeAreaInsets();
  const { careSetup, setCareSetup } = useApp();
  const careSetupRef = useRef(careSetup);
  careSetupRef.current = careSetup;
  const { babyName, babyBirthMeta, activeBabyId, familyMembers } = useBabyLog();
  const compact = useCompactLayout();
  const ageLabel = formatRecordHeaderAge(careSetup.child) ?? babyBirthMeta;
  const isShared = familyMembers.filter((member) => member.status === "active").length > 1;
  const [babyPhoto, setBabyPhoto] = useState(careSetup.child.photoUri);

  useFocusEffect(
    useCallback(() => {
      setBabyPhoto(careSetupRef.current.child.photoUri);
      const babyId = activeBabyId;
      if (!babyId) return;
      let cancelled = false;
      void BabyProfileRepository.getBabyProfile(babyId)
        .then((profile) => {
          if (cancelled || !profile) return;
          const current = careSetupRef.current;
          const nextUri = profile.avatarUrl ?? profile.photoUrl;
          if (nextUri) setBabyPhoto(nextUri);
          const same =
            profile.name === current.child.childName &&
            (profile.nickname ?? undefined) === (current.child.nickname ?? undefined) &&
            (profile.birthDate ?? undefined) === (current.child.birthDate ?? undefined) &&
            (nextUri ?? undefined) === (current.child.photoUri ?? undefined);
          if (same) return;
          setCareSetup({
            ...current,
            child: {
              ...current.child,
              childName: profile.name,
              nickname: profile.nickname,
              birthDate: profile.birthDate,
              photoUri: nextUri,
              specialNotes: profile.note ?? current.child.specialNotes,
            },
          });
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [activeBabyId, setCareSetup]),
  );

  return (
    <View style={[styles.wrap, embedded && styles.wrapEmbedded, compact && styles.wrapCompact, { paddingTop: Math.max(insets.top, compact ? 8 : 12) }]}>
      <View style={styles.headerRow}>
        <View style={[styles.card, compact && styles.cardCompact]}>
          <Pressable style={[styles.avatarCircle, compact && styles.avatarCompact]} onPress={onOpenProfile} hitSlop={compact ? 4 : undefined} accessibilityRole="button" accessibilityLabel="아기 프로필 열기">
            {babyPhoto ? (
              <Image source={{ uri: babyPhoto }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            ) : (
              <BabyLogIcon kind="baby" size={compact ? 22 : 27} color={colors.amberText} />
            )}
          </Pressable>

          <View style={styles.info}>
            <View style={[styles.nameLine, compact && styles.nameLineCompact]}>
              <Pressable style={styles.nameRow} onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel={`${babyName} 아기 프로필 열기`}>
                <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>{babyName}</Text>
              </Pressable>
              <View style={styles.switchWrap}><BabySwitcher variant="switchButton" /></View>
            </View>
            <Text style={styles.age} maxFontSizeMultiplier={fontScaleCap.chrome}>{ageLabel}</Text>
            {isShared ? (
              <View style={styles.sharedMeta}>
                <BabyLogIcon kind="profile" size={14} color={colors.amberText} strokeWidth={2.1} />
                <Text style={styles.sharedText} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>공유 중</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.actions}>
          {onOpenNotifications ? <NotificationBellButton onPress={onOpenNotifications} /> : null}
          {onOpenSettings ? <Pressable style={styles.settingsBtn} onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="설정 열기"><BabyLogIcon kind="settings" size={18} color={colors.muted} /></Pressable> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 8 },
  wrapEmbedded: { paddingHorizontal: 0 },
  wrapCompact: { paddingBottom: 2 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "transparent",
  },
  cardCompact: { minHeight: 64, paddingVertical: 4 },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#4A3428",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  avatarCompact: { width: 40, height: 40, borderRadius: 20 },
  info: { flex: 1, minWidth: 0, justifyContent: "center" },
  nameLine: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  nameLineCompact: { flexDirection: "column", alignItems: "flex-start", gap: 4 },
  nameRow: { minWidth: 0, flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontSize: type.lg, fontWeight: "900", color: colors.text, letterSpacing: -0.4 },
  age: { marginTop: 2, fontSize: type.sm, color: colors.text, fontWeight: "800", flexShrink: 0 },
  sharedMeta: { minWidth: 0, marginTop: 2, flexDirection: "row", alignItems: "center", gap: 4 },
  sharedText: { flexShrink: 1, color: colors.muted, fontSize: type.xs, fontWeight: "700" },
  switchWrap: { flexShrink: 0, alignItems: "flex-end" },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
});
