import type { BackgroundCheckStatus, CredentialStatus } from "../demo/caregivers";
import type { MessageKey } from "../i18n";

type Translate = (key: MessageKey) => string;

export function getBackgroundCheckLabel(status: BackgroundCheckStatus, t: Translate) {
  const map: Record<BackgroundCheckStatus, string> = {
    completed: t("match.bgCheck.completed"),
    pending: t("match.bgCheck.pending"),
    not_submitted: t("match.bgCheck.notSubmitted"),
    expired: t("match.bgCheck.expired"),
  };
  return map[status];
}

export function isBackgroundCheckComplete(status: BackgroundCheckStatus) {
  return status === "completed";
}

export function getCredentialLabel(id: string, t: Translate) {
  const map: Record<string, string> = {
    identity: t("match.credential.identity"),
    cpr: t("match.credential.cpr"),
    license: t("match.credential.license"),
    background_check: t("match.credential.backgroundCheck"),
    references: t("match.credential.references"),
  };
  return map[id] ?? id;
}

export function getCredentialStatusLabel(status: CredentialStatus, t: Translate) {
  const map: Record<CredentialStatus, string> = {
    verified: t("match.credentialStatus.verified"),
    pending: t("match.credentialStatus.pending"),
    unavailable: t("match.credentialStatus.unavailable"),
  };
  return map[status];
}
