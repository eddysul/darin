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
import { RoleSelectScreen } from "./src/screens/RoleSelectScreen";
import { ParentSetupScreen } from "./src/screens/ParentSetupScreen";
import { CaregiverSetupScreen } from "./src/screens/CaregiverSetupScreen";
import type { CareSetup } from "./src/types/careSetup";
import type { UserProfile, UserRole } from "./src/types/profile";
import { WebAppShell } from "./src/components/WebAppShell";
import { colors } from "./src/theme";

type AppPhase =
  | "splash"
  | "login"
  | "onboarding"
  | "role-select"
  | "parent-setup"
  | "caregiver-setup"
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

  return (
    <NavigationContainer>
      <MainTabs />
    </NavigationContainer>
  );
}

function RootApp() {
  const { setProfile, setCareSetup } = useApp();
  const { setLocale } = useLanguage();
  const [phase, setPhase] = useState<AppPhase>("splash");
  const [onboardingProfile, setOnboardingProfile] = useState<UserProfile | null>(null);

  const handleSplashComplete = useCallback(() => setPhase("login"), []);
  const handleLogin = useCallback(() => setPhase("role-select"), []);
  const handleSignUp = useCallback(() => setPhase("onboarding"), []);

  const handleOnboardingComplete = useCallback((nextProfile: UserProfile) => {
    setOnboardingProfile(nextProfile);
    setProfile(nextProfile);
    setPhase("main");
  }, [setProfile]);

  const handleRoleSelect = useCallback((role: UserRole) => {
    setPhase(role === "parent" ? "parent-setup" : "caregiver-setup");
  }, []);

  const handleParentSetupComplete = useCallback(
    (setup: CareSetup) => {
      setCareSetup(setup);
      setLocale(setup.parent.preferredLanguage);
      setProfile({
        ...DEFAULT_PARENT_PROFILE,
        name: setup.parent.parentName,
        role: "parent",
        dueDate: setup.child.dueDate ?? setup.child.birthDate ?? DEFAULT_PARENT_PROFILE.dueDate,
        languages: setup.parent.preferredLanguage === "ko" ? "Korean" : "English",
      });
      setPhase("main");
    },
    [setCareSetup, setLocale, setProfile],
  );

  const handleCaregiverSetupComplete = useCallback((nextProfile: UserProfile) => {
    setProfile(nextProfile);
    setPhase("main");
  }, [setProfile]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {phase === "main" && <MainNavigator onboardingProfile={onboardingProfile} />}
      {phase === "splash" && <SplashScreen onComplete={handleSplashComplete} />}
      {phase === "login" && <LoginScreen onLogin={handleLogin} onSignUp={handleSignUp} />}
      {phase === "onboarding" && <OnboardingScreen onComplete={handleOnboardingComplete} />}
      {phase === "role-select" && <RoleSelectScreen onSelect={handleRoleSelect} />}
      {phase === "parent-setup" && <ParentSetupScreen onComplete={handleParentSetupComplete} />}
      {phase === "caregiver-setup" && <CaregiverSetupScreen onComplete={handleCaregiverSetupComplete} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
