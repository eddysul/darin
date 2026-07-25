import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PARENT_PROFILE, useApp } from "./src/context/AppContext";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "./src/context/AppContext";
import { AppSettingsProvider } from "./src/context/AppSettingsContext";
import { BabyLogProvider, useBabyLog } from "./src/context/BabyLogContext";
import { LogoutProvider } from "./src/context/LogoutContext";
import { VoiceRecordingProvider } from "./src/context/VoiceRecordingContext";
import { LanguageProvider, useLanguage } from "./src/LanguageContext";
import { AuthStartScreen } from "./src/screens/onboarding/AuthStartScreen";
import { InviteShareScreen } from "./src/screens/onboarding/InviteShareScreen";
import { OnboardingFlow, type OnboardingResult } from "./src/screens/onboarding/OnboardingFlow";
import { TermsConsentScreen } from "./src/screens/onboarding/TermsConsentScreen";
import { MainTabs } from "./src/screens/MainTabs";
import { SplashScreen } from "./src/screens/SplashScreen";
import type { CareSetup } from "./src/types/careSetup";
import { DEFAULT_CARE_SETUP } from "./src/types/careSetup";
import type { UserProfile } from "./src/types/profile";
import { WebAppShell } from "./src/components/WebAppShell";
import { colors } from "./src/theme";
import { resolvePostSplashPhase } from "./src/utils/appStartup";
import {
  getTermsAccepted,
  hydrateTermsAccepted,
  saveTermsAccepted,
} from "./src/utils/termsStore";

type AppPhase =
  | "splash"
  | "terms"
  | "auth"
  | "setup"
  | "invite-share"
  | "main";

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

  useEffect(() => {
    if (onboardingProfile) setProfile(onboardingProfile);
  }, [onboardingProfile, setProfile]);

  const linking = {
    prefixes: ["knanny://", "exp://"],
    config: {
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
        Menu: "menu",
        Mic: "mic",
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      <MainTabs />
    </NavigationContainer>
  );
}

function RootApp() {
  const { careSetup, careSetupReady, hasSavedCareSetup, setProfile, setCareSetup, clearSession } =
    useApp();
  const { applyOwnerFromSetup, joinWithInvite } = useBabyLog();
  const { setLocale } = useLanguage();
  const [phase, setPhase] = useState<AppPhase>("splash");
  const [onboardingProfile, setOnboardingProfile] = useState<UserProfile | null>(null);
  const [splashFinished, setSplashFinished] = useState(false);
  const [termsReady, setTermsReady] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [authName, setAuthName] = useState("");
  const [pendingInviteBaby, setPendingInviteBaby] = useState("");

  useEffect(() => {
    void hydrateTermsAccepted().then(() => {
      setTermsAccepted(getTermsAccepted());
      setTermsReady(true);
    });
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
    await clearSession();
    setOnboardingProfile(null);
    setAuthName("");
    setPendingInviteBaby("");
    setPhase(getTermsAccepted() ? "auth" : "terms");
  }, [clearSession]);

  useEffect(() => {
    if (phase !== "splash") return;
    const nextPhase = resolvePostSplashPhase({
      splashFinished,
      careSetupReady,
      termsReady,
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
  ]);

  const handleTermsAccept = useCallback((marketingOptIn: boolean) => {
    void marketingOptIn;
    void saveTermsAccepted(true);
    setTermsAccepted(true);
    setPhase("auth");
  }, []);

  const handleAuthenticated = useCallback((payload: { name?: string; provider: string }) => {
    const name = payload.name?.trim() || "";
    setAuthName(name);
    if (name) {
      setProfile({
        ...DEFAULT_PARENT_PROFILE,
        name,
        role: "parent",
      });
    }
    setPhase("setup");
  }, [setProfile]);

  const handleSetupComplete = useCallback(
    (result: OnboardingResult) => {
      if (result.mode === "join") {
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
        joinWithInvite({
          code: result.code,
          myName: result.myName,
          ownerName: result.ownerName,
          relationshipLabel: result.relationshipLabel,
        });
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
    [applyParentSetup, enterMain, joinWithInvite, setCareSetup],
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
        {phase === "auth" && <AuthStartScreen onAuthenticated={handleAuthenticated} />}
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
