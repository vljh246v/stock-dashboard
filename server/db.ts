import { eq, and, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  type User,
  type Watchlist,
  users,
  watchlist,
  stockAnalysisCache,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let dbUnavailable = false;
let warnedLocalFallback = false;

type LocalCacheEntry = {
  symbol: string;
  dataType: string;
  data: unknown;
  expiresAt: Date;
};

const localStore = {
  nextUserId: 1,
  nextWatchlistId: 1,
  users: [] as User[],
  watchlist: [] as Watchlist[],
  cache: [] as LocalCacheEntry[],
};

function canUseLocalFallback() {
  return ENV.enableLocalDbFallback || process.env.VITEST === "true";
}

function useLocalFallback(reason: string, error?: unknown) {
  if (!canUseLocalFallback()) return false;
  dbUnavailable = true;
  if (!warnedLocalFallback) {
    warnedLocalFallback = true;
    const suffix = error instanceof Error ? `: ${error.message}` : "";
    console.warn(`[Database] Using local development fallback (${reason})${suffix}`);
  }
  return true;
}

function localRoleFor(role?: "user" | "admin" | null) {
  return role ?? "user";
}

function localUpsertUser(user: InsertUser): void {
  const now = new Date();
  const existing = localStore.users.find(item => item.openId === user.openId);

  if (existing) {
    if (user.name !== undefined) existing.name = user.name ?? null;
    if (user.email !== undefined) existing.email = user.email ?? null;
    if (user.passwordHash !== undefined) existing.passwordHash = user.passwordHash ?? null;
    if (user.loginMethod !== undefined) existing.loginMethod = user.loginMethod ?? null;
    if (user.role !== undefined) existing.role = localRoleFor(user.role);
    if (user.approvedAt !== undefined) existing.approvedAt = user.approvedAt ?? null;
    if (user.lastSignedIn !== undefined) existing.lastSignedIn = user.lastSignedIn;
    existing.updatedAt = now;
    return;
  }

  localStore.users.push({
    id: localStore.nextUserId++,
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    passwordHash: user.passwordHash ?? null,
    loginMethod: user.loginMethod ?? null,
    role: localRoleFor(user.role),
    approvedAt: user.approvedAt ?? null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: user.lastSignedIn ?? now,
  });
}

export async function getDb() {
  if (dbUnavailable) return null;
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      useLocalFallback("connection setup failed", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    if (useLocalFallback("database not available")) {
      localUpsertUser(user);
    }
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "passwordHash", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }
    if (user.approvedAt !== undefined) {
      values.approvedAt = user.approvedAt;
      updateSet.approvedAt = user.approvedAt;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    if (useLocalFallback("upsert user failed", error)) {
      localUpsertUser(user);
      return;
    }
    throw error;
  }
}

export async function approveUser(userId: number, approvedAt = new Date()) {
  const db = await getDb();
  if (!db) {
    if (useLocalFallback("database not available")) {
      const user = localStore.users.find(item => item.id === userId);
      if (!user) return undefined;
      user.approvedAt = approvedAt;
      user.updatedAt = new Date();
      return user;
    }
    return undefined;
  }

  try {
    await db.update(users).set({ approvedAt }).where(eq(users.id, userId));
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    if (useLocalFallback("approve user failed", error)) {
      const user = localStore.users.find(item => item.id === userId);
      if (!user) return undefined;
      user.approvedAt = approvedAt;
      user.updatedAt = new Date();
      return user;
    }
    throw error;
  }
}

export async function getPendingUsers() {
  const db = await getDb();
  if (!db) {
    if (useLocalFallback("database not available")) {
      return localStore.users.filter(user => !user.approvedAt);
    }
    return [];
  }

  try {
    const result = await db.select().from(users);
    return result.filter(user => !user.approvedAt);
  } catch (error) {
    if (useLocalFallback("get pending users failed", error)) {
      return localStore.users.filter(user => !user.approvedAt);
    }
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    if (useLocalFallback("database not available")) {
      return localStore.users.find(user => user.openId === openId);
    }
    return undefined;
  }

  try {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    if (useLocalFallback("get user failed", error)) {
      return localStore.users.find(user => user.openId === openId);
    }
    throw error;
  }
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    if (useLocalFallback("database not available")) {
      const normalized = email.toLowerCase();
      return localStore.users.find(user => user.email?.toLowerCase() === normalized);
    }
    return undefined;
  }

  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    if (useLocalFallback("get user by email failed", error)) {
      const normalized = email.toLowerCase();
      return localStore.users.find(user => user.email?.toLowerCase() === normalized);
    }
    throw error;
  }
}

// ===== Watchlist Helpers =====

export async function getWatchlist(userId: number) {
  const db = await getDb();
  if (!db) {
    if (useLocalFallback("database not available")) {
      return localStore.watchlist.filter(item => item.userId === userId);
    }
    return [];
  }
  try {
    return await db.select().from(watchlist).where(eq(watchlist.userId, userId));
  } catch (error) {
    if (useLocalFallback("get watchlist failed", error)) {
      return localStore.watchlist.filter(item => item.userId === userId);
    }
    throw error;
  }
}

export async function addToWatchlist(userId: number, symbol: string, name?: string) {
  const db = await getDb();
  const normalizedSymbol = symbol.toUpperCase();
  if (!db) {
    if (useLocalFallback("database not available")) {
      const existing = localStore.watchlist.find(
        item => item.userId === userId && item.symbol === normalizedSymbol
      );
      if (existing) return existing;

      const item: Watchlist = {
        id: localStore.nextWatchlistId++,
        userId,
        symbol: normalizedSymbol,
        name: name || null,
        addedAt: new Date(),
      };
      localStore.watchlist.push(item);
      return item;
    }
    throw new Error("Database not available");
  }

  // Check if already exists
  try {
    const existing = await db.select().from(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.symbol, normalizedSymbol)))
      .limit(1);

    if (existing.length > 0) return existing[0];

    await db.insert(watchlist).values({
      userId,
      symbol: normalizedSymbol,
      name: name || null,
    });

    const result = await db.select().from(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.symbol, normalizedSymbol)))
      .limit(1);
    return result[0];
  } catch (error) {
    if (useLocalFallback("add watchlist failed", error)) {
      return addToWatchlist(userId, normalizedSymbol, name);
    }
    throw error;
  }
}

export async function removeFromWatchlist(userId: number, symbol: string) {
  const db = await getDb();
  const normalizedSymbol = symbol.toUpperCase();
  if (!db) {
    if (useLocalFallback("database not available")) {
      localStore.watchlist = localStore.watchlist.filter(
        item => !(item.userId === userId && item.symbol === normalizedSymbol)
      );
      return;
    }
    throw new Error("Database not available");
  }
  try {
    await db.delete(watchlist).where(
      and(eq(watchlist.userId, userId), eq(watchlist.symbol, normalizedSymbol))
    );
  } catch (error) {
    if (useLocalFallback("remove watchlist failed", error)) {
      await removeFromWatchlist(userId, normalizedSymbol);
      return;
    }
    throw error;
  }
}

// ===== Cache Helpers =====

export async function getCachedData(symbol: string, dataType: string) {
  const db = await getDb();
  const normalizedSymbol = symbol.toUpperCase();
  if (!db) {
    if (useLocalFallback("database not available")) {
      const cached = localStore.cache.find(
        item =>
          item.symbol === normalizedSymbol &&
          item.dataType === dataType &&
          item.expiresAt > new Date()
      );
      return cached?.data ?? null;
    }
    return null;
  }

  try {
    const result = await db.select().from(stockAnalysisCache)
      .where(
        and(
          eq(stockAnalysisCache.symbol, normalizedSymbol),
          eq(stockAnalysisCache.dataType, dataType),
          gt(stockAnalysisCache.expiresAt, new Date())
        )
      )
      .limit(1);

    return result.length > 0 ? result[0].data : null;
  } catch (error) {
    if (useLocalFallback("get cache failed", error)) {
      return getCachedData(normalizedSymbol, dataType);
    }
    throw error;
  }
}

export async function setCachedData(symbol: string, dataType: string, data: unknown, ttlMinutes: number = 60) {
  const db = await getDb();
  const normalizedSymbol = symbol.toUpperCase();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  if (!db) {
    if (useLocalFallback("database not available")) {
      localStore.cache = localStore.cache.filter(
        item => !(item.symbol === normalizedSymbol && item.dataType === dataType)
      );
      localStore.cache.push({
        symbol: normalizedSymbol,
        dataType,
        data,
        expiresAt,
      });
    }
    return;
  }

  try {
    // Delete old cache for this symbol+type
    await db.delete(stockAnalysisCache).where(
      and(
        eq(stockAnalysisCache.symbol, normalizedSymbol),
        eq(stockAnalysisCache.dataType, dataType)
      )
    );

    await db.insert(stockAnalysisCache).values({
      symbol: normalizedSymbol,
      dataType,
      data: data as any,
      expiresAt,
    });
  } catch (error) {
    if (useLocalFallback("set cache failed", error)) {
      await setCachedData(normalizedSymbol, dataType, data, ttlMinutes);
      return;
    }
    throw error;
  }
}
