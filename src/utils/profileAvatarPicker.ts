import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS, Alert, Platform } from "react-native";
import { MAX_PROFILE_AVATAR_BYTES } from "../types/profileSettings";
import type { Translate } from "./recordDisplay";

export type PickedAvatar = {
  uri: string;
  mimeType?: string;
  fileSize?: number;
};

async function launchLibrary(t?: Translate): Promise<PickedAvatar | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      t ? t("onboardingFlow.photo.permissionTitle") : "사진 접근",
      t ? t("chrome.critical.099") : "사진을 선택하려면 사진 보관함 권한이 필요해요.",
    );
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    quality: 0.85,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.fileSize !== undefined && asset.fileSize > MAX_PROFILE_AVATAR_BYTES) {
    Alert.alert(
      t ? t("chrome.critical.098") : "사진 크기",
      t ? t("babyProfile.error.photoTooLarge") : "사진은 5MB 이하만 올릴 수 있어요.",
    );
    return null;
  }
  return { uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize };
}

async function launchCamera(t?: Translate): Promise<PickedAvatar | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      t ? t("chrome.critical.100") : "카메라 접근",
      t ? t("chrome.critical.101") : "사진을 찍으려면 카메라 권한이 필요해요.",
    );
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.85,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.fileSize !== undefined && asset.fileSize > MAX_PROFILE_AVATAR_BYTES) {
    Alert.alert(
      t ? t("chrome.critical.098") : "사진 크기",
      t ? t("babyProfile.error.photoTooLarge") : "사진은 5MB 이하만 올릴 수 있어요.",
    );
    return null;
  }
  return { uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize };
}

export type AvatarPickerChoice = "library" | "camera" | "clear" | "cancel";

export function presentAvatarPicker(options: {
  hasAvatar: boolean;
  onPick: (avatar: PickedAvatar) => void;
  onClear?: () => void;
  t?: Translate;
}): void {
  const { t } = options;
  const run = async (choice: AvatarPickerChoice) => {
    if (choice === "cancel") return;
    if (choice === "clear") {
      options.onClear?.();
      return;
    }
    const picked = choice === "camera" ? await launchCamera(t) : await launchLibrary(t);
    if (picked) options.onPick(picked);
  };

  const selectLabel = t ? t("onboardingFlow.photo.select") : "사진 선택";
  const takeLabel = t ? t("chrome.critical.103") : "사진 찍기";
  const clearLabel = t ? t("chrome.critical.104") : "기본 아이콘으로 변경";
  const cancelLabel = t ? t("common.cancel") : "취소";
  const title = t ? t("chrome.critical.102") : "프로필 사진";

  if (Platform.OS === "ios") {
    const labels = [selectLabel, takeLabel];
    if (options.hasAvatar && options.onClear) labels.push(clearLabel);
    labels.push(cancelLabel);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex: options.hasAvatar && options.onClear ? labels.length - 2 : undefined,
      },
      (index) => {
        if (index === 0) void run("library");
        else if (index === 1) void run("camera");
        else if (options.hasAvatar && options.onClear && index === 2) void run("clear");
      },
    );
    return;
  }

  const buttons: Array<{ text: string; style?: "cancel" | "destructive"; onPress?: () => void }> = [
    { text: selectLabel, onPress: () => void run("library") },
    { text: takeLabel, onPress: () => void run("camera") },
  ];
  if (options.hasAvatar && options.onClear) {
    buttons.push({ text: clearLabel, style: "destructive", onPress: () => void run("clear") });
  }
  buttons.push({ text: cancelLabel, style: "cancel" });
  Alert.alert(title, undefined, buttons);
}
