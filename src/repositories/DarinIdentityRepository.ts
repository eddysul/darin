import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../utils/storageKeys";
import type { DarinIdentity, DarinIdentityInput } from "../types/darinIdentity";

const TAG_LENGTH = 4;

export function generateDarinTag(): string {
  return Array.from({ length: TAG_LENGTH }, () => Math.floor(Math.random() * 10)).join("");
}

export function validateDarinNickname(value: string): string | null {
  const nickname = value.trim();
  if (!nickname) return "닉네임을 입력해 주세요.";
  if (Array.from(nickname).length < 2 || Array.from(nickname).length > 12) return "닉네임은 2~12자로 입력해 주세요.";
  if (nickname.includes("#")) return "닉네임에는 #을 사용할 수 없어요.";
  if (nickname.includes("/")) return "닉네임에는 /을 사용할 수 없어요.";
  return null;
}

export type DarinNicknameValidationCode = "required" | "length" | "hash" | "slash";

export function validateDarinNicknameCode(value: string): DarinNicknameValidationCode | null {
  const nickname = value.trim();
  if (!nickname) return "required";
  if (Array.from(nickname).length < 2 || Array.from(nickname).length > 12) return "length";
  if (nickname.includes("#")) return "hash";
  if (nickname.includes("/")) return "slash";
  return null;
}

export function parseDarinId(value: string): { darinId: string; nickname: string; tag: string } | null {
  const darinId = value.trim();
  if (validateDarinId(darinId)) return null;
  const marker = darinId.lastIndexOf("#");
  return { darinId, nickname: darinId.slice(0, marker), tag: darinId.slice(marker + 1) };
}

export function validateDarinId(value: string): string | null {
  const darinId = value.trim();
  const marker = darinId.lastIndexOf("#");
  if (marker <= 0 || marker !== darinId.indexOf("#")) return "Darin ID를 닉네임#0000 형식으로 입력해 주세요.";
  const nicknameError = validateDarinNickname(darinId.slice(0, marker));
  if (nicknameError) return nicknameError;
  if (!/^\d{4}$/.test(darinId.slice(marker + 1))) return "Darin ID의 코드는 숫자 4자리예요.";
  return null;
}

export function createDarinIdentity(input: DarinIdentityInput): DarinIdentity {
  const nickname = input.nickname.trim();
  const tag = input.tag.length === TAG_LENGTH ? input.tag : generateDarinTag();
  return { realNameFromProvider: input.realNameFromProvider.trim(), nickname, tag, darinId: `${nickname}#${tag}` };
}

function keyFor(userId: string) {
  return `${STORAGE_KEYS.darinIdentity}:${userId}`;
}

export const DarinIdentityRepository = {
  async get(userId: string): Promise<DarinIdentity | null> {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<DarinIdentity>;
      if (!parsed.nickname || !parsed.tag || !parsed.realNameFromProvider) return null;
      return createDarinIdentity({ realNameFromProvider: parsed.realNameFromProvider, nickname: parsed.nickname, tag: parsed.tag });
    } catch {
      return null;
    }
  },
  async save(userId: string, input: DarinIdentityInput): Promise<DarinIdentity> {
    const identity = createDarinIdentity(input);
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(identity));
    return identity;
  },
};
