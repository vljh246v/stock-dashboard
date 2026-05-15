import { describe, expect, it } from "vitest";
import { generateDecisionSummary } from "./decisionSummary";

const blockedPhrases = ["사세요", "파세요", "매수하세요", "매도하세요", "무조건", "보장"];

const stockProfile = {
  quoteSummary: {
    result: [
      {
        summaryProfile: {
          industry: "Auto Manufacturers",
          sector: "Consumer Cyclical",
        },
        price: {
          shortName: "Tesla, Inc.",
        },
      },
    ],
    error: null,
  },
};

const stockInsights = {
  finance: {
    result: {
      instrumentInfo: {
        technicalEvents: {
          shortTermOutlook: { direction: "Bullish", score: 7 },
          intermediateTermOutlook: { direction: "Neutral", score: 1 },
          longTermOutlook: { direction: "Bearish", score: -2 },
        },
        keyTechnicals: {
          support: 180,
          resistance: 235,
          stopLoss: 165,
          provider: "Yahoo Finance",
        },
        valuation: {
          description: "Overvalued",
          discount: "-12%",
        },
      },
      recommendation: {
        rating: "Hold",
        targetPrice: 230,
        numberOfAnalysts: 32,
      },
      companySnapshot: {
        company: {
          innovativeness: 0.9,
          hiring: 0.6,
          sustainability: 0.5,
          insiderSentiments: 0.4,
          dividends: 0.1,
        },
        sector: {
          innovativeness: 0.5,
          insiderSentiments: 0.5,
        },
      },
      sigDevs: [{ headline: "Margins remain under pressure" }],
    },
  },
};

const stockChart = {
  chart: {
    result: [
      {
        meta: {
          instrumentType: "EQUITY",
          regularMarketPrice: 210,
        },
      },
    ],
    error: null,
  },
};

const etfProfile = {
  quoteSummary: {
    result: [
      {
        fundProfile: {
          family: "Vanguard",
          categoryName: "Large Blend",
          feesExpensesInvestment: {
            annualReportExpenseRatio: { fmt: "0.03%", raw: 0.0003 },
            annualHoldingsTurnover: { fmt: "2.00%", raw: 0.02 },
            totalNetAssets: { raw: 1_200_000 },
          },
        },
        price: {
          shortName: "Vanguard S&P 500 ETF",
        },
      },
    ],
    error: null,
  },
};

const etfChart = {
  chart: {
    result: [
      {
        meta: {
          instrumentType: "ETF",
          regularMarketPrice: 500,
        },
      },
    ],
    error: null,
  },
};

function flattenText(value: unknown) {
  return JSON.stringify(value);
}

describe("generateDecisionSummary", () => {
  it("returns a beginner-safe stock summary with reasons and risk context", () => {
    const summary = generateDecisionSummary({
      symbol: "TSLA",
      profile: stockProfile,
      insights: stockInsights,
      chart: stockChart,
      holders: null,
      secFilings: null,
      etfHoldings: null,
    });

    expect(summary.assetType).toBe("stock");
    expect(["interest", "wait", "caution", "unavailable"]).toContain(summary.state);
    expect(["관심", "관망", "주의", "판단 보류"]).toContain(summary.labelKo);
    expect(summary.reasons.length).toBeGreaterThanOrEqual(3);
    expect(summary.riskNote.length).toBeGreaterThan(0);
    expect(summary.disclaimer).toContain("참고");

    const text = flattenText(summary);
    for (const phrase of blockedPhrases) {
      expect(text).not.toContain(phrase);
    }
  });

  it("keeps price zones as conditional reference levels, not order commands", () => {
    const summary = generateDecisionSummary({
      symbol: "TSLA",
      profile: stockProfile,
      insights: stockInsights,
      chart: stockChart,
      holders: null,
      secFilings: null,
      etfHoldings: null,
    });

    expect(summary.priceZones).toMatchObject({
      interestBelow: 180,
      invalidationBelow: 165,
      riskManagementNear: 235,
      source: "yahoo_keyTechnicals",
    });
    expect(Object.keys(summary.priceZones ?? {})).not.toContain("buyAt");
    expect(Object.keys(summary.priceZones ?? {})).not.toContain("sellAt");
    expect(Object.keys(summary.priceZones ?? {})).not.toContain("stopLossOrder");
  });

  it("returns a partial summary when insights are unavailable", () => {
    const summary = generateDecisionSummary({
      symbol: "TSLA",
      profile: stockProfile,
      insights: null,
      chart: stockChart,
      holders: null,
      secFilings: null,
      etfHoldings: null,
    });

    expect(summary.state).toBe("unavailable");
    expect(summary.labelKo).toBe("판단 보류");
    expect(summary.reasons.some(reason => reason.category === "data_quality")).toBe(true);
    expect(summary.sources.some(source => source.name === "Yahoo insights" && source.status === "unavailable")).toBe(true);
  });

  it("summarizes ETF exposure when holdings are present and degrades when missing", () => {
    const withHoldings = generateDecisionSummary({
      symbol: "VOO",
      profile: etfProfile,
      insights: null,
      chart: etfChart,
      holders: null,
      secFilings: null,
      etfHoldings: {
        holdings: [
          { symbol: "NVDA", name: "NVIDIA Corp.", weight: 7.58 },
          { symbol: "AAPL", name: "Apple Inc.", weight: 6.66 },
          { symbol: "MSFT", name: "Microsoft Corp.", weight: 4.92 },
        ],
        source: "Vanguard",
        asOfDate: "2026-03-31",
      },
    });

    expect(withHoldings.assetType).toBe("etf");
    expect(withHoldings.headline).toContain("비용과 구성 집중도가 상대적으로 부담이 낮게 보입니다.");
    expect(withHoldings.reasons.some(reason => reason.label.includes("장기 비용"))).toBe(true);
    expect(withHoldings.reasons.some(reason => reason.category === "etf_exposure")).toBe(true);
    expect(withHoldings.riskNote).toContain("보수");
    expect(withHoldings.sources.some(source => source.name === "ETF holdings" && source.status === "used")).toBe(true);

    const withoutHoldings = generateDecisionSummary({
      symbol: "VOO",
      profile: etfProfile,
      insights: null,
      chart: etfChart,
      holders: null,
      secFilings: null,
      etfHoldings: null,
    });

    expect(withoutHoldings.assetType).toBe("etf");
    expect(withoutHoldings.sources.some(source => source.name === "ETF holdings" && source.status === "unavailable")).toBe(true);
    expect(withoutHoldings.state).not.toBe("interest");
  });

  it("uses numeric Yahoo ETF fee fields in the decision summary", () => {
    const numericEtfProfile = {
      quoteSummary: {
        result: [
          {
            fundProfile: {
              family: "Vanguard",
              categoryName: "Large Blend",
              feesExpensesInvestment: {
                annualReportExpenseRatio: 0.00029999999,
                annualHoldingsTurnover: 0.02,
                totalNetAssets: 404537.56,
              },
            },
          },
        ],
        error: null,
      },
    };

    const summary = generateDecisionSummary({
      symbol: "VOO",
      profile: numericEtfProfile,
      insights: null,
      chart: etfChart,
      holders: null,
      secFilings: null,
      etfHoldings: {
        holdings: [
          { symbol: "NVDA", name: "NVIDIA Corp.", weight: 7.58 },
          { symbol: "AAPL", name: "Apple Inc.", weight: 6.66 },
          { symbol: "MSFT", name: "Microsoft Corp.", weight: 4.92 },
        ],
        source: "Vanguard",
        asOfDate: "2026-03-31",
      },
    });

    expect(flattenText(summary)).toContain("0.03%");
    expect(flattenText(summary)).toContain("2.00%");
    expect(flattenText(summary)).toContain("$404.5B");
    expect(flattenText(summary)).not.toContain("보수 데이터 부족");
  });
});
