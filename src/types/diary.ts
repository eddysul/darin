export type DiaryMedia = {
  id: string;
  diaryEntryId: string;
  babyId: string;
  storagePath: string;
  mediaType: "image";
  width?: number;
  height?: number;
  createdAt: string;
};

export type DiaryMigrationResult = {
  uploaded: number;
  failed: number;
  photoFailed: number;
};
