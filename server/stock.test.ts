import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the stock data module
const mockGetStockProfile = vi.fn();
const mockGetStockInsights = vi.fn();
const mockGetStockChart = vi.fn();
const mockGetStockHolders = vi.fn();
const mockGetStockSecFiling = vi.fn();

vi.mock("./stockData", () => ({
  getStockProfile: (...args: any[]) => mockGetStockProfile(...args),
  getStockInsights: (...args: any[]) => mockGetStockInsights(...args),
  getStockChart: (...args: any[]) => mockGetStockChart(...args),
  getStockHolders: (...args: any[]) => mockGetStockHolders(...args),
  getStockSecFiling: (...args: any[]) => mockGetStockSecFiling(...args),
}));

// Mock the LLM analysis module
vi.mock("./multiAgentAnalysis", () => ({
  generateMultiAgentOpinion: vi.fn().mockResolvedValue({
    agents: [
      { agentName: "기술적 분석", signal: "매수", confidence: "중간", reasoning: "단기 상승 추세", keyPoints: ["기술적 강세"] },
      { agentName: "펀더멘털 분석", signal: "보유", confidence: "중간", reasoning: "고평가 상태", keyPoints: ["밸류에이션 부담"] },
      { agentName: "리스크 관리", signal: "보유", confidence: "중간", reasoning: "하방 리스크 존재", keyPoints: ["중국 시장 리스크"] },
    ],
    finalVerdict: {
      signal: "보유",
      confidence: "중간",
      summary: "기술적 강세에도 불구하고 밸류에이션 부담으로 보유 권고",
      bullCase: "강력한 생태계와 서비스 매출 성장이 긍정적입니다.",
      bearCase: "높은 밸류에이션과 중국 시장 리스크가 존재합니다.",
      keyFactors: ["서비스 매출 성장", "AI 투자", "밸류에이션"],
      dissent: "기술적 분석가는 매수를 권하지만 리스크 요인이 존재합니다.",
    },
    disclaimer: "본 분석은 AI가 공개 데이터를 기반으로 생성한 참고 정보입니다.",
  }),
}));

vi.mock("./llmAnalysis", () => ({
  generateInvestmentOpinion: vi.fn().mockResolvedValue({
    bullCase: "강력한 생태계와 서비스 매출 성장이 긍정적입니다.",
    bearCase: "높은 밸류에이션과 중국 시장 리스크가 존재합니다.",
    signal: "매수",
    confidence: "중간",
    summary: "전반적으로 긍정적 전망이나 밸류에이션 부담이 있습니다.",
    keyFactors: ["서비스 매출 성장", "AI 투자", "밸류에이션"],
  }),
  generateSentimentAnalysis: vi.fn().mockResolvedValue({
    overallSentiment: "긍정",
    sentimentScore: 72,
    newsAnalysis: [
      { headline: "애플 신제품 출시", sentiment: "긍정", impact: "시장 기대감 상승" },
    ],
    marketImpact: "전반적으로 긍정적인 뉴스 흐름입니다.",
  }),
}));

// Mock the DB functions
vi.mock("./db", () => ({
  getWatchlist: vi.fn().mockResolvedValue([]),
  addToWatchlist: vi.fn().mockResolvedValue({ id: 1, symbol: "AAPL", name: "Apple Inc." }),
  removeFromWatchlist: vi.fn().mockResolvedValue(undefined),
  getCachedData: vi.fn().mockResolvedValue(null),
  setCachedData: vi.fn().mockResolvedValue(undefined),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      passwordHash: null,
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const validProfile = {
  quoteSummary: {
    result: [{
      summaryProfile: {
        industry: "Consumer Electronics",
        sector: "Technology",
        longBusinessSummary: "Apple Inc. designs, manufactures, and markets smartphones.",
        fullTimeEmployees: 164000,
        city: "Cupertino",
        country: "United States",
        website: "https://www.apple.com",
        companyOfficers: [{ name: "Tim Cook", title: "CEO" }],
      },
      price: { shortName: "Apple Inc.", longName: "Apple Inc." },
    }],
    error: null,
  },
};

const validChart = {
  chart: {
    result: [{
      meta: { regularMarketPrice: 185.5, fiftyTwoWeekHigh: 199.0, fiftyTwoWeekLow: 155.0 },
      timestamp: [1700000000, 1700100000],
      indicators: {
        quote: [{
          open: [180.0, 182.0],
          close: [182.0, 185.5],
          high: [183.0, 186.0],
          low: [179.0, 181.0],
          volume: [50000000, 45000000],
        }],
      },
    }],
  },
};

const validInsights = {
  finance: {
    result: {
      instrumentInfo: {
        technicalEvents: {
          shortTermOutlook: { direction: "Bullish", score: 7 },
          intermediateTermOutlook: { direction: "Neutral", score: 5 },
          longTermOutlook: { direction: "Bullish", score: 8 },
        },
        keyTechnicals: { support: 170.5, resistance: 195.2 },
        valuation: { description: "Overvalued", discount: "-10%" },
      },
      recommendation: { rating: "Buy", targetPrice: 210.0 },
      companySnapshot: { company: { innovativeness: 85, hiring: 70, sustainability: 60, insiderSentiments: 55 } },
      sigDevs: [{ headline: "Apple launches new product", date: "2024-12-01" }],
      reports: [],
    },
  },
};

const validHolders = {
  quoteSummary: {
    result: [{
      insiderHolders: {
        holders: [
          { name: "Tim Cook", relation: "CEO", positionDirect: { fmt: "3,280,000" }, transactionDescription: "Sale", latestTransDate: { fmt: "2024-11-15" } },
        ],
      },
    }],
    error: null,
  },
};

const validSecFiling = {
  quoteSummary: {
    result: [{
      secFilings: {
        filings: [{ type: "10-K", title: "Annual Report", date: "2024-10-30", edgarUrl: "https://sec.gov/..." }],
      },
    }],
    error: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetStockProfile.mockResolvedValue(validProfile);
  mockGetStockInsights.mockResolvedValue(validInsights);
  mockGetStockChart.mockResolvedValue(validChart);
  mockGetStockHolders.mockResolvedValue(validHolders);
  mockGetStockSecFiling.mockResolvedValue(validSecFiling);
});

describe("stock.profile", () => {
  it("returns company profile data for a valid symbol", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stock.profile({ symbol: "AAPL" });

    expect(result).toBeDefined();
    const data = result as any;
    expect(data.quoteSummary.result[0].summaryProfile.industry).toBe("Consumer Electronics");
    expect(data.quoteSummary.result[0].price.shortName).toBe("Apple Inc.");
  });

  it("returns error response for invalid symbol (frontend detects it)", async () => {
    const invalidResponse = {
      quoteSummary: {
        result: null,
        error: { code: "Not Found", description: "Quote not found for symbol: APPLE" },
      },
    };
    mockGetStockProfile.mockResolvedValue(invalidResponse);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stock.profile({ symbol: "APPLE" });

    // Should return the error data, not throw
    expect(result).toBeDefined();
    expect((result as any).quoteSummary.result).toBeNull();
    expect((result as any).quoteSummary.error.code).toBe("Not Found");
  });

  it("returns null when API throws an error", async () => {
    mockGetStockProfile.mockResolvedValue(null);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stock.profile({ symbol: "AAPL" });

    expect(result).toBeNull();
  });
});

describe("stock.insights", () => {
  it("returns technical insights data", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stock.insights({ symbol: "AAPL" });

    expect(result).toBeDefined();
    const data = (result as any).finance.result;
    expect(data.instrumentInfo.technicalEvents.shortTermOutlook.direction).toBe("Bullish");
    expect(data.recommendation.targetPrice).toBe(210.0);
  });
});

describe("stock.chart", () => {
  it("returns chart data with timestamps and quotes", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stock.chart({ symbol: "AAPL", interval: "1d", range: "6mo" });

    expect(result).toBeDefined();
    const chartResult = (result as any).chart.result[0];
    expect(chartResult.meta.regularMarketPrice).toBe(185.5);
    expect(chartResult.timestamp.length).toBe(2);
  });
});

describe("stock.holders", () => {
  it("returns insider holders data", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stock.holders({ symbol: "AAPL" });

    expect(result).toBeDefined();
    const holders = (result as any).quoteSummary.result[0].insiderHolders.holders;
    expect(holders.length).toBe(1);
    expect(holders[0].name).toBe("Tim Cook");
  });

  it("returns null for invalid symbol", async () => {
    mockGetStockHolders.mockResolvedValue(null);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stock.holders({ symbol: "INVALID" });

    expect(result).toBeNull();
  });
});

describe("stock.secFiling", () => {
  it("returns SEC filing data", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stock.secFiling({ symbol: "AAPL" });

    expect(result).toBeDefined();
    const filings = (result as any).quoteSummary.result[0].secFilings.filings;
    expect(filings[0].type).toBe("10-K");
  });
});

describe("stock.opinion", () => {
  it("returns LLM-generated investment opinion in Korean", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stock.opinion({ symbol: "AAPL" });

    expect(result).toBeDefined();
    expect((result as any).agents).toHaveLength(3);
    expect((result as any).finalVerdict.signal).toBe("보유");
    expect((result as any).finalVerdict.keyFactors.length).toBeGreaterThan(0);
    expect((result as any).disclaimer).toBeDefined();
  });
});

describe("stock.sentiment", () => {
  it("returns LLM-generated sentiment analysis in Korean", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.stock.sentiment({ symbol: "AAPL" });

    expect(result).toBeDefined();
    expect((result as any).overallSentiment).toBe("긍정");
    expect((result as any).sentimentScore).toBe(72);
    expect((result as any).newsAnalysis[0].headline).toContain("애플");
  });
});

describe("watchlist.add", () => {
  it("rejects invalid symbol when chart returns null result", async () => {
    mockGetStockChart.mockResolvedValue({ chart: { result: null } });

    const caller = appRouter.createCaller(createAuthContext());

    await expect(caller.watchlist.add({ symbol: "INVALID" })).rejects.toThrow(
      /유효하지 않은 종목 심볼/
    );
  });

  it("accepts valid symbol and returns watchlist entry", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.watchlist.add({ symbol: "AAPL" });

    expect(result).toEqual({ id: 1, symbol: "AAPL", name: "Apple Inc." });
  });
});
