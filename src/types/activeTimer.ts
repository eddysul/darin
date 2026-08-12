import type { OneTouchAction } from "../constants/quickRecordActions";

export type TimerSide = "left" | "right" | "both";

export type ActiveTimerKind =
  | "breastfeeding"
  | "formula"
  | "storedMilk"
  | "sleep"
  | "pump"
  | "tummy"
  | "play";

export type ActiveTimer = {
  id: string;
  kind: ActiveTimerKind;
  action: OneTouchAction;
  /** Wall-clock start HH:MM */
  startTime: string;
  dateKey: string;
  /** ISO timestamp when the current running segment started */
  segmentStartedAt: string;
  /** Accumulated ms from previous segments (pause/resume) */
  accumulatedMs: number;
  status: "running" | "paused";
  side?: TimerSide;
  /** Per-side accumulated ms (breast / pump) */
  leftMs: number;
  rightMs: number;
  /** Linked open sleep log id when kind === sleep */
  linkedLogId?: string;
};

export const TIMER_ACTIONS: OneTouchAction[] = [
  "breastfeeding",
  "formula",
  "storedMilk",
  "sleep",
  "pump",
  "tummy",
  "play",
];

export function isTimerAction(action: OneTouchAction): action is ActiveTimerKind {
  return (TIMER_ACTIONS as string[]).includes(action);
}

export function sideLabel(side?: TimerSide): string {
  if (side === "left") return "좌측";
  if (side === "right") return "우측";
  if (side === "both") return "양쪽";
  return "";
}

export function elapsedMsNow(timer: ActiveTimer, now = Date.now()): number {
  const running =
    timer.status === "running"
      ? Math.max(0, now - Date.parse(timer.segmentStartedAt))
      : 0;
  return timer.accumulatedMs + running;
}

export function msToMinutes(ms: number): number {
  return Math.max(1, Math.round(ms / 60_000));
}

export function formatElapsedClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
