export function createKeyedAsyncQueue() {
  const tails = new Map<string, Promise<void>>();

  return {
    run<T>(key: string, task: () => Promise<T>): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve();
      const operation = previous.catch(() => undefined).then(task);
      const tail = operation.then(
        () => undefined,
        () => undefined,
      );
      tails.set(key, tail);
      tail.then(() => {
        if (tails.get(key) === tail) tails.delete(key);
      });
      return operation;
    },
  };
}
