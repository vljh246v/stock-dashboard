import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockQuoteSummary } = vi.hoisted(() => ({
  mockQuoteSummary: vi.fn(),
}));

vi.mock("yahoo-finance2", () => ({
  default: class YahooFinanceMock {
    quoteSummary = mockQuoteSummary;
  },
}));

vi.mock("./db", () => ({
  getCachedData: vi.fn().mockResolvedValue(null),
  setCachedData: vi.fn().mockResolvedValue(undefined),
}));

import { getStockProfile } from "./stockData";

describe("getStockProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuoteSummary.mockResolvedValue({
      price: { shortName: "SPDR S&P 500 ETF Trust" },
      quoteType: { quoteType: "ETF" },
      fundProfile: { family: "State Street Investment Management" },
    });
  });

  it("requests fundProfile so ETF dashboards have enough basic fund data", async () => {
    await getStockProfile("SPY");

    expect(mockQuoteSummary).toHaveBeenCalledWith("SPY", {
      modules: expect.arrayContaining(["summaryProfile", "price", "quoteType", "fundProfile"]),
    });
  });
});
