import { IssuerLockService } from "./issuer-lock.service";

const TASK_DURATION_MS = 5;
const SLOW_TASK_MS = 10;
const FAST_TASK_MS = 1;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function concurrencyProbe(): { task: () => Promise<void>; maxActive: () => number } {
  let active = 0;
  let maxActive = 0;
  return {
    task: async (): Promise<void> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(TASK_DURATION_MS);
      active -= 1;
    },
    maxActive: () => maxActive,
  };
}

describe("IssuerLockService", () => {
  it("serializes tasks for the same key (no overlap)", async () => {
    const lock = new IssuerLockService();
    const probe = concurrencyProbe();

    await Promise.all([
      lock.runExclusive("issuer-1", probe.task),
      lock.runExclusive("issuer-1", probe.task),
      lock.runExclusive("issuer-1", probe.task),
    ]);

    expect(probe.maxActive()).toBe(1);
  });

  it("preserves call order for the same key", async () => {
    const lock = new IssuerLockService();
    const order: number[] = [];

    await Promise.all(
      [1, 2, 3].map((count) =>
        lock.runExclusive("issuer-1", async () => {
          await delay(count === 1 ? SLOW_TASK_MS : FAST_TASK_MS);
          order.push(count);
        }),
      ),
    );

    expect(order).toEqual([1, 2, 3]);
  });

  it("runs different keys concurrently", async () => {
    const lock = new IssuerLockService();
    const probe = concurrencyProbe();

    await Promise.all([lock.runExclusive("issuer-1", probe.task), lock.runExclusive("issuer-2", probe.task)]);

    expect(probe.maxActive()).toBe(2);
  });

  it("releases the lock even when a task throws", async () => {
    const lock = new IssuerLockService();

    await expect(lock.runExclusive("issuer-1", () => Promise.reject(new Error("boom")))).rejects.toThrow(
      "boom",
    );

    const result = await lock.runExclusive("issuer-1", () => Promise.resolve("ok"));
    expect(result).toBe("ok");
  });
});
