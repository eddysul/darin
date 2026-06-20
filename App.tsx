import { useCallback, useEffect, useState } from "react";
import { useApp } from "./src/context/AppContext";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "./src/context/AppContext";
import { LanguageProvider } from "./src/LanguageContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { MainTabs } from "./src/screens/MainTabs";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { ParentSetupScreen } from "./src/screens/ParentSetupScreen";
import { CaregiverSetupScreen } from "./src/screens/CaregiverSetupScreen";
import { RoleSelectScreen } from "./src/screens/RoleSelectScreen";
import { SplashScreen } from "./src/screens/SplashScreen";
import type { UserProfile, UserRole } from "./src/types/profile";
import { DEFAULT_CAREGIVER_PROFILE } from "./src/context/AppContext";
import { colors } from "./src/theme";

type AppPhase = "splash" | "login" | "role-select" | "parent-setup" | "caregiver-setup" | "onboarding" | "main";

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AppProvider>
          <RootApp />
        </AppProvider>
      </LanguageProvider>
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
  const { profile, setProfile } = useApp();
  const [phase, setPhase] = useState<AppPhase>("splash");
  const [onboardingProfile, setOnboardingProfile] = useState<UserProfile | null>(null);

  const handleSplashComplete = useCallback(() => setPhase("login"), []);
  const handleLogin = useCallback(() => setPhase("role-select"), []);
  const handleSignUp = useCallback(() => setPhase("role-select"), []);
  const handleRoleSelect = useCallback((role: UserRole) => {
    if (role === "caregiver") {
      setProfile(DEFAULT_CAREGIVER_PROFILE);
      setPhase("caregiver-setup");
    } else {
      setProfile({ ...profile, role });
      setPhase("parent-setup");
    }
  }, [profile, setProfile]);
  const handleParentSetupComplete = useCallback((nextProfile: UserProfile) => {
    setProfile(nextProfile);
    setPhase("main");
  }, [setProfile]);
  const handleCaregiverSetupComplete = useCallback((nextProfile: UserProfile) => {
    setProfile(nextProfile);
    setPhase("main");
  }, [setProfile]);
  const handleOnboardingComplete = useCallback((nextProfile: UserProfile) => {
    setOnboardingProfile(nextProfile);
    setPhase("main");
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {phase === "main" && <MainNavigator onboardingProfile={onboardingProfile} />}
      {phase === "splash" && <SplashScreen onComplete={handleSplashComplete} />}
      {phase === "login" && <LoginScreen onLogin={handleLogin} onSignUp={handleSignUp} />}
      {phase === "role-select" && <RoleSelectScreen onSelect={handleRoleSelect} />}
      {phase === "parent-setup" && <ParentSetupScreen initialProfile={profile} onComplete={handleParentSetupComplete} />}
      {phase === "caregiver-setup" && <CaregiverSetupScreen onComplete={handleCaregiverSetupComplete} />}
      {phase === "onboarding" && <OnboardingScreen onComplete={handleOnboardingComplete} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
