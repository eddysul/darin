import type { NavigatorScreenParams } from "@react-navigation/native";
import type { SettingsPage } from "../components/settings/AppSettingsModal";
import type { LogCategoryKey } from "../types/logCategory";

export type SettingsDetailPage = SettingsPage;

export type MainTabParamList = {
  Record: { logId?: string; category?: LogCategoryKey } | undefined;
  Diary: {
    openCompose?: boolean;
    date?: string;
    source?: string;
    openGrowthBookVault?: boolean;
    diaryEntryId?: string;
  } | undefined;
  Report: undefined;
  Memories: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Consult: { initialQuestion?: string; focusInput?: boolean } | undefined;
  BabyProfile: { mode?: "create" | "convertBirth" } | undefined;
  FamilyShare: { tab?: "create" | "enter" | "people"; peopleFilter?: "family" | "friend" } | undefined;
  MyProfile: { edit?: boolean } | undefined;
  SettingsHome: undefined;
  NotificationCenter: undefined;
  SettingsDetail: { page: SettingsDetailPage };
  GrowthRecords: undefined;
  MemoryDetail: { memoryPostId: string; source?: "family" | "friend" | "notification" };
};
