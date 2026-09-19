/**
 * Apps in Toss native runtimes can lose fullscreen/rewarded callbacks when a
 * banner attach/load overlaps them. Keep every native ad load operation on one
 * FIFO lane. A rejected operation still releases the next queued operation.
 */
export class AdLoadCoordinator {
  private tail: Promise<void> = Promise.resolve();

  run<T>(_kind: "banner" | "fullscreen" | "rewarded", operation: () => Promise<T>): Promise<T> {
    const start = this.tail.catch(() => undefined);
    const result = start.then(operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
