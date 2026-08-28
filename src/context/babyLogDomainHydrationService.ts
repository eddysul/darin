import { isSupabaseConfigured } from "../lib/supabase";
import { BabyStickerRepository } from "../repositories/BabyStickerRepository";
import { CautionFoodRepository } from "../repositories/CautionFoodRepository";
import { FamilyRepository } from "../repositories/FamilyRepository";
import type { BabySticker } from "../types/babySticker";
import type { CautionFood } from "../types/cautionFood";
import type { DiaryEntry } from "../types/babyLog";
import type { FamilyMember } from "../types/family";
import type { GrowthBookEdit } from "../types/growthBook";
import { createEmptyGrowthBookEdit } from "../types/growthBook";
import type { GrowthRecord } from "../types/growthRecord";
import { getBabyStickers } from "../utils/babyStickersStore";
import { loadCautionFoods } from "../utils/cautionFoodsStore";
import { bootstrapDiaryFromServer } from "../utils/diaryServerSync";
import { getDiaryEntries } from "../utils/diaryStore";
import { getFamilyMembers } from "../utils/familyMembersStore";
import { bootstrapGrowthBookFromServer } from "../utils/growthBookServerSync";
import { ensureGrowthBookEdit, getGrowthBookEdit } from "../utils/growthBookStore";
import { bootstrapGrowthRecordsFromServer } from "../utils/growthRecordServerSync";
import { getGrowthRecords } from "../utils/growthRecordsStore";
import { containsLegacySampleDiary, removeLegacySampleDiaries, removeLegacySampleFamily } from "../utils/legacySampleData";
import type { LocalDataScope } from "../utils/scopedLocalStorage";

export type HydratedDomainSnapshot<T> = {
  value: T | null;
  persist: boolean;
};

export async function resolveDiarySnapshot(
  scope: LocalDataScope | null,
): Promise<HydratedDomainSnapshot<DiaryEntry[]>> {
  const stored = getDiaryEntries();
  const local = stored === null ? [] : removeLegacySampleDiaries(stored);
  const cleanedLegacy = stored !== null && local.length !== stored.length;
  const boot = await bootstrapDiaryFromServer(scope, local);
  if (boot.usedServer && boot.entries !== null) {
    return { value: boot.entries, persist: true };
  }
  return { value: stored === null ? null : local, persist: cleanedLegacy };
}

export async function resolveFamilySnapshot(
  scope: LocalDataScope | null,
): Promise<HydratedDomainSnapshot<FamilyMember[]>> {
  const stored = getFamilyMembers();
  const local = stored === null ? null : removeLegacySampleFamily(stored);
  const cleanedLegacy = stored !== null && local !== null && local.length !== stored.length;
  if (scope?.babyId && isSupabaseConfigured()) {
    try {
      const server = await FamilyRepository.listMembersAsFamily(scope.babyId);
      if (server.length) return { value: server, persist: true };
    } catch {
      // Keep the scoped device cache while a co-member profile join is unavailable.
    }
  }
  return { value: local, persist: cleanedLegacy };
}

export async function resolveGrowthBookSnapshot(input: {
  scope: LocalDataScope | null;
  babyName: string;
}): Promise<{ edit: GrowthBookEdit; mediaFailed: number }> {
  const storedEdit = getGrowthBookEdit();
  const storedDiary = getDiaryEntries();
  const localEdit = storedDiary && containsLegacySampleDiary(storedDiary)
    ? createEmptyGrowthBookEdit({ babyId: input.scope?.babyId ?? "", babyName: input.babyName })
    : ensureGrowthBookEdit({
        babyId: input.scope?.babyId ?? "",
        babyName: input.babyName,
        existing: storedEdit,
      });
  const boot = await bootstrapGrowthBookFromServer({
    scope: input.scope,
    babyName: input.babyName,
    localEdit,
    diaryOrder: (storedDiary ?? []).filter((entry) => entry.includedInGrowthBook).map((entry) => entry.id),
  });
  return {
    edit: boot.usedServer && boot.edit ? boot.edit : localEdit,
    mediaFailed: boot.mediaFailed,
  };
}

export async function resolveStickerSnapshot(
  scope: LocalDataScope | null,
): Promise<BabySticker[]> {
  const stored = getBabyStickers() ?? [];
  if (!scope) return stored;
  try {
    return await BabyStickerRepository.uploadLocalBabyStickersMigration(scope, stored);
  } catch {
    // Keep local originals and retry migration on the next scoped hydration.
    return stored;
  }
}

export async function resolveGrowthRecordsSnapshot(
  hasSavedCareSetup: boolean,
): Promise<HydratedDomainSnapshot<GrowthRecord[]>> {
  const stored = getGrowthRecords();
  const local = stored ?? [];
  if (!hasSavedCareSetup) return { value: stored, persist: false };
  const boot = await bootstrapGrowthRecordsFromServer(local);
  if (boot.usedServer && boot.records !== null) {
    return { value: boot.records, persist: true };
  }
  return { value: stored, persist: false };
}

export async function resolveCautionFoodsSnapshot(scope: LocalDataScope): Promise<CautionFood[]> {
  const local = await loadCautionFoods(scope);
  if (!isSupabaseConfigured()) return local;
  try {
    const server = await CautionFoodRepository.list(scope.babyId);
    const merged = [...server];
    const serverNames = new Set(server.map((food) => food.normalizedFoodName));
    for (const localFood of local) {
      if (serverNames.has(localFood.normalizedFoodName)) continue;
      try {
        const migrated = await CautionFoodRepository.add(scope.babyId, localFood.foodName, localFood.source);
        merged.push(migrated);
        serverNames.add(migrated.normalizedFoodName);
      } catch {
        merged.push(localFood);
      }
    }
    return merged;
  } catch {
    return local;
  }
}
