import { eq, and, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, watchlist, stockAnalysisCache } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
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
    console.warn("[Database] Cannot upsert user: database not available");
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
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
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
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by email: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== Watchlist Helpers =====

export async function getWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(watchlist).where(eq(watchlist.userId, userId));
}

export async function addToWatchlist(userId: number, symbol: string, name?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if already exists
  const existing = await db.select().from(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.symbol, symbol.toUpperCase())))
    .limit(1);

  if (existing.length > 0) return existing[0];

  await db.insert(watchlist).values({
    userId,
    symbol: symbol.toUpperCase(),
    name: name || null,
  });

  const result = await db.select().from(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.symbol, symbol.toUpperCase())))
    .limit(1);
  return result[0];
}

export async function removeFromWatchlist(userId: number, symbol: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(watchlist).where(
    and(eq(watchlist.userId, userId), eq(watchlist.symbol, symbol.toUpperCase()))
  );
}

// ===== Cache Helpers =====

export async function getCachedData(symbol: string, dataType: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(stockAnalysisCache)
    .where(
      and(
        eq(stockAnalysisCache.symbol, symbol.toUpperCase()),
        eq(stockAnalysisCache.dataType, dataType),
        gt(stockAnalysisCache.expiresAt, new Date())
      )
    )
    .limit(1);

  return result.length > 0 ? result[0].data : null;
}

export async function setCachedData(symbol: string, dataType: string, data: unknown, ttlMinutes: number = 60) {
  const db = await getDb();
  if (!db) return;

  // Delete old cache for this symbol+type
  await db.delete(stockAnalysisCache).where(
    and(
      eq(stockAnalysisCache.symbol, symbol.toUpperCase()),
      eq(stockAnalysisCache.dataType, dataType)
    )
  );

  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  await db.insert(stockAnalysisCache).values({
    symbol: symbol.toUpperCase(),
    dataType,
    data: data as any,
    expiresAt,
  });
}
