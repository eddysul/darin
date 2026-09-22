import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MyBabiesSection } from "../components/profile/MyBabiesSection";
import { MyMomentsSection } from "../components/profile/MyMomentsSection";
import { MyProfileEditForm } from "../components/profile/MyProfileEditForm";
import { ProfileHeader } from "../components/profile/ProfileHeader";
import { ProfileQuoteCard } from "../components/profile/ProfileQuoteCard";
import { ProfileStatsCard } from "../components/profile/ProfileStatsCard";
import { ProfileSummarySection } from "../components/profile/ProfileSummarySection";
import { ErrorBanner } from "../components/states/FeedbackStates";
import { useApp } from "../context/AppContext";
import { useBabyLog } from "../context/BabyLogContext";
import { useLanguage } from "../LanguageContext";
import type { RootStackParamList } from "../navigation/types";
import { AuthRepository } from "../repositories/AuthRepository";
import { BabyProfileRepository } from "../repositories/BabyProfileRepository";
import { FriendRepository } from "../repositories/DarinFriendRepository";
import { FamilyRepository } from "../repositories/FamilyRepository";
import { MemoriesRepository } from "../repositories/MemoriesRepository";
import { ProfileRepository } from "../repositories/ProfileRepository";
import type { BabyRow } from "../types/database";
import type { FamilyRole } from "../types/family";
import type { MemoryMomentPreview } from "../types/memory";
import type { MyProfileBabyItem, MyProfileStatKey } from "../types/myProfileShowcase";
import { PROFILE_RELATION_OPTIONS } from "../types/profileSettings";
import type { RelationshipLabel } from "../types/growthBook";
import { colors } from "../theme";
import { isPregnancyStage } from "../utils/childDisplay";
import { localizedErrorMessage } from "../utils/familyDisplay";
import { presentAvatarPicker } from "../utils/profileAvatarPicker";
import { readProfileBio } from "../utils/profileBioStore";
import { permissionToFamilyRole } from "../utils/supabaseMappers";
import type { MessageKey } from "../i18n";
import { useScreenLoadTrace } from "../hooks/useScreenLoadTrace";

type Props = NativeStackScreenProps<RootStackParamList, "MyProfile">;

function formatHandle(darinId?: string | null): string | undefined {
  const value = darinId?.trim();
  if (!value) return undefined;
  return value.startsWith("@") ? value : `@${value}`;
}

function babyCardAge(
  baby: Pick<BabyRow, "birth_date" | "child_status">,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
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

function displayFamilyRole(role: FamilyRole): FamilyRole {
  return role === "owner" ? "admin" : role;
}

function roleForBaby(
  baby: BabyRow,
  meId: string | undefined,
  permissionRole: FamilyRole | undefined,
  activeBabyId: string | null,
  myFamilyRole: FamilyRole,
): FamilyRole {
  if (permissionRole) return displayFamilyRole(permissionRole);
  if (baby.id === activeBabyId) return displayFamilyRole(myFamilyRole);
  if (baby.created_by && meId && baby.created_by === meId) return "admin";
  return "editor";
}

export function MyProfileScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const editing = Boolean(route.params?.edit);
  const { careSetup, setCareSetup } = useApp();
  const { babies, activeBabyId, myFamilyRole, switchActiveBaby, applyMyProfileUpdate } = useBabyLog();
  const { t } = useLanguage();
  const [name, setName] = useState(careSetup.parent.parentName);
  const [handle, setHandle] = useState<string | undefined>();
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(careSetup.parent.avatarUri);
  const [relation, setRelation] = useState<RelationshipLabel>(PROFILE_RELATION_OPTIONS[0]);
  const [realName, setRealName] = useState(careSetup.parent.nickname ?? "");
  const [familyCount, setFamilyCount] = useState<number | null>(null);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [babyItems, setBabyItems] = useState<MyProfileBabyItem[]>([]);
  const [moments, setMoments] = useState<MemoryMomentPreview[]>([]);
  const [customBio, setCustomBio] = useState("");
  const [statsLoading, setStatsLoading] = useState(true);
  const [babiesLoading, setBabiesLoading] = useState(true);
  const [momentsLoading, setMomentsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const loadRunRef = useRef(0);

  useScreenLoadTrace("MyProfile", activeBabyId, {
    firstContent: !babiesLoading,
    coreReady: !babiesLoading && !statsLoading,
    fullReady: !babiesLoading && !statsLoading && !momentsLoading,
  });

  const bio = useMemo(() => {
    if (customBio.trim()) return customBio.trim();
    const names = babyItems.map((baby) => baby.name).filter(Boolean);
    if (!names.length) return t("memory.critical.219");
    return t("memory.critical.224", { names: names.join(" · ") });
  }, [babyItems, customBio, t]);

  const load = useCallback(async () => {
    const loadRun = ++loadRunRef.current;
    setError("");
    setFamilyCount(null);
    setFriendCount(null);
    setStatsLoading(true);
    setBabiesLoading(true);
    setMomentsLoading(true);

    const userPromise = AuthRepository.getUser();
    const profilePromise = ProfileRepository.getMyProfile();
    const momentsPromise = MemoriesRepository.listRecentAuthoredPreviews(3, babies.map((baby) => baby.id));

    // The list itself is already account-scoped by BabyLogContext. Render it
    // immediately; relationship/profile enrichment can arrive independently.
    setBabyItems(babies.map((baby) => ({
      id: baby.id,
      name: baby.name,
      ageLabel: babyCardAge(baby, t),
      role: roleForBaby(baby, undefined, undefined, activeBabyId, myFamilyRole),
      avatarUrl: baby.photo_url ?? undefined,
    } satisfies MyProfileBabyItem)));
    setBabiesLoading(false);

    let user: Awaited<ReturnType<typeof AuthRepository.getUser>> = null;
    try {
      user = await userPromise;
    } catch (cause) {
      if (loadRun === loadRunRef.current) {
        setError(cause instanceof Error ? localizedErrorMessage(t, cause.message) : t("settings.critical.003"));
      }
    }
    if (loadRun !== loadRunRef.current) return;
    const meId = user?.id;

    const baseBabies = babies.map((baby) => ({
      id: baby.id,
      name: baby.name,
      ageLabel: babyCardAge(baby, t),
      role: roleForBaby(baby, meId, undefined, activeBabyId, myFamilyRole),
      avatarUrl: baby.photo_url ?? undefined,
    } satisfies MyProfileBabyItem));
    setBabyItems(baseBabies);

    const bioTask = (async () => {
      if (!meId) return;
      try {
        const nextBio = await readProfileBio(meId);
        if (loadRun === loadRunRef.current) setCustomBio(nextBio);
      } catch {
        // Keep the previous scoped bio instead of replacing it with an empty value.
      }
    })();

    const profileTask = (async () => {
      try {
        const profile = await profilePromise;
        if (loadRun !== loadRunRef.current) return;
        if (!profile) {
          setName(careSetup.parent.parentName);
          setHandle(undefined);
          setAvatarUrl(careSetup.parent.avatarUri);
          return;
        }
        setName(profile.display_name || careSetup.parent.parentName);
        setHandle(formatHandle(profile.darin_id));
        setRealName(profile.nickname ?? careSetup.parent.nickname ?? "");
        if (profile.default_relation) setRelation(profile.default_relation as RelationshipLabel);
        const fallbackAvatar = profile.avatar_url ?? careSetup.parent.avatarUri;
        setAvatarUrl(fallbackAvatar);
        if (profile.avatar_storage_path) {
          void ProfileRepository.createProfileAvatarSignedUrl(profile.avatar_storage_path)
            .then((signed) => {
              if (loadRun === loadRunRef.current) setAvatarUrl(signed);
            })
            .catch(() => undefined);
        }
      } catch (cause) {
        if (loadRun === loadRunRef.current) {
          setError(cause instanceof Error ? localizedErrorMessage(t, cause.message) : t("settings.critical.003"));
        }
      }
    })();

    const momentsTask = (async () => {
      try {
        const recentMoments = await momentsPromise;
        if (loadRun === loadRunRef.current) setMoments(recentMoments);
      } catch {
        if (loadRun === loadRunRef.current) setError(t("settings.critical.003"));
      } finally {
        if (loadRun === loadRunRef.current) setMomentsLoading(false);
      }
    })();

    const familyIds = new Set<string>();
    const friendIds = new Set<string>();
    let statsComplete = Boolean(meId);
    const memberGroupsPromise = FamilyRepository.listMembersForBabyIds(babies.map((baby) => baby.id));
    const friendRequests = new Map(babies.map((baby) => [
      baby.id,
      FriendRepository.listFriendsByBabyId(baby.id).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      ),
    ]));
    const memberGroupsResult = await Promise.allSettled([memberGroupsPromise]);
    const memberGroups = memberGroupsResult[0]?.status === "fulfilled"
      ? memberGroupsResult[0].value
      : null;
    if (!memberGroups) statsComplete = false;
    const babyTasks = babies.map(async (baby) => {
      const friendsResult = await friendRequests.get(baby.id)!;
      if (loadRun !== loadRunRef.current) return;
      if (friendsResult.status === "rejected") {
        statsComplete = false;
      }
      const members = memberGroups?.get(baby.id) ?? [];
      const friends = friendsResult.status === "fulfilled" ? friendsResult.value : [];
      members.forEach((member) => {
        if (member.status === "active" && member.user_id !== meId) familyIds.add(member.user_id);
      });
      friends.forEach((friend) => {
        if (friend.status === "active") friendIds.add(friend.userId);
      });
      const mine = members.find((member) => member.user_id === meId);
      setBabyItems((current) => current.map((item) => item.id === baby.id ? {
        ...item,
        role: roleForBaby(
          baby,
          meId,
          mine ? permissionToFamilyRole(mine.permission_role) : undefined,
          activeBabyId,
          myFamilyRole,
        ),
        avatarUrl: baby.photo_url ?? undefined,
      } : item));
      if (baby.avatar_storage_path) {
        void BabyProfileRepository.createBabyAvatarSignedUrl(baby.avatar_storage_path)
          .then((signed) => {
            if (loadRun !== loadRunRef.current) return;
            setBabyItems((current) => current.map((item) => item.id === baby.id
              ? { ...item, avatarUrl: signed }
              : item));
          })
          .catch(() => undefined);
      }
    });

    await Promise.all([bioTask, profileTask, momentsTask, ...babyTasks]);
    if (loadRun !== loadRunRef.current) return;
    setFamilyCount(statsComplete ? familyIds.size : null);
    setFriendCount(statsComplete ? friendIds.size : null);
    setStatsLoading(false);
    if (!statsComplete) setError(t("settings.critical.003"));
  }, [activeBabyId, babies, careSetup.parent.avatarUri, careSetup.parent.nickname, careSetup.parent.parentName, myFamilyRole, t]);

  useFocusEffect(useCallback(() => {
    if (editing) return;
    void load();
  }, [editing, load]));

  const openEdit = () => navigation.setParams({ edit: true });
  const closeEdit = () => navigation.setParams({ edit: undefined });

  const pickAvatar = () => {
    presentAvatarPicker({
      hasAvatar: Boolean(avatarUrl),
      t,
      onPick: (avatar) => {
        setSaving(true);
        setError("");
        void ProfileRepository.uploadMyAvatar(avatar)
          .then((next) => {
            setAvatarUrl(next.avatarUrl);
            const nextSetup = {
              ...careSetup,
              parent: { ...careSetup.parent, avatarUri: next.avatarUrl, parentName: next.displayName },
            };
            setCareSetup(nextSetup);
            applyMyProfileUpdate({
              userId: next.userId,
              babyId: activeBabyId,
              displayName: next.displayName,
              realName: next.nickname,
              avatarUrl: next.avatarUrl,
              relationshipLabel: relation,
            });
          })
          .catch((cause) => setError(cause instanceof Error ? localizedErrorMessage(t, cause.message) : t("settings.critical.007")))
          .finally(() => setSaving(false));
      },
      onClear: () => {
        setSaving(true);
        void ProfileRepository.updateMyProfile({
          displayName: name.trim() || careSetup.parent.parentName || t("settings.critical.008"),
          nickname: realName,
          defaultRelation: relation,
          clearAvatar: true,
        })
          .then((next) => {
            setAvatarUrl(undefined);
            setCareSetup({
              ...careSetup,
              parent: { ...careSetup.parent, avatarUri: undefined, parentName: next.displayName },
            });
            applyMyProfileUpdate({
              userId: next.userId,
              babyId: activeBabyId,
              displayName: next.displayName,
              realName: next.nickname,
              avatarUrl: undefined,
              relationshipLabel: relation,
            });
          })
          .catch((cause) => setError(cause instanceof Error ? localizedErrorMessage(t, cause.message) : t("settings.critical.006")))
          .finally(() => setSaving(false));
      },
    });
  };

  const openFamily = (filter: "family" | "friend") => {
    navigation.navigate("FamilyShare", { tab: "people", peopleFilter: filter });
  };

  const openBabyManage = () => {
    navigation.navigate("BabyProfile", { mode: babies.length ? undefined : "create" });
  };

  const openBaby = async (babyId: string) => {
    if (babyId !== activeBabyId) {
      const switched = await switchActiveBaby(babyId).catch(() => false);
      if (!switched) return;
    }
    navigation.navigate("BabyProfile", { mode: undefined });
  };

  const openMemories = () => {
    navigation.navigate("MainTabs", { screen: "Memories" });
  };

  const onPressStat = (key: MyProfileStatKey) => {
    if (key === "baby") {
      openBabyManage();
      return;
    }
    openFamily(key);
  };

  const openMore = () => {
    const editLabel = t("memory.critical.223");
    const settingsLabel = t("chrome.critical.035");
    const familyLabel = t("memory.critical.211");
    const cancelLabel = t("common.cancel");
    const run = (index: number) => {
      if (index === 0) openEdit();
      if (index === 1) navigation.navigate("SettingsHome");
      if (index === 2) navigation.navigate("FamilyShare", { tab: "people" });
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [editLabel, settingsLabel, familyLabel, cancelLabel],
          cancelButtonIndex: 3,
        },
        (index) => {
          if (typeof index === "number") run(index);
        },
      );
      return;
    }
    Alert.alert(t("memory.critical.236"), undefined, [
      { text: editLabel, onPress: () => run(0) },
      { text: settingsLabel, onPress: () => run(1) },
      { text: cancelLabel, style: "cancel" },
    ]);
  };

  if (editing) {
    return <MyProfileEditForm onClose={closeEdit} />;
  }

  return (
    <View style={styles.root}>
      <ProfileHeader
        title={t("babyProfile.myProfile")}
        onBack={() => navigation.goBack()}
        onMore={openMore}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.banner}>
            <ErrorBanner message={error} />
          </View>
        ) : null}
        <ProfileSummarySection
          name={name || careSetup.parent.parentName}
          handle={handle}
          bio={bio}
          avatarUrl={avatarUrl}
          saving={saving}
          onChangePhoto={pickAvatar}
          onEditProfile={openEdit}
        />
        <ProfileStatsCard
          babyCount={babies.length}
          familyCount={familyCount}
          friendCount={friendCount}
          loading={statsLoading}
          onPressStat={onPressStat}
        />
        <MyBabiesSection
          babies={babyItems}
          loading={babiesLoading}
          onPressManage={openBabyManage}
          onPressBaby={(babyId) => { void openBaby(babyId); }}
        />
        <MyMomentsSection
          moments={moments}
          loading={momentsLoading}
          onPressSeeAll={openMemories}
          onPressMoment={(memoryPostId) => navigation.navigate("MemoryDetail", { memoryPostId })}
        />
        <ProfileQuoteCard />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 8, gap: 22 },
  banner: { paddingHorizontal: 20 },
});
