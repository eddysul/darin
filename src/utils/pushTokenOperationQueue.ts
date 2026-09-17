let tail: Promise<void> = Promise.resolve();

/** Keep registration and logout revocation ordered on this installation. */
export function queuePushTokenOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = tail.then(operation, operation);
  tail = result.then(() => undefined, () => undefined);
  return result;
}
