import type { ActiveTimer, ActiveTimerKind, TimerSide } from "../types/activeTimer";
import { elapsedMsNow, msToMinutes, sideLabel } from "../types/activeTimer";
import type { BabyLogEntry } from "../types/babyLog";
import type { OneTouchAction } from "../constants/quickRecordActions";
import { nowTime } from "./formatLog";
import { formatDateKey } from "./dateKey";

export function newTimerId(kind: ActiveTimerKind): string {
  return `${kind}-${Date.now()}`;
}

export function createActiveTimer(
  kind: ActiveTimerKind,
  action: OneTouchAction,
  opts?: Partial<Pick<ActiveTimer, "side" | "linkedLogId" | "startTime" | "dateKey" | "segmentStartedAt">>,
): ActiveTimer {
  const now = new Date();
  return {
    id: newTimerId(kind),
    kind,
    action,
    startTime: opts?.startTime ?? nowTime(),
    dateKey: opts?.dateKey ?? formatDateKey(),
    segmentStartedAt: opts?.segmentStartedAt ?? now.toISOString(),
    accumulatedMs: 0,
    status: "running",
    side: opts?.side ?? (kind === "breastfeeding" || kind === "pump" ? "left" : undefined),
    leftMs: 0,
    rightMs: 0,
    linkedLogId: opts?.linkedLogId,
  };
}

/** Rebuild a sleep timer from an open sleep log (no duration). */
export function timerFromOpenSleep(log: BabyLogEntry): ActiveTimer {
  const dateKey = log.dateKey ?? formatDateKey();
  const [y, mo, d] = dateKey.split("-").map(Number);
  const [hh, mm] = log.time.split(":").map(Number);
  const started = new Date(y, mo - 1, d, hh, mm, 0);
  return {
    id: `sleep-${log.id}`,
    kind: "sleep",
    action: "sleep",
    startTime: log.time,
    dateKey,
    segmentStartedAt: started.toISOString(),
    accumulatedMs: 0,
    status: "running",
    leftMs: 0,
    rightMs: 0,
    linkedLogId: log.id,
  };
}

function bankCurrentSegment(timer: ActiveTimer, now = Date.now()): ActiveTimer {
  if (timer.status !== "running") return timer;
  const segment = Math.max(0, now - Date.parse(timer.segmentStartedAt));
  const next: ActiveTimer = {
    ...timer,
    accumulatedMs: timer.accumulatedMs + segment,
    segmentStartedAt: new Date(now).toISOString(),
  };
  if (timer.side === "left") next.leftMs = timer.leftMs + segment;
  else if (timer.side === "right") next.rightMs = timer.rightMs + segment;
  else if (timer.side === "both") {
    // Split evenly so L/R summary stays meaningful for "양쪽"
    const half = Math.floor(segment / 2);
    next.leftMs = timer.leftMs + half;
    next.rightMs = timer.rightMs + (segment - half);
  }
  return next;
}

export function pauseTimer(timer: ActiveTimer): ActiveTimer {
  if (timer.status === "paused") return timer;
  const banked = bankCurrentSegment(timer);
  return { ...banked, status: "paused" };
}

export function resumeTimer(timer: ActiveTimer): ActiveTimer {
  if (timer.status === "running") return timer;
  return {
    ...timer,
    status: "running",
    segmentStartedAt: new Date().toISOString(),
  };
}

export function changeTimerSide(timer: ActiveTimer, side: TimerSide): ActiveTimer {
  if (timer.side === side) return timer;
  const banked = bankCurrentSegment(timer);
  return { ...banked, side };
}

export type TimerStopResult = {
  startTime: string;
  dateKey: string;
  durationMinutes: number;
  chip?: string;
  notes?: string;
  leftMinutes: number;
  rightMinutes: number;
  amount?: string;
};

export function buildTimerStopResult(
  timer: ActiveTimer,
  opts?: { amount?: string },
): TimerStopResult {
  const banked = bankCurrentSegment(timer);
  const totalMs = banked.accumulatedMs;
  const leftMs = banked.leftMs;
  const rightMs = banked.rightMs;
  const leftMinutes = leftMs > 0 ? msToMinutes(leftMs) : 0;
  const rightMinutes = rightMs > 0 ? msToMinutes(rightMs) : 0;
  const durationMinutes = msToMinutes(totalMs);

  let chip: string | undefined;
  let notes: string | undefined;
  if (timer.kind === "breastfeeding" || timer.kind === "pump") {
    if (leftMs > 0 && rightMs > 0) {
      chip = "양쪽";
      notes = `좌 ${leftMinutes}분 · 우 ${rightMinutes}분`;
    } else if (leftMs > 0) {
      chip = "좌측";
    } else if (rightMs > 0) {
      chip = "우측";
    } else if (timer.side) {
      chip = sideLabel(timer.side);
    }
  }

  return {
    startTime: timer.startTime,
    dateKey: timer.dateKey,
    durationMinutes,
    chip,
    notes,
    leftMinutes,
    rightMinutes,
    amount: opts?.amount,
  };
}

export function liveElapsedLabel(timer: ActiveTimer): string {
  return `${msToMinutes(elapsedMsNow(timer))}분`;
}
