import type { MessageKey } from "../i18n";
import { FAMILY_ROLE_LABELS, familyRoleMessageKey, type FamilyRole } from "../types/family";
import type { Translate } from "./recordDisplay";

const RELATION_KEYS: Record<string, MessageKey> = {
  "엄마": "profileSetup.relation.mom",
  "아빠": "profileSetup.relation.dad",
  "보호자": "profileSetup.relation.guardian",
  "할머니": "profileSetup.relation.grandmother",
  "할아버지": "profileSetup.relation.grandfather",
  "이모": "profileSetup.relation.aunt",
  "삼촌": "profileSetup.relation.uncle",
  "시터": "profileSetup.relation.sitter",
  "친구": "profileSetup.relation.friend",
  "가족": "profileSetup.relation.family",
  "기타": "profileSetup.relation.other",
};

const INVITE_TITLE_KEYS: Record<string, MessageKey> = {
  "가족 초대 요청": "onboardingFlow.requests.familyTitle",
  "친구 추가 요청": "onboardingFlow.requests.friendTitle",
  "보낸 가족 요청": "family.critical.091",
  "보낸 친구 요청": "family.critical.092",
};

const INVITE_BODY_KEYS: Record<string, MessageKey> = {
  "공유 요청이 도착했어요.": "onboardingFlow.requests.received",
  "상대의 수락을 기다리고 있어요.": "family.critical.093",
};

const ERROR_KEYS: Record<string, MessageKey> = {
  "초대 요청 기능이 아직 준비 중이에요.": "family.critical.094",
  "만료된 초대예요. 새 초대를 요청해 주세요.": "family.critical.095",
  "이미 요청을 보냈어요. 상대방의 응답을 기다려 주세요.": "family.critical.096",
  "이미 처리되었거나 사용할 수 없는 초대예요.": "family.critical.097",
  "해당 Darin ID를 찾지 못했어요.": "family.critical.098",
  "내 ID에는 요청을 보낼 수 없어요.": "family.critical.099",
  "이미 연결되어 있어요.": "family.critical.100",
  "초대 요청은 아기 관리자만 보낼 수 있어요.": "family.critical.016",
  "네트워크 연결을 확인하고 다시 시도해 주세요.": "family.critical.101",
  "초대 요청을 보내지 못했어요.": "family.critical.021",
  "내 권한은 직접 바꿀 수 없어요.": "family.critical.102",
  "이 정보를 수정할 권한이 없어요.": "family.critical.103",
  "내 계정은 여기서 제거할 수 없어요.": "family.critical.104",
  "로그인이 필요해요.": "chrome.critical.014",
  "이미 이메일 계정으로 로그인되어 있어요.": "chrome.critical.055",
  "이미 가입된 이메일이에요. 로그인해주세요.": "auth.email.error.alreadyRegistered",
  "로그인 세션을 만들지 못했어요.": "chrome.critical.056",
  "Google 로그인 주소를 만들지 못했어요.": "chrome.critical.057",
  "Google 로그인에 실패했어요. 다시 시도해주세요.": "chrome.critical.058",
  "카카오 로그인 주소를 만들지 못했어요.": "chrome.critical.059",
  "카카오 로그인에 실패했어요. 다시 시도해주세요.": "chrome.critical.060",
  "카카오 로그인 세션을 만들지 못했어요.": "chrome.critical.061",
  "이 기기에서는 Apple 로그인을 사용할 수 없어요.": "chrome.critical.062",
  "Apple 인증 토큰을 받지 못했어요. 다시 시도해주세요.": "chrome.critical.063",
  "Apple 로그인 세션을 만들지 못했어요.": "chrome.critical.064",
  "다시 보낼 인증 요청을 찾지 못했어요. 회원가입을 다시 진행해주세요.": "chrome.critical.065",
  "이메일 인증이 아직 완료되지 않았어요. 메일의 인증 링크를 먼저 열어주세요.": "chrome.critical.066",
  "문의 내용을 입력해주세요.": "chrome.critical.067",
  "문의 내용은 4,000자 이하로 입력해주세요.": "chrome.critical.068",
  "답변 받을 이메일을 확인해주세요.": "chrome.critical.069",
  "계정 삭제 응답을 확인하지 못했어요.": "chrome.critical.070",
  "내보낼 수 있는 아기 기록이 없어요.": "chrome.critical.071",
  "내보내기 파일을 만들 수 없어요.": "chrome.critical.072",
  "이 기기에서는 공유 기능을 사용할 수 없어요.": "chrome.critical.073",
  "현재 선택된 아기의 스티커만 저장할 수 있어요.": "chrome.critical.074",
  "현재 선택된 아기가 없어 성장 기록을 저장할 수 없어요.": "chrome.critical.075",
  "현재 선택된 아기가 없어 기록을 저장할 수 없어요.": "chrome.critical.076",
  "아기 이름을 입력해 주세요.": "babyProfile.error.nameRequired",
  "현재 선택된 아기가 없어요.": "settings.critical.203",
  "주의 식품 이름을 입력해 주세요.": "chrome.critical.077",
  "이미 등록된 주의 식품이에요.": "chrome.critical.078",
  "사진은 5MB 이하만 올릴 수 있어요.": "babyProfile.error.photoTooLarge",
  "사진은 25MB 이하만 올릴 수 있어요.": "memory.critical.115",
  "일기 사진은 25MB 이하만 올릴 수 있어요.": "memory.critical.115",
  "이미 사용 중인 Darin ID예요. 새 코드를 눌러 다시 시도해 주세요.": "chrome.critical.106",
  "닉네임을 입력해 주세요.": "profileSetup.nicknameError.required",
  "닉네임은 2~12자로 입력해 주세요.": "profileSetup.nicknameError.length",
  "닉네임에는 #을 사용할 수 없어요.": "profileSetup.nicknameError.hash",
  "닉네임에는 /을 사용할 수 없어요.": "profileSetup.nicknameError.slash",
  "이름을 입력해 주세요.": "settings.critical.004",
  "프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.": "profileSetup.saveError",
  "사진을 올리지 못했어요. 다른 사진으로 다시 시도해 주세요.": "settings.critical.007",
  "사진을 올리지 못했어요.": "settings.critical.007",
  "사진을 불러오지 못했어요.": "chrome.critical.107",
  "선택한 사진을 읽지 못했어요.": "chrome.critical.108",
  "댓글을 입력해주세요.": "chrome.critical.109",
  "저장할 수 없는 추억이에요.": "chrome.critical.110",
  "사진을 한 장 이상 추가해 주세요.": "memory.critical.112",
  "사진은 최대 5장까지 추가할 수 있어요.": "chrome.critical.111",
  "새 사진 업로드를 완료하지 못했어요. 기존 사진은 유지했어요.": "chrome.critical.112",
  "새 사진은 저장됐지만 일부 사진 삭제를 완료하지 못했어요. 다시 열어 확인해 주세요.": "chrome.critical.113",
  "업로드한 추억을 다시 불러오지 못했어요.": "chrome.critical.114",
  "추억 사진을 연결하지 못했어요.": "chrome.critical.115",
  "올린 추억을 다시 불러오지 못했어요.": "chrome.critical.116",
  "프로필 사진을 불러오지 못했어요.": "chrome.critical.117",
  "스티커 이미지를 읽지 못했어요.": "chrome.critical.118",
  "스티커 이미지는 10MB 이하만 저장할 수 있어요.": "chrome.critical.119",
  "Darin ID를 닉네임#0000 형식으로 입력해 주세요.": "family.critical.015",
  "Darin ID의 코드는 숫자 4자리예요.": "chrome.critical.120",
  "선택한 일기 사진을 읽지 못했어요.": "chrome.critical.121",
};

export function localizedErrorMessage(t: Translate, message: string): string {
  const key = ERROR_KEYS[message];
  if (key) return t(key);
  if (message.startsWith("계정 삭제 요청 실패")) return t("chrome.critical.070");
  return message;
}

export function caughtErrorMessage(t: Translate, cause: unknown, fallback: MessageKey): string {
  return cause instanceof Error ? localizedErrorMessage(t, cause.message) : t(fallback);
}

export function storedRelationshipLabel(t: Translate, value: string): string {
  const key = RELATION_KEYS[value];
  return key ? t(key) : value;
}

export function storedFamilyRoleLabel(t: Translate, roleLabel: string): string {
  const role = (Object.entries(FAMILY_ROLE_LABELS) as Array<[FamilyRole, string]>)
    .find(([, label]) => label === roleLabel)?.[0];
  return role ? t(familyRoleMessageKey(role)) : roleLabel;
}

export function inviteRequestTitle(t: Translate, title: string): string {
  const key = INVITE_TITLE_KEYS[title];
  return key ? t(key) : title;
}

export function inviteRequestBody(t: Translate, body: string): string {
  const key = INVITE_BODY_KEYS[body];
  return key ? t(key) : body;
}

export function familyErrorMessage(t: Translate, message: string): string {
  return localizedErrorMessage(t, message);
}
