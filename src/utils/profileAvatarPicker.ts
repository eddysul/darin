import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS, Alert, Platform } from "react-native";
import { MAX_PROFILE_AVATAR_BYTES } from "../types/profileSettings";

export type PickedAvatar = {
  uri: string;
  mimeType?: string;
  fileSize?: number;
};

async function launchLibrary(): Promise<PickedAvatar | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("사진 접근", "사진을 선택하려면 사진 보관함 권한이 필요해요.");
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
    Alert.alert("사진 크기", "사진은 5MB 이하만 올릴 수 있어요.");
    return null;
  }
  return { uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize };
}

async function launchCamera(): Promise<PickedAvatar | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("카메라 접근", "사진을 찍으려면 카메라 권한이 필요해요.");
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.85,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.fileSize !== undefined && asset.fileSize > MAX_PROFILE_AVATAR_BYTES) {
    Alert.alert("사진 크기", "사진은 5MB 이하만 올릴 수 있어요.");
    return null;
  }
  return { uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize };
}

export type AvatarPickerChoice = "library" | "camera" | "clear" | "cancel";

export function presentAvatarPicker(options: {
  hasAvatar: boolean;
  onPick: (avatar: PickedAvatar) => void;
  onClear?: () => void;
}): void {
  const run = async (choice: AvatarPickerChoice) => {
    if (choice === "cancel") return;
    if (choice === "clear") {
      options.onClear?.();
      return;
    }
    const picked = choice === "camera" ? await launchCamera() : await launchLibrary();
    if (picked) options.onPick(picked);
  };

  if (Platform.OS === "ios") {
    const labels = ["사진 선택", "사진 찍기"];
    if (options.hasAvatar && options.onClear) labels.push("기본 아이콘으로 변경");
    labels.push("취소");
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
    { text: "사진 선택", onPress: () => void run("library") },
    { text: "사진 찍기", onPress: () => void run("camera") },
  ];
  if (options.hasAvatar && options.onClear) {
    buttons.push({ text: "기본 아이콘으로 변경", style: "destructive", onPress: () => void run("clear") });
  }
  buttons.push({ text: "취소", style: "cancel" });
  Alert.alert("프로필 사진", undefined, buttons);
}
