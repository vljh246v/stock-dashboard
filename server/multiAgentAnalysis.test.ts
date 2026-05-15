import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { generateMultiAgentOpinion } from "./multiAgentAnalysis";
import type { AnalysisPack, GuidanceEvidenceMetric } from "./analysisPack";
import type { AnalysisMetrics, FinancialMetric, MetricFreshness } from "@shared/analysisMetrics";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./db", () => ({
  createOpinionSnapshotWithPendingOutcomes: vi.fn().mockResolvedValue(undefined),
  getCachedData: vi.fn().mockResolvedValue(null),
  getLastGoodCachedData: vi.fn().mockResolvedValue(null),
  setCachedData: vi.fn().mockResolvedValue(undefined),
}));

const profileData = {
  quoteSummary: {
    result: [{
      price: { shortName: "Apple Inc." },
      summaryProfile: { sector: "Technology" },
    }],
  },
};

const insightsData = {
  finance: {
    result: {
      instrumentInfo: {
        technicalEvents: {
          shortTermOutlook: { direction: "Bullish", score: 4 },
          intermediateTermOutlook: { direction: "Neutral", score: 0 },
          longTermOutlook: { direction: "Bullish", score: 3 },
        },
        keyTechnicals: { support: 185, stopLoss: 174 },
        valuation: { description: "Overvalued", discount: "-8%" },
      },
      recommendation: { rating: "Buy", targetPrice: 230, numberOfAnalysts: 30 },
      companySnapshot: {
        company: { innovativeness: 0.8, hiring: 0.7, sustainability: 0.6, insiderSentiments: 0.55, dividends: 0.5 },
        sector: { innovativeness: 0.6, hiring: 0.5, sustainability: 0.5, insiderSentiments: 0.5, dividends: 0.4 },
      },
      sigDevs: [{ headline: "Apple announces new product" }],
    },
  },
};

const chartData = {
  chart: {
    result: [{
      meta: { regularMarketPrice: 185.5 },
    }],
  },
};

function makeAnalysisPack(
  guidanceEvidence: GuidanceEvidenceMetric[] = [],
  guidanceHighlights: string[] = [],
  metrics: AnalysisMetrics = makeMetrics()
): AnalysisPack {
  return {
    symbol: "AAPL",
    asset: {
      assetType: "stock",
      displayName: "Apple Inc.",
      sector: "Technology",
    },
    price: {
      current: 185.5,
      fiftyTwoWeekHigh: 199,
      fiftyTwoWeekLow: 150,
      support: 185,
      stopLoss: 174,
    },
    technical: {
      averageScore: 2.3,
      outlooks: ["단기 강세", "중기 중립"],
      summary: "기술 흐름은 우호적입니다.",
    },
    valuation: {
      summary: "밸류에이션 요약",
      rating: "Buy",
      targetPrice: 230,
      analystCount: 30,
    },
    news: {
      events: [{ headline: "Apple announces new product" }],
      bullishPoints: ["제품 뉴스 긍정"],
      bearishPoints: ["고평가 부담"],
    },
    guidance: {
      evidence: guidanceEvidence,
    },
    metrics,
    governance: {
      qualitySignals: ["혁신 80점", "지속가능성 60점"],
      insiderTransactions: ["내부자 심리 55점"],
    },
    filings: {
      latest: ["10-Q filing"],
    },
    tabData: {
      overview: { highlights: ["Apple Inc."] },
      technical: { highlights: ["단기 강세"] },
      financial: { highlights: ["밸류에이션 요약"] },
      guidance: { highlights: guidanceHighlights },
      filings: { highlights: ["10-Q filing"] },
      etf: { highlights: [] },
      sentiment: { highlights: ["제품 뉴스 긍정"] },
    },
    sources: [{ name: "Yahoo quoteSummary", status: "used" }],
  };
}

function availableMetric(
  id: string,
  labelKo: string,
  value: string,
  basis: string,
  freshness: MetricFreshness,
  descriptionKo = labelKo
): FinancialMetric {
  return {
    id,
    labelKo,
    descriptionKo,
    status: "available",
    value,
    source: { name: "Yahoo quoteSummary", basis },
    freshness,
  };
}

function unavailableMetric(
  id: string,
  labelKo: string,
  unavailableDetailKo: string,
  basis: string,
  descriptionKo = labelKo
): FinancialMetric {
  return {
    id,
    labelKo,
    descriptionKo,
    status: "unavailable",
    unavailableReason: "missing_source",
    unavailableDetailKo,
    expectedSource: { name: "Yahoo quoteSummary", basis },
  };
}

function makeMetrics(): AnalysisMetrics {
  return {
    assetType: "stock",
    generatedAt: "2026-05-16T00:00:00.000Z",
    groups: [
      {
        id: "valuation",
        labelKo: "가치 평가",
        descriptionKo: "가치 평가 지표",
        metrics: [
          availableMetric("per", "PER", "28.4배", "summaryDetail.trailingPE", {
            kind: "checked_at",
            checkedAt: "2026-05-16",
            note: "quoteSummary 조회",
          }, "주가수익비율"),
          availableMetric("pbr", "PBR", "12.1배", "defaultKeyStatistics.priceToBook", {
            kind: "as_of",
            asOf: "2026-05-15",
          }, "주가순자산비율"),
          availableMetric("marketCap", "시가총액", "$2.9T", "price.marketCap", {
            kind: "checked_at",
            checkedAt: "2026-05-16",
            note: "장중 데이터",
          }, "시장 가치"),
        ],
      },
      {
        id: "profitability",
        labelKo: "수익성",
        descriptionKo: "수익성 지표",
        metrics: [
          availableMetric("roe", "ROE", "135.0%", "financialData.returnOnEquity", {
            kind: "as_of",
            asOf: "2025-12-31",
          }, "자기자본이익률"),
          availableMetric("operatingMargin", "영업이익률", "31.5%", "financialData.operatingMargins", {
            kind: "as_of",
            asOf: "2025-12-31",
          }, "영업 마진"),
          availableMetric("netMargin", "순이익률", "26.4%", "financialData.profitMargins", {
            kind: "as_of",
            asOf: "2025-12-31",
          }, "순이익 마진"),
          availableMetric("freeCashFlow", "FCF", "$99.6B", "financialData.freeCashflow", {
            kind: "checked_at",
            checkedAt: "2026-05-16",
            note: "financialData 조회",
          }, "잉여현금흐름"),
        ],
      },
      {
        id: "growth",
        labelKo: "성장",
        descriptionKo: "성장 지표",
        metrics: [
          availableMetric("revenueGrowth", "매출 성장률", "6.2%", "financialData.revenueGrowth", {
            kind: "as_of",
            asOf: "2025-12-31",
          }, "매출 성장"),
          unavailableMetric("profitGrowth", "이익 성장률", "999% 같은 미검증 값은 쓰지 않음", "earningsGrowth", "이익 성장"),
        ],
      },
      {
        id: "risk",
        labelKo: "위험/가격 범위",
        descriptionKo: "리스크 지표",
        metrics: [
          availableMetric("debtRatio", "부채비율", "145.2%", "financialData.debtToEquity", {
            kind: "as_of",
            asOf: "2025-12-31",
          }, "부채 비율"),
          availableMetric("beta", "베타", "1.22", "summaryDetail.beta", {
            kind: "checked_at",
            checkedAt: "2026-05-16",
            note: "summaryDetail 조회",
          }, "시장 민감도"),
          availableMetric("fiftyTwoWeekHigh", "52주 고가", "$199.00", "summaryDetail.fiftyTwoWeekHigh", {
            kind: "checked_at",
            checkedAt: "2026-05-16",
            note: "summaryDetail 조회",
          }, "52주 고점"),
          availableMetric("fiftyTwoWeekLow", "52주 저가", "$150.00", "summaryDetail.fiftyTwoWeekLow", {
            kind: "checked_at",
            checkedAt: "2026-05-16",
            note: "summaryDetail 조회",
          }, "52주 저점"),
        ],
      },
      {
        id: "shareholder",
        labelKo: "주주 환원",
        descriptionKo: "주주 환원 지표",
        metrics: [
          availableMetric("dividendYield", "배당수익률", "0.5%", "summaryDetail.dividendYield", {
            kind: "not_material",
            note: "배당 미중심 성장주",
          }, "배당 수익률"),
        ],
      },
    ],
    dataQuality: {
      available: 13,
      unavailable: 1,
      total: 14,
    },
  };
}

const llmJson = (payload: unknown) => ({
  id: "chatcmpl-test",
  created: 0,
  model: "test-model",
  choices: [{
    index: 0,
    message: {
      role: "assistant" as const,
      content: JSON.stringify(payload),
    },
    finish_reason: "stop",
  }],
});

describe("generateMultiAgentOpinion fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(invokeLLM).mockRejectedValue(new Error("OPENAI_API_KEY is not configured"));
  });

  it("returns data-based opinion text instead of agent execution errors when LLM fails", async () => {
    const result = await generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData);
    const serialized = JSON.stringify(result);

    expect(result.agents).toHaveLength(8);
    expect(result.finalVerdict.summary).toContain("공개 데이터 기반");
    expect(serialized).toContain("185.5");
    expect(serialized).toContain("강세 리서처");
    expect(serialized).toContain("포트폴리오 매니저");
    expect(serialized).not.toContain("에이전트 실행 중 오류");
    expect(serialized).not.toContain("분석 불가");
    expect(result.agents.find(agent => agent.agentName === "시장/기술 분석")).toMatchObject({
      signal: "매수",
      confidence: "높음",
    });
    expect(result.agents.find(agent => agent.agentName === "뉴스·시장 심리 분석")).toMatchObject({
      signal: "보유",
      confidence: "낮음",
    });
    expect(new Set(result.agents.map(agent => `${agent.signal}/${agent.confidence}`)).size).toBeGreaterThan(2);
  });

  it("uses a cache key that does not reuse old agent-error opinion cache", async () => {
    await generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData);

    expect(db.getCachedData).toHaveBeenCalledWith("AAPL", "llm_multi_opinion_v12_metric_context");
    expect(db.setCachedData).toHaveBeenCalledWith(
      "AAPL",
      "llm_multi_opinion_v12_metric_context",
      expect.any(Object),
      120
    );
  });

  it("records a tracking snapshot on fresh fallback generation", async () => {
    await generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData);

    expect(db.createOpinionSnapshotWithPendingOutcomes).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "AAPL",
        opinionVersion: "llm_multi_opinion_v12_metric_context",
        finalSignal: expect.any(String),
        finalConfidence: expect.any(String),
        startObservedDate: expect.any(Date),
        startPrice: 185.5,
        opinionPayload: expect.any(Object),
        sourceSummary: expect.any(Object),
      })
    );
  });
});

describe("generateMultiAgentOpinion TradingAgents-style workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getCachedData).mockResolvedValue(null);
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce(llmJson({
        signal: "매수",
        confidence: "중간",
        reasoning: "가격 흐름은 우호적입니다.",
        keyPoints: ["단기 추세 강세", "지지선 185"],
      }) as any)
      .mockResolvedValueOnce(llmJson({
        signal: "보유",
        confidence: "중간",
        reasoning: "밸류에이션 부담이 있습니다.",
        keyPoints: ["고평가", "목표가 230"],
      }) as any)
      .mockResolvedValueOnce(llmJson({
        signal: "매수",
        confidence: "낮음",
        reasoning: "제품 뉴스는 긍정적입니다.",
        keyPoints: ["신제품 뉴스"],
      }) as any)
      .mockResolvedValueOnce(llmJson({
        signal: "매수",
        confidence: "중간",
        reasoning: "강세 논거가 더 설득력 있습니다.",
        keyPoints: ["기술 흐름", "브랜드 경쟁력"],
      }) as any)
      .mockResolvedValueOnce(llmJson({
        signal: "보유",
        confidence: "중간",
        reasoning: "고평가와 이벤트 리스크가 있습니다.",
        keyPoints: ["고평가", "손절선 확인"],
      }) as any)
      .mockResolvedValueOnce(llmJson({
        signal: "보유",
        confidence: "중간",
        reasoning: "추격 매수보다는 분할 접근이 적절합니다.",
        keyPoints: ["분할 진입", "손절선 174"],
      }) as any)
      .mockResolvedValueOnce(llmJson({
        signal: "보유",
        confidence: "중간",
        reasoning: "하방 리스크를 반영해 보수적으로 접근합니다.",
        keyPoints: ["고평가", "손절 기준"],
      }) as any)
      .mockResolvedValueOnce(llmJson({
        signal: "보유",
        confidence: "중간",
        summary: "가격, 재무, 뉴스, 리스크 검토를 종합하면 보유가 적절합니다.",
        bullCase: "기술 흐름과 제품 뉴스는 긍정적입니다.",
        bearCase: "고평가와 손절선 이탈 리스크가 있습니다.",
        keyFactors: ["기술 추세", "밸류에이션", "리스크 한도"],
        dissent: "Bull 리서처는 제한적 매수를 주장했습니다.",
      }) as any);
  });

  it("does not create a tracking snapshot when returning cached opinion", async () => {
    vi.mocked(db.getCachedData).mockResolvedValueOnce({
      generatedAt: "2026-01-01T00:00:00.000Z",
      opinionVersion: "llm_multi_opinion_v12_metric_context",
      agents: [],
      workflow: {
        source: "TradingAgents-style research report",
        stages: [],
      },
      finalVerdict: {
        signal: "보유",
        confidence: "낮음",
        summary: "cached",
        bullCase: "",
        bearCase: "",
        keyFactors: [],
        dissent: "",
      },
      researchReport: {
        thesis: "",
        sections: [],
        dataQuality: [],
        nextChecks: [],
      },
      disclaimer: "cached",
    });

    const result = await generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData);

    expect(result.finalVerdict.summary).toBe("cached");
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(db.createOpinionSnapshotWithPendingOutcomes).not.toHaveBeenCalled();
  });

  it("runs analyst, researcher, trader, risk, and portfolio stages in order", async () => {
    const result = await generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData);

    expect(result.agents.map(agent => agent.agentName)).toEqual([
      "시장/기술 분석",
      "펀더멘털 분석",
      "뉴스·시장 심리 분석",
      "강세 리서처",
      "약세 리서처",
      "트레이더",
      "리스크 관리자",
      "포트폴리오 매니저",
    ]);
    expect(result.workflow).toEqual({
      source: "TradingAgents-style research report",
      stages: ["Analyst Team", "Research Debate", "Trader", "Risk Management", "Portfolio Manager"],
    });
    expect(result.finalVerdict.summary).toContain("가격");
    expect(result.finalVerdict.dissent).toContain("강세 리서처");
    expect(invokeLLM).toHaveBeenCalledTimes(8);
  });

  it("returns a research report backed by shared analysis data", async () => {
    const result = await generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData);

    expect(result.workflow.source).toBe("TradingAgents-style research report");
    expect(result.researchReport.thesis).toContain("AAPL");
    expect(result.researchReport.sections.map(section => section.title)).toEqual(
      expect.arrayContaining(["핵심 판단", "근거 데이터", "리스크와 반대 논거", "시나리오"])
    );
    expect(result.researchReport.sections.flatMap(section => section.bullets).join(" ")).toContain("현재가");
    expect(result.researchReport.dataQuality).toEqual(
      expect.arrayContaining([expect.stringContaining("Yahoo")])
    );
    expect(JSON.stringify(result.researchReport)).toContain("혁신 80점");
    expect(JSON.stringify(result.researchReport)).not.toMatch(/\d+\.\d{4,}/);
    expect(JSON.stringify(result.researchReport)).not.toMatch(/\b(Bullish|Neutral|Overvalued|Buy)\b/);
  });

  it("does not pass untrusted neutral sector quality values as confirmed sector averages", async () => {
    await generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData);

    const fundamentalPrompt = vi.mocked(invokeLLM).mock.calls[1]?.[0].messages[1].content;

    expect(fundamentalPrompt).toContain("기업 품질: 혁신 80점");
    expect(fundamentalPrompt).toContain("채용 70점");
    expect(fundamentalPrompt).not.toContain("섹터 평균");
    expect(fundamentalPrompt).not.toMatch(/섹터 평균:.*50점/);
  });

  it("passes source-backed core metrics to the portfolio manager", async () => {
    const analysisPack = makeAnalysisPack();

    await generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData, {
      analysisPack,
    });

    const portfolioPrompt = String(vi.mocked(invokeLLM).mock.calls[7]?.[0].messages[1].content);

    expect(portfolioPrompt).toContain("핵심 지표");
    expect(portfolioPrompt).toContain("PER: 28.4배 · 출처 Yahoo quoteSummary/summaryDetail.trailingPE");
    expect(portfolioPrompt).toContain("신선도 확인 2026-05-16");
    expect(portfolioPrompt).toContain("ROE: 135.0% · 출처 Yahoo quoteSummary/financialData.returnOnEquity");
    expect(portfolioPrompt).toContain("순이익률: 26.4%");
    expect(portfolioPrompt).toContain("FCF: $99.6B");
    expect(portfolioPrompt).toContain("매출 성장률: 6.2%");
    expect(portfolioPrompt).toContain("부채비율: 145.2%");
    expect(portfolioPrompt).toContain("베타: 1.22");
    expect(portfolioPrompt).toContain("배당수익률: 0.5% · 출처 Yahoo quoteSummary/summaryDetail.dividendYield · 신선도 배당 미중심 성장주");
    expect(portfolioPrompt).not.toContain("이익 성장률");
    expect(portfolioPrompt).not.toContain("999% 같은 미검증 값");
  });

  it("passes only fundamental metric context to the fundamental analyst", async () => {
    const analysisPack = makeAnalysisPack();

    await generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData, {
      analysisPack,
    });

    const fundamentalPrompt = String(vi.mocked(invokeLLM).mock.calls[1]?.[0].messages[1].content);

    expect(fundamentalPrompt).toContain("## 핵심 지표");
    expect(fundamentalPrompt).toContain("PER: 28.4배");
    expect(fundamentalPrompt).toContain("시가총액: $2.9T");
    expect(fundamentalPrompt).toContain("ROE: 135.0%");
    expect(fundamentalPrompt).toContain("순이익률: 26.4%");
    expect(fundamentalPrompt).toContain("FCF: $99.6B");
    expect(fundamentalPrompt).toContain("매출 성장률: 6.2%");
    expect(fundamentalPrompt).toContain("배당수익률: 0.5%");
    expect(fundamentalPrompt).not.toContain("베타: 1.22");
    expect(fundamentalPrompt).not.toContain("부채비율: 145.2%");
    expect(fundamentalPrompt).not.toContain("52주 고가: $199.00");
    expect(fundamentalPrompt).not.toContain("999% 같은 미검증 값");
  });

  it("passes risk metrics and price controls to the risk manager", async () => {
    const analysisPack = makeAnalysisPack();

    await generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData, {
      analysisPack,
    });

    const riskPrompt = String(vi.mocked(invokeLLM).mock.calls[6]?.[0].messages[1].content);

    expect(riskPrompt).toContain("- 현재가: 185.5");
    expect(riskPrompt).toContain("- 손절가: 174");
    expect(riskPrompt).toContain("## 핵심 리스크 지표");
    expect(riskPrompt).toContain("부채비율: 145.2%");
    expect(riskPrompt).toContain("베타: 1.22");
    expect(riskPrompt).toContain("52주 고가: $199.00");
    expect(riskPrompt).toContain("52주 저가: $150.00");
    expect(riskPrompt).not.toContain("ROE: 135.0%");
    expect(riskPrompt).not.toContain("매출 성장률: 6.2%");
    expect(riskPrompt).not.toContain("999% 같은 미검증 값");
  });

  it("passes verified guidance evidence and anti-invention rules to the portfolio manager", async () => {
    const analysisPack = makeAnalysisPack([
      {
        label: "최근 EPS",
        value: "$0.14",
        comparison: "예상 $0.12 · 서프라이즈 +16.7%",
        source: "Yahoo earningsHistory",
        asOf: "2025-09-30",
        category: "reported",
      },
    ]);

    const result = await generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData, {
      analysisPack,
    });
    const portfolioPrompt = vi.mocked(invokeLLM).mock.calls[7]?.[0].messages[1].content;

    expect(portfolioPrompt).toContain("검증된 가이던스 근거: 최근 EPS: $0.14");
    expect(portfolioPrompt).toContain("Yahoo earningsHistory");
    expect(portfolioPrompt).toContain("2025-09-30");
    expect(portfolioPrompt).toContain("계산·추론·창작하지 말고");
    expect(portfolioPrompt).toContain("근거가 없으면 확인 불가");

    const evidenceSection = result.researchReport.sections.find(section => section.title === "근거 데이터");
    expect(evidenceSection?.bullets[0]).toContain("검증된 가이던스 근거: 최근 EPS: $0.14");
    expect(evidenceSection?.bullets.findIndex(bullet => bullet.includes("최근 EPS"))).toBeLessThan(
      evidenceSection?.bullets.findIndex(bullet => bullet.includes("밸류에이션 요약")) ?? Number.MAX_SAFE_INTEGER
    );
  });

  it("does not trust prose-only guidance highlights as numeric guidance evidence", async () => {
    const proseOnlyClaim = "FY25 매출 $9.99B로 상향이라는 미검증 문장";
    const analysisPack = makeAnalysisPack([], [proseOnlyClaim]);

    const result = await generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData, {
      analysisPack,
    });
    const portfolioPrompt = vi.mocked(invokeLLM).mock.calls[7]?.[0].messages[1].content;
    const serializedReport = JSON.stringify(result.researchReport);

    expect(portfolioPrompt).toContain("검증된 가이던스 근거: 확인 불가");
    expect(portfolioPrompt).not.toContain(proseOnlyClaim);
    expect(serializedReport).toContain("검증된 가이던스 근거: 확인 불가");
    expect(serializedReport).not.toContain(proseOnlyClaim);
  });

  it("coalesces concurrent opinion generation for the same symbol", async () => {
    const results = await Promise.all([
      generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData),
      generateMultiAgentOpinion("aapl", profileData, insightsData, null, chartData),
      generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData),
    ]);

    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(invokeLLM).toHaveBeenCalledTimes(8);
    expect(db.createOpinionSnapshotWithPendingOutcomes).toHaveBeenCalledTimes(1);
    expect(db.setCachedData).toHaveBeenCalledTimes(1);
  });

  it("returns last-good opinion cache when a fresh refresh cannot be committed", async () => {
    const lastGood = {
      generatedAt: "2026-01-01T00:00:00.000Z",
      opinionVersion: "llm_multi_opinion_v12_metric_context",
      agents: [],
      workflow: {
        source: "TradingAgents-style research report",
        stages: [],
      },
      finalVerdict: {
        signal: "보유",
        confidence: "낮음",
        summary: "last-good",
        bullCase: "",
        bearCase: "",
        keyFactors: [],
        dissent: "",
      },
      researchReport: {
        thesis: "",
        sections: [],
        dataQuality: [],
        nextChecks: [],
      },
      disclaimer: "cached",
    };
    vi.mocked(db.getLastGoodCachedData).mockResolvedValueOnce(lastGood);
    vi.mocked(db.setCachedData).mockRejectedValueOnce(new Error("cache write failed"));

    const result = await generateMultiAgentOpinion("AAPL", profileData, insightsData, null, chartData);

    expect(result.finalVerdict.summary).toBe("last-good");
    expect(db.setCachedData).toHaveBeenCalledTimes(1);
  });
});
