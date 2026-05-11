import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "email:user@example.com",
      email: "user@example.com",
      name: "User",
      passwordHash: "scrypt:secret",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { cookie: () => {}, clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("auth routes", () => {
  it("does not expose password hashes from auth.me", async () => {
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.auth.me();

    expect(result).not.toHaveProperty("passwordHash");
    expect(result).toMatchObject({
      id: 1,
      email: "user@example.com",
      loginMethod: "email",
    });
  });
});
