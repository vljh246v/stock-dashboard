import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the stock data module
const mockGetStockProfile = vi.fn();
const mockGetStockInsights = vi.fn();
const mockGetStockChart = vi.fn();
const mockGetStockHolders = vi.fn();
const mockGetStockSecFiling = vi.fn();
const mockGetETFHoldings = vi.fn();
const mockGenerateMultiAgentOpinion = vi.fn();
const mockListRecentOpinionTracking = vi.fn();
const mockUpdateOpinionOutcome = vi.fn();

vi.mock("./stockData", () => ({
  getStockProfile: (...args: any[]) => mockGetStockProfile(...args),
  getStockInsights: (...args: any[]) => mockGetStockInsights(...args),
  getStockChart: (...args: any[]) => mockGetStockChart(...args),
  getStockHolders: (...args: any[]) => mockGetStockHolders(...args),
  getStockSecFiling: (...args: any[]) => mockGetStockSecFiling(...args),
  getETFHoldings: (...args: any[]) => mockGetETFHoldings(...args),
}));

// Mock the LLM analysis module
vi.mock("./multiAgentAnalysis", () => ({
  generateMultiAgentOpinion: (...args: any[]) => mockGenerateMultiAgentOpinion(...args),
}));

const mockGenerateDecisionSummary = vi.fn();

vi.mock("./decisionSummary", () => ({
  generateDecisionSummary: (...args: any[]) => mockGenerateDecisionSummary(...args),
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
  listRecentOpinionTracking: (...args: any[]) => mockListRecentOpinionTracking(...args),
  updateOpinionOutcome: (...args: any[]) => mockUpdateOpinionOutcome(...args),
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
      approvedAt: new Date(),
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
  mockGetETFHoldings.mockResolvedValue(null);
  mockListRecentOpinionTracking.mockResolvedValue([]);
  mockUpdateOpinionOutcome.mockImplementation(async (input) => ({
    id: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    resolvedAt: input.status === "resolved" ? new Date("2026-02-15T00:00:00.000Z") : null,
    ...input,
  }));
  mockGenerateMultiAgentOpinion.mockResolvedValue({
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
  });
  mockGenerateDecisionSummary.mockReturnValue({
    symbol: "AAPL",
    assetType: "stock",
    state: "wait",
    labelKo: "관망",
    confidence: "중간",
    headline: "관망 관점입니다. 근거를 함께 확인하세요.",
    reasons: [
      { category: "trend", label: "추세 중립", detail: "방향성이 강하지 않습니다." },
      { category: "valuation", label: "밸류에이션 부담", detail: "진입 가격은 신중히 봐야 합니다." },
      { category: "risk", label: "리스크 확인", detail: "하방 기준을 확인해야 합니다." },
    ],
    riskNote: "무효화 기준을 확인하세요.",
    sources: [{ name: "Yahoo insights", status: "used" }],
    disclaimer: "본 요약은 공개 데이터 기반 참고 정보입니다.",
  });
});

describe("stock.profile", () => {
  it("rejects unauthenticated stock API calls before upstream/LLM work", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const stockCalls = [
      () => caller.stock.profile({ symbol: "AAPL" }),
      () => caller.stock.insights({ symbol: "AAPL" }),
      () => caller.stock.chart({ symbol: "AAPL", interval: "1d", range: "6mo" }),
      () => caller.stock.holders({ symbol: "AAPL" }),
      () => caller.stock.guidanceTranslation({ symbol: "AAPL" }),
      () => caller.stock.secFiling({ symbol: "AAPL" }),
      () => caller.stock.opinion({ symbol: "AAPL" }),
      () => caller.stock.opinionTracking({ symbol: "AAPL" }),
      () => caller.stock.analysisPack({ symbol: "AAPL" }),
      () => caller.stock.decisionSummary({ symbol: "AAPL" }),
      () => caller.stock.etfHoldings({ symbol: "AAPL" }),
      () => caller.stock.sentiment({ symbol: "AAPL" }),
    ];

    for (const callStockProcedure of stockCalls) {
      await expect(callStockProcedure()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    }

    expect(mockGetStockProfile).not.toHaveBeenCalled();
    expect(mockGetStockInsights).not.toHaveBeenCalled();
    expect(mockGetStockChart).not.toHaveBeenCalled();
    expect(mockGetStockHolders).not.toHaveBeenCalled();
    expect(mockGetStockSecFiling).not.toHaveBeenCalled();
    expect(mockGetETFHoldings).not.toHaveBeenCalled();
    expect(mockGenerateMultiAgentOpinion).not.toHaveBeenCalled();
  });

  it("returns company profile data for a valid symbol", async () => {
    const caller = appRouter.createCaller(createAuthContext());
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

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stock.profile({ symbol: "APPLE" });

    // Should return the error data, not throw
    expect(result).toBeDefined();
    expect((result as any).quoteSummary.result).toBeNull();
    expect((result as any).quoteSummary.error.code).toBe("Not Found");
  });

  it("returns null when API throws an error", async () => {
    mockGetStockProfile.mockResolvedValue(null);

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stock.profile({ symbol: "AAPL" });

    expect(result).toBeNull();
  });
});

describe("stock.insights", () => {
  it("returns technical insights data", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stock.insights({ symbol: "AAPL" });

    expect(result).toBeDefined();
    const data = (result as any).finance.result;
    expect(data.instrumentInfo.technicalEvents.shortTermOutlook.direction).toBe("Bullish");
    expect(data.recommendation.targetPrice).toBe(210.0);
  });
});

describe("stock.chart", () => {
  it("returns chart data with timestamps and quotes", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stock.chart({ symbol: "AAPL", interval: "1d", range: "6mo" });

    expect(result).toBeDefined();
    const chartResult = (result as any).chart.result[0];
    expect(chartResult.meta.regularMarketPrice).toBe(185.5);
    expect(chartResult.timestamp.length).toBe(2);
  });
});

describe("stock.holders", () => {
  it("returns insider holders data", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stock.holders({ symbol: "AAPL" });

    expect(result).toBeDefined();
    const holders = (result as any).quoteSummary.result[0].insiderHolders.holders;
    expect(holders.length).toBe(1);
    expect(holders[0].name).toBe("Tim Cook");
  });

  it("returns null for invalid symbol", async () => {
    mockGetStockHolders.mockResolvedValue(null);

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stock.holders({ symbol: "INVALID" });

    expect(result).toBeNull();
  });
});

describe("stock.secFiling", () => {
  it("returns SEC filing data", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stock.secFiling({ symbol: "AAPL" });

    expect(result).toBeDefined();
    const filings = (result as any).quoteSummary.result[0].secFilings.filings;
    expect(filings[0].type).toBe("10-K");
  });
});

describe("stock.opinion", () => {
  it("returns LLM-generated investment opinion in Korean", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stock.opinion({ symbol: "AAPL" });

    expect(result).toBeDefined();
    expect((result as any).agents).toHaveLength(3);
    expect((result as any).finalVerdict.signal).toBe("보유");
    expect((result as any).finalVerdict.keyFactors.length).toBeGreaterThan(0);
    expect((result as any).disclaimer).toBeDefined();
  });

  it("normalizes apple input before fetching opinion data", async () => {
    const caller = appRouter.createCaller(createAuthContext());

    await caller.stock.opinion({ symbol: "apple" });

    expect(mockGetStockProfile).toHaveBeenCalledWith("AAPL");
    expect(mockGetStockInsights).toHaveBeenCalledWith("AAPL");
    expect(mockGetStockHolders).toHaveBeenCalledWith("AAPL");
    expect(mockGetStockChart).toHaveBeenCalledWith("AAPL", "1d", "6mo");
    expect(mockGenerateMultiAgentOpinion).toHaveBeenCalledWith(
      "AAPL",
      validProfile,
      validInsights,
      validHolders,
      validChart,
      expect.objectContaining({
        analysisPack: expect.objectContaining({ symbol: "AAPL" }),
      })
    );
  });
});

describe("stock.opinionTracking", () => {
  it("normalizes symbol and returns tracking rows", async () => {
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.stock.opinionTracking({ symbol: "apple" });

    expect(result.symbol).toBe("AAPL");
    expect(result.copy.description).toContain("이후 가격 변화");
    expect(mockListRecentOpinionTracking).toHaveBeenCalledWith("AAPL", 1200, expect.any(Date));
    expect(mockGetStockChart).not.toHaveBeenCalledWith("AAPL", "1d", "6mo");
  });

  it("resolves eligible pending outcomes from chart data", async () => {
    mockGetStockChart.mockResolvedValue({
      chart: {
        result: [{
          timestamp: [Date.UTC(2020, 1, 16) / 1000],
          indicators: { quote: [{ close: [111] }] },
        }],
      },
    });
    mockListRecentOpinionTracking.mockResolvedValue([{
      snapshot: {
        id: 10,
        symbol: "AAPL",
        opinionCreatedAt: new Date("2020-01-15T00:00:00.000Z"),
        opinionVersion: "test",
        finalSignal: "매수",
        finalConfidence: "중간",
        startObservedDate: new Date("2020-01-15T00:00:00.000Z"),
        startPrice: 100,
        opinionPayload: {},
        sourceSummary: {},
        createdAt: new Date("2020-01-15T00:00:00.000Z"),
      },
      outcomes: [{
        id: 20,
        snapshotId: 10,
        horizon: "1m",
        targetDate: new Date("2020-02-15T00:00:00.000Z"),
        observedDate: null,
        observedPrice: null,
        returnPct: null,
        alignment: "수집 중",
        status: "pending",
        resolvedAt: null,
        createdAt: new Date("2020-01-15T00:00:00.000Z"),
      }],
    }]);

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stock.opinionTracking({ symbol: "AAPL" });

    expect(mockGetStockChart).toHaveBeenCalledWith("AAPL", "1d", "6mo");
    expect(mockUpdateOpinionOutcome).toHaveBeenCalledWith(expect.objectContaining({
      snapshotId: 10,
      horizon: "1m",
      status: "resolved",
      observedPrice: 111,
      returnPct: 11,
      alignment: "방향 일치",
    }));
    expect((result.rows[0].outcomes[0] as any).status).toBe("resolved");
  });
});

describe("stock.decisionSummary", () => {
  it("returns a structured beginner-safe decision summary", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stock.decisionSummary({ symbol: "AAPL" });

    expect(result).toBeDefined();
    expect((result as any).labelKo).toBe("관망");
    expect((result as any).reasons).toHaveLength(3);
    expect(JSON.stringify(result)).not.toContain("사세요");
    expect(JSON.stringify(result)).not.toContain("파세요");
    expect(mockGenerateDecisionSummary).toHaveBeenCalledWith(expect.objectContaining({
      symbol: "AAPL",
      profile: validProfile,
      insights: validInsights,
      chart: validChart,
      holders: validHolders,
      secFilings: validSecFiling,
      etfHoldings: null,
    }));
  });
});

describe("stock.analysisPack", () => {
  it("returns one shared processed data pack for dashboard tabs", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.stock.analysisPack({ symbol: "apple" });

    expect(result.symbol).toBe("AAPL");
    expect(result.raw.profile).toBe(validProfile);
    expect(result.raw.insights).toBe(validInsights);
    expect(result.raw.chart).toBe(validChart);
    expect(result.raw.secFilings).toBe(validSecFiling);
    expect(result.decisionSummary.labelKo).toBe("관망");
    expect(result.pack.tabData.overview.highlights.length).toBeGreaterThan(0);
    expect(result.pack.tabData.technical.highlights.join(" ")).toContain("추세");
    expect(mockGetStockProfile).toHaveBeenCalledTimes(1);
    expect(mockGetStockInsights).toHaveBeenCalledTimes(1);
    expect(mockGetStockChart).toHaveBeenCalledWith("AAPL", "1d", "6mo");
  });
});

describe("stock.sentiment", () => {
  it("returns LLM-generated sentiment analysis in Korean", async () => {
    const caller = appRouter.createCaller(createAuthContext());
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
