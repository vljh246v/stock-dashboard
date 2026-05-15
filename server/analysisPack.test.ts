import { describe, expect, it } from "vitest";
import { generateAnalysisPack } from "./analysisPack";

const stockProfile = {
  quoteSummary: {
    result: [{
      summaryProfile: {
        sector: "Technology",
        industry: "Consumer Electronics",
      },
      price: { shortName: "Apple Inc.", longName: "Apple Inc." },
    }],
  },
};

const stockInsights = {
  finance: {
    result: {
      instrumentInfo: {
        technicalEvents: {
          shortTermOutlook: { direction: "Bullish", score: 7 },
          intermediateTermOutlook: { direction: "Neutral", score: 5 },
          longTermOutlook: { direction: "Bullish", score: 8 },
        },
        keyTechnicals: { support: 170.5, resistance: 195.2, stopLoss: 162.0 },
        valuation: { description: "Overvalued", discount: "-10%", relativeValue: "Premium" },
      },
      recommendation: { rating: "Buy", targetPrice: 210.0, numberOfAnalysts: 30 },
      companySnapshot: { company: { innovativeness: 85, hiring: 70, sustainability: 60, insiderSentiments: 55 } },
      sigDevs: [{ headline: "Apple launches new product", date: "2024-12-01" }],
      upsell: {
        msBullishSummary: ["Services revenue growth is resilient"],
        msBearishSummary: ["Valuation remains elevated"],
      },
    },
  },
};

const stockChart = {
  chart: {
    result: [{
      meta: { regularMarketPrice: 185.5, fiftyTwoWeekHigh: 199, fiftyTwoWeekLow: 155, instrumentType: "EQUITY" },
    }],
  },
};

const stockHolders = {
  quoteSummary: {
    result: [{
      insiderHolders: {
        holders: [{ name: "Tim Cook", transactionDescription: "Sale", latestTransDate: { fmt: "2024-11-15" } }],
      },
    }],
  },
};

const stockSecFilings = {
  quoteSummary: {
    result: [{
      secFilings: {
        filings: [{ type: "10-K", title: "Annual Report", date: "2024-10-30" }],
      },
    }],
  },
};

describe("generateAnalysisPack", () => {
  it("normalizes stock data into a shared pack for report and tabs", () => {
    const pack = generateAnalysisPack({
      symbol: "aapl",
      profile: stockProfile,
      insights: stockInsights,
      chart: stockChart,
      holders: stockHolders,
      secFilings: stockSecFilings,
      etfHoldings: null,
    });

    expect(pack.symbol).toBe("AAPL");
    expect(pack.asset.assetType).toBe("stock");
    expect(pack.asset.displayName).toBe("Apple Inc.");
    expect(pack.price.current).toBe(185.5);
    expect(pack.technical.averageScore).toBeCloseTo(6.67, 2);
    expect(pack.valuation.summary).toContain("고평가");
    expect(pack.valuation.summary).toContain("매수");
    expect(pack.governance.qualitySignals).toEqual(
      expect.arrayContaining(["혁신 85점", "채용 70점", "지속가능성 60점", "내부자 심리 55점"])
    );
    expect(JSON.stringify(pack)).not.toMatch(/\b(Bullish|Neutral|Overvalued|Buy)\b/);
    expect(pack.news.events[0].headline).toContain("Apple launches");
    expect(pack.governance.insiderTransactions[0]).toContain("Tim Cook");
    expect(pack.filings.latest[0]).toContain("10-K");
    expect(pack.tabData.technical.highlights.join(" ")).toContain("평균 추세 점수");
    expect(pack.tabData.filings.highlights.join(" ")).toContain("10-K");
    expect(pack.sources.map(source => source.name)).toEqual(
      expect.arrayContaining(["Yahoo profile", "Yahoo insights", "Yahoo chart", "Yahoo holders", "SEC filings"])
    );
  });

  it("normalizes ETF profile, fee, and holdings data into the same shared pack", () => {
    const pack = generateAnalysisPack({
      symbol: "voo",
      profile: {
        quoteSummary: {
          result: [{
            price: { shortName: "Vanguard S&P 500 ETF" },
            fundProfile: {
              family: "Vanguard",
              categoryName: "Large Blend",
              feesExpensesInvestment: {
                annualReportExpenseRatio: 0.0003,
                annualHoldingsTurnover: 0.02,
                totalNetAssets: 404537.56,
              },
            },
          }],
        },
      },
      insights: null,
      chart: {
        chart: {
          result: [{
            meta: { regularMarketPrice: 510, instrumentType: "ETF" },
          }],
        },
      },
      holders: null,
      secFilings: null,
      etfHoldings: {
        source: "Vanguard",
        asOfDate: "2026-03-31",
        holdings: [
          { symbol: "NVDA", name: "NVIDIA Corp", weight: 7.2 },
          { symbol: "AAPL", name: "Apple Inc", weight: 6.4 },
        ],
      },
    });

    expect(pack.asset.assetType).toBe("etf");
    expect(pack.etf?.expenseRatio).toBe("0.03%");
    expect(pack.etf?.turnover).toBe("2.00%");
    expect(pack.etf?.netAssets).toBe("$404.5B");
    expect(pack.etf?.topHoldingsWeight).toBeCloseTo(13.6, 1);
    expect(pack.tabData.etf.highlights.join(" ")).toContain("상위 2개");
    expect(pack.tabData.financial.highlights.join(" ")).toContain("총보수율");
  });
});
