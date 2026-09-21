import { isFeatureVisible } from "../config/featureFlags";

/**
 * Local-only records for checking the Notification Center UI during development.
 * Shown only when the server list is empty. Never mixed with real events.
 * Set this to false to exercise the empty state. These are never fetched or sent.
 */
export const ENABLE_NOTIFICATION_QA_SEED = isFeatureVisible("experimentalNotifications");

export type NotificationType =
  | "invite_request"
  | "new_shared_log"
  | "new_diary"
  | "daily_summary"
  | "weekly_summary"
  | "reminder"
  | "event";

export type NotificationPeriod = "today" | "week" | "older";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  period: NotificationPeriod;
  isRead: boolean;
  createdAt?: string;
  actorId?: string;
  actorAvatarUrl?: string;
  thumbnailUrl?: string;
  eventType?: string;
  data?: Record<string, unknown>;
};

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

export function getNotificationQaSeed(): NotificationItem[] {
  if (!ENABLE_NOTIFICATION_QA_SEED) return [];
  return [
    { id: "qa-invite", type: "invite_request", eventType: "invite_request", title: "가족 초대 요청", body: "민지님이 돌봄 멤버로 함께하기를 요청했어요.", period: "today", isRead: false, createdAt: hoursAgo(3), data: { requestStatus: "pending" } },
    { id: "qa-shared-log", type: "new_shared_log", eventType: "new_shared_log", title: "새 공유 기록", body: "아빠가 수유 기록을 공유했어요.", period: "today", isRead: false, createdAt: hoursAgo(6), data: { route: "record" } },
    { id: "qa-daily-summary", type: "daily_summary", eventType: "daily_summary", title: "오늘의 요약", body: "오늘의 수유와 수면 기록을 확인해 보세요.", period: "week", isRead: true, createdAt: hoursAgo(48), data: { route: "report" } },
    { id: "qa-reminder", type: "reminder", eventType: "reminder", title: "예방접종 리마인더", body: "내일 오전 10시, 예방접종 일정이 있어요.", period: "older", isRead: false, createdAt: hoursAgo(240), data: { route: "record" } },
  ];
}

export function hasUnreadNotificationQaSeed(): boolean {
  return ENABLE_NOTIFICATION_QA_SEED && getNotificationQaSeed().some((item) => !item.isRead);
}
