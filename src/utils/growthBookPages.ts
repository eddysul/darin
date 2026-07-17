import type { DiaryEntry } from "../types/babyLog";
import {
  diaryBookBody,
  diaryMilestoneLabel,
  diaryPrimaryPhoto,
  sortGrowthBookEntries,
} from "./diaryModel";

export type GrowthBookPageKind = "cover" | "moment" | "photo" | "letter";

export type GrowthBookPage = {
  id: string;
  kind: GrowthBookPageKind;
  title: string;
  subtitle?: string;
  body?: string;
  photoUri?: string | null;
  dateLabel?: string;
  moodStamp?: string | null;
  weatherStamp?: string | null;
  milestone?: string | null;
};

function formatRange(entries: DiaryEntry[]): string {
  if (entries.length === 0) return "";
  const keys = entries.map((e) => e.dateKey).filter(Boolean).sort();
  const first = keys[0];
  const last = keys[keys.length - 1];
  const fmt = (k: string) => {
    const [y, m] = k.split("-");
    return `${y}.${m}`;
  };
  if (!first) return "";
  if (first === last) return fmt(first);
  return `${fmt(first)} - ${fmt(last)}`;
}

/** Cover + one page per entry + closing letter. */
export function buildGrowthBookPages(input: {
  babyName: string;
  entries: DiaryEntry[];
}): GrowthBookPage[] {
  const sorted = sortGrowthBookEntries(input.entries.filter((e) => e.includedInGrowthBook));
  const pages: GrowthBookPage[] = [];
  const coverPhoto = sorted.map(diaryPrimaryPhoto).find(Boolean) ?? null;

  pages.push({
    id: "cover",
    kind: "cover",
    title: `${input.babyName}의 첫 순간들`,
    subtitle: "성장책",
    photoUri: coverPhoto,
    dateLabel: formatRange(sorted) || `${new Date().getFullYear()}`,
  });

  for (const entry of sorted) {
    const milestone = diaryMilestoneLabel(entry);
    const photo = diaryPrimaryPhoto(entry);
    const kind: GrowthBookPageKind = photo && !milestone ? "photo" : "moment";

    pages.push({
      id: `entry-${entry.id}`,
      kind,
      title: milestone ?? `${input.babyName}의 하루`,
      subtitle: milestone ? "성장 순간" : photo ? "사진" : "일기",
      body: diaryBookBody(entry),
      photoUri: photo,
      dateLabel: entry.date,
      moodStamp: entry.moodStamp,
      weatherStamp: entry.weatherStamp,
      milestone,
    });
  }

  pages.push({
    id: "letter",
    kind: "letter",
    title: "사랑하는 너에게",
    subtitle: "마지막 편지",
    body:
      sorted.length > 0
        ? `${input.babyName}야,\n\n이 책에 담긴 ${sorted.length}개의 순간은 우리가 함께 웃고, 울고, 성장한 날들이야.\n\n앞으로도 너의 하루하루를 소중히 남겨둘게.\n\n사랑해.`
        : `${input.babyName}야,\n\n앞으로의 소중한 순간들을 이 책에 하나씩 담아갈게.\n\n사랑해.`,
  });

  return pages;
}

export function estimateGrowthBookPageCount(entryCount: number): number {
  return Math.max(2, entryCount + 2);
}
