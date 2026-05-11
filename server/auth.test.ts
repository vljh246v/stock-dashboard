import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, hashPassword, verifyPassword, verifySession } from "./_core/auth";

vi.mock("./_core/env", () => ({
  ENV: {
    cookieSecret: "test-secret-at-least-long-enough",
    ownerOpenId: "",
    isProduction: false,
    openAiApiKey: "",
    openAiModel: "gpt-4o-mini",
  },
}));

describe("local auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hashes and verifies passwords without storing plaintext", async () => {
    const hash = await hashPassword("correct-password");

    expect(hash).toMatch(/^scrypt:/);
    expect(hash).not.toContain("correct-password");
    await expect(verifyPassword("correct-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("creates and verifies local session tokens", async () => {
    const token = await createSessionToken({
      openId: "email:user@example.com",
      name: "User",
    });

    const session = await verifySession(token);

    expect(session).toEqual({
      openId: "email:user@example.com",
      name: "User",
    });
  });
});
