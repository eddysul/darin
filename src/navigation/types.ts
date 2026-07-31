import type { NavigatorScreenParams } from "@react-navigation/native";
import type { SettingsPage } from "../components/settings/AppSettingsModal";

export type SettingsDetailPage = Exclude<SettingsPage, "account">;

export type MainTabParamList = {
  Record: undefined;
  Diary: {
    openCompose?: boolean;
    date?: string;
    source?: string;
  } | undefined;
  Mic: undefined;
  Report: undefined;
  Consult: { initialQuestion?: string } | undefined;
  Menu: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  BabyProfile: undefined;
  SettingsDetail: { page: SettingsDetailPage };
  GrowthRecords: undefined;
};
