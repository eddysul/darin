import AsyncStorage from "@react-native-async-storage/async-storage";
import { consumeQaFaultOnce } from "./qaDebug";
import { STORAGE_KEYS } from "./storageKeys";

function canInjectRead(key: string) {
  // Keep the configured-user routing intact so the common in-app banner remains reachable.
  return __DEV__ && key !== STORAGE_KEYS.careSetup;
}

export const qaStorage = {
  async getItem(key: string): Promise<string | null> {
    if (canInjectRead(key) && (await consumeQaFaultOnce("storageRead"))) {
      throw new Error(`QA injected storage read failure: ${key}`);
    }
    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (__DEV__ && (await consumeQaFaultOnce("storageWrite"))) {
      throw new Error(`QA injected storage write failure: ${key}`);
    }
    await AsyncStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },

  async getAllKeys(): Promise<readonly string[]> {
    return AsyncStorage.getAllKeys();
  },

  async multiRemove(keys: readonly string[]): Promise<void> {
    if (!keys.length) return;
    await AsyncStorage.multiRemove([...keys]);
  },
};
