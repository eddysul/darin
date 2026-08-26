import type { MessageKey } from "../i18n";
import type { Translate } from "./recordDisplay";

const TITLE_KEYS: Record<string, MessageKey> = {
  "가족 초대 요청": "onboardingFlow.requests.familyTitle",
  "친구 추가 요청": "onboardingFlow.requests.friendTitle",
  "새 공유 기록": "notice.critical.030",
  "오늘의 요약": "notice.critical.031",
  "예방접종 리마인더": "notice.critical.032",
};

const BODY_KEYS: Record<string, MessageKey> = {
  "공유 요청이 도착했어요.": "onboardingFlow.requests.received",
  "민지님이 돌봄 멤버로 함께하기를 요청했어요.": "notice.critical.033",
  "아빠가 수유 기록을 공유했어요.": "notice.critical.034",
  "오늘의 수유와 수면 기록을 확인해 보세요.": "notice.critical.035",
  "내일 오전 10시, 예방접종 일정이 있어요.": "notice.critical.036",
};

export function notificationTitleLabel(t: Translate, title: string): string {
  const key = TITLE_KEYS[title];
  return key ? t(key) : title;
}

export function notificationBodyLabel(t: Translate, body: string): string {
  const key = BODY_KEYS[body];
  return key ? t(key) : body;
}
