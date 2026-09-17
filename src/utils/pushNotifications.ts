import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { createId } from "./id";
import { NotificationRepository } from "../repositories/NotificationRepository";
import { queuePushTokenOperation } from "./pushTokenOperationQueue";
import type { PushPermissionState } from "../types/notifications";

const DEVICE_ID_KEY = "darin:push-device-id";
const INSTALLATION_SECRET_KEY = "darin:push-installation-secret";

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

async function getPushInstallationSecret(): Promise<string> {
  const current = await AsyncStorage.getItem(INSTALLATION_SECRET_KEY);
  if (current && current.length >= 32) return current;
  const next = `${createId()}${createId()}`;
  await AsyncStorage.setItem(INSTALLATION_SECRET_KEY, next);
  return next;
}

/** Registers only after permission is already granted. It never prompts on app launch. */
export async function registerCurrentPushToken(): Promise<boolean> {
  return queuePushTokenOperation(async () => {
    if (await getPushPermissionState() !== "granted") return false;
    try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Darin",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token)) return false;
    await NotificationRepository.registerToken({
      deviceId: await getPushDeviceId(),
      installationSecret: await getPushInstallationSecret(),
      expoPushToken: token,
    });
      return true;
    } catch {
      // Simulator, Expo Go and builds without an EAS project id may not provide a token.
      return false;
    }
  });
}

export async function unregisterCurrentPushToken(): Promise<void> {
  await queuePushTokenOperation(async () => {
    const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (deviceId) await NotificationRepository.unregisterToken(deviceId);
  });
}
