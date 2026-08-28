import { useEffect } from "react";
import type { BabyLogEntry, ChatMessage, DiaryEntry } from "../types/babyLog";
import type { BabySticker } from "../types/babySticker";
import type { FamilyMember } from "../types/family";
import type { GrowthBookEdit } from "../types/growthBook";
import type { GrowthRecord } from "../types/growthRecord";
import type { LocalDataScope } from "../utils/scopedLocalStorage";
import { saveBabyLogs } from "../utils/babyLogsStore";
import { saveBabyStickers } from "../utils/babyStickersStore";
import { saveChatHistory } from "../utils/chatHistoryStore";
import { saveDiaryEntries } from "../utils/diaryStore";
import { saveFamilyMembers } from "../utils/familyMembersStore";
import { saveGrowthBookEdit } from "../utils/growthBookStore";
import { saveGrowthRecords } from "../utils/growthRecordsStore";

type HydratedSlice<T> = {
  value: T;
  hydrated: boolean;
};

type BabyLogCachePersistenceOptions = {
  scope: LocalDataScope | null;
  logs: HydratedSlice<BabyLogEntry[]>;
  diaryEntries: HydratedSlice<DiaryEntry[]>;
  chatHistory: HydratedSlice<ChatMessage[]>;
  familyMembers: HydratedSlice<FamilyMember[]>;
  growthBookEdit: HydratedSlice<GrowthBookEdit>;
  babyStickers: HydratedSlice<BabySticker[]>;
  growthRecords: HydratedSlice<GrowthRecord[]>;
};

/** Keeps AsyncStorage as a scoped cache without mixing persistence effects into the domain context. */
export function useBabyLogCachePersistence(options: BabyLogCachePersistenceOptions): void {
  const { scope } = options;

  useEffect(() => {
    if (!options.logs.hydrated) return;
    void saveBabyLogs(options.logs.value, scope);
  }, [options.logs.hydrated, options.logs.value, scope]);

  useEffect(() => {
    if (!options.diaryEntries.hydrated) return;
    void saveDiaryEntries(options.diaryEntries.value, scope);
  }, [options.diaryEntries.hydrated, options.diaryEntries.value, scope]);

  useEffect(() => {
    if (!options.chatHistory.hydrated) return;
    void saveChatHistory(options.chatHistory.value, scope);
  }, [options.chatHistory.hydrated, options.chatHistory.value, scope]);

  useEffect(() => {
    if (!options.familyMembers.hydrated) return;
    void saveFamilyMembers(options.familyMembers.value, scope);
  }, [options.familyMembers.hydrated, options.familyMembers.value, scope]);

  useEffect(() => {
    if (!options.growthBookEdit.hydrated) return;
    void saveGrowthBookEdit(options.growthBookEdit.value, scope);
  }, [options.growthBookEdit.hydrated, options.growthBookEdit.value, scope]);

  useEffect(() => {
    if (!options.babyStickers.hydrated) return;
    void saveBabyStickers(options.babyStickers.value, scope);
  }, [options.babyStickers.hydrated, options.babyStickers.value, scope]);

  useEffect(() => {
    if (!options.growthRecords.hydrated) return;
    void saveGrowthRecords(options.growthRecords.value, scope);
  }, [options.growthRecords.hydrated, options.growthRecords.value, scope]);
}
