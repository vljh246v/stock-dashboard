import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { upsertUser } from "../db";
import { appRouter } from "../routers";
import { createSessionToken } from "./auth";
import { createContext } from "./context";
import { getSessionCookieOptions } from "./cookies";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  if (
    process.env.NODE_ENV === "development" &&
    process.env.ENABLE_LOCAL_DB_FALLBACK === "1"
  ) {
    app.get("/api/dev-login", async (req, res, next) => {
      try {
        const user = {
          openId: "email:local-dev@stockpulse.test",
          email: "local-dev@stockpulse.test",
          name: "Local Dev",
          loginMethod: "email",
          role: "admin" as const,
          approvedAt: new Date(),
          lastSignedIn: new Date(),
        };

        await upsertUser(user);
        const sessionToken = await createSessionToken(
          { openId: user.openId, name: user.name },
          { expiresInMs: ONE_YEAR_MS }
        );
        res.cookie(COOKIE_NAME, sessionToken, {
          ...getSessionCookieOptions(req),
          maxAge: ONE_YEAR_MS,
        });
        res.redirect("/dashboard");
      } catch (error) {
        next(error);
      }
    });
  }

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port =
    process.env.NODE_ENV === "production" ? preferredPort : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  const host =
    process.env.HOST || (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0");

  server.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}/`);
  });
}

startServer().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
