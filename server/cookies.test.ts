import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";
import type { Request } from "express";

function request(protocol: "http" | "https", host: string): Request {
  return {
    protocol,
    headers: {
      host,
    },
  } as Request;
}

describe("getSessionCookieOptions", () => {
  it("uses lax cookies for plain HTTP localhost so browsers keep login sessions", () => {
    expect(getSessionCookieOptions(request("http", "localhost:3000"))).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });

  it("uses secure none cookies behind HTTPS", () => {
    expect(getSessionCookieOptions(request("https", "app.example.com"))).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  });
});
