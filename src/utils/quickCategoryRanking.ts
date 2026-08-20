import { PREGNANCY_QUICK_RECORD_ACTIONS, QUICK_RECORD_ACTIONS, type OneTouchAction } from "../constants/quickRecordActions";
import type { BabyLogEntry } from "../types/babyLog";
import { isCustomCategoryKey } from "../types/logCategory";

export const FALLBACK_TOP_ACTIONS: OneTouchAction[] = ["breastfeeding", "formula", "diaper", "sleep", "pump", "storedMilk"];

function recordedAt(entry: BabyLogEntry): number | null {
  if (!entry.dateKey) return null;
  const [year, month, day] = entry.dateKey.split("-").map(Number);
  const [hour, minute] = entry.time.split(":").map(Number);
  const value = new Date(year, month - 1, day, hour || 0, minute || 0).getTime();
  return Number.isFinite(value) ? value : null;
}

export function rankQuickActions(logs: BabyLogEntry[], visibleActions: OneTouchAction[], now = new Date()): OneTouchAction[] {
  const catalog = [...QUICK_RECORD_ACTIONS, ...PREGNANCY_QUICK_RECORD_ACTIONS];
  const visible = catalog.filter((action) => visibleActions.includes(action.id));
  const actionByCategory = new Map(visible.map((action) => [action.cat, action]));
  const nowMs = now.getTime();
  const day = 24 * 60 * 60 * 1000;
  const stats = new Map<OneTouchAction, { count30d: number; count7d: number; count24h: number; latest: number }>();

  for (const entry of logs) {
    if (isCustomCategoryKey(entry.cat)) continue;
    const action = actionByCategory.get(entry.cat);
    const timestamp = recordedAt(entry);
    if (!action || timestamp == null) continue;
    const age = nowMs - timestamp;
    if (age < 0 || age > 30 * day) continue;
    const current = stats.get(action.id) ?? { count30d: 0, count7d: 0, count24h: 0, latest: 0 };
    current.count30d += 1;
    if (age <= 7 * day) current.count7d += 1;
    if (age <= day) current.count24h += 1;
    current.latest = Math.max(current.latest, timestamp);
    stats.set(action.id, current);
  }

  const totalRecent = [...stats.values()].reduce((sum, item) => sum + item.count30d, 0);
  if (totalRecent < 3 || stats.size < 3) {
    return [...FALLBACK_TOP_ACTIONS.filter((id) => visibleActions.includes(id)), ...visible.map((item) => item.id)]
      .filter((id, index, values) => values.indexOf(id) === index)
      .slice(0, 6);
  }

  return visible
    .map((action, defaultIndex) => {
      const item = stats.get(action.id) ?? { count30d: 0, count7d: 0, count24h: 0, latest: 0 };
      const age = item.latest ? nowMs - item.latest : Number.POSITIVE_INFINITY;
      const recencyBonus = age <= day ? 3 : age <= 7 * day ? 2 : age <= 30 * day ? 1 : 0;
      return { id: action.id, score: item.count30d + item.count7d * 2 + item.count24h * 3 + recencyBonus, defaultIndex };
    })
    .sort((a, b) => b.score - a.score || a.defaultIndex - b.defaultIndex)
    .slice(0, 6)
    .map((item) => item.id);
}
