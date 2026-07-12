import { IssuerLockService } from './issuer-lock.service';

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe('IssuerLockService', () => {
  it('serializes tasks for the same key (no overlap)', async () => {
    const lock = new IssuerLockService();
    let active = 0;
    let maxActive = 0;

    const task = async (): Promise<void> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(5);
      active -= 1;
    };

    await Promise.all([
      lock.runExclusive('issuer-1', task),
      lock.runExclusive('issuer-1', task),
      lock.runExclusive('issuer-1', task),
    ]);

    expect(maxActive).toBe(1);
  });

  it('preserves call order for the same key', async () => {
    const lock = new IssuerLockService();
    const order: number[] = [];

    await Promise.all(
      [1, 2, 3].map((n) =>
        lock.runExclusive('issuer-1', async () => {
          await delay(n === 1 ? 10 : 1);
          order.push(n);
        }),
      ),
    );

    expect(order).toEqual([1, 2, 3]);
  });

  it('runs different keys concurrently', async () => {
    const lock = new IssuerLockService();
    let active = 0;
    let maxActive = 0;

    const task = async (): Promise<void> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(5);
      active -= 1;
    };

    await Promise.all([
      lock.runExclusive('issuer-1', task),
      lock.runExclusive('issuer-2', task),
    ]);

    expect(maxActive).toBe(2);
  });

  it('releases the lock even when a task throws', async () => {
    const lock = new IssuerLockService();

    await expect(
      lock.runExclusive('issuer-1', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const result = await lock.runExclusive('issuer-1', async () => 'ok');
    expect(result).toBe('ok');
  });
});
