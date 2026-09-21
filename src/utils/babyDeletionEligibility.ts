type CreatorProof = { babyId: string; accountId: string } | null;

/** The list/detail action is a hint only; the database independently authorizes deletion. */
export function canOfferBabyDeletion(input: {
  babyId: string | null;
  accountId: string | null;
  creatorProof: CreatorProof;
  familyRole: string;
  busy: boolean;
}): boolean {
  return !input.busy
    && Boolean(input.babyId && input.accountId)
    && input.creatorProof?.babyId === input.babyId
    && input.creatorProof?.accountId === input.accountId
    && (input.familyRole === "owner" || input.familyRole === "admin");
}
