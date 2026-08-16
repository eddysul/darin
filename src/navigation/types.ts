import type { NavigatorScreenParams } from "@react-navigation/native";
import type { SettingsPage } from "../components/settings/AppSettingsModal";

export type SettingsDetailPage = Exclude<SettingsPage, "account">;

export type MainTabParamList = {
  Record: undefined;
  Diary: {
    openCompose?: boolean;
    date?: string;
    source?: string;
    openGrowthBookVault?: boolean;
  } | undefined;
  Mic: undefined;
  Report: undefined;
  Consult: { initialQuestion?: string } | undefined;
  Memories: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  BabyProfile: { mode?: "create" } | undefined;
  FamilyShare: { tab?: "create" | "enter" | "people" } | undefined;
  MyProfile: undefined;
  SettingsHome: undefined;
  NotificationCenter: undefined;
  SettingsDetail: { page: SettingsDetailPage };
  GrowthRecords: undefined;
  MemoryDetail: { memoryPostId: string };
};
