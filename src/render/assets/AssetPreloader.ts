export async function preloadWithConcurrency<T>(items: readonly T[], concurrency: number, load: (item: T) => Promise<void>): Promise<void> {
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), items.length));
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      await load(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: workerCount }, worker));
}
