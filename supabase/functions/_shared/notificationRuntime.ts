export type SupportedLocale = "ko" | "en" | "ja" | "es" | "zh-CN";

export function localeFor(value: unknown): SupportedLocale {
  return value === "en" || value === "ja" || value === "es" || value === "zh-CN" ? value : "ko";
}

export function inQuietHours(
  now: Date,
  timezone: string | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  if (!timezone || !start || !end) return false;
  try {
    const hm = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
    const current = Number(hm.replace(":", ""));
    const from = Number(start.slice(0, 5).replace(":", ""));
    const to = Number(end.slice(0, 5).replace(":", ""));
    return from <= to ? current >= from && current < to : current >= from || current < to;
  } catch {
    return false;
  }
}

const EXPO_PUSH_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === "string" && EXPO_PUSH_TOKEN_PATTERN.test(value);
}

export type ExpoPushMessage = {
  to: string;
  sound?: "default" | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type ExpoPushTicket = {
  status?: string;
  details?: { error?: string };
};

export type ExpoPushResult = {
  responseOk: boolean;
  tickets: ExpoPushTicket[];
  successCount: number;
  deviceNotRegisteredIndexes: number[];
};

export function summarizeExpoPushResponse(
  responseOk: boolean,
  payload: unknown,
): ExpoPushResult {
  const data = payload && typeof payload === "object" && "data" in payload
    ? (payload as { data?: ExpoPushTicket | ExpoPushTicket[] }).data
    : undefined;
  const tickets = Array.isArray(data) ? data : data ? [data] : [];
  const deviceNotRegisteredIndexes: number[] = [];
  let successCount = 0;
  tickets.forEach((ticket, index) => {
    if (responseOk && ticket?.status === "ok") successCount += 1;
    if (ticket?.details?.error === "DeviceNotRegistered") deviceNotRegisteredIndexes.push(index);
  });
  return { responseOk, tickets, successCount, deviceNotRegisteredIndexes };
}

export async function sendExpoPush(
  messages: readonly ExpoPushMessage[],
  fetcher: typeof fetch = fetch,
): Promise<ExpoPushResult> {
  const response = await fetcher("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => null);
  return summarizeExpoPushResponse(response.ok, payload);
}

