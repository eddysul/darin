import { isSupabaseConfigured } from "../lib/supabase";
import { AuthRepository } from "../repositories/AuthRepository";
import { GrowthBookRepository } from "../repositories/GrowthBookRepository";
import type { GrowthBookEdit } from "../types/growthBook";
import {
  isGrowthBookServerMigrationComplete,
  markGrowthBookServerMigrationComplete,
} from "./growthBookServerMigrationStore";
import { isValidLocalDataScope, type LocalDataScope } from "./scopedLocalStorage";

export type GrowthBookBootstrapResult = {
  usedServer: boolean;
  edit: GrowthBookEdit | null;
  migrated: boolean;
  mediaFailed: number;
  error?: string;
};

function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

function hasLocalGrowthBookData(edit: GrowthBookEdit | null): edit is GrowthBookEdit {
  if (!edit) return false;
  return !!edit.coverPhotoUri
    || !!edit.coverSubtitle
    || !!edit.coverDateRange
    || Object.keys(edit.pages).length > 0
    || edit.letters.length > 0;
}

async function authenticated(scope: LocalDataScope): Promise<boolean> {
  const user = await AuthRepository.getUser();
  return user?.id === scope.userId;
}

export async function bootstrapGrowthBookFromServer(input: {
  scope: LocalDataScope | null;
  babyName: string;
  localEdit: GrowthBookEdit | null;
  diaryOrder: string[];
}): Promise<GrowthBookBootstrapResult> {
  const empty = { usedServer: false, edit: null, migrated: false, mediaFailed: 0 };
  if (!isSupabaseConfigured() || !isValidLocalDataScope(input.scope)) return empty;
  if (!(await authenticated(input.scope))) return empty;
  try {
    const complete = await isGrowthBookServerMigrationComplete(input.scope);
    if (!complete && hasLocalGrowthBookData(input.localEdit)) {
      const result = await GrowthBookRepository.saveEdit({
        babyId: input.scope.babyId,
        babyName: input.babyName,
        edit: input.localEdit,
        diaryOrder: input.diaryOrder,
      });
      if (result.mediaFailed === 0) await markGrowthBookServerMigrationComplete(input.scope);
      return {
        usedServer: true,
        edit: result.mediaFailed === 0 ? result.edit : input.localEdit,
        migrated: true,
        mediaFailed: result.mediaFailed,
      };
    }
    const remote = await GrowthBookRepository.hydrate(input.scope.babyId, input.babyName);
    if (!complete && !hasLocalGrowthBookData(input.localEdit)) {
      await markGrowthBookServerMigrationComplete(input.scope);
    }
    return { ...empty, usedServer: true, edit: remote };
  } catch (error) {
    const errorText = message(error);
    console.warn("[supabase] growth book bootstrap failed:", errorText);
    return { ...empty, error: errorText };
  }
}

export async function syncGrowthBookEdit(input: {
  scope: LocalDataScope | null;
  babyName: string;
  edit: GrowthBookEdit;
  diaryOrder: string[];
}): Promise<GrowthBookEdit | null> {
  if (!isSupabaseConfigured() || !isValidLocalDataScope(input.scope)) return null;
  if (!(await authenticated(input.scope))) return null;
  try {
    const result = await GrowthBookRepository.saveEdit({
      babyId: input.scope.babyId,
      babyName: input.babyName,
      edit: input.edit,
      diaryOrder: input.diaryOrder,
    });
    if (result.mediaFailed > 0) {
      console.warn(`[supabase] ${result.mediaFailed} growth book media upload(s) failed; local source was retained.`);
      return null;
    }
    await markGrowthBookServerMigrationComplete(input.scope);
    return result.edit;
  } catch (error) {
    console.warn("[supabase] growth book save failed:", message(error));
    return null;
  }
}
