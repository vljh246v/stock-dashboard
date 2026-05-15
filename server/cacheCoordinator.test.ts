import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCacheCoordinator,
  type CacheCoordinatorObserver,
  type CacheRefreshLock,
} from "./cacheCoordinator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("cache coordinator", () => {
  let observer: CacheCoordinatorObserver;
  let events: string[];

  beforeEach(() => {
    events = [];
    observer = event => {
      events.push(event.type);
    };
  });

  it("coalesces same-process same-key refreshes into one producer result", async () => {
    let fresh: unknown = null;
    const gate = deferred<{ value: number }>();
    const producer = vi.fn(() => gate.promise);
    const coordinator = createCacheCoordinator({ observer });

    const first = coordinator.refresh({
      key: "AAPL:profile",
      readFresh: async () => fresh,
      readLastGood: async () => null,
      write: async value => {
        fresh = value;
      },
      produce: producer,
    });
    const second = coordinator.refresh({
      key: "AAPL:profile",
      readFresh: async () => fresh,
      readLastGood: async () => null,
      write: async value => {
        fresh = value;
      },
      produce: producer,
    });

    gate.resolve({ value: 1 });

    await expect(Promise.all([first, second])).resolves.toEqual([{ value: 1 }, { value: 1 }]);
    expect(producer).toHaveBeenCalledTimes(1);
    expect(events).toContain("refresh_waited");
  });

  it("re-reads cache after a cross-instance lock wait and skips the second producer", async () => {
    let fresh: unknown = null;
    let tail = Promise.resolve();
    const lock: CacheRefreshLock = {
      runExclusive: async (_key, _timeoutSeconds, task) => {
        const previous = tail;
        let release!: () => void;
        tail = new Promise<void>(resolve => {
          release = resolve;
        });
        await previous;
        try {
          return await task();
        } finally {
          release();
        }
      },
    };
    const first = createCacheCoordinator({ lock, observer });
    const second = createCacheCoordinator({ lock, observer });
    const firstProducer = vi.fn(async () => ({ value: "shared" }));
    const secondProducer = vi.fn(async () => ({ value: "duplicate" }));

    const firstResult = first.refresh({
      key: "AAPL:profile",
      readFresh: async () => fresh,
      readLastGood: async () => null,
      write: async value => {
        fresh = value;
      },
      produce: firstProducer,
    });
    const secondResult = second.refresh({
      key: "AAPL:profile",
      readFresh: async () => fresh,
      readLastGood: async () => null,
      write: async value => {
        fresh = value;
      },
      produce: secondProducer,
    });

    await expect(Promise.all([firstResult, secondResult])).resolves.toEqual([
      { value: "shared" },
      { value: "shared" },
    ]);
    expect(firstProducer).toHaveBeenCalledTimes(1);
    expect(secondProducer).not.toHaveBeenCalled();
    expect(events).toContain("cache_hit_after_lock");
  });

  it("returns last-good data to all waiters when the producer fails", async () => {
    const coordinator = createCacheCoordinator({ observer });
    const lastGood = { value: "stale" };
    const producer = vi.fn(async () => {
      throw new Error("upstream down");
    });

    const calls = await Promise.all([
      coordinator.refresh({
        key: "AAPL:profile",
        readFresh: async () => null,
        readLastGood: async () => lastGood,
        write: async () => {},
        produce: producer,
      }),
      coordinator.refresh({
        key: "AAPL:profile",
        readFresh: async () => null,
        readLastGood: async () => lastGood,
        write: async () => {},
        produce: producer,
      }),
    ]);

    expect(calls).toEqual([lastGood, lastGood]);
    expect(producer).toHaveBeenCalledTimes(1);
    expect(events).toContain("last_good_fallback");
  });

  it("returns a configured failure value when no cache exists", async () => {
    const coordinator = createCacheCoordinator({ observer });
    const failureValue = { error: true };

    await expect(coordinator.refresh({
      key: "AAPL:sentiment",
      readFresh: async () => null,
      readLastGood: async () => null,
      write: async () => {},
      produce: async () => {
        throw new Error("llm down");
      },
      failureValue,
    })).resolves.toEqual(failureValue);

    expect(events).toContain("refresh_failed_no_cache");
  });
});
