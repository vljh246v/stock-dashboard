import mysql from "mysql2/promise";

export type CacheCoordinatorEventType =
  | "cache_hit"
  | "cache_hit_after_lock"
  | "refresh_started"
  | "refresh_waited"
  | "refresh_written"
  | "refresh_timeout"
  | "last_good_fallback"
  | "refresh_failed_no_cache";

export type CacheCoordinatorObserver = (event: {
  type: CacheCoordinatorEventType;
  key: string;
}) => void;

export interface CacheRefreshLock {
  runExclusive<T>(
    key: string,
    timeoutSeconds: number,
    task: () => Promise<T>
  ): Promise<T>;
}

interface RefreshOptions<T> {
  key: string;
  readFresh: () => Promise<T | null>;
  readLastGood: () => Promise<T | null>;
  write: (value: T) => Promise<void>;
  produce: () => Promise<T | null>;
  failureValue?: T;
  isCacheable?: (value: T) => boolean;
  lockTimeoutSeconds?: number;
}

export interface CacheCoordinator {
  refresh<T>(options: RefreshOptions<T>): Promise<T | null>;
}

class MySqlAdvisoryLock implements CacheRefreshLock {
  async runExclusive<T>(
    key: string,
    timeoutSeconds: number,
    task: () => Promise<T>
  ): Promise<T> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return task();

    const connection = await mysql.createConnection(databaseUrl);
    const lockKey = `stockpulse:cache:${key}`.slice(0, 64);
    try {
      const [rows] = await connection.query("SELECT GET_LOCK(?, ?) AS acquired", [
        lockKey,
        timeoutSeconds,
      ]);
      const acquired = Array.isArray(rows)
        ? Number((rows[0] as { acquired?: unknown })?.acquired)
        : 0;
      if (acquired !== 1) {
        throw new Error(`Timed out waiting for cache refresh lock: ${key}`);
      }
      return await task();
    } finally {
      try {
        await connection.query("SELECT RELEASE_LOCK(?)", [lockKey]);
      } finally {
        await connection.end();
      }
    }
  }
}

export function createCacheCoordinator(options: {
  lock?: CacheRefreshLock | null;
  observer?: CacheCoordinatorObserver;
} = {}): CacheCoordinator {
  const inFlight = new Map<string, Promise<unknown>>();
  const lock = options.lock === undefined
    ? process.env.DATABASE_URL
      ? new MySqlAdvisoryLock()
      : null
    : options.lock;
  const observe = (type: CacheCoordinatorEventType, key: string) => {
    options.observer?.({ type, key });
  };

  async function refresh<T>(refreshOptions: RefreshOptions<T>): Promise<T | null> {
    const fresh = await refreshOptions.readFresh();
    if (fresh !== null) {
      observe("cache_hit", refreshOptions.key);
      return fresh;
    }

    const existing = inFlight.get(refreshOptions.key) as Promise<T | null> | undefined;
    if (existing) {
      observe("refresh_waited", refreshOptions.key);
      return existing;
    }

    const task = runRefresh(refreshOptions);
    inFlight.set(refreshOptions.key, task);
    try {
      return await task;
    } finally {
      inFlight.delete(refreshOptions.key);
    }
  }

  async function runRefresh<T>(refreshOptions: RefreshOptions<T>): Promise<T | null> {
    const execute = async () => {
      const afterLock = await refreshOptions.readFresh();
      if (afterLock !== null) {
        observe("cache_hit_after_lock", refreshOptions.key);
        return afterLock;
      }

      observe("refresh_started", refreshOptions.key);
      try {
        const produced = await refreshOptions.produce();
        if (produced === null) {
          const lastGood = await refreshOptions.readLastGood();
          if (lastGood !== null) {
            observe("last_good_fallback", refreshOptions.key);
            return lastGood;
          }
          if (refreshOptions.failureValue !== undefined) {
            observe("refresh_failed_no_cache", refreshOptions.key);
            return refreshOptions.failureValue;
          }
          return null;
        }

        const cacheable = refreshOptions.isCacheable?.(produced) ?? true;
        if (cacheable) {
          await refreshOptions.write(produced);
          observe("refresh_written", refreshOptions.key);
        }
        return produced;
      } catch (error) {
        const lastGood = await refreshOptions.readLastGood();
        if (lastGood !== null) {
          observe("last_good_fallback", refreshOptions.key);
          return lastGood;
        }
        if (refreshOptions.failureValue !== undefined) {
          observe("refresh_failed_no_cache", refreshOptions.key);
          return refreshOptions.failureValue;
        }
        throw error;
      }
    };

    if (!lock) return execute();

    try {
      return await lock.runExclusive(
        refreshOptions.key,
        refreshOptions.lockTimeoutSeconds ?? 5,
        execute
      );
    } catch (error) {
      observe("refresh_timeout", refreshOptions.key);
      const lastGood = await refreshOptions.readLastGood();
      if (lastGood !== null) {
        observe("last_good_fallback", refreshOptions.key);
        return lastGood;
      }
      if (refreshOptions.failureValue !== undefined) {
        observe("refresh_failed_no_cache", refreshOptions.key);
        return refreshOptions.failureValue;
      }
      throw error;
    }
  }

  return { refresh };
}

export const defaultCacheCoordinator = createCacheCoordinator();
