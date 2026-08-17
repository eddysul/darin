/**
 * 생년월일만으로 결정되는 참조 일정 (기록 데이터 불필요).
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 검진·접종은 현재 PLACEHOLDER 상태입니다 (MVP).                │
 * │ SCHEDULE_DATA_READY === false 인 동안 UI에 노출되지 않습니다. │
 * └─────────────────────────────────────────────────────────────┘
 *
 * 켜기 전에 팀에서 확정해야 하는 것:
 *  1. 대상 국가. 아래 데이터는 100% 대한민국 제도 기준인데,
 *     이 앱은 preferredLanguage "en"과 파운드/인치 단위를 지원한다.
 *     영어 사용자에게는 이 일정이 전부 틀리다. 국가 분기 필요 여부 결정.
 *  2. 예방접종 표를 질병관리청 공식 PDF와 대조 (https://nip.kdca.go.kr).
 *     아래 표는 텍스트 2차 출처로 작성됐고, 참고한 자료 중 하나
 *     (국립재활원 페이지)는 IPV 4차·MMR 2차가 실제로 틀렸다.
 *     특히 확인 필요: 로타바이러스(RV1 2회/RV5 3회), 일본뇌염(불활성화/약독화),
 *     구강검진 회차(자료마다 3~4회로 갈림).
 *  3. 건강검진은 국민건강보험공단 국가검진(일반 8회 + 구강)이며
 *     구간을 넘기면 무료 지원이 종료된다 = 실제 마감이 있다.
 *     접종은 늦어도 의사가 조정하므로 마감이 아니다. 이 구분은 UI 문구에 반영돼 있다.
 *
 * 안전 체크포인트는 위와 성격이 다르다. 공적 제도가 아니라 일반 육아 안전 상식이며
 * 국가와 무관하므로 지금도 노출된다. 특정 기관 지침의 인용이 아님에 유의.
 */

/** 검진·접종 데이터가 팀 검토를 통과했는지. false면 placeholder만 노출. */
export const SCHEDULE_DATA_READY = false;

export type ScheduleKind = "checkup" | "vaccine" | "safety";

/** 출생일 기준 오프셋. days는 신생아 구간처럼 월 단위가 부적절할 때만 사용. */
export type AgeOffset = { months: number } | { days: number };

export type ScheduleItem = {
  id: string;
  kind: ScheduleKind;
  /** 카드 본문 */
  label: string;
  /** 시기 표기 ("9~12개월") */
  window: string;
  from: AgeOffset;
  to: AgeOffset;
};

/** 국가 영유아 건강검진 — 구간을 놓치면 무료 지원이 종료된다. */
const CHECKUPS: ScheduleItem[] = [
  { id: "checkup-1", kind: "checkup", label: "1차 영유아 건강검진", window: "14~35일", from: { days: 14 }, to: { days: 35 } },
  { id: "checkup-2", kind: "checkup", label: "2차 영유아 건강검진", window: "4~6개월", from: { months: 4 }, to: { months: 6 } },
  { id: "checkup-3", kind: "checkup", label: "3차 영유아 건강검진", window: "9~12개월", from: { months: 9 }, to: { months: 12 } },
  { id: "checkup-4", kind: "checkup", label: "4차 영유아 건강검진", window: "18~24개월", from: { months: 18 }, to: { months: 24 } },
  { id: "checkup-oral-1", kind: "checkup", label: "1차 구강검진", window: "18~29개월", from: { months: 18 }, to: { months: 29 } },
  { id: "checkup-5", kind: "checkup", label: "5차 영유아 건강검진", window: "30~36개월", from: { months: 30 }, to: { months: 36 } },
  { id: "checkup-6", kind: "checkup", label: "6차 영유아 건강검진", window: "42~48개월", from: { months: 42 }, to: { months: 48 } },
  { id: "checkup-oral-2", kind: "checkup", label: "2차 구강검진", window: "42~53개월", from: { months: 42 }, to: { months: 53 } },
  { id: "checkup-7", kind: "checkup", label: "7차 영유아 건강검진", window: "54~60개월", from: { months: 54 }, to: { months: 60 } },
  { id: "checkup-oral-3", kind: "checkup", label: "3차 구강검진", window: "54~65개월", from: { months: 54 }, to: { months: 65 } },
  { id: "checkup-8", kind: "checkup", label: "8차 영유아 건강검진", window: "66~71개월", from: { months: 66 }, to: { months: 71 } },
];

/**
 * 표준예방접종. 부모는 "회차"가 아니라 "병원 한 번"으로 경험하므로 방문 시점 기준으로 묶는다.
 * 로타바이러스는 백신 종류(RV1 2회 / RV5 3회)에 따라 달라 6개월 차수는 표기에서 제외.
 */
const VACCINES: ScheduleItem[] = [
  { id: "vac-0", kind: "vaccine", label: "B형간염 1차", window: "출생 직후", from: { days: 0 }, to: { days: 7 } },
  { id: "vac-bcg", kind: "vaccine", label: "BCG (결핵)", window: "4주 이내", from: { days: 0 }, to: { days: 28 } },
  { id: "vac-1m", kind: "vaccine", label: "B형간염 2차", window: "1개월", from: { months: 1 }, to: { months: 2 } },
  { id: "vac-2m", kind: "vaccine", label: "DTaP·IPV·Hib·폐렴구균 1차, 로타바이러스 1차", window: "2개월", from: { months: 2 }, to: { months: 3 } },
  { id: "vac-4m", kind: "vaccine", label: "DTaP·IPV·Hib·폐렴구균 2차, 로타바이러스 2차", window: "4개월", from: { months: 4 }, to: { months: 5 } },
  { id: "vac-6m", kind: "vaccine", label: "DTaP·IPV·Hib·폐렴구균 3차, B형간염 3차", window: "6개월", from: { months: 6 }, to: { months: 7 } },
  { id: "vac-flu", kind: "vaccine", label: "인플루엔자 (매년, 첫 해는 2회)", window: "6개월~", from: { months: 6 }, to: { months: 9 } },
  { id: "vac-12m", kind: "vaccine", label: "MMR 1차, 수두, Hib·폐렴구균 4차, 일본뇌염 1차", window: "12~15개월", from: { months: 12 }, to: { months: 15 } },
  { id: "vac-hepa", kind: "vaccine", label: "A형간염 1~2차 (6개월 이상 간격)", window: "12~23개월", from: { months: 12 }, to: { months: 23 } },
  { id: "vac-15m", kind: "vaccine", label: "DTaP 4차", window: "15~18개월", from: { months: 15 }, to: { months: 18 } },
  { id: "vac-4y", kind: "vaccine", label: "DTaP 5차, IPV 4차, MMR 2차", window: "만 4~6세", from: { months: 48 }, to: { months: 72 } },
];

/**
 * 안전 체크포인트. 발달 여부를 평가하지 않고 "환경을 이렇게 바꾸세요"만 말한다.
 * 아이의 수행을 기준으로 삼지 않는 것이 이 목록의 원칙.
 */
const SAFETY: ScheduleItem[] = [
  { id: "safe-fall", kind: "safety", label: "뒤집기 무렵 — 침대·소파 낙상 주의. 기저귀 갈 때 손 떼지 않기", window: "3~6개월", from: { months: 3 }, to: { months: 6 } },
  { id: "safe-food", kind: "safety", label: "이유식 시작 — 견과·포도·떡 등 질식 위험 음식 피하기", window: "4~7개월", from: { months: 4 }, to: { months: 7 } },
  { id: "safe-crawl", kind: "safety", label: "기어다니기 무렵 — 콘센트 커버, 모서리 보호대, 바닥 작은 물건 치우기", window: "7~11개월", from: { months: 7 }, to: { months: 11 } },
  { id: "safe-stand", kind: "safety", label: "잡고 서기 무렵 — 서랍장 벽 고정, 식탁보·전선 잡아당김 주의", window: "9~15개월", from: { months: 9 }, to: { months: 15 } },
  { id: "safe-walk", kind: "safety", label: "걷기 무렵 — 계단 안전문, 욕실 물 받아두지 않기", window: "12~24개월", from: { months: 12 }, to: { months: 24 } },
];

export const CARE_SCHEDULE: ScheduleItem[] = [...CHECKUPS, ...VACCINES, ...SAFETY];

function addOffset(birth: Date, offset: AgeOffset): Date {
  const date = new Date(birth);
  if ("days" in offset) date.setDate(date.getDate() + offset.days);
  else date.setMonth(date.getMonth() + offset.months);
  return date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export type ResolvedScheduleItem = ScheduleItem & {
  startAt: Date;
  endAt: Date;
  /** 시작일까지 남은 일수. 구간에 진입했으면 0 이하. */
  daysUntilStart: number;
  /** 종료일까지 남은 일수. */
  daysUntilEnd: number;
  /** 지금이 구간 안인지. */
  active: boolean;
};

/** 아직 끝나지 않은 항목만, 시작일 순으로. */
export function resolveSchedule(birthDate: string, now = new Date()): ResolvedScheduleItem[] {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return [];
  const today = startOfDay(now);
  const dayMs = 24 * 60 * 60 * 1000;

  return CARE_SCHEDULE.map((item) => {
    const startAt = startOfDay(addOffset(birth, item.from));
    const endAt = startOfDay(addOffset(birth, item.to));
    const daysUntilStart = Math.round((startAt.getTime() - today.getTime()) / dayMs);
    const daysUntilEnd = Math.round((endAt.getTime() - today.getTime()) / dayMs);
    return {
      ...item,
      startAt,
      endAt,
      daysUntilStart,
      daysUntilEnd,
      active: daysUntilStart <= 0 && daysUntilEnd >= 0,
    };
  })
    .filter((item) => item.daysUntilEnd >= 0)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/**
 * 종류별로 가장 임박한 1건.
 * 검진·접종은 팀 확정 전까지 null을 반환한다 — 확인되지 않은 의료 일정을
 * 실제 날짜와 함께 보여주면 사용자가 그대로 신뢰하기 때문.
 */
export function nextByKind(
  birthDate: string,
  kind: ScheduleKind,
  now = new Date(),
): ResolvedScheduleItem | null {
  if (!SCHEDULE_DATA_READY && kind !== "safety") return null;
  const items = resolveSchedule(birthDate, now).filter((item) => item.kind === kind);
  return items.find((item) => item.active) ?? items[0] ?? null;
}

/**
 * 검진과 접종은 성격이 다르다.
 * 검진은 구간을 넘기면 무료 지원이 끝나므로 마감을 알려야 하고,
 * 접종은 늦어도 의사가 일정을 조정하므로 "마감"이라고 말하면 안 된다.
 */
export function formatScheduleTiming(item: ResolvedScheduleItem): string {
  if (!item.active) {
    return item.daysUntilStart === 0 ? "오늘부터" : `D-${item.daysUntilStart}`;
  }
  if (item.kind !== "checkup") return "접종 시기";
  if (item.daysUntilEnd === 0) return "오늘 마감";
  return `${item.daysUntilEnd}일 남음`;
}
