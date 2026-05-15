import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { generateMultiAgentOpinion } from "./multiAgentAnalysis";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./db", () => ({
  getCachedData: vi.fn().mockResolvedValue(null),
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

    expect(db.getCachedData).toHaveBeenCalledWith("AAPL", "llm_multi_opinion_v9_score_confidence");
    expect(db.setCachedData).toHaveBeenCalledWith(
      "AAPL",
      "llm_multi_opinion_v9_score_confidence",
      expect.any(Object),
      120
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
        summary: "TradingAgents식 분석팀, 리서처, 트레이더, 리스크 검토를 종합하면 보유가 적절합니다.",
        bullCase: "기술 흐름과 제품 뉴스는 긍정적입니다.",
        bearCase: "고평가와 손절선 이탈 리스크가 있습니다.",
        keyFactors: ["기술 추세", "밸류에이션", "리스크 한도"],
        dissent: "Bull 리서처는 제한적 매수를 주장했습니다.",
      }) as any);
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
    expect(result.finalVerdict.summary).toContain("TradingAgents식");
    expect(result.finalVerdict.dissent).toContain("강세 리서처");
    expect(invokeLLM).toHaveBeenCalledTimes(8);
  });

  it("returns a TradingAgents-style research report backed by shared analysis data", async () => {
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
});
