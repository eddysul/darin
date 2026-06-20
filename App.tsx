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
import { SplashScreen } from "./src/screens/SplashScreen";
import type { UserProfile } from "./src/types/profile";
import { colors } from "./src/theme";

type AppPhase = "splash" | "login" | "onboarding" | "main";

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
  const [phase, setPhase] = useState<AppPhase>("splash");
  const [onboardingProfile, setOnboardingProfile] = useState<UserProfile | null>(null);

  const handleSplashComplete = useCallback(() => setPhase("login"), []);
  const handleLogin = useCallback(() => setPhase("main"), []);
  const handleSignUp = useCallback(() => setPhase("onboarding"), []);
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
      {phase === "onboarding" && <OnboardingScreen onComplete={handleOnboardingComplete} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
