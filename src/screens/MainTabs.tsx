import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, FileText, Mic, Search, User } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VoiceRecordingOverlay } from "../components/VoiceRecordingOverlay";
import { useVoiceRecording } from "../context/VoiceRecordingContext";
import { useLanguage } from "../LanguageContext";
import { colors } from "../theme";
import { HomeScreen } from "./tabs/HomeScreen";
import { LogScreen } from "./tabs/LogScreen";
import { MatchScreen } from "./tabs/MatchScreen";
import { ProfileScreen } from "./tabs/ProfileScreen";
import { ReportScreen } from "./tabs/ReportScreen";
import { LanguagePicker } from "../components/LanguagePicker";
import { ProfileEditModal } from "../components/ProfileEditModal";
import { useApp } from "../context/AppContext";

export type MainTabParamList = {
  Home: undefined;
  Reports: undefined;
  Log: undefined;
  Find: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { isRecording, isHolding, holdProgress, beginHold, endHold, stopAndSave, consumeSkipPress } =
    useVoiceRecording();
  const tabs = [
    { name: "Home" as const, icon: Home, label: t("tabs.home") },
    { name: "Reports" as const, icon: FileText, label: t("tabs.report") },
    { name: "Log" as const, icon: Mic, label: t("tabs.log"), center: true },
    { name: "Find" as const, icon: Search, label: t("tabs.match") },
    { name: "Profile" as const, icon: User, label: t("tabs.profile") },
  ];

  return (
    <>
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {tabs.map(({ name, icon: Icon, label, center }, index) => {
        const active = state.index === index;
        if (center) {
          return (
            <Pressable
              key={name}
              style={styles.tabItem}
              onPress={() => {
                if (consumeSkipPress()) return;
                if (isRecording) {
                  void stopAndSave();
                  navigation.navigate("Log");
                  return;
                }
                navigation.navigate(name);
              }}
              onPressIn={() => {
                if (!isRecording) beginHold();
              }}
              onPressOut={() => {
                if (!isRecording) endHold();
              }}
            >
              <View style={styles.centerBtnWrap}>
                {isHolding && (
                  <View
                    style={[
                      styles.holdRing,
                      {
                        opacity: 0.25 + holdProgress * 0.55,
                        transform: [{ scale: 0.85 + holdProgress * 0.25 }],
                      },
                    ]}
                  />
                )}
                <View
                  style={[
                    styles.centerBtn,
                    active && styles.centerBtnActive,
                    isRecording && styles.centerBtnRecording,
                    isHolding && styles.centerBtnHolding,
                  ]}
                >
                  <Icon size={22} color={isRecording ? colors.primaryForeground : colors.text} />
                </View>
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive, styles.centerLabel]}>
                {isRecording ? t("log.recordingShort") : isHolding ? t("log.holdToRecord") : label}
              </Text>
            </Pressable>
          );
        }

        return (
          <Pressable key={name} style={styles.tabItem} onPress={() => navigation.navigate(name)}>
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Icon size={20} color={active ? colors.text : colors.muted} />
            </View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
    <VoiceRecordingOverlay />
    </>
  );
}

export function MainTabs() {
  const {
    profile,
    setProfile,
    langPickerOpen,
    setLangPickerOpen,
    profileEditOpen,
    setProfileEditOpen,
  } = useApp();

  return (
    <>
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Reports" component={ReportScreen} />
      <Tab.Screen name="Log" component={LogScreen} />
      <Tab.Screen name="Find" component={MatchScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
    <LanguagePicker open={langPickerOpen} onClose={() => setLangPickerOpen(false)} />
    <ProfileEditModal
      open={profileEditOpen}
      profile={profile}
      onClose={() => setProfileEditOpen(false)}
      onSave={setProfile}
    />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 4 },
  iconWrap: { padding: 8, borderRadius: 12 },
  iconWrapActive: { backgroundColor: colors.yellowSoft },
  centerBtnWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
  },
  holdRing: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.yellow,
  },
  centerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  centerBtnActive: { transform: [{ scale: 1.05 }] },
  centerBtnHolding: { transform: [{ scale: 0.96 }] },
  centerBtnRecording: { backgroundColor: colors.black },
  tabLabel: { fontSize: 11, fontWeight: "600", color: colors.muted },
  tabLabelActive: { color: colors.text },
  centerLabel: { marginTop: 4 },
});
