import { describe, expect, it } from "vitest";

import {
  coerceDashboardTabForAsset,
  getDashboardTabValues,
} from "../client/src/lib/dashboardTabs";

describe("dashboard tab asset transitions", () => {
  it("keeps stock-only financial guidance from surviving an ETF transition", () => {
    expect(coerceDashboardTabForAsset("financial-guidance", true)).toBe("core");
    expect(getDashboardTabValues(true)).not.toContain("financial-guidance");
  });

  it("keeps ETF-only detail tabs from surviving a stock transition", () => {
    expect(coerceDashboardTabForAsset("etf", false)).toBe("core");
    expect(getDashboardTabValues(false)).not.toContain("etf");
  });

  it("preserves shared tabs across stock and ETF transitions", () => {
    for (const tab of ["core", "technical", "opinion", "evidence", "sentiment"]) {
      expect(coerceDashboardTabForAsset(tab, true)).toBe(tab);
      expect(coerceDashboardTabForAsset(tab, false)).toBe(tab);
    }
  });
});
