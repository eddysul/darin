import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PARENT_PROFILE, useApp } from "./src/context/AppContext";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "./src/context/AppContext";
import { BabyLogProvider } from "./src/context/BabyLogContext";
import { VoiceRecordingProvider } from "./src/context/VoiceRecordingContext";
import { LanguageProvider, useLanguage } from "./src/LanguageContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { MainTabs } from "./src/screens/MainTabs";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { SplashScreen } from "./src/screens/SplashScreen";
import { ParentSetupScreen } from "./src/screens/ParentSetupScreen";
import type { CareSetup } from "./src/types/careSetup";
import type { UserProfile } from "./src/types/profile";
import { WebAppShell } from "./src/components/WebAppShell";
import { colors } from "./src/theme";
import { resolvePostSplashPhase } from "./src/utils/appStartup";

type AppPhase =
  | "splash"
  | "login"
  | "onboarding"
  | "parent-setup"
  | "main";

export default function App() {
  return (
    <SafeAreaProvider>
      <WebAppShell>
        <LanguageProvider>
          <AppProvider>
            <BabyLogProvider>
              <VoiceRecordingProvider>
                <RootApp />
              </VoiceRecordingProvider>
            </BabyLogProvider>
          </AppProvider>
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
  const { careSetup, careSetupReady, hasSavedCareSetup, setProfile, setCareSetup } = useApp();
  const { setLocale } = useLanguage();
  const [phase, setPhase] = useState<AppPhase>("splash");
  const [onboardingProfile, setOnboardingProfile] = useState<UserProfile | null>(null);
  const [splashFinished, setSplashFinished] = useState(false);

  const applyParentSetup = useCallback((setup: CareSetup) => {
    setLocale(setup.parent.preferredLanguage);
    setProfile({
      ...DEFAULT_PARENT_PROFILE,
      name: setup.parent.parentName,
      role: "parent",
      dueDate: setup.child.dueDate ?? setup.child.birthDate ?? DEFAULT_PARENT_PROFILE.dueDate,
      languages: setup.parent.preferredLanguage === "ko" ? "Korean" : "English",
    });
  }, [setLocale, setProfile]);

  const handleSplashComplete = useCallback(() => setSplashFinished(true), []);
  const handleLogin = useCallback(() => setPhase("parent-setup"), []);
  const handleSignUp = useCallback(() => setPhase("onboarding"), []);

  useEffect(() => {
    if (phase !== "splash") return;
    const nextPhase = resolvePostSplashPhase({ splashFinished, careSetupReady, hasSavedCareSetup });
    if (!nextPhase) return;
    if (nextPhase === "main") {
      applyParentSetup(careSetup);
      setPhase("main");
    } else {
      setPhase("login");
    }
  }, [applyParentSetup, careSetup, careSetupReady, hasSavedCareSetup, phase, splashFinished]);

  const handleOnboardingComplete = useCallback((nextProfile: UserProfile) => {
    setOnboardingProfile(nextProfile);
    setProfile(nextProfile);
    setPhase("main");
  }, [setProfile]);

  const handleParentSetupComplete = useCallback(
    (setup: CareSetup) => {
      setCareSetup(setup);
      applyParentSetup(setup);
      setPhase("main");
    },
    [applyParentSetup, setCareSetup],
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {phase === "main" && <MainNavigator onboardingProfile={onboardingProfile} />}
      {phase === "splash" && <SplashScreen onComplete={handleSplashComplete} />}
      {phase === "login" && <LoginScreen onLogin={handleLogin} onSignUp={handleSignUp} />}
      {phase === "onboarding" && <OnboardingScreen onComplete={handleOnboardingComplete} />}
      {phase === "parent-setup" && <ParentSetupScreen onComplete={handleParentSetupComplete} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
