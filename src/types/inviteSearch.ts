export type InviteSearchHit = {
  userId: string;
  displayName: string;
  darinId: string;
  avatarUrl?: string;
};

export type InviteRowStatus =
  | "self"
  | "family"
  | "friend"
  | "outgoing"
  | "incoming"
  | "invite"
  | "hidden";

export type InviteFamilyRole = "admin" | "editor";

export type InviteRequestKind = "family" | "friend";

export type InviteComposerStep =
  | "relationship"
  | "familyRole"
  | "confirm"
  | "submitting";
