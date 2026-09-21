import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { BabySwitcher } from "../babylog/BabySwitcher";
import { ProfileAvatar } from "../profile/ProfileAvatar";
import { useApp } from "../../context/AppContext";
import { useBabyLog } from "../../context/BabyLogContext";
import { useLanguage } from "../../LanguageContext";
import type { RootStackParamList } from "../../navigation/types";
import { FriendRepository } from "../../repositories/DarinFriendRepository";
import { AuthRepository } from "../../repositories/AuthRepository";
import { ProfileRepository } from "../../repositories/ProfileRepository";
import { colors, fontScaleCap } from "../../theme";
import { readProfileBio } from "../../utils/profileBioStore";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

type Props = {
  postCount: number;
  scopeAccountId: string;
};

function formatHandle(darinId?: string | null): string | undefined {
  const value = darinId?.trim();
  if (!value) return undefined;
  return value.startsWith("@") ? value : `@${value}`;
}

export function MemoryIdentityHeader({ postCount, scopeAccountId }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();
  const { careSetup } = useApp();
  const { familyMembers, babies, activeBabyId } = useBabyLog();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState<string | undefined>();
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [customBio, setCustomBio] = useState("");
  const familyCount = useMemo(
    () => familyMembers.filter((member) => member.status === "active" && !member.isMe).length,
    [familyMembers],
  );
  const bio = customBio.trim();

  useFocusEffect(useCallback(() => {
    let active = true;
    setName("");
    setHandle(undefined);
    setAvatarUrl(undefined);
    setCustomBio("");
    setFriendCount(null);
    void AuthRepository.getUser().then(async (user) => {
      if (!active || user?.id !== scopeAccountId) return;
      const [bioValue, profile] = await Promise.all([
        readProfileBio(scopeAccountId).catch(() => ""),
        ProfileRepository.getMyProfile().catch(() => null),
      ]);
      if (!active) return;
      setCustomBio(bioValue);
      if (!profile) return;
      setName(profile.display_name || careSetup.parent.parentName);
      setHandle(formatHandle(profile.darin_id));
      const nextAvatar = profile.avatar_storage_path
        ? await ProfileRepository.createProfileAvatarSignedUrl(profile.avatar_storage_path).catch(() => profile.avatar_url)
        : profile.avatar_url;
      if (active) setAvatarUrl(nextAvatar ?? undefined);
    }).catch(() => undefined);

    const babyId = activeBabyId;
    if (!babyId) {
      setFriendCount(null);
      return () => {
        active = false;
      };
    }
    void FriendRepository.listFriendsByBabyId(babyId)
      .then((friends) => {
        if (active) setFriendCount(friends.filter((friend) => friend.status === "active").length);
      })
      .catch(() => {
        if (active) setFriendCount(null);
      });
    return () => {
      active = false;
    };
  }, [activeBabyId, careSetup.parent.parentName, scopeAccountId]));

  const openMyProfile = () => navigation.navigate("MyProfile");
  const openFamily = () => navigation.navigate("FamilyShare", { tab: "people", peopleFilter: "family" });
  const openFriends = () => navigation.navigate("FamilyShare", { tab: "people", peopleFilter: "friend" });
  const openInvite = () => navigation.navigate("FamilyShare", { tab: "create" });

  return (
    <View style={styles.wrap}>
      <ProfileAvatar
        uri={avatarUrl}
        size={80}
        fallback="profile"
        onPress={openMyProfile}
        label={t("memory.critical.210")}
      />

      <View style={styles.copy}>
        <Pressable onPress={openMyProfile} accessibilityRole="button" accessibilityLabel={t("memory.critical.210")}>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>
            {name || t("memory.critical.210")}
          </Text>
          {handle ? (
            <Text style={styles.handle} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>
              {handle}
            </Text>
          ) : null}
          {bio ? (
            <Text style={styles.status} numberOfLines={2} maxFontSizeMultiplier={fontScaleCap.chrome}>
              {bio}
            </Text>
          ) : null}
        </Pressable>
        <View style={styles.together}>
          <BabySwitcher
            variant="togetherChip"
            togetherCopy={{
              countLabel: t("memory.critical.237", { count: babies.length }),
              title: t("memory.critical.225"),
              subtitle: t("memory.critical.238"),
            }}
          />
        </View>
        <View style={styles.stats}>
          <Stat
            value={familyCount}
            label={t("memory.critical.215")}
            accessibilityLabel={t("memory.critical.220", { count: familyCount })}
            onPress={openFamily}
          />
          <View style={styles.statDivider} />
          <Stat
            value={friendCount}
            label={t("memory.critical.216")}
            accessibilityLabel={friendCount === null
              ? t("memory.critical.216")
              : t("memory.critical.221", { count: friendCount })}
            onPress={openFriends}
          />
          <View style={styles.statDivider} />
          <Stat
            value={postCount}
            label={t("memory.critical.217")}
            accessibilityLabel={t("memory.critical.222", { count: postCount })}
          />
        </View>
      </View>

      <Pressable
        style={styles.find}
        onPress={openInvite}
        accessibilityRole="button"
        accessibilityLabel={t("memory.critical.218")}
      >
        <View style={styles.findCircle}>
          <BabyLogIcon kind="userPlus" size={22} color={colors.muted} strokeWidth={2} />
        </View>
        <Text style={styles.findLabel} maxFontSizeMultiplier={fontScaleCap.chrome}>
          {t("memory.critical.218")}
        </Text>
      </Pressable>
    </View>
  );
}

function Stat({
  value,
  label,
  accessibilityLabel,
  onPress,
}: {
  value: number | null;
  label: string;
  accessibilityLabel: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.stat}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.statValue} maxFontSizeMultiplier={fontScaleCap.chrome}>{value ?? "—"}</Text>
      <Text style={styles.statLabel} maxFontSizeMultiplier={fontScaleCap.chrome}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 14,
  },
  copy: { flex: 1, minWidth: 0, paddingTop: 2 },
  name: { color: colors.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  handle: { marginTop: 3, color: colors.muted, fontSize: 13, fontWeight: "600" },
  status: { marginTop: 3, color: colors.muted, fontSize: 13, fontWeight: "500" },
  together: { marginTop: 8, alignSelf: "flex-start" },
  stats: { marginTop: 14, flexDirection: "row", alignItems: "center" },
  stat: {
    minHeight: TOUCH_MIN,
    minWidth: 44,
    justifyContent: "center",
    paddingRight: 12,
  },
  statValue: { color: colors.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  statLabel: { marginTop: 2, color: colors.muted, fontSize: 12, fontWeight: "500" },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: colors.border,
    marginRight: 12,
  },
  find: {
    minWidth: TOUCH_MIN,
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 6,
    paddingBottom: 2,
  },
  findCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  findLabel: { color: colors.muted, fontSize: 11, fontWeight: "600" },
});
