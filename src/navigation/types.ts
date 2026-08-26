import type { NavigatorScreenParams } from "@react-navigation/native";
import type { SettingsPage } from "../components/settings/AppSettingsModal";

export type SettingsDetailPage = SettingsPage;

export type MainTabParamList = {
  Record: { logId?: string } | undefined;
  Diary: {
    openCompose?: boolean;
    date?: string;
    source?: string;
    openGrowthBookVault?: boolean;
    diaryEntryId?: string;
  } | undefined;
  Mic: undefined;
  Report: undefined;
  Memories: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Consult: { initialQuestion?: string; focusInput?: boolean } | undefined;
  BabyProfile: { mode?: "create" | "convertBirth" } | undefined;
  FamilyShare: { tab?: "create" | "enter" | "people" } | undefined;
  MyProfile: undefined;
  SettingsHome: undefined;
  NotificationCenter: undefined;
  SettingsDetail: { page: SettingsDetailPage };
  GrowthRecords: undefined;
  MemoryDetail: { memoryPostId: string; source?: "family" | "friend" | "notification" };
};
