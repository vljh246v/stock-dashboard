import { double, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar, json, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Watchlist - 사용자별 관심 종목 목록
 */
export const watchlist = mysqlTable("watchlist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type Watchlist = typeof watchlist.$inferSelect;
export type InsertWatchlist = typeof watchlist.$inferInsert;

/**
 * Stock Analysis Cache - API 호출 결과 캐시 (비용 절감)
 */
export const stockAnalysisCache = mysqlTable("stock_analysis_cache", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  dataType: varchar("dataType", { length: 50 }).notNull(), // profile, insights, chart, holders, sec_filing, llm_opinion, llm_sentiment
  data: json("data"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type StockAnalysisCache = typeof stockAnalysisCache.$inferSelect;
export type InsertStockAnalysisCache = typeof stockAnalysisCache.$inferInsert;

/**
 * Opinion Tracking - immutable AI opinion snapshots used for historical alignment evidence.
 */
export const opinionTrackingSnapshots = mysqlTable("opinion_tracking_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  opinionCreatedAt: timestamp("opinionCreatedAt").notNull(),
  opinionVersion: varchar("opinionVersion", { length: 80 }).notNull(),
  finalSignal: varchar("finalSignal", { length: 20 }).notNull(),
  finalConfidence: varchar("finalConfidence", { length: 20 }).notNull(),
  startObservedDate: timestamp("startObservedDate"),
  startPrice: double("startPrice"),
  opinionPayload: json("opinionPayload"),
  sourceSummary: json("sourceSummary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("opinion_tracking_snapshot_unique").on(
    table.symbol,
    table.opinionVersion,
    table.opinionCreatedAt
  ),
]);

export const opinionTrackingOutcomes = mysqlTable("opinion_tracking_outcomes", {
  id: int("id").autoincrement().primaryKey(),
  snapshotId: int("snapshotId").notNull(),
  horizon: varchar("horizon", { length: 10 }).notNull(),
  targetDate: timestamp("targetDate").notNull(),
  observedDate: timestamp("observedDate"),
  observedPrice: double("observedPrice"),
  returnPct: double("returnPct"),
  alignment: varchar("alignment", { length: 30 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("opinion_tracking_outcome_unique").on(table.snapshotId, table.horizon),
]);

export type OpinionTrackingSnapshot = typeof opinionTrackingSnapshots.$inferSelect;
export type InsertOpinionTrackingSnapshot = typeof opinionTrackingSnapshots.$inferInsert;
export type OpinionTrackingOutcome = typeof opinionTrackingOutcomes.$inferSelect;
export type InsertOpinionTrackingOutcome = typeof opinionTrackingOutcomes.$inferInsert;
