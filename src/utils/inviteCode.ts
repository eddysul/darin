export function normalizeInviteCode(value: string): string | null {
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  return code || null;
}

export function inviteUrl(code: string, appLinkHost = process.env.EXPO_PUBLIC_APP_LINK_HOST): string {
  const normalized = normalizeInviteCode(code) ?? "";
  const host = appLinkHost?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (host && /^[a-z0-9.-]+(?::\d+)?$/.test(host)) {
    return `https://${host}/invite/${encodeURIComponent(normalized)}`;
  }
  return `knanny://invite/${encodeURIComponent(normalized)}`;
}

export function parseInviteCodeFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const queryCode = normalizeInviteCode(url.searchParams.get("code") ?? "");
    if (queryCode) return queryCode;
    const scheme = url.protocol.toLowerCase();
    const rawPath = scheme === "knanny:" ? `/${url.hostname}${url.pathname}` : url.pathname;
    const match = rawPath.match(/\/invite\/([^/]+)/i);
    return normalizeInviteCode(match?.[1] ?? "");
  } catch {
    return null;
  }
}
