import { useCallback, useEffect, useRef } from "react";
import {
  NavigationContainer,
  createNavigationContainerRef,
  type LinkingOptions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { useApp } from "../context/AppContext";
import { useBabyLog } from "../context/BabyLogContext";
import { useLanguage } from "../LanguageContext";
import { AppSettingsModal, SETTINGS_PAGE_TITLES } from "../components/settings/AppSettingsModal";
import { canOpenNotificationData } from "../config/featureFlags";
import { NotificationRepository } from "../repositories/NotificationRepository";
import { registerCurrentPushToken } from "../utils/pushNotifications";
import { BabyProfileScreen } from "../screens/BabyProfileScreen";
import { FamilyShareScreen } from "../screens/FamilyShareScreen";
import { GrowthRecordsManagerScreen } from "../screens/GrowthRecordsManagerScreen";
import { MainTabs } from "../screens/MainTabs";
import { MemoryDetailScreen } from "../screens/MemoryDetailScreen";
import { MyProfileScreen } from "../screens/MyProfileScreen";
import { NotificationCenterScreen } from "../screens/NotificationCenterScreen";
import { SettingsHomeScreen } from "../screens/SettingsHomeScreen";
import { ConsultScreen } from "../screens/tabs/ConsultScreen";
import { colors } from "../theme";
import type { UserProfile } from "../types/profile";
import type { RootStackParamList } from "./types";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function MainNavigator({
  onboardingProfile,
  friendOnly,
}: {
  onboardingProfile: UserProfile | null;
  friendOnly: boolean;
}) {
  const { setProfile } = useApp();
  const { t } = useLanguage();
  const { localDataScope } = useBabyLog();
  const pendingNotificationRoute = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (onboardingProfile) setProfile(onboardingProfile);
  }, [onboardingProfile, setProfile]);

  useEffect(() => {
    if (!friendOnly && !localDataScope?.userId) return;
    void registerCurrentPushToken();
  }, [friendOnly, localDataScope?.userId]);

  const openNotificationRoute = useCallback((data: Record<string, unknown>) => {
    if (!navigationRef.isReady()) {
      pendingNotificationRoute.current = data;
      return;
    }
    pendingNotificationRoute.current = null;
    if (!canOpenNotificationData(data)) {
      navigationRef.navigate("NotificationCenter");
      return;
    }
    if (typeof data.eventId === "string") {
      void NotificationRepository.markInAppEventRead(data.eventId).catch(() => undefined);
    }
    if (data.route === "memory" && typeof data.memoryPostId === "string") {
      navigationRef.navigate("MemoryDetail", {
        memoryPostId: data.memoryPostId,
        source: friendOnly ? "friend" : "notification",
      });
      return;
    }
    if (friendOnly) {
      navigationRef.navigate("NotificationCenter");
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
  }, [friendOnly]);

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
    config: friendOnly ? {
      screens: {
        MainTabs: { screens: { Memories: "memories" } },
      },
    } : {
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
        <RootStack.Screen name="MainTabs" options={{ headerShown: false }}>
          {() => <MainTabs friendOnly={friendOnly} />}
        </RootStack.Screen>
        {!friendOnly ? (
          <>
            <RootStack.Screen name="Consult" component={ConsultScreen} options={{ headerShown: false }} />
            <RootStack.Screen name="BabyProfile" component={BabyProfileScreen} options={{ title: t("babyProfile.title.profile") }} />
            <RootStack.Screen name="FamilyShare" component={FamilyShareScreen} options={{ title: t("babyProfile.family.invite") }} />
            <RootStack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: t("babyProfile.myProfile") }} />
            <RootStack.Screen name="SettingsHome" component={SettingsHomeScreen} options={{ title: t("chrome.critical.035") }} />
            <RootStack.Screen
              name="SettingsDetail"
              options={({ route }) => ({ title: t(SETTINGS_PAGE_TITLES[route.params.page]) })}
            >
              {({ route, navigation }) => (
                <AppSettingsModal
                  page={route.params.page}
                  embedded
                  onClose={() => navigation.goBack()}
                  onOpenMyProfile={() => navigation.navigate("MyProfile")}
                />
              )}
            </RootStack.Screen>
            <RootStack.Screen name="GrowthRecords" component={GrowthRecordsManagerScreen} options={{ title: t("growth.critical.116") }} />
          </>
        ) : null}
        <RootStack.Screen name="NotificationCenter" options={{ title: t("chrome.critical.034") }}>
          {(props) => <NotificationCenterScreen {...props} friendOnly={friendOnly} />}
        </RootStack.Screen>
        <RootStack.Screen name="MemoryDetail" component={MemoryDetailScreen} options={{ title: t("memory.critical.001") }} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

