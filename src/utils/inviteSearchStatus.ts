import type { InviteRowStatus, InviteSearchHit } from "../types/inviteSearch";

function sameId(left?: string | null, right?: string | null): boolean {
  return Boolean(left && right && left === right);
}

function sameDarinId(left?: string | null, right?: string | null): boolean {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}

export function resolveInviteRowStatus(input: {
  hit: Pick<InviteSearchHit, "userId" | "darinId">;
  meId?: string | null;
  myDarinId?: string | null;
  familyIds: Set<string>;
  friendIds: Set<string>;
  outgoingUserIds: Set<string>;
  outgoingDarinIds: Set<string>;
  incomingUserIds: Set<string>;
  canInvite: boolean;
}): InviteRowStatus {
  const { hit } = input;
  if (sameId(hit.userId, input.meId) || sameDarinId(hit.darinId, input.myDarinId)) return "self";
  if (hit.userId && input.familyIds.has(hit.userId)) return "family";
  if (hit.userId && input.friendIds.has(hit.userId)) return "friend";
  if (hit.userId && input.outgoingUserIds.has(hit.userId)) return "outgoing";
  if (hit.darinId && input.outgoingDarinIds.has(hit.darinId.trim().toLowerCase())) return "outgoing";
  if (hit.userId && input.incomingUserIds.has(hit.userId)) return "incoming";
  if (!input.canInvite) return "hidden";
  return "invite";
}

export function inviteSearchQueryReady(query: string): boolean {
  return [...query.trim()].length >= 2;
}

export function inviteSenderNameFromBody(body: string): string {
  const match = body.match(/^(.+?)님이\s/);
  return match?.[1]?.trim() ?? "";
}
