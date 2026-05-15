import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("cache concurrency migration", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "drizzle/0005_cache_concurrency_unique.sql"),
    "utf8"
  );
  const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
  const snapshot = readFileSync(resolve(process.cwd(), "drizzle/meta/0005_snapshot.json"), "utf8");

  it("deduplicates watchlist before adding the user-symbol unique key", () => {
    expect(migration.indexOf("DELETE w1 FROM `watchlist`")).toBeLessThan(
      migration.indexOf("watchlist_user_symbol_unique")
    );
    expect(migration).toContain("w1.`id` > w2.`id`");
    expect(migration).toContain("UNIQUE(`userId`,`symbol`)");
    expect(schema).toContain("watchlist_user_symbol_unique");
    expect(snapshot).toContain("watchlist_user_symbol_unique");
  });

  it("keeps the newest cache row before adding the symbol-type unique key", () => {
    expect(migration.indexOf("DELETE c1 FROM `stock_analysis_cache`")).toBeLessThan(
      migration.indexOf("stock_analysis_cache_symbol_type_unique")
    );
    expect(migration).toContain("c1.`expiresAt` < c2.`expiresAt`");
    expect(migration).toContain("c1.`id` < c2.`id`");
    expect(migration).toContain("UNIQUE(`symbol`,`dataType`)");
    expect(schema).toContain("stock_analysis_cache_symbol_type_unique");
    expect(snapshot).toContain("stock_analysis_cache_symbol_type_unique");
  });
});
