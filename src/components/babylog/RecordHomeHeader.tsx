import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "./BabyLogIcon";
import { useApp } from "../../context/AppContext";
import { useBabyLog } from "../../context/BabyLogContext";
import { BabyProfileRepository } from "../../repositories/BabyProfileRepository";
import { colors } from "../../theme";
import { formatRecordHeaderAge } from "../../utils/childDisplay";
import { BabySwitcher } from "./BabySwitcher";

type Props = {
  onOpenProfile: () => void;
  onOpenSettings?: () => void;
  embedded?: boolean;
};

export function RecordHomeHeader({ onOpenProfile, onOpenSettings, embedded = false }: Props) {
  const insets = useSafeAreaInsets();
  const { careSetup, setCareSetup } = useApp();
  const careSetupRef = useRef(careSetup);
  careSetupRef.current = careSetup;
  const { babyName, babyBirthMeta, activeBabyId } = useBabyLog();
  const ageLabel = formatRecordHeaderAge(careSetup.child) ?? babyBirthMeta;
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
    <View style={[styles.wrap, embedded && styles.wrapEmbedded, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.headerRow}>
        <View style={styles.card}>
          <Pressable style={styles.avatarCircle} onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel="아기 프로필 열기">
            {babyPhoto ? (
              <Image source={{ uri: babyPhoto }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            ) : (
              <BabyLogIcon kind="baby" size={27} color={colors.amber} />
            )}
          </Pressable>

          <View style={styles.info}>
            <View style={styles.nameLine}>
              <Pressable style={styles.nameRow} onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel={`${babyName} 아기 프로필 열기`}>
                <Text style={styles.name} numberOfLines={1}>{babyName}</Text>
              </Pressable>
              <View style={styles.switchWrap}><BabySwitcher variant="switchButton" /></View>
            </View>
            <Text style={styles.age} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{ageLabel}</Text>
            <View style={styles.sharedMeta}>
              <BabyLogIcon kind="profile" size={14} color={colors.amber} strokeWidth={2.1} />
              <Text style={styles.sharedText} numberOfLines={1}>공유 중</Text>
            </View>
          </View>
        </View>
        {onOpenSettings ? <Pressable style={styles.settingsBtn} onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="설정 열기"><BabyLogIcon kind="settings" size={18} color={colors.muted} /></Pressable> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 18 },
  wrapEmbedded: { paddingHorizontal: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 13,
    backgroundColor: "transparent",
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  info: { flex: 1, minWidth: 0, justifyContent: "center" },
  nameLine: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  nameRow: { minWidth: 0, flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontSize: 20, fontWeight: "900", color: colors.text, letterSpacing: -0.4 },
  age: { marginTop: 2, fontSize: 15, color: colors.text, fontWeight: "800" },
  sharedMeta: { minWidth: 0, marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  sharedText: { flexShrink: 1, color: colors.muted, fontSize: 12, fontWeight: "700" },
  switchWrap: { flexShrink: 0, alignItems: "flex-end" },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
