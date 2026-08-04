import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { createId } from "./id";
import { NotificationRepository } from "../repositories/NotificationRepository";
import type { PushPermissionState } from "../types/notifications";

const DEVICE_ID_KEY = "darin:push-device-id";

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return "unavailable";
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status === "granted") return "granted";
    if (permission.status === "denied") return "denied";
    return "not_determined";
  } catch {
    return "unavailable";
  }
}

export async function requestPushPermission(): Promise<PushPermissionState> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return "unavailable";
  try {
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status === "granted") return "granted";
    if (permission.status === "denied") return "denied";
    return "not_determined";
  } catch {
    return "unavailable";
  }
}

export async function getPushDeviceId(): Promise<string> {
  const current = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (current) return current;
  const next = createId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

/** Registers only after permission is already granted. It never prompts on app launch. */
export async function registerCurrentPushToken(): Promise<boolean> {
  if (await getPushPermissionState() !== "granted") return false;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Darin 알림",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token)) return false;
    await NotificationRepository.registerToken({
      deviceId: await getPushDeviceId(),
      expoPushToken: token,
    });
    return true;
  } catch {
    // Simulator, Expo Go and builds without an EAS project id may not provide a token.
    return false;
  }
}

export async function unregisterCurrentPushToken(): Promise<void> {
  try {
    await NotificationRepository.unregisterToken(await getPushDeviceId());
  } catch {
    // Logout must continue even when the device is offline.
  }
}
