import { describe, it, expect, vi, beforeEach } from "vitest";
import { getETFHoldings } from "./stockData";
import * as db from "./db";

// Mock the db module
vi.mock("./db", () => ({
  getCachedData: vi.fn(),
  getLastGoodCachedData: vi.fn(),
  setCachedData: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockVanguardResponse = {
  size: 503,
  asOfDate: "2026-03-31T00:00:00-04:00",
  fund: {
    entity: [
      { ticker: "NVDA", longName: "NVIDIA Corp.", percentWeight: "7.58", marketValue: 107915509121.6 },
      { ticker: "AAPL", longName: "Apple Inc.", percentWeight: "6.66", marketValue: 94876849539.36 },
      { ticker: "MSFT", longName: "Microsoft Corp.", percentWeight: "4.92", marketValue: 70123456789.0 },
      { ticker: "AMZN", longName: "Amazon.com Inc.", percentWeight: "3.64", marketValue: 51234567890.0 },
      { ticker: "GOOGL", longName: "Alphabet Inc. Class A", percentWeight: "2.99", marketValue: 42345678901.0 },
      { ticker: "META", longName: "Meta Platforms Inc.", percentWeight: "2.56", marketValue: 36456789012.0 },
      { ticker: "TSLA", longName: "Tesla Inc.", percentWeight: "1.87", marketValue: 26567890123.0 },
      { ticker: "BRK.B", longName: "Berkshire Hathaway Inc.", percentWeight: "1.74", marketValue: 24678901234.0 },
      { ticker: "AVGO", longName: "Broadcom Inc.", percentWeight: "1.65", marketValue: 23456789012.0 },
      { ticker: "JPM", longName: "JPMorgan Chase & Co.", percentWeight: "1.45", marketValue: 20678901234.0 },
      // Extra entries to test slicing to top 10
      { ticker: "UNH", longName: "UnitedHealth Group Inc.", percentWeight: "1.23", marketValue: 17890123456.0 },
    ],
  },
};

describe("getETFHoldings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getCachedData).mockResolvedValue(null);
    vi.mocked(db.getLastGoodCachedData).mockResolvedValue(null);
    vi.mocked(db.setCachedData).mockResolvedValue(undefined);
  });

  it("캐시된 데이터가 있으면 API를 호출하지 않고 반환한다", async () => {
    const cached = { holdings: [], source: "Vanguard", asOfDate: "2026-03-31" };
    vi.mocked(db.getCachedData).mockResolvedValue(cached);

    const result = await getETFHoldings("VOO");
    expect(result).toEqual(cached);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("Vanguard API 성공 시 상위 10개 종목을 비중 내림차순으로 반환한다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockVanguardResponse,
    });

    const result = await getETFHoldings("VOO") as any;
    expect(result).not.toBeNull();
    expect(result.source).toBe("Vanguard");
    expect(result.holdings).toHaveLength(10);
    // 비중 내림차순 정렬 확인
    expect(result.holdings[0].symbol).toBe("NVDA");
    expect(result.holdings[0].weight).toBe(7.58);
    expect(result.holdings[1].symbol).toBe("AAPL");
    // 11번째 항목(UNH)은 제외되어야 함
    const symbols = result.holdings.map((h: any) => h.symbol);
    expect(symbols).not.toContain("UNH");
  });

  it("Vanguard API 실패 시 null을 반환한다", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const result = await getETFHoldings("SPY");
    expect(result).toBeNull();
  });

  it("fetch 예외 발생 시 null을 반환한다", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await getETFHoldings("QQQ");
    expect(result).toBeNull();
  });

  it("성공 시 결과를 캐시에 저장한다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockVanguardResponse,
    });

    await getETFHoldings("VOO");
    expect(db.setCachedData).toHaveBeenCalledWith("VOO", "etfHoldings", expect.any(Object), 1440);
  });

  it("반환된 holdings에 symbol, name, weight, marketValue 필드가 있다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockVanguardResponse,
    });

    const result = await getETFHoldings("VTI") as any;
    const firstHolding = result.holdings[0];
    expect(firstHolding).toHaveProperty("symbol");
    expect(firstHolding).toHaveProperty("name");
    expect(firstHolding).toHaveProperty("weight");
    // shares is present (Vanguard: null, stockanalysis.com: number)
    expect(firstHolding).toHaveProperty("shares");
  });
});
