import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MenuScreen } from "./tabs/MenuScreen";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "SettingsHome">;

export function SettingsHomeScreen({ navigation }: Props) {
  return (
    <MenuScreen
      embedded
      onOpenProfile={() => navigation.navigate("BabyProfile")}
      onOpenMyProfile={() => navigation.navigate("MyProfile")}
      onOpenSettings={(page) => navigation.navigate("SettingsDetail", { page })}
      onOpenGrowthRecords={() => navigation.navigate("GrowthRecords")}
      onOpenGrowthBookStorage={() => navigation.navigate("MainTabs", { screen: "Diary", params: { openGrowthBookVault: true } })}
    />
  );
}
