import { useEffect, useRef } from "react";
import { devLog } from "../utils/devLog";

type ScreenLoadMilestones = {
  firstContent: boolean;
  coreReady: boolean;
  fullReady: boolean;
};

type TraceRun = {
  scopeKey: string;
  startedAt: number;
  marked: Set<keyof ScreenLoadMilestones>;
};

function clockNow(): number {
  return typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now();
}

/**
 * Development-only route loading trace. Scope identifiers are intentionally
 * omitted from logs; they are used only to reset a run after account/baby changes.
 */
export function useScreenLoadTrace(
  screen: string,
  scopeKey: string | null,
  milestones: ScreenLoadMilestones,
): void {
  const runRef = useRef<TraceRun>({
    scopeKey: scopeKey ?? "unscoped",
    startedAt: clockNow(),
    marked: new Set(),
  });

  useEffect(() => {
    runRef.current = {
      scopeKey: scopeKey ?? "unscoped",
      startedAt: clockNow(),
      marked: new Set(),
    };
    devLog(`[performance] ${screen} route_enter`);
  }, [scopeKey, screen]);

  useEffect(() => {
    const run = runRef.current;
    const mark = (name: keyof ScreenLoadMilestones, ready: boolean) => {
      if (!ready || run.marked.has(name)) return;
      run.marked.add(name);
      devLog(`[performance] ${screen} ${name} ${Math.round(clockNow() - run.startedAt)}ms`);
    };
    mark("firstContent", milestones.firstContent);
    mark("coreReady", milestones.coreReady);
    mark("fullReady", milestones.fullReady);
  }, [milestones.coreReady, milestones.firstContent, milestones.fullReady, scopeKey, screen]);
}
