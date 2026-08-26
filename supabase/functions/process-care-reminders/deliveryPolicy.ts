export type DeliveryStatus = "sent" | "skipped_quiet_hours" | "skipped_no_token"
  | "skipped_permission_or_disabled" | "failed_retryable" | "failed_permanent";
export type DeliveryCounts = Record<DeliveryStatus, number>;

export const emptyCounts = (): DeliveryCounts => ({
  sent: 0, skipped_quiet_hours: 0, skipped_no_token: 0,
  skipped_permission_or_disabled: 0, failed_retryable: 0, failed_permanent: 0,
});

export function genericEventStatus(status: DeliveryStatus): "sent" | "failed" | "skipped" {
  if (status === "sent") return "sent";
  return status.startsWith("failed_") ? "failed" : "skipped";
}
export function inQuietHours(
  now: Date,
  timezone: string | null,
  start: string | null,
  end: string | null,
): boolean {
  if (!timezone || !start || !end) return false;
  try {
    const hm = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);
    const current = Number(hm.replace(":", ""));
    const from = Number(start.slice(0, 5).replace(":", ""));
    const to = Number(end.slice(0, 5).replace(":", ""));
    return from <= to ? current >= from && current < to : current >= from || current < to;
  } catch { return false; }
}

export function unavailableTokenStatus(totalTokens: number, validActiveTokens: number): DeliveryStatus | null {
  if (validActiveTokens > 0) return null;
  return totalTokens === 0 ? "skipped_no_token" : "skipped_permission_or_disabled";
}

export function expoDeliveryStatus(
  successCount: number,
  disabledTokenCount: number,
  attemptedTokenCount: number,
): DeliveryStatus {
  if (successCount > 0) return "sent";
  if (attemptedTokenCount > 0 && disabledTokenCount === attemptedTokenCount) return "failed_permanent";
  return "failed_retryable";
}

export function finalStateStatus(counts: DeliveryCounts): "scheduled" | "sent" | "processed" {
  if (counts.failed_retryable > 0) return "scheduled";
  return counts.sent > 0 ? "sent" : "processed";
}

export function currentClaimMatches(
  claim: { version: number; lastRelevantLogId: string; processingStartedAt: string },
  current: { version: number; lastRelevantLogId: string | null; processingStartedAt: string | null; sendStatus: string } | null,
  enabled: boolean,
): boolean {
  return Boolean(current && enabled && current.sendStatus === "scheduled"
    && current.version === claim.version
    && current.lastRelevantLogId === claim.lastRelevantLogId
    && current.processingStartedAt === claim.processingStartedAt);
}
