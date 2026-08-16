/**
 * Local-only records for checking the Notification Center UI during development.
 * Shown only when the server list is empty. Never mixed with real events.
 * Set this to false to exercise the empty state. These are never fetched or sent.
 */
export const ENABLE_NOTIFICATION_QA_SEED = __DEV__;

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
};

const QA_NOTIFICATION_ITEMS: NotificationItem[] = [
  { id: "qa-invite", type: "invite_request", title: "가족 초대 요청", body: "민지님이 돌봄 멤버로 함께하기를 요청했어요.", period: "today", isRead: false },
  { id: "qa-shared-log", type: "new_shared_log", title: "새 공유 기록", body: "아빠가 수유 기록을 공유했어요.", period: "today", isRead: false },
  { id: "qa-daily-summary", type: "daily_summary", title: "오늘의 요약", body: "오늘의 수유와 수면 기록을 확인해 보세요.", period: "week", isRead: true },
  { id: "qa-reminder", type: "reminder", title: "예방접종 리마인더", body: "내일 오전 10시, 예방접종 일정이 있어요.", period: "older", isRead: false },
];

export function getNotificationQaSeed(): NotificationItem[] {
  return ENABLE_NOTIFICATION_QA_SEED ? QA_NOTIFICATION_ITEMS.map((item) => ({ ...item })) : [];
}

export function hasUnreadNotificationQaSeed(): boolean {
  return ENABLE_NOTIFICATION_QA_SEED && QA_NOTIFICATION_ITEMS.some((item) => !item.isRead);
}
