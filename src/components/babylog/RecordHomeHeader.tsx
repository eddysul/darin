import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "./BabyLogIcon";
import { SharedCaregiversRow } from "./SharedCaregiversRow";
import { useApp } from "../../context/AppContext";
import { useBabyLog } from "../../context/BabyLogContext";
import { BabyProfileRepository } from "../../repositories/BabyProfileRepository";
import { colors } from "../../theme";
import { useAppSettings } from "../../context/AppSettingsContext";
import { formatWeight } from "../../utils/measurementFormat";
import { formatBabyAge } from "../../utils/childDisplay";
import { getSupabaseSync } from "../../utils/supabaseSyncStore";

type Props = {
  onOpenProfile: () => void;
  onOpenSettings?: () => void;
};

export function RecordHomeHeader({ onOpenProfile, onOpenSettings }: Props) {
  const insets = useSafeAreaInsets();
  const { careSetup, setCareSetup } = useApp();
  const careSetupRef = useRef(careSetup);
  careSetupRef.current = careSetup;
  const { babyName, babyBadge, babyBirthMeta } = useBabyLog();
  const { settings } = useAppSettings();
  const dDay = babyBadge.match(/D\+\d+/)?.[0];
  const birthWeight = careSetup.child.birthWeight?.trim();
  const configuredAge = formatBabyAge(careSetup.child, settings.time.babyAge);
  const [babyPhoto, setBabyPhoto] = useState(careSetup.child.photoUri);

  useFocusEffect(
    useCallback(() => {
      setBabyPhoto(careSetupRef.current.child.photoUri);
      const babyId = getSupabaseSync().babyId;
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
    }, [setCareSetup]),
  );

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.row}>
        <Pressable style={styles.avatarCircle} onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel="아기 프로필 열기">
          {babyPhoto ? (
            <Image source={{ uri: babyPhoto }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : (
            <BabyLogIcon kind="baby" size={26} color={colors.amber} />
          )}
        </Pressable>

        <Pressable style={styles.info} onPress={onOpenProfile} accessibilityRole="button">
          <View style={styles.nameRow}>
            <Text style={styles.name}>{careSetup.child.childName || babyName}</Text>
            {dDay ? <Text style={styles.dayBadge}>{dDay}</Text> : null}
          </View>
          <Text style={styles.age}>
            {configuredAge ?? babyBirthMeta}
            {birthWeight ? ` · ${formatWeight(birthWeight, settings.units.weight)}` : ""}
          </Text>
          <View style={styles.sharedWrap}>
            <SharedCaregiversRow onPress={onOpenProfile} size="sm" />
          </View>
        </Pressable>

        <Pressable
          style={styles.profileBtn}
          onPress={onOpenSettings ?? onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel={onOpenSettings ? "설정 열기" : "아기 프로필 열기"}
        >
          <BabyLogIcon kind={onOpenSettings ? "settings" : "profile"} size={18} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#4A3428",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 21, fontWeight: "800", color: colors.text, letterSpacing: -0.35 },
  dayBadge: { color: colors.amber, backgroundColor: colors.amberSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: "800", overflow: "hidden" },
  age: { fontSize: 13, color: colors.muted, marginTop: 2, fontWeight: "500" },
  sharedWrap: { marginTop: 8 },
  profileBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
