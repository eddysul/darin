export type DiarySaveTransactionResult =
  | "saved"
  | "failed"
  | "duplicate"
  | "stale"
  | "superseded";

type DiarySaveTransactionInput = {
  preserveDraft: () => Promise<void>;
  persist: () => Promise<boolean>;
  isCurrent: () => boolean;
  clearPersistedDraft: () => Promise<boolean>;
};

/**
 * Keeps the ordering contract for a compose save in one testable place.
 * One coordinator belongs to one mounted compose screen.
 */
export function createDiarySaveCoordinator() {
  let busy = false;

  return {
    get busy() {
      return busy;
    },

    async run(input: DiarySaveTransactionInput): Promise<DiarySaveTransactionResult> {
      if (busy) return "duplicate";
      busy = true;
      try {
        await input.preserveDraft();
        if (!(await input.persist())) return "failed";
        if (!input.isCurrent()) return "stale";
        return (await input.clearPersistedDraft()) ? "saved" : "superseded";
      } catch {
        return "failed";
      } finally {
        busy = false;
      }
    },
  };
}
