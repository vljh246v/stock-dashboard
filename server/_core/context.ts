import {
  ACCOUNT_PENDING_APPROVAL_MSG,
  COOKIE_NAME,
} from "@shared/const";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateRequest } from "./auth";
import { getSessionCookieOptions } from "./cookies";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await authenticateRequest(opts.req);
  } catch (error) {
    if (error instanceof Error && error.message === ACCOUNT_PENDING_APPROVAL_MSG) {
      opts.res.clearCookie(COOKIE_NAME, {
        ...getSessionCookieOptions(opts.req),
        maxAge: -1,
      });
    }
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
