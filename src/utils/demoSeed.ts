/**
 * 데모용 시드 데이터 (개발 빌드 전용).
 *
 * 기존 QA 샘플은 7일치라 한눈에 탭의 절반이 빈 상태로 나온다.
 * 이 시드는 각 카드가 요구하는 최소 조건을 모두 채운다.
 *
 *   최근 경향  수유와 수면을 함께 기록한 날 9일 이상
 *   주간 요약  최근 6일 중 3일 이상
 *   건강 신호  오늘 체온 37.5도 이상
 *   성장       측정 기록 1건 이상
 *
 * 아기 생년월일에 맞춰 기간과 수치를 조절하므로, 신생아든 큰 아이든 자연스럽게 나온다.
 */
import type { BabyLogEntry } from "../types/babyLog";
import type { GrowthRecord } from "../types/growthRecord";
import type { CareSetup } from "../types/careSetup";
import { formatDateKey } from "./dateKey";
import { valueAtZ, zForPercentile, type WhoSex } from "./growthPercentile";
import { createId } from "./id";

/** 데모에서 보여줄 최대 기간. 아기가 더 어리면 나이에 맞춰 줄어든다. */
const MAX_DAYS = 28;

function ageInDays(birthDate?: string, now = new Date()): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const days = Math.floor((now.getTime() - birth.getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

function dateKeyDaysAgo(daysAgo: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  return formatDateKey(d);
}

function hhmm(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * 결정적 의사난수. 같은 날짜에는 항상 같은 값이 나와 데모가 재현 가능하다.
 *
 * 정수 해시를 쓴다. sin 기반으로 하면 ago*3+11 과 ago*5+3 처럼
 * 시드가 선형으로 늘어나는 두 수열 사이에 상관이 생겨서,
 * 심지도 않은 관계가 발견 카드에 잡힌다. 실제로 그렇게 새어 나왔다.
 */
function rnd(day: number, stream: number): number {
  let h = Math.imul(day + 1, 0x9e3779b1) ^ Math.imul(stream + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 하루·스트림별 흔들림. 스트림이 다르면 서로 무관한 수열이다. */
function jitter(day: number, stream: number, spread: number): number {
  return Math.round((rnd(day, stream) - 0.5) * 2 * spread);
}

type DemoActor = BabyLogEntry["createdBy"];

/**
 * 하루치 기록을 만든다.
 *
 * 날마다 서로 독립인 "그날의 사정" 다섯 개를 먼저 뽑고, 나머지 수치를 거기에 매단다.
 * 이렇게 해야 발견 카드가 잡아낼 관계가 서로 얽히지 않는다.
 *
 *   놀이 시간      →  총 수면
 *   수유 간격      →  가장 긴 잠
 *   목욕 시각      →  마지막 수유 시각 (저녁 루틴이 통째로 움직인다)
 *   총 수유량      →  기저귀 횟수
 *   밤잠 길이      →  기저귀 횟수 (길게 자면 밤중에 덜 간다)
 *
 * 실제 사용자 데이터에는 당연히 이런 관계가 없을 수 있다. 데모를 위한 것이다.
 */
function buildLogs(
  days: number,
  ageMonths: number,
  actor: DemoActor,
  now = new Date(),
): Omit<BabyLogEntry, "id">[] {
  const out: Omit<BabyLogEntry, "id">[] = [];
  // 이유식은 만 6개월부터. 그전에는 물도 따로 주지 않는다.
  const hasSolids = ageMonths >= 6;
  const feedsPerDay = ageMonths < 3 ? 8 : ageMonths < 7 ? 7 : 5;
  const baseVolume = ageMonths < 3 ? 90 : ageMonths < 7 ? 150 : 190;
  const baseSleep = ageMonths < 3 ? 900 : ageMonths < 7 ? 840 : 750;
  let foodIndex = 0;

  for (let ago = days - 1; ago >= 0; ago -= 1) {
    const dateKey = dateKeyDaysAgo(ago, now);
    const isToday = ago === 0;

    // ── 그날의 사정 (서로 독립인 다섯 스트림) ────────────────
    const playMin = 32 + jitter(ago, 1, 14);            // 18~46분
    const feedGap = 190 + jitter(ago, 2, 30);           // 160~220분
    const bathTime = 1170 + jitter(ago, 3, 55);         // 18:35~20:25
    const volumeShift = jitter(ago, 4, 22);             // 한 끼당 ±22ml
    const tummyMin = 21 + jitter(ago, 5, 9);            // 12~30분

    // ── 사정에 매달린 값들 ──────────────────────────────────
    // 잡음을 넉넉히 둔다. 상관이 0.95 를 넘으면 데모 티가 나고, 실제 기록은 그렇게 깨끗하지 않다.
    const sleepTotal = Math.round(baseSleep + (playMin - 32) * 3.4 + jitter(ago, 11, 38));
    const nightSleep = Math.round(590 + (feedGap - 190) * 1.4 + jitter(ago, 12, 32));
    // 목욕하고 재운다. 목욕이 이르면 잠자리도 이르다.
    const bedtime = Math.round(bathTime + 45 + jitter(ago, 13, 15));
    const perFeed = baseVolume + volumeShift;
    // 많이 먹은 날은 소변 기저귀가 는다.
    const wetCount = Math.max(3, Math.round(5.2 + volumeShift * 0.055 + jitter(ago, 14, 0.5)));
    // 터미타임을 오래 한 날은 대변을 더 본다.
    const stoolCount = isToday ? 1 : Math.max(1, Math.round(1.9 + (tummyMin - 21) * 0.075 + jitter(ago, 15, 0.4)));

    // ── 수유 ────────────────────────────────────────────────
    // 모유와 분유를 섞어 먹인다. 분유에만 양을 적는 것이 실제 기록과 같다.
    const feedCount = isToday ? 4 : feedsPerDay;
    const firstFeed = 375 + jitter(ago, 21, 15);
    for (let i = 0; i < feedCount; i += 1) {
      const time = Math.round(firstFeed + i * feedGap * 0.82);
      const breast = i % 3 === 1;
      out.push(
        breast
          ? {
              cat: "breast",
              time: hhmm(time),
              dateKey,
              duration: String(14 + jitter(ago, 30 + i, 5)),
              chip: i % 2 === 0 ? "왼쪽" : "오른쪽",
              createdBy: actor,
              source: "manual",
            }
          : {
              cat: "formula",
              time: hhmm(time),
              dateKey,
              amount: String(perFeed + jitter(ago, 40 + i, 8)),
              createdBy: actor,
              source: "manual",
            },
      );
    }

    // ── 수면 ────────────────────────────────────────────────
    if (isToday) {
      out.push({ cat: "sleep", time: "09:20", dateKey, duration: "50", createdBy: actor, source: "manual" });
      out.push({ cat: "sleep", time: "12:50", dateKey, duration: "75", createdBy: actor, source: "manual" });
    } else {
      const napTotal = Math.max(120, sleepTotal - nightSleep);
      const naps = [
        { start: 540, minutes: Math.round(napTotal * 0.34) },
        { start: 780, minutes: Math.round(napTotal * 0.42) },
        { start: 1020, minutes: Math.round(napTotal * 0.24) },
      ];
      for (const nap of naps) {
        out.push({
          cat: "sleep",
          time: hhmm(nap.start + jitter(ago, 50 + nap.start, 22)),
          dateKey,
          duration: String(Math.max(20, nap.minutes)),
          createdBy: actor,
          source: "manual",
        });
      }
      // 밤잠. 이 월령이면 밤에 한 번은 깨므로 두 덩어리로 적는다.
      // 한 건으로 적으면 "밤잠"과 "가장 긴 잠"이 같은 값이 되어 두 지표가 겹친다.
      const firstStretch = Math.round(nightSleep * 0.62);
      const wakeGap = 25 + jitter(ago, 16, 10);
      out.push({
        cat: "sleep",
        time: hhmm(bedtime),
        dateKey,
        duration: String(firstStretch),
        chip: "밤잠",
        createdBy: actor,
        source: "manual",
      });
      out.push({
        cat: "sleep",
        time: hhmm(bedtime + firstStretch + wakeGap),
        dateKey,
        duration: String(Math.max(60, nightSleep - firstStretch)),
        chip: "밤잠",
        createdBy: actor,
        source: "manual",
      });
    }

    // ── 기저귀 ──────────────────────────────────────────────
    for (let i = 0; i < stoolCount; i += 1) {
      out.push({
        cat: "diaper",
        time: hhmm(465 + i * 280 + jitter(ago, 60 + i, 25)),
        dateKey,
        chip: "대변",
        chip2: "황금색",
        createdBy: actor,
        source: "manual",
      });
    }
    const urineCount = isToday ? 2 : wetCount;
    for (let i = 0; i < urineCount; i += 1) {
      out.push({
        cat: "diaper",
        time: hhmm(420 + Math.round((i * 960) / Math.max(1, urineCount)) + jitter(ago, 70 + i, 18)),
        dateKey,
        chip: "소변",
        createdBy: actor,
        source: "manual",
      });
    }

    if (isToday) continue;

    // ── 활동 ────────────────────────────────────────────────
    out.push({
      cat: "tummy",
      time: hhmm(615 + jitter(ago, 23, 30)),
      dateKey,
      duration: String(tummyMin),
      createdBy: actor,
      source: "manual",
    });
    out.push({
      cat: "play",
      time: hhmm(930 + jitter(ago, 24, 50)),
      dateKey,
      duration: String(playMin),
      details: ["모빌 보기", "딸랑이", "노래 듣기", "거울 보기", "발 잡기"][ago % 5],
      createdBy: actor,
      source: "manual",
    });
    out.push({ cat: "bath", time: hhmm(bathTime), dateKey, createdBy: actor, source: "manual" });

    if (ago % 2 === 1) {
      out.push({
        cat: "pump",
        time: hhmm(1290 + jitter(ago, 25, 35)),
        dateKey,
        amount: String(95 + jitter(ago, 26, 35)),
        createdBy: actor,
        source: "manual",
      });
    }
    if (ago === 9) {
      out.push({ cat: "doctor", time: hhmm(615), dateKey, title: "예방접종", createdBy: actor, source: "manual" });
    }
    if (ago === 8 || ago === 7) {
      out.push({ cat: "med", time: hhmm(1155), dateKey, createdBy: actor, source: "manual" });
    }

    // ── 이유식 월령에서만 ───────────────────────────────────
    if (hasSolids) {
      const water = Math.max(40, 120 + jitter(ago, 27, 55));
      out.push({ cat: "water", time: hhmm(660), dateKey, amount: String(water), createdBy: actor, source: "manual" });
      if (ago % 3 !== 0) {
        out.push({ cat: "snack", time: hhmm(960), dateKey, ingredients: [["바나나", "치즈", "쌀과자"][ago % 3]], createdBy: actor, source: "manual" });
      }
      const menu = ["고구마", "미음", "애호박", "소고기", "당근", "바나나"];
      out.push({
        cat: "food",
        time: hhmm(690),
        dateKey,
        ingredients: [menu[foodIndex++ % menu.length]],
        amount: String(Math.max(25, Math.round(40 + (water - 70) * 0.32 + jitter(ago, 28, 5)))),
        chip: ago % 5 === 0 ? "보통" : "잘 먹음",
        chip2: "없음",
        createdBy: actor,
        source: "manual",
      });
    }
  }

  return out;
}

/**
 * 검진·예방접종 때 재는 시점. 실제 병원 방문 월령을 따른다.
 * 이 시점들이 있어야 성장 곡선이 출생부터 이어진 선으로 보인다.
 */
const CHECKUP_MONTHS = [0, 1, 2, 4, 6, 9, 12, 18, 24, 30, 36];

/**
 * 데모 성장 기록.
 *
 * 값을 임의로 만들지 않고 WHO 기준에서 뽑는다. 성별에 따라 곡선이 다르므로
 * 성별을 모르면 남아 기준으로 그린다 (데모 화면에 아무것도 안 나오는 것보다 낫다).
 * 백분위는 60 근처에서 조금씩 흔들리게 해서 실제 기록처럼 보이게 한다.
 */
function buildGrowthRecords(
  ageMonthsNow: number,
  sex: WhoSex,
  babyId: string,
  createdBy: string,
  now = new Date(),
): GrowthRecord[] {
  const picked = new Set<number>([0]);
  for (const month of CHECKUP_MONTHS) {
    if (month <= ageMonthsNow) picked.add(month);
  }
  // 신생아기는 병원에서도 집에서도 자주 잰다.
  // 검진 시점만 쓰면 생후 몇 주짜리 아기는 점이 하나뿐이라 곡선이 그려지지 않는다.
  const earlyStep = ageMonthsNow < 3 ? 0.25 : 0.5;
  for (let month = 0; month <= Math.min(ageMonthsNow, 3); month += earlyStep) {
    picked.add(Number(month.toFixed(2)));
  }
  const months = [...picked].sort((a, b) => a - b);
  if (ageMonthsNow - months[months.length - 1] > 0.2) months.push(Number(ageMonthsNow.toFixed(2)));

  const records: GrowthRecord[] = [];
  months.forEach((month, index) => {
    const ageDays = Math.round(month * 30.4375);
    const iso = new Date(now);
    iso.setDate(iso.getDate() - Math.round((ageMonthsNow - month) * 30.4375));

    const z = zForPercentile(60 + jitter(index, 90, 16));
    const weight = valueAtZ("weight", sex, ageDays, z);
    const height = valueAtZ("height", sex, ageDays, z);
    const head = valueAtZ("head", sex, ageDays, z);
    if (weight === null || height === null || head === null) return;

    records.push({
      id: createId(),
      babyId,
      measuredAt: formatDateKey(iso),
      weightKg: Number(weight.toFixed(2)),
      weightUnit: "kg",
      heightCm: Number(height.toFixed(1)),
      heightUnit: "cm",
      headCircumferenceCm: Number(head.toFixed(1)),
      headCircumferenceUnit: "cm",
      source: "hospital",
      inputMethod: "manual",
      userConfirmed: true,
      createdBy,
      createdAt: iso.toISOString(),
      updatedAt: iso.toISOString(),
    });
  });

  return records;
}

export type DemoSeed = {
  logs: Omit<BabyLogEntry, "id">[];
  growthRecords: GrowthRecord[];
  days: number;
};

export function buildDemoSeed(input: {
  careSetup: CareSetup;
  actor: DemoActor;
  babyId: string;
  userId: string;
  now?: Date;
}): DemoSeed {
  const now = input.now ?? new Date();
  const age = ageInDays(input.careSetup.child.birthDate, now);
  // 생년월일이 없거나 아기가 아주 어리면 카드가 요구하는 최소 일수는 채운다.
  const days = Math.max(12, Math.min(MAX_DAYS, age ?? MAX_DAYS));
  const ageMonths = (age ?? MAX_DAYS) / 30.44;

  return {
    days,
    logs: buildLogs(days, ageMonths, input.actor, now),
    growthRecords: buildGrowthRecords(
      ageMonths,
      input.careSetup.child.gender === "girl" ? "girl" : "boy",
      input.babyId,
      input.userId,
      now,
    ),
  };
}
