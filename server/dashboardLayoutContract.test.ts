import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(import.meta.dirname, "../client/src/pages/Dashboard.tsx"),
  "utf-8"
);

describe("Dashboard layout contract", () => {
  it("keeps mobile content usable without shrinking the main dashboard column", () => {
    expect(dashboardSource).toContain("flex-col");
    expect(dashboardSource).toContain("md:flex-row");
    expect(dashboardSource).toContain("max-h-56");
    expect(dashboardSource).toContain("md:w-64");
    expect(dashboardSource).toContain("min-w-0 flex-1 overflow-y-auto");
  });
});
