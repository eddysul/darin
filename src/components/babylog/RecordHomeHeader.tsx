import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { ShieldCheck } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "./BabyLogIcon";
import { useApp } from "../../context/AppContext";
import { useBabyLog } from "../../context/BabyLogContext";
import { BabyProfileRepository } from "../../repositories/BabyProfileRepository";
import { colors } from "../../theme";
import { useAppSettings } from "../../context/AppSettingsContext";
import { formatWeight } from "../../utils/measurementFormat";
import { formatBabyAge } from "../../utils/childDisplay";
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
  const { babyName, babyBadge, babyBirthMeta, activeBabyId } = useBabyLog();
  const { settings } = useAppSettings();
  const dDay = babyBadge.match(/D\+\d+/)?.[0];
  const birthWeight = careSetup.child.birthWeight?.trim();
  const configuredAge = formatBabyAge(careSetup.child, settings.time.babyAge);
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
            <Pressable style={styles.nameRow} onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel={`${babyName} 아기 프로필 열기`}>
              <Text style={styles.name} numberOfLines={1}>{babyName}</Text>
              <ShieldCheck size={18} color={colors.amber} strokeWidth={2.2} />
            </Pressable>
            <View style={styles.sharedMeta}>
              <BabyLogIcon kind="profile" size={16} color={colors.amber} strokeWidth={2.1} />
              <Text style={styles.sharedText} numberOfLines={1}>나와 공유 중</Text>
            </View>
            <View style={styles.actionRow}>
              <Text style={styles.age} numberOfLines={1}>
                {dDay ?? configuredAge ?? babyBirthMeta}
                {birthWeight ? ` · ${formatWeight(birthWeight, settings.units.weight)}` : ""}
              </Text>
              <View style={styles.switchWrap}><BabySwitcher variant="switchButton" /></View>
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  card: {
    width: "70%",
    flexShrink: 1,
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "transparent",
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flexShrink: 1, fontSize: 21, fontWeight: "900", color: colors.text, letterSpacing: -0.4 },
  actionRow: { minWidth: 0, marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
  age: { flexShrink: 1, fontSize: 16, color: colors.text, fontWeight: "800" },
  sharedMeta: { minWidth: 0, marginTop: 3, flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  sharedText: { flexShrink: 1, color: colors.muted, fontSize: 13.5, fontWeight: "700" },
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
