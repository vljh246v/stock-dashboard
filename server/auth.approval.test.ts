import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

function createPublicContext(cookie = vi.fn()): TrpcContext {
  return {
    user: null,
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: {
      cookie,
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("auth approval gate", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "";
    process.env.JWT_SECRET = "test-secret";
    process.env.OWNER_OPEN_ID = "email:owner@example.com";
    process.env.ENABLE_LOCAL_DB_FALLBACK = "1";
  });

  it("registers normal users as pending without issuing a session cookie", async () => {
    const { appRouter } = await import("./routers");
    const cookie = vi.fn();
    const caller = appRouter.createCaller(createPublicContext(cookie));

    const result = await caller.auth.register({
      email: "pending@example.com",
      password: "Testpass123!",
      name: "Pending User",
    });

    expect(result).toMatchObject({
      email: "pending@example.com",
      approvedAt: null,
    });
    expect(cookie).not.toHaveBeenCalled();
  });

  it("rejects login until the user is approved", async () => {
    const { registerWithEmail, loginWithEmail } = await import("./_core/auth");

    await registerWithEmail({
      email: "wait@example.com",
      password: "Testpass123!",
      name: "Wait User",
    });

    await expect(
      loginWithEmail({
        email: "wait@example.com",
        password: "Testpass123!",
      })
    ).rejects.toThrow("관리자 승인 후 사용할 수 있습니다.");
  });

  it("does not auto-approve or promote the owner email from public registration", async () => {
    const { appRouter } = await import("./routers");
    const cookie = vi.fn();
    const caller = appRouter.createCaller(createPublicContext(cookie));

    const result = await caller.auth.register({
      email: "owner@example.com",
      password: "Testpass123!",
      name: "Owner Imposter",
    });

    expect(result).toMatchObject({
      email: "owner@example.com",
      role: "user",
      approvedAt: null,
    });
    expect(cookie).not.toHaveBeenCalled();
  });

  it("allows an admin to approve a pending user before login", async () => {
    const { appRouter } = await import("./routers");
    const { getUserByEmail, upsertUser } = await import("./db");
    const { loginWithEmail } = await import("./_core/auth");
    const pendingCaller = appRouter.createCaller(createPublicContext());

    await upsertUser({
      openId: "email:owner@example.com",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "email",
      role: "admin",
      approvedAt: new Date(),
    });
    const admin = await getUserByEmail("owner@example.com");
    expect(admin).toBeTruthy();

    const pending = await pendingCaller.auth.register({
      email: "approve-me@example.com",
      password: "Testpass123!",
      name: "Approve Me",
    });
    const adminCaller = appRouter.createCaller({
      ...createPublicContext(),
      user: admin!,
    });

    const pendingUsers = await adminCaller.auth.pendingUsers();
    expect(pendingUsers.map(user => user.email)).toContain("approve-me@example.com");

    const approved = await adminCaller.auth.approveUser({ userId: pending.id });

    expect(approved).toMatchObject({
      id: pending.id,
      email: "approve-me@example.com",
    });
    expect(approved?.approvedAt).toBeInstanceOf(Date);
    await expect(
      loginWithEmail({
        email: "approve-me@example.com",
        password: "Testpass123!",
      })
    ).resolves.toMatchObject({ id: pending.id });
  });

  it("rejects admin procedures for unapproved admin users", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      ...createPublicContext(),
      user: {
        id: 99,
        openId: "email:unapproved-admin@example.com",
        email: "unapproved-admin@example.com",
        name: "Unapproved Admin",
        passwordHash: null,
        loginMethod: "email",
        role: "admin",
        approvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    });

    await expect(caller.auth.pendingUsers()).rejects.toThrow(
      "관리자 승인 후 사용할 수 있습니다."
    );
  });

  it("clears stale session cookies for pending users", async () => {
    const { COOKIE_NAME } = await import("@shared/const");
    const { createContext } = await import("./_core/context");
    const { createSessionToken, registerWithEmail } = await import("./_core/auth");
    const clearCookie = vi.fn();

    await registerWithEmail({
      email: "stale-session@example.com",
      password: "Testpass123!",
      name: "Stale Session",
    });
    const token = await createSessionToken({
      openId: "email:stale-session@example.com",
      name: "Stale Session",
    });

    const context = await createContext({
      req: {
        protocol: "http",
        headers: {
          cookie: `${COOKIE_NAME}=${token}`,
        },
      } as TrpcContext["req"],
      res: {
        clearCookie,
      } as unknown as TrpcContext["res"],
    });

    expect(context.user).toBeNull();
    expect(clearCookie).toHaveBeenCalledWith(
      COOKIE_NAME,
      expect.objectContaining({ maxAge: -1 })
    );
  });
});
