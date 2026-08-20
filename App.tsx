import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PARENT_PROFILE, useApp } from "./src/context/AppContext";
import { NavigationContainer, createNavigationContainerRef, type LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "./src/context/AppContext";
import { AppSettingsProvider } from "./src/context/AppSettingsContext";
import { useAppSettings } from "./src/context/AppSettingsContext";
import { BabyLogProvider, useBabyLog } from "./src/context/BabyLogContext";
import { LogoutProvider } from "./src/context/LogoutContext";
import { VoiceRecordingProvider } from "./src/context/VoiceRecordingContext";
import { LanguageProvider, useLanguage } from "./src/LanguageContext";
import { AuthStartScreen } from "./src/screens/onboarding/AuthStartScreen";
import { OnboardingFlow, type OnboardingResult } from "./src/screens/onboarding/OnboardingFlow";
import {
  ProfileSetupScreen,
  type ProfileSetupInitial,
} from "./src/screens/onboarding/ProfileSetupScreen";
import { TermsConsentScreen } from "./src/screens/onboarding/TermsConsentScreen";
import { MainTabs } from "./src/screens/MainTabs";
import { BabyProfileScreen } from "./src/screens/BabyProfileScreen";
import { ConsultScreen } from "./src/screens/tabs/ConsultScreen";
import { FamilyShareScreen } from "./src/screens/FamilyShareScreen";
import { GrowthRecordsManagerScreen } from "./src/screens/GrowthRecordsManagerScreen";
import { MemoryDetailScreen } from "./src/screens/MemoryDetailScreen";
import { MyProfileScreen } from "./src/screens/MyProfileScreen";
import { SettingsHomeScreen } from "./src/screens/SettingsHomeScreen";
import { NotificationCenterScreen } from "./src/screens/NotificationCenterScreen";
import { AppSettingsModal, SETTINGS_PAGE_TITLES } from "./src/components/settings/AppSettingsModal";
import type { RootStackParamList } from "./src/navigation/types";
import { SplashScreen } from "./src/screens/SplashScreen";
import {
  DEFAULT_CARE_SETUP,
  type CareSetup,
  type ChildGender,
  type ChildStatus,
  type RelationshipToChild,
} from "./src/types/careSetup";
import type { UserProfile } from "./src/types/profile";
import type { BabyRow } from "./src/types/database";
import type { RelationshipLabel } from "./src/types/growthBook";
import { RELATIONSHIP_LABELS } from "./src/types/growthBook";
import {
  isAppLanguagePreference,
  isResidenceCountry,
  resolveAppLocale,
} from "./src/types/profilePreferences";
import { WebAppShell } from "./src/components/WebAppShell";
import { colors } from "./src/theme";
import { resolvePostSplashPhase } from "./src/utils/appStartup";
import { isBabyProfileComplete, isUserProfileComplete, resolveAuthenticatedRoute } from "./src/utils/profileCompletion";
import { getSupabaseSync, hydrateSupabaseSync } from "./src/utils/supabaseSyncStore";
import {
  clearPendingInvite,
  hydratePendingInvite,
  parseInviteCodeFromUrl,
  savePendingInvite,
} from "./src/utils/pendingInviteStore";
import { AuthRepository } from "./src/repositories/AuthRepository";
import { DarinIdentityRepository, generateDarinTag } from "./src/repositories/DarinIdentityRepository";
import { BabyRepository } from "./src/repositories/BabyRepository";
import { FamilyRepository } from "./src/repositories/FamilyRepository";
import { BabyProfileRepository } from "./src/repositories/BabyProfileRepository";
import { ProfileRepository } from "./src/repositories/ProfileRepository";
import { NotificationRepository } from "./src/repositories/NotificationRepository";
import {
  getTermsAccepted,
  hydrateTermsAccepted,
  saveMarketingConsent,
  saveTermsAccepted,
} from "./src/utils/termsStore";
import { registerCurrentPushToken, unregisterCurrentPushToken } from "./src/utils/pushNotifications";

type AppPhase =
  | "splash"
  | "terms"
  | "auth"
  | "profileSetup"
  | "setup"
  | "main";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function relationshipLabel(value?: string | null): RelationshipLabel | undefined {
  return RELATIONSHIP_LABELS.includes(value as RelationshipLabel)
    ? (value as RelationshipLabel)
    : undefined;
}

function relationshipToCareValue(value?: string | null): RelationshipToChild {
  if (value === "엄마") return "mom";
  if (value === "아빠") return "dad";
  if (value === "시터") return "sitter";
  if (["가족", "할머니", "할아버지", "이모", "삼촌"].includes(value ?? "")) return "family";
  return "guardian";
}

function authProfileName(user: Awaited<ReturnType<typeof AuthRepository.getUser>>, supplied?: string): string {
  const metadata = user?.user_metadata;
  const candidate = supplied?.trim()
    || [metadata?.display_name, metadata?.full_name, metadata?.name, metadata?.nickname]
      .find((value) => typeof value === "string" && value.trim())?.trim()
    || "";
  if (!candidate || candidate.includes("@") || candidate === user?.email) return "";
  return candidate;
}

function normalizedChildStatus(value: string): ChildStatus {
  return ["unborn", "newborn", "infant"].includes(value) ? value as ChildStatus : "newborn";
}

function onboardingChildFromBaby(baby: BabyRow): Partial<CareSetup["child"]> {
  const gender = ["girl", "boy", "unknown"].includes(baby.gender ?? "")
    ? baby.gender as ChildGender
    : "unknown";
  return {
    childName: baby.name,
    nickname: baby.nickname ?? undefined,
    birthDate: baby.birth_date ?? undefined,
    dueDate: baby.due_date ?? undefined,
    childStatus: normalizedChildStatus(baby.child_status),
    gender,
    photoUri: baby.photo_url ?? undefined,
    gestationalAgeWeeks: baby.gestational_age_weeks ?? undefined,
    birthWeight: baby.birth_weight ?? undefined,
    specialNotes: baby.special_notes ?? undefined,
  };
}

export default function App() {
  return (
    <SafeAreaProvider>
      <WebAppShell>
        <LanguageProvider>
          <AppSettingsProvider>
            <AppProvider>
              <BabyLogProvider>
                <VoiceRecordingProvider>
                  <RootApp />
                </VoiceRecordingProvider>
              </BabyLogProvider>
            </AppProvider>
          </AppSettingsProvider>
        </LanguageProvider>
      </WebAppShell>
    </SafeAreaProvider>
  );
}

function MainNavigator({ onboardingProfile }: { onboardingProfile: UserProfile | null }) {
  const { setProfile } = useApp();
  const { localDataScope } = useBabyLog();
  const pendingNotificationRoute = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (onboardingProfile) setProfile(onboardingProfile);
  }, [onboardingProfile, setProfile]);

  useEffect(() => {
    if (!localDataScope?.userId) return;
    void registerCurrentPushToken();
  }, [localDataScope?.userId]);

  const openNotificationRoute = useCallback((data: Record<string, unknown>) => {
    if (!navigationRef.isReady()) {
      pendingNotificationRoute.current = data;
      return;
    }
    pendingNotificationRoute.current = null;
    if (typeof data.eventId === "string") {
      void NotificationRepository.markInAppEventRead(data.eventId).catch(() => undefined);
    }
    if (data.route === "memory" && typeof data.memoryPostId === "string") {
      navigationRef.navigate("MemoryDetail", { memoryPostId: data.memoryPostId });
      return;
    }
    if (data.route === "growth_book") {
      navigationRef.navigate("MainTabs", { screen: "Diary", params: { openGrowthBookVault: true } });
      return;
    }
    if (data.route === "family") {
      navigationRef.navigate("FamilyShare", { tab: "people" });
      return;
    }
    if (data.route === "report") {
      navigationRef.navigate("MainTabs", { screen: "Report" });
      return;
    }
    if (data.route === "settings") {
      navigationRef.navigate("SettingsDetail", { page: "careAlerts" });
      return;
    }
    if (data.route === "record") {
      navigationRef.navigate("MainTabs", {
        screen: "Record",
        params: typeof data.logId === "string" ? { logId: data.logId } : undefined,
      });
      return;
    }
    if (data.route !== "diary") {
      navigationRef.navigate("NotificationCenter");
      return;
    }
    navigationRef.navigate("MainTabs", {
      screen: "Diary",
      params: typeof data.diaryEntryId === "string"
        ? { diaryEntryId: data.diaryEntryId, source: "notification" }
        : {
            openCompose: Boolean(data.openCompose),
            source: "notification",
            date: typeof data.date === "string" ? data.date : undefined,
          },
    });
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotificationRoute(response.notification.request.content.data as Record<string, unknown>);
    });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openNotificationRoute(response.notification.request.content.data as Record<string, unknown>);
    });
    return () => subscription.remove();
  }, [openNotificationRoute]);

  const linking: LinkingOptions<RootStackParamList> = {
    prefixes: ["knanny://", "exp://"],
    config: {
      screens: {
        MainTabs: {
          screens: {
            Diary: {
              path: "diary/compose",
              parse: {
                date: (value: string) => value,
                source: (value: string) => value,
                openCompose: (value: string) => value === "1" || value === "true",
              },
            },
            Record: "record",
            Report: "report",
            Memories: "memories",
            Mic: "mic",
          },
        },
        Consult: "consult",
      },
    },
  };

  return (
    <NavigationContainer
      linking={linking}
      ref={navigationRef}
      onReady={() => {
        const pending = pendingNotificationRoute.current;
        if (pending) openNotificationRoute(pending);
      }}
    >
      <RootStack.Navigator
        screenOptions={{
          headerTitleAlign: "center",
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.card },
          headerShadowVisible: true,
          headerBackButtonDisplayMode: "minimal",
          gestureEnabled: true,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <RootStack.Screen name="Consult" component={ConsultScreen} options={{ headerShown: false }} />
        <RootStack.Screen name="BabyProfile" component={BabyProfileScreen} options={{ title: "아기 프로필" }} />
        <RootStack.Screen name="FamilyShare" component={FamilyShareScreen} options={{ title: "가족·친구 초대" }} />
        <RootStack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: "내 프로필" }} />
        <RootStack.Screen name="SettingsHome" component={SettingsHomeScreen} options={{ title: "설정" }} />
        <RootStack.Screen name="NotificationCenter" component={NotificationCenterScreen} options={{ title: "알림" }} />
        <RootStack.Screen
          name="SettingsDetail"
          options={({ route }) => ({ title: SETTINGS_PAGE_TITLES[route.params.page] })}
        >
          {({ route, navigation }) => (
            <AppSettingsModal
              page={route.params.page}
              embedded
              onClose={() => navigation.goBack()}
            />
          )}
        </RootStack.Screen>
        <RootStack.Screen name="GrowthRecords" component={GrowthRecordsManagerScreen} options={{ title: "성장 기록 관리" }} />
        <RootStack.Screen name="MemoryDetail" component={MemoryDetailScreen} options={{ title: "추억" }} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

function RootApp() {
  const { careSetup, careSetupReady, hasSavedCareSetup, setProfile, setCareSetup, resetCareSetup, clearSession } =
    useApp();
  const { applyOwnerFromSetup, prepareForLogout, rehydrateFromServer } = useBabyLog();
  const { setLocale } = useLanguage();
  const { setSettings } = useAppSettings();
  const [phase, setPhase] = useState<AppPhase>("splash");
  const [onboardingProfile, setOnboardingProfile] = useState<UserProfile | null>(null);
  const [splashFinished, setSplashFinished] = useState(false);
  const [termsReady, setTermsReady] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [hasAuthSession, setHasAuthSession] = useState(false);
  const [authRecovery, setAuthRecovery] = useState(false);
  const [onboardingVersion, setOnboardingVersion] = useState(0);
  const [profileSetupInitial, setProfileSetupInitial] = useState<ProfileSetupInitial>({});
  const [onboardingRelation, setOnboardingRelation] = useState<RelationshipLabel | undefined>();
  const [onboardingInviteCode, setOnboardingInviteCode] = useState("");
  const [onboardingStartsWithBaby, setOnboardingStartsWithBaby] = useState(false);
  const [onboardingInitialChild, setOnboardingInitialChild] = useState<Partial<CareSetup["child"]>>();
  const [onboardingExistingBabyId, setOnboardingExistingBabyId] = useState<string | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [startupRoutingBusy, setStartupRoutingBusy] = useState(false);
  const startupRouting = useRef(false);
  const phaseRef = useRef<AppPhase>("splash");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    void hydrateTermsAccepted().then(() => {
      setTermsAccepted(getTermsAccepted());
      setTermsReady(true);
    });
  }, []);

  useEffect(() => {
    let active = true;
    void AuthRepository.getSession()
      .then((session) => {
        if (active) setHasAuthSession(Boolean(session));
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    const handleUrl = async (url: string) => {
      try {
        const inviteCode = parseInviteCodeFromUrl(url);
        if (inviteCode) {
          await savePendingInvite(inviteCode);
          if (phaseRef.current === "main") {
            setOnboardingInviteCode(inviteCode);
            setOnboardingInitialChild(undefined);
            setOnboardingExistingBabyId(null);
            setOnboardingStartsWithBaby(false);
            setOnboardingVersion((value) => value + 1);
            setPhase("setup");
          }
          return;
        }
        const result = await AuthRepository.handleAuthUrl(url);
        if (!result) return;
        if (result.status === "cancelled") return;
        if (result.status === "error") {
          Alert.alert("인증을 완료하지 못했어요", "로그인을 다시 시도해주세요.");
          return;
        }
        setHasAuthSession(true);
        if (result.mode === "recovery") {
          setAuthRecovery(true);
          setPhase("auth");
        }
      } catch (error) {
        if (__DEV__) console.warn("[Auth] Callback handling crashed", error);
        Alert.alert("인증 링크를 열지 못했어요", "링크를 다시 요청해주세요.");
      }
    };
    void Linking.getInitialURL().then((url) => {
      if (url) return handleUrl(url);
    });
    const subscription = Linking.addEventListener("url", ({ url }) => void handleUrl(url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const applyParentSetup = useCallback(
    (setup: CareSetup) => {
      setLocale(setup.parent.preferredLanguage);
      setProfile({
        ...DEFAULT_PARENT_PROFILE,
        name: setup.parent.parentName,
        role: "parent",
        dueDate: setup.child.dueDate ?? setup.child.birthDate ?? DEFAULT_PARENT_PROFILE.dueDate,
        languages: setup.parent.preferredLanguage === "ko" ? "Korean" : "English",
      });
      applyOwnerFromSetup(setup);
    },
    [applyOwnerFromSetup, setLocale, setProfile],
  );

  const handleSplashComplete = useCallback(() => setSplashFinished(true), []);

  const handleLogout = useCallback(async () => {
    await unregisterCurrentPushToken();
    await prepareForLogout();
    await clearSession();
    setHasAuthSession(false);
    setOnboardingProfile(null);
    setAuthName("");
    setOnboardingInviteCode("");
    setOnboardingStartsWithBaby(false);
    startupRouting.current = false;
    setPhase(getTermsAccepted() ? "auth" : "terms");
  }, [clearSession, prepareForLogout]);

  const restoreWorkspace = useCallback(async (serverBaby: BabyRow, fallbackName = "") => {
    const [displayProfile, ownProfile, babyProfile, members, familyDisplays, authenticatedUser] = await Promise.all([
      ProfileRepository.getMyDisplayProfile(),
      ProfileRepository.getMyProfile(),
      BabyProfileRepository.getBabyProfile(serverBaby.id).catch(() => null),
      FamilyRepository.listMembers(serverBaby.id),
      FamilyRepository.listMembersAsFamily(serverBaby.id).catch(() => [] as Awaited<ReturnType<typeof FamilyRepository.listMembersAsFamily>>),
      AuthRepository.getUser(),
    ]);
    if (!authenticatedUser) throw new Error("로그인이 필요해요.");
    const me = members.find((member) => member.user_id === authenticatedUser?.id);
    const childStatus: ChildStatus = ["unborn", "newborn", "infant"].includes(serverBaby.child_status)
      ? (serverBaby.child_status as ChildStatus)
      : "newborn";
    const gender: ChildGender = ["girl", "boy", "unknown"].includes(babyProfile?.gender ?? serverBaby.gender ?? "")
      ? ((babyProfile?.gender ?? serverBaby.gender) as ChildGender)
      : "unknown";
    const restoredSetup: CareSetup = {
      parent: {
        parentName: displayProfile?.displayName || fallbackName || "나",
        nickname: displayProfile?.nickname,
        relationshipToChild: relationshipToCareValue(
          me?.relationship_label ?? displayProfile?.defaultRelation,
        ),
        postpartumStatus: childStatus === "unborn" ? "pregnant" : careSetup.parent.postpartumStatus,
        preferredLanguage: resolveAppLocale(
          isAppLanguagePreference(ownProfile?.preferred_language)
            ? ownProfile.preferred_language
            : "system",
        ),
        avatarUri: displayProfile?.avatarUrl,
      },
      child: {
        childName: babyProfile?.name || serverBaby.name,
        nickname: babyProfile?.nickname,
        birthDate: babyProfile?.birthDate ?? serverBaby.birth_date ?? undefined,
        dueDate: serverBaby.due_date ?? undefined,
        childStatus,
        gender,
        photoUri: babyProfile?.avatarUrl ?? babyProfile?.photoUrl ?? serverBaby.photo_url ?? undefined,
        gestationalAgeWeeks: serverBaby.gestational_age_weeks ?? undefined,
        birthWeight: serverBaby.birth_weight ?? undefined,
        specialNotes: babyProfile?.note ?? serverBaby.special_notes ?? undefined,
      },
      preferences: hasSavedCareSetup ? careSetup.preferences : DEFAULT_CARE_SETUP.preferences,
    };
    setCareSetup(restoredSetup);
    applyParentSetup(restoredSetup);
    const storedLanguagePreference = ownProfile?.preferred_language;
    if (isAppLanguagePreference(storedLanguagePreference)) {
      setSettings((current) => ({
        ...current,
        account: { ...current.account, language: storedLanguagePreference },
      }));
    }
    if (familyDisplays.length) {
      const { saveFamilyMembers } = await import("./src/utils/familyMembersStore");
      await saveFamilyMembers(
        familyDisplays,
        { userId: authenticatedUser.id, babyId: serverBaby.id },
      );
    }
    await rehydrateFromServer({ userId: authenticatedUser.id, babyId: serverBaby.id });
    setOnboardingInviteCode("");
    setOnboardingStartsWithBaby(false);
    setPhase("main");
  }, [applyParentSetup, careSetup, hasSavedCareSetup, rehydrateFromServer, setCareSetup, setSettings]);

  const routeAuthenticatedSession = useCallback(async (input?: {
    name?: string;
    preferredBabyId?: string | null;
  }) => {
    const session = await AuthRepository.getSession();
    if (!session?.user) {
      setHasAuthSession(false);
      setPhase("auth");
      return;
    }
    setHasAuthSession(true);

    const pendingCode = await hydratePendingInvite();
    let pendingRelation: RelationshipLabel | undefined;
    let validPendingCode = pendingCode ?? "";
    if (pendingCode) {
      try {
        const preview = await FamilyRepository.previewInviteCode(pendingCode);
        if (!preview?.is_valid) {
          await clearPendingInvite();
          validPendingCode = "";
        } else {
          pendingRelation = relationshipLabel(preview.relation);
        }
      } catch {
        // Keep a pending code across a transient preview failure. The invite
        // screen will show the retryable error without accepting it early.
      }
    }

    const profile = await ProfileRepository.getMyProfile().catch(() => null);
    const profileComplete = isUserProfileComplete(profile);
    const providerName = authProfileName(session.user, input?.name);
    const localIdentity = await DarinIdentityRepository.get(session.user.id).catch(() => null);
    const relation = relationshipLabel(profile?.default_relation) ?? pendingRelation;
    const displayName = profile?.display_name?.trim() || providerName;
    const avatarUrl = profile?.avatar_storage_path
      ? await ProfileRepository.createProfileAvatarSignedUrl(profile.avatar_storage_path).catch(() => undefined)
      : profile?.avatar_url ?? undefined;
    setAuthName(displayName);
    setOnboardingRelation(relation);
    setOnboardingInviteCode(validPendingCode);

    if (!profileComplete) {
      setProfileSetupInitial({
        nickname: profile?.display_name?.trim() || localIdentity?.nickname || providerName,
        realNameFromProvider: localIdentity?.realNameFromProvider || providerName || profile?.nickname || "",
        darinTag: localIdentity?.tag || generateDarinTag(),
        relation,
        avatarUrl,
        residenceCountry: isResidenceCountry(profile?.residence_country)
          ? profile.residence_country
          : undefined,
        preferredLanguage: isAppLanguagePreference(profile?.preferred_language)
          ? profile.preferred_language
          : undefined,
        guardianBirthDate: profile?.guardian_birth_date ?? undefined,
      });
      setPhase("profileSetup");
      return;
    }

    const babies = await BabyRepository.listMyBabies();
    await hydrateSupabaseSync();
    const sync = getSupabaseSync();
    // A cold start carries no explicit hint. Without the last-active pointer a
    // multi-baby account would silently fall back to the oldest baby on every launch.
    const lastActiveBabyId = sync.userId === session.user.id ? sync.babyId : null;
    const preferredBaby = babies.find((baby) => baby.id === input?.preferredBabyId)
      ?? babies.find((baby) => baby.id === lastActiveBabyId)
      ?? babies[0];
    const route = resolveAuthenticatedRoute({
      profileComplete,
      hasPendingInvite: Boolean(validPendingCode),
      hasBaby: Boolean(preferredBaby && isBabyProfileComplete(preferredBaby)),
    });
    if (route === "invite") {
      setOnboardingInitialChild(undefined);
      setOnboardingExistingBabyId(null);
      setOnboardingStartsWithBaby(false);
      setOnboardingVersion((value) => value + 1);
      setPhase("setup");
      return;
    }
    if (route === "babySetup") {
      await resetCareSetup();
      setOnboardingInitialChild(preferredBaby ? onboardingChildFromBaby(preferredBaby) : undefined);
      setOnboardingExistingBabyId(preferredBaby?.id ?? null);
      setOnboardingStartsWithBaby(true);
      setOnboardingVersion((value) => value + 1);
      setPhase("setup");
      return;
    }
    const serverBaby = preferredBaby;
    if (serverBaby) await restoreWorkspace(serverBaby, displayName);
  }, [resetCareSetup, restoreWorkspace]);

  const retryStartupRouting = useCallback(() => {
    if (startupRouting.current) return;
    startupRouting.current = true;
    setStartupError(null);
    setStartupRoutingBusy(true);
    void routeAuthenticatedSession()
      .then(() => {
        setStartupError(null);
      })
      .catch(() => {
        startupRouting.current = false;
        if (hasSavedCareSetup) {
          setStartupError(null);
          setPhase("main");
          return;
        }
        setStartupError("네트워크를 확인한 뒤 다시 시도해 주세요.");
      })
      .finally(() => {
        setStartupRoutingBusy(false);
      });
  }, [hasSavedCareSetup, routeAuthenticatedSession]);

  useEffect(() => {
    if (phase !== "splash") return;
    const nextPhase = resolvePostSplashPhase({
      splashFinished,
      careSetupReady,
      termsReady,
      authReady,
      hasAuthSession,
      hasSavedCareSetup,
      termsAccepted,
    });
    if (!nextPhase) return;
    if (nextPhase === "postAuth") {
      if (startupRouting.current) return;
      startupRouting.current = true;
      setStartupRoutingBusy(true);
      void routeAuthenticatedSession()
        .then(() => {
          setStartupError(null);
        })
        .catch(() => {
          startupRouting.current = false;
          if (hasSavedCareSetup) {
            setStartupError(null);
            setPhase("main");
            return;
          }
          setStartupError("네트워크를 확인한 뒤 다시 시도해 주세요.");
        })
        .finally(() => {
          setStartupRoutingBusy(false);
        });
      return;
    }
    setPhase(nextPhase);
  }, [
    careSetup,
    careSetupReady,
    hasSavedCareSetup,
    phase,
    splashFinished,
    termsAccepted,
    termsReady,
    authReady,
    hasAuthSession,
    hasSavedCareSetup,
    routeAuthenticatedSession,
  ]);

  const handleTermsAccept = useCallback((marketingOptIn: boolean) => {
    void saveMarketingConsent(marketingOptIn);
    void saveTermsAccepted(true);
    setTermsAccepted(true);
    setPhase("auth");
  }, []);

  const handleAuthenticated = useCallback(async (payload: { name?: string; email?: string; provider: "email" | "google" | "apple" | "kakao"; user?: { id: string } }) => {
    setHasAuthSession(true);
    setAuthRecovery(false);
    if (
      (payload.provider === "email" || payload.provider === "google" || payload.provider === "apple" || payload.provider === "kakao") &&
      payload.email
    ) {
      setSettings((current) => ({
        ...current,
        account: { ...current.account, email: payload.email!, loginMethod: payload.provider },
      }));
    }
    await routeAuthenticatedSession({ name: payload.name });
  }, [routeAuthenticatedSession, setSettings]);

  const handleSetupComplete = useCallback(
    async (result: OnboardingResult) => {
      if (result.mode === "join-request") {
        try {
          await rehydrateFromServer();
          await routeAuthenticatedSession({
            name: result.myName,
            preferredBabyId: result.babyId,
          });
        } catch (cause) {
          Alert.alert("참여하지 못했어요", cause instanceof Error ? cause.message : "잠시 후 다시 시도해 주세요.");
        }
        return;
      }

      if (result.mode === "join") {
        let accepted: Awaited<ReturnType<typeof FamilyRepository.acceptInviteCode>>;
        try {
          accepted = await FamilyRepository.acceptInviteCode({
            code: result.code,
            displayName: result.myName,
            nickname: result.myRealName,
            relation: result.relationshipLabel,
          });
          await clearPendingInvite();
          await rehydrateFromServer();
        } catch (cause) {
          Alert.alert("초대를 수락하지 못했어요", cause instanceof Error ? cause.message : "잠시 후 다시 시도해 주세요.");
          return;
        }
        if (result.inviteType !== "family") {
          Alert.alert(
            "초대 수락 완료",
            result.inviteType === "baby_friend"
              ? "친구 공개 순간에 연결됐어요."
              : "친구로 연결됐어요.",
          );
        }
        await routeAuthenticatedSession({
          name: result.myName,
          preferredBabyId: accepted?.baby_id ?? null,
        });
        return;
      }

      try {
        const baby = await BabyRepository.ensureFromCareSetup(result.setup, onboardingExistingBabyId);
        const pickedPhotoUri = result.setup.child.photoUri;
        let avatarUploadFailed = false;
        if (pickedPhotoUri && !/^https?:\/\//i.test(pickedPhotoUri)) {
          try {
            await BabyProfileRepository.uploadBabyAvatar(baby.id, { uri: pickedPhotoUri });
          } catch {
            avatarUploadFailed = true;
          }
        }
        await restoreWorkspace(baby, result.setup.parent.parentName);
        if (avatarUploadFailed) {
          Alert.alert(
            "아기 정보는 저장했어요",
            "사진은 올리지 못했어요. 아기 프로필에서 다시 추가해 주세요.",
          );
        }
      } catch (cause) {
        Alert.alert(
          "아기 프로필을 저장하지 못했어요",
          cause instanceof Error ? cause.message : "잠시 후 다시 시도해 주세요.",
        );
      }
    },
    [onboardingExistingBabyId, rehydrateFromServer, restoreWorkspace, routeAuthenticatedSession],
  );

  return (
    <LogoutProvider onLogout={handleLogout}>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {phase === "main" && <MainNavigator onboardingProfile={onboardingProfile} />}
        {phase === "splash" && (
          <SplashScreen
            onComplete={handleSplashComplete}
            routingError={startupError}
            routingBusy={startupRoutingBusy}
            onRetryRouting={retryStartupRouting}
          />
        )}
        {phase === "terms" && <TermsConsentScreen onAccept={handleTermsAccept} />}
        {phase === "auth" && <AuthStartScreen recoveryMode={authRecovery} onAuthenticated={handleAuthenticated} />}
        {phase === "profileSetup" && (
          <ProfileSetupScreen
            initial={profileSetupInitial}
            onComplete={() => routeAuthenticatedSession()}
          />
        )}
        {phase === "setup" && (
          <OnboardingFlow
            key={onboardingVersion}
            initialName={authName}
            initialRelation={onboardingRelation}
            initialInviteCode={onboardingInviteCode}
            skipProfileStep
            startAtBabySetup={onboardingStartsWithBaby}
            initialChild={onboardingInitialChild}
            onComplete={handleSetupComplete}
          />
        )}
      </View>
    </LogoutProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
