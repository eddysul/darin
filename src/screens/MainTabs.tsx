import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, FileText, Mic, Search, User } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const tabs = [
    { name: "Home" as const, icon: Home, label: t("tabs.home") },
    { name: "Reports" as const, icon: FileText, label: t("tabs.report") },
    { name: "Log" as const, icon: Mic, label: t("tabs.log"), center: true },
    { name: "Find" as const, icon: Search, label: t("tabs.match") },
    { name: "Profile" as const, icon: User, label: t("tabs.profile") },
  ];

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {tabs.map(({ name, icon: Icon, label, center }, index) => {
        const active = state.index === index;
        return (
          <Pressable key={name} style={styles.tabItem} onPress={() => navigation.navigate(name)}>
            {center ? (
              <View style={[styles.centerBtn, active && styles.centerBtnActive]}>
                <Icon size={22} color={colors.text} />
              </View>
            ) : (
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                <Icon size={20} color={active ? colors.text : colors.muted} />
              </View>
            )}
            <Text style={[styles.tabLabel, active && styles.tabLabelActive, center && styles.centerLabel]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
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
  centerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
  },
  centerBtnActive: { transform: [{ scale: 1.05 }] },
  tabLabel: { fontSize: 11, fontWeight: "600", color: colors.muted },
  tabLabelActive: { color: colors.text },
  centerLabel: { marginTop: 4 },
});
