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
import { InviteShareScreen } from "./src/screens/onboarding/InviteShareScreen";
import { OnboardingFlow, type OnboardingResult } from "./src/screens/onboarding/OnboardingFlow";
import { TermsConsentScreen } from "./src/screens/onboarding/TermsConsentScreen";
import { MainTabs } from "./src/screens/MainTabs";
import { BabyProfileScreen } from "./src/screens/BabyProfileScreen";
import { FamilyShareScreen } from "./src/screens/FamilyShareScreen";
import { GrowthRecordsManagerScreen } from "./src/screens/GrowthRecordsManagerScreen";
import { MemoryDetailScreen } from "./src/screens/MemoryDetailScreen";
import { MyProfileScreen } from "./src/screens/MyProfileScreen";
import { SettingsHomeScreen } from "./src/screens/SettingsHomeScreen";
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
import { WebAppShell } from "./src/components/WebAppShell";
import { colors } from "./src/theme";
import { resolvePostSplashPhase } from "./src/utils/appStartup";
import { AuthRepository } from "./src/repositories/AuthRepository";
import { BabyRepository } from "./src/repositories/BabyRepository";
import { FamilyRepository } from "./src/repositories/FamilyRepository";
import { BabyProfileRepository } from "./src/repositories/BabyProfileRepository";
import { ProfileRepository } from "./src/repositories/ProfileRepository";
import {
  getTermsAccepted,
  hydrateTermsAccepted,
  saveTermsAccepted,
} from "./src/utils/termsStore";
import { registerCurrentPushToken, unregisterCurrentPushToken } from "./src/utils/pushNotifications";

type AppPhase =
  | "splash"
  | "terms"
  | "auth"
  | "setup"
  | "invite-share"
  | "main";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
    if (data.route === "memory" && typeof data.memoryPostId === "string") {
      navigationRef.navigate("MemoryDetail", { memoryPostId: data.memoryPostId });
      return;
    }
    if (data.route === "growth_book") {
      navigationRef.navigate("MainTabs", { screen: "Diary", params: { openGrowthBookVault: true } });
      return;
    }
    if (data.route === "family") {
      navigationRef.navigate("BabyProfile");
      return;
    }
    navigationRef.navigate("MainTabs", {
      screen: "Diary",
      params: { openCompose: Boolean(data.openCompose), source: "notification" },
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
            Consult: "consult",
            Memories: "memories",
            Mic: "mic",
          },
        },
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
        <RootStack.Screen name="BabyProfile" component={BabyProfileScreen} options={{ title: "아기 프로필" }} />
        <RootStack.Screen name="FamilyShare" component={FamilyShareScreen} options={{ title: "가족·친구 공유" }} />
        <RootStack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: "내 프로필" }} />
        <RootStack.Screen name="SettingsHome" component={SettingsHomeScreen} options={{ title: "설정" }} />
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
  const { applyOwnerFromSetup, joinWithInvite, prepareForLogout, rehydrateFromServer } = useBabyLog();
  const { setLocale } = useLanguage();
  const { setSettings } = useAppSettings();
  const [phase, setPhase] = useState<AppPhase>("splash");
  const [onboardingProfile, setOnboardingProfile] = useState<UserProfile | null>(null);
  const [splashFinished, setSplashFinished] = useState(false);
  const [termsReady, setTermsReady] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [authName, setAuthName] = useState("");
  const [pendingInviteBaby, setPendingInviteBaby] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [hasAuthSession, setHasAuthSession] = useState(false);
  const [authRecovery, setAuthRecovery] = useState(false);

  useEffect(() => {
    void hydrateTermsAccepted().then(() => {
      setTermsAccepted(getTermsAccepted());
      setTermsReady(true);
    });
  }, []);

  useEffect(() => {
    let active = true;
    void AuthRepository.getSession()
      .then(async (session) => {
        if (session) {
          try {
            const babies = await BabyRepository.listMyBabies();
            if (babies.length === 0) await resetCareSetup();
          } catch {
            // Keep the local cache on transient network/RLS failures.
          }
        }
        if (active) setHasAuthSession(Boolean(session));
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    const handleUrl = async (url: string) => {
      try {
        const result = await AuthRepository.handleAuthUrl(url);
        if (!result) return;
        setHasAuthSession(true);
        if (result === "recovery") {
          setAuthRecovery(true);
          setPhase("auth");
        }
      } catch (error) {
        Alert.alert("인증 링크를 열지 못했어요", error instanceof Error ? error.message : "링크를 다시 요청해주세요.");
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
  }, [resetCareSetup]);

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

  const enterMain = useCallback(
    (setup: CareSetup, profileName?: string) => {
      setCareSetup(setup);
      applyParentSetup(setup);
      if (profileName) {
        setOnboardingProfile({
          ...DEFAULT_PARENT_PROFILE,
          name: profileName,
          role: "parent",
        });
      }
      setPhase("main");
    },
    [applyParentSetup, setCareSetup],
  );

  const handleSplashComplete = useCallback(() => setSplashFinished(true), []);

  const handleLogout = useCallback(async () => {
    await unregisterCurrentPushToken();
    await prepareForLogout();
    await clearSession();
    setHasAuthSession(false);
    setOnboardingProfile(null);
    setAuthName("");
    setPendingInviteBaby("");
    setPhase(getTermsAccepted() ? "auth" : "terms");
  }, [clearSession, prepareForLogout]);

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
    if (nextPhase === "main") {
      applyParentSetup(careSetup);
      setPhase("main");
    } else {
      setPhase(nextPhase);
    }
  }, [
    applyParentSetup,
    careSetup,
    careSetupReady,
    hasSavedCareSetup,
    phase,
    splashFinished,
    termsAccepted,
    termsReady,
    authReady,
    hasAuthSession,
  ]);

  const handleTermsAccept = useCallback((marketingOptIn: boolean) => {
    void marketingOptIn;
    void saveTermsAccepted(true);
    setTermsAccepted(true);
    setPhase("auth");
  }, []);

  const handleAuthenticated = useCallback(async (payload: { name?: string; email?: string; provider: "email" | "google" | "apple" | "kakao"; user?: { id: string } }) => {
    const name = payload.name?.trim() || "";
    setHasAuthSession(true);
    setAuthRecovery(false);
    setAuthName(name);
    if (name) {
      setProfile({
        ...DEFAULT_PARENT_PROFILE,
        name,
        role: "parent",
      });
    }
    if (
      (payload.provider === "email" || payload.provider === "google" || payload.provider === "apple" || payload.provider === "kakao") &&
      payload.email
    ) {
      setSettings((current) => ({
        ...current,
        account: { ...current.account, email: payload.email!, loginMethod: payload.provider },
      }));
    }
    const babies = await BabyRepository.listMyBabies();
    const serverBaby = babies[0];
    if (serverBaby) {
      const [displayProfile, babyProfile, members, familyDisplays] = await Promise.all([
        ProfileRepository.getMyDisplayProfile().catch(() => null),
        BabyProfileRepository.getBabyProfile(serverBaby.id).catch(() => null),
        FamilyRepository.listMembers(serverBaby.id),
        FamilyRepository.listMembersAsFamily(serverBaby.id).catch(() => [] as Awaited<ReturnType<typeof FamilyRepository.listMembersAsFamily>>),
      ]);
      const authenticatedUser = payload.user ?? (await AuthRepository.getUser());
      const me = members.find((member) => member.user_id === authenticatedUser?.id);
      const relationshipMap: Record<string, RelationshipToChild> = {
        "엄마": "mom",
        "아빠": "dad",
        "보호자": "guardian",
        "가족": "family",
        "시터": "sitter",
      };
      const childStatus: ChildStatus = ["unborn", "newborn", "infant"].includes(serverBaby.child_status)
        ? (serverBaby.child_status as ChildStatus)
        : "newborn";
      const gender: ChildGender = ["girl", "boy", "unknown"].includes(babyProfile?.gender ?? serverBaby.gender ?? "")
        ? ((babyProfile?.gender ?? serverBaby.gender) as ChildGender)
        : "unknown";
      const restoredSetup: CareSetup = {
        parent: {
          parentName: displayProfile?.displayName || name || "나",
          nickname: displayProfile?.nickname,
          relationshipToChild: relationshipMap[me?.relationship_label ?? displayProfile?.defaultRelation ?? ""] ?? "guardian",
          postpartumStatus: careSetup.parent.postpartumStatus,
          preferredLanguage: careSetup.parent.preferredLanguage,
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
      if (familyDisplays.length) {
        const { saveFamilyMembers } = await import("./src/utils/familyMembersStore");
        await saveFamilyMembers(familyDisplays);
      }
      if (authenticatedUser) {
        await rehydrateFromServer({ userId: authenticatedUser.id, babyId: serverBaby.id });
      } else {
        await rehydrateFromServer();
      }
      setPhase("main");
    } else {
      await resetCareSetup();
      setPhase("setup");
    }
  }, [applyParentSetup, careSetup, hasSavedCareSetup, rehydrateFromServer, resetCareSetup, setCareSetup, setProfile, setSettings]);

  const handleSetupComplete = useCallback(
    async (result: OnboardingResult) => {
      if (result.mode === "join") {
        try {
          await FamilyRepository.acceptInviteCode({
            code: result.code,
            displayName: result.myName,
            relation: result.relationshipLabel,
          });
          await rehydrateFromServer();
        } catch (cause) {
          Alert.alert("초대를 수락하지 못했어요", cause instanceof Error ? cause.message : "잠시 후 다시 시도해 주세요.");
          return;
        }
        const setup: CareSetup = {
          ...DEFAULT_CARE_SETUP,
          parent: {
            ...DEFAULT_CARE_SETUP.parent,
            parentName: result.myName,
            relationshipToChild: result.relationship,
            preferredLanguage: "ko",
          },
          child: {
            ...DEFAULT_CARE_SETUP.child,
            childName: result.babyName,
            childStatus: "newborn",
          },
          preferences: {
            ...DEFAULT_CARE_SETUP.preferences,
            familySharingEnabled: true,
          },
        };
        enterMain(setup, result.myName);
        return;
      }

      if (result.showInviteShare) {
        setCareSetup(result.setup);
        applyParentSetup(result.setup);
        setPendingInviteBaby(result.setup.child.childName.trim() || "아기");
        setPhase("invite-share");
        return;
      }

      enterMain(result.setup, result.setup.parent.parentName);
    },
    [applyParentSetup, enterMain, rehydrateFromServer, setCareSetup],
  );

  const finishInviteShare = useCallback(() => {
    setPhase("main");
  }, []);

  return (
    <LogoutProvider onLogout={handleLogout}>
      <View style={styles.root}>
        <StatusBar style="dark" />
        {phase === "main" && <MainNavigator onboardingProfile={onboardingProfile} />}
        {phase === "splash" && <SplashScreen onComplete={handleSplashComplete} />}
        {phase === "terms" && <TermsConsentScreen onAccept={handleTermsAccept} />}
        {phase === "auth" && <AuthStartScreen recoveryMode={authRecovery} onAuthenticated={handleAuthenticated} />}
        {phase === "setup" && (
          <OnboardingFlow initialName={authName} onComplete={handleSetupComplete} />
        )}
        {phase === "invite-share" && (
          <InviteShareScreen
            babyName={pendingInviteBaby || careSetup.child.childName || "아기"}
            onDone={() => finishInviteShare()}
            onSkip={() => finishInviteShare()}
          />
        )}
      </View>
    </LogoutProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
