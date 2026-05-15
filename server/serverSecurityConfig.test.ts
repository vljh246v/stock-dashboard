import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serverSource = () =>
  readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
const viteSource = () =>
  readFileSync(new URL("./_core/vite.ts", import.meta.url), "utf8");

describe("server security configuration", () => {
  it("keeps request body parsing limits small", () => {
    const source = serverSource();

    expect(source).toContain('express.json({ limit: "1mb" })');
    expect(source).toContain('express.urlencoded({ limit: "1mb", extended: true })');
    expect(source).not.toContain('"50mb"');
  });

  it("binds production server to localhost unless HOST is explicitly set", () => {
    const source = serverSource();

    expect(source).toContain(
      'process.env.HOST || (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0")'
    );
    expect(source).toContain("server.listen(port, host");
  });

  it("uses Express 5 compatible SPA fallback handlers", () => {
    const source = viteSource();

    expect(source).not.toContain('app.use("*"');
  });

  it("fails the process when server startup fails", () => {
    const source = serverSource();

    expect(source).toContain("process.exitCode = 1");
  });

  it("keeps the production port strict for reverse proxies", () => {
    const source = serverSource();

    expect(source).toContain(
      'process.env.NODE_ENV === "production" ? preferredPort : await findAvailablePort(preferredPort)'
    );
  });
});
