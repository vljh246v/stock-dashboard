import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockQuoteSummary, mockInsights, mockChart } = vi.hoisted(() => ({
  mockQuoteSummary: vi.fn(),
  mockInsights: vi.fn(),
  mockChart: vi.fn(),
}));

vi.mock("yahoo-finance2", () => ({
  default: class YahooFinanceMock {
    quoteSummary = mockQuoteSummary;
    insights = mockInsights;
    chart = mockChart;
  },
}));

vi.mock("./db", () => ({
  getCachedData: vi.fn().mockResolvedValue(null),
  getLastGoodCachedData: vi.fn().mockResolvedValue(null),
  setCachedData: vi.fn().mockResolvedValue(undefined),
}));

import { getStockChart, getStockInsights, getStockProfile } from "./stockData";

describe("getStockProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuoteSummary.mockResolvedValue({
      price: { shortName: "SPDR S&P 500 ETF Trust" },
      quoteType: { quoteType: "ETF" },
      fundProfile: { family: "State Street Investment Management" },
    });
    mockInsights.mockResolvedValue({ recommendation: { rating: "Buy" } });
    mockChart.mockResolvedValue({
      meta: { regularMarketPrice: 100 },
      timestamp: [1],
      indicators: { quote: [{ close: [100] }] },
    });
  });

  it("requests fundProfile so ETF dashboards have enough basic fund data", async () => {
    await getStockProfile("SPY");

    expect(mockQuoteSummary).toHaveBeenCalledWith("SPY", {
      modules: expect.arrayContaining([
        "summaryProfile",
        "price",
        "quoteType",
        "fundProfile",
      ]),
    });
  });

  it("requests structured earnings and financial modules for verified guidance evidence", async () => {
    await getStockProfile("AAPL");

    expect(mockQuoteSummary).toHaveBeenCalledWith("AAPL", {
      modules: expect.arrayContaining([
        "financialData",
        "earnings",
        "earningsHistory",
        "earningsTrend",
        "calendarEvents",
      ]),
    });
  });

  it("coalesces concurrent profile cache misses for the same symbol", async () => {
    const [first, second, third] = await Promise.all([
      getStockProfile("aapl"),
      getStockProfile("AAPL"),
      getStockProfile("AAPL"),
    ]);

    expect(first).toEqual(second);
    expect(second).toEqual(third);
    expect(mockQuoteSummary).toHaveBeenCalledTimes(1);
  });

  it("coalesces chart calls by symbol, interval, and range only", async () => {
    await Promise.all([
      getStockChart("AAPL", "1d", "6mo"),
      getStockChart("AAPL", "1d", "6mo"),
      getStockChart("AAPL", "1d", "5d"),
    ]);

    expect(mockChart).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent insights cache misses for the same symbol", async () => {
    await Promise.all([
      getStockInsights("AAPL"),
      getStockInsights("aapl"),
      getStockInsights("AAPL"),
    ]);

    expect(mockInsights).toHaveBeenCalledTimes(1);
  });
});
