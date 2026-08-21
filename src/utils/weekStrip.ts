/**
 * 7일 리듬 스트립 — 한 주를 가로로 펼친 것.
 *
 * 오늘의 리듬이 하루를 원으로 본 것이라면 이건 같은 데이터를 주 단위로 본다.
 * 밤잠이 한 덩어리로 모이는지 같은 "형태" 변화는 숫자로는 안 보이고 이 그림에서만 보인다.
 * 색과 묶음은 오늘의 리듬과 같은 규칙(logCategoryDisplay)을 쓴다.
 */
import type { BabyLogEntry } from "../types/babyLog";
import { formatDateKey, lastNDateKeys, weekdayLabelKo } from "./dateKey";
import { toMinutes } from "./formatLog";
import { displayKey, displayMeta, hasDuration, isDisplayableCat } from "./logCategoryDisplay";
import { WEEK_DAYS } from "./weeklyFeatureTable";

const DAY_MINUTES = 1440;

export type StripBlock = {
  key: string;
  /** 0~100. 하루를 100으로 본 시작 위치와 길이. */
  startPct: number;
  widthPct: number;
};

export type StripTick = {
  key: string;
  /** 0~100. */
  pct: number;
};

export type StripDay = {
  dateKey: string;
  label: string;
  blocks: StripBlock[];
  ticks: StripTick[];
};

export type WeekStrip = {
  days: StripDay[];
  legend: { key: string; label: string; color: string }[];
};

/**
 * 최근 6일을 오래된 순으로.
 *
 * 자정을 넘는 잠은 시작한 날에서 자르지 않고 다음 날 줄 왼쪽으로 이어 그린다.
 * 자르면 밤잠 덩어리가 반쪽으로 보여서 이 그림의 요점이 사라진다.
 */
export function buildWeekStrip(logs: BabyLogEntry[], now = new Date()): WeekStrip {
  const todayKey = formatDateKey(now);
  const keys = lastNDateKeys(WEEK_DAYS + 1, now).slice(0, WEEK_DAYS);
  const index = new Map(keys.map((key, i) => [key, i] as const));

  const days: StripDay[] = keys.map((dateKey) => ({
    dateKey,
    label: weekdayLabelKo(dateKey, todayKey),
    blocks: [],
    ticks: [],
  }));
  const seen: string[] = [];

  for (const entry of logs) {
    if (!isDisplayableCat(entry.cat)) continue;
    const dateKey = entry.dateKey ?? todayKey;
    const dayIndex = index.get(dateKey);
    const start = toMinutes(entry.time);
    if (!Number.isFinite(start)) continue;

    const key = displayKey(entry.cat);
    const duration = Number.parseInt(entry.duration ?? "0", 10) || 0;

    if (hasDuration(entry.cat) && duration > 0) {
      const end = start + duration;
      if (dayIndex !== undefined) {
        const width = Math.min(end, DAY_MINUTES) - start;
        if (width > 0) {
          days[dayIndex].blocks.push({
            key,
            startPct: (start / DAY_MINUTES) * 100,
            widthPct: (width / DAY_MINUTES) * 100,
          });
          if (!seen.includes(key)) seen.push(key);
        }
      }
      // 자정을 넘은 몫은 다음 날 줄 왼쪽에
      if (end > DAY_MINUTES && dayIndex !== undefined && dayIndex + 1 < days.length) {
        days[dayIndex + 1].blocks.push({
          key,
          startPct: 0,
          widthPct: (Math.min(end - DAY_MINUTES, DAY_MINUTES) / DAY_MINUTES) * 100,
        });
        if (!seen.includes(key)) seen.push(key);
      }
      continue;
    }

    if (dayIndex !== undefined) {
      days[dayIndex].ticks.push({ key, pct: (start / DAY_MINUTES) * 100 });
      if (!seen.includes(key)) seen.push(key);
    }
  }

  return {
    days,
    legend: seen.map((key) => ({ key, ...displayMeta(key) })),
  };
}

/** 그릴 것이 하나도 없으면 스트립을 띄우지 않는다. */
export function stripHasData(strip: WeekStrip): boolean {
  return strip.days.some((day) => day.blocks.length > 0 || day.ticks.length > 0);
}
