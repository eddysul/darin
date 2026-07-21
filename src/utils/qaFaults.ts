export type QaFaultKind = "ai" | "storageRead" | "storageWrite";

export type QaFaultState = Record<QaFaultKind, boolean>;

export const EMPTY_QA_FAULT_STATE: QaFaultState = {
  ai: false,
  storageRead: false,
  storageWrite: false,
};

export function armQaFault(state: QaFaultState, kind: QaFaultKind): QaFaultState {
  return { ...state, [kind]: true };
}

export function consumeQaFault(
  state: QaFaultState,
  kind: QaFaultKind,
): { consumed: boolean; state: QaFaultState } {
  if (!state[kind]) return { consumed: false, state };
  return { consumed: true, state: { ...state, [kind]: false } };
}
