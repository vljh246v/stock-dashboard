import { beforeEach, describe, expect, it, vi } from "vitest";

describe("local development database fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "";
    process.env.JWT_SECRET = "test-secret";
    process.env.ENABLE_LOCAL_DB_FALLBACK = "1";
  });

  it("keeps email auth and watchlist usable when MySQL is unavailable", async () => {
    const { registerWithEmail, loginWithEmail } = await import("./_core/auth");
    const { addToWatchlist, approveUser, getWatchlist } = await import("./db");

    const email = `local-${Date.now()}@example.com`;
    const registered = await registerWithEmail({
      email,
      password: "Testpass123!",
      name: "Local User",
    });
    await approveUser(registered.id);
    const loggedIn = await loginWithEmail({
      email,
      password: "Testpass123!",
    });
    const watchlistItem = await addToWatchlist(loggedIn.id, "AAPL", "Apple Inc.");
    const watchlist = await getWatchlist(loggedIn.id);

    expect(registered.email).toBe(email);
    expect(loggedIn.openId).toBe(`email:${email}`);
    expect(watchlistItem.symbol).toBe("AAPL");
    expect(watchlist).toEqual([watchlistItem]);
  });
});
