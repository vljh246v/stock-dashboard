import {
  ACCOUNT_PENDING_APPROVAL_MSG,
  COOKIE_NAME,
  INVALID_EMAIL_OR_PASSWORD_MSG,
  ONE_YEAR_MS,
} from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { jwtVerify, SignJWT } from "jose";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;

type SessionPayload = {
  openId: string;
  name: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function isUserApproved(user: Pick<User, "approvedAt">): boolean {
  return Boolean(user.approvedAt);
}

const getSessionSecret = () => {
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
};

function parseCookies(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return new Map<string, string>();
  }

  const parsed = parseCookieHeader(cookieHeader);
  return new Map(Object.entries(parsed));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!storedHash) return false;

  const [algorithm, salt, key] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !key) return false;

  const storedKey = Buffer.from(key, "hex");
  const derivedKey = (await scrypt(password, salt, storedKey.length)) as Buffer;
  return (
    storedKey.length === derivedKey.length &&
    timingSafeEqual(storedKey, derivedKey)
  );
}

export async function createSessionToken(
  payload: SessionPayload,
  options: { expiresInMs?: number } = {}
): Promise<string> {
  const issuedAt = Date.now();
  const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
  const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

  return new SignJWT({
    openId: payload.openId,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSessionSecret());
}

export async function verifySession(
  cookieValue: string | undefined | null
): Promise<SessionPayload | null> {
  if (!cookieValue) return null;

  try {
    const { payload } = await jwtVerify(cookieValue, getSessionSecret(), {
      algorithms: ["HS256"],
    });
    const { openId, name } = payload as Record<string, unknown>;

    if (typeof openId !== "string" || openId.length === 0) return null;
    return {
      openId,
      name: typeof name === "string" ? name : "",
    };
  } catch {
    return null;
  }
}

export async function authenticateRequest(req: Request): Promise<User> {
  const cookies = parseCookies(req.headers.cookie);
  const session = await verifySession(cookies.get(COOKIE_NAME));

  if (!session) {
    throw ForbiddenError("Invalid session cookie");
  }

  const user = await db.getUserByOpenId(session.openId);
  if (!user) {
    throw ForbiddenError("User not found");
  }
  if (!isUserApproved(user)) {
    throw ForbiddenError(ACCOUNT_PENDING_APPROVAL_MSG);
  }

  await db.upsertUser({
    openId: user.openId,
    lastSignedIn: new Date(),
  });

  return user;
}

export async function registerWithEmail(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<User> {
  const email = normalizeEmail(input.email);
  const existing = await db.getUserByEmail(email);
  if (existing) {
    throw new Error("이미 가입된 이메일입니다.");
  }

  const openId = `email:${email}`;
  await db.upsertUser({
    openId,
    email,
    name: input.name?.trim() || email.split("@")[0],
    passwordHash: await hashPassword(input.password),
    loginMethod: "email",
    role: "user",
    approvedAt: null,
    lastSignedIn: new Date(),
  });

  const user = await db.getUserByOpenId(openId);
  if (!user) {
    throw new Error("사용자를 생성할 수 없습니다.");
  }
  return user;
}

export async function loginWithEmail(input: {
  email: string;
  password: string;
}): Promise<User> {
  const email = normalizeEmail(input.email);
  const user = await db.getUserByEmail(email);

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new Error(INVALID_EMAIL_OR_PASSWORD_MSG);
  }
  if (!isUserApproved(user)) {
    throw new Error(ACCOUNT_PENDING_APPROVAL_MSG);
  }

  await db.upsertUser({
    openId: user.openId,
    lastSignedIn: new Date(),
  });

  return user;
}
