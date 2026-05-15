import { describe, expect, it } from "vitest";
import { generateAnalysisPack } from "./analysisPack";

const stockProfile = {
  quoteSummary: {
    result: [
      {
        summaryProfile: {
          sector: "Technology",
          industry: "Consumer Electronics",
        },
        price: { shortName: "Apple Inc.", longName: "Apple Inc." },
        summaryDetail: {
          trailingPE: 28.4,
          dividendYield: 0.0045,
          marketCap: 2850000000000,
          beta: 1.12,
        },
        defaultKeyStatistics: {
          priceToBook: 42.1,
          trailingEps: 6.43,
        },
        financialData: {
          financialCurrency: "USD",
          totalRevenue: 391035000000,
          revenueGrowth: 0.061,
          earningsGrowth: 0.094,
          ebitda: 134661000000,
          ebitdaMargins: 0.3444,
          operatingMargins: 0.3151,
          profitMargins: 0.2397,
          returnOnEquity: 1.385,
          debtToEquity: 145.2,
          freeCashflow: 99584000000,
        },
        earningsHistory: {
          history: [
            {
              epsActual: 1.64,
              epsEstimate: 1.6,
              surprisePercent: 2.5,
              quarter: "2025-03-31",
              period: "-1q",
              currency: "USD",
            },
          ],
        },
        earningsTrend: {
          trend: [
            {
              period: "0q",
              endDate: "2025-06-30",
              earningsEstimate: {
                avg: 1.42,
                numberOfAnalysts: 24,
                earningsCurrency: "USD",
              },
              revenueEstimate: {
                avg: 90000000000,
                growth: 0.035,
                numberOfAnalysts: 22,
                revenueCurrency: "USD",
              },
            },
          ],
        },
        calendarEvents: {
          earnings: {
            earningsDate: ["2025-07-31"],
            earningsAverage: 1.42,
            revenueAverage: 90000000000,
          },
        },
      },
    ],
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
        valuation: {
          description: "Overvalued",
          discount: "-10%",
          relativeValue: "Premium",
        },
      },
      recommendation: {
        rating: "Buy",
        targetPrice: 210.0,
        numberOfAnalysts: 30,
      },
      companySnapshot: {
        company: {
          innovativeness: 85,
          hiring: 70,
          sustainability: 60,
          insiderSentiments: 55,
        },
      },
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
    result: [
      {
        meta: {
          regularMarketPrice: 185.5,
          fiftyTwoWeekHigh: 199,
          fiftyTwoWeekLow: 155,
          instrumentType: "EQUITY",
        },
      },
    ],
  },
};

const stockHolders = {
  quoteSummary: {
    result: [
      {
        insiderHolders: {
          holders: [
            {
              name: "Tim Cook",
              transactionDescription: "Sale",
              latestTransDate: { fmt: "2024-11-15" },
            },
          ],
        },
      },
    ],
  },
};

const stockSecFilings = {
  quoteSummary: {
    result: [
      {
        secFilings: {
          filings: [
            { type: "10-K", title: "Annual Report", date: "2024-10-30" },
          ],
        },
      },
    ],
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
      expect.arrayContaining([
        "혁신 85점",
        "채용 70점",
        "지속가능성 60점",
        "내부자 심리 55점",
      ])
    );
    expect(JSON.stringify(pack)).not.toMatch(
      /\b(Bullish|Neutral|Overvalued|Buy)\b/
    );
    expect(pack.news.events[0].headline).toContain("Apple launches");
    expect(pack.guidance.evidence.length).toBeGreaterThan(0);
    expect(pack.metrics.assetType).toBe("stock");
    expect(pack.metrics.dataQuality.total).toBe(15);
    expect(pack.metrics.dataQuality.available).toBe(15);
    expect(
      pack.metrics.groups
        .flatMap(group => group.metrics)
        .map(metric => metric.id)
    ).toEqual([
      "per",
      "pbr",
      "marketCap",
      "eps",
      "roe",
      "operatingMargin",
      "netMargin",
      "freeCashFlow",
      "revenueGrowth",
      "profitGrowth",
      "debtRatio",
      "beta",
      "fiftyTwoWeekHigh",
      "fiftyTwoWeekLow",
      "dividendYield",
    ]);
    expect(
      pack.metrics.groups
        .flatMap(group => group.metrics)
        .filter(metric => metric.status === "available")
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "per",
          value: "28.4배",
          source: expect.objectContaining({
            name: "Yahoo quoteSummary.summaryDetail",
            basis: "trailingPE",
          }),
          freshness: expect.objectContaining({ kind: "checked_at" }),
        }),
        expect.objectContaining({
          id: "pbr",
          value: "42.1배",
        }),
        expect.objectContaining({
          id: "roe",
          value: "138.5%",
        }),
      ])
    );
    expect(pack.guidance.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "최근 EPS",
          value: "$1.64",
          comparison: expect.stringContaining("예상 $1.60"),
          source: "Yahoo earningsHistory",
          asOf: "2025-03-31",
        }),
        expect.objectContaining({
          label: "매출",
          value: "$391.0B",
          comparison: "성장률 +6.1%",
          source: "Yahoo financialData",
        }),
        expect.objectContaining({
          label: "EBITDA",
          value: "$134.7B",
          source: "Yahoo financialData",
        }),
        expect.objectContaining({
          label: "다음 분기 매출 예상",
          value: "$90.0B",
          comparison: "성장률 +3.5% · 애널리스트 22명",
          source: "Yahoo earningsTrend",
          asOf: "2025-06-30",
        }),
      ])
    );
    expect(pack.governance.insiderTransactions[0]).toContain("Tim Cook");
    expect(pack.filings.latest[0]).toContain("10-K");
    expect(pack.tabData.technical.highlights.join(" ")).toContain(
      "평균 추세 점수"
    );
    expect(pack.tabData.filings.highlights.join(" ")).toContain("10-K");
    expect(pack.sources.map(source => source.name)).toEqual(
      expect.arrayContaining([
        "Yahoo profile",
        "Yahoo insights",
        "Yahoo chart",
        "Yahoo holders",
        "SEC filings",
      ])
    );
  });

  it("does not turn prose-only LLM or analyst text into verified guidance evidence", () => {
    const pack = generateAnalysisPack({
      symbol: "ktos",
      profile: {
        quoteSummary: {
          result: [
            {
              summaryProfile: { sector: "Industrials" },
              price: { shortName: "Kratos Defense" },
            },
          ],
        },
      },
      insights: {
        finance: {
          result: {
            sigDevs: [
              {
                headline:
                  "Revenue $347.6M beats estimate and backlog rises to $1.48B",
              },
            ],
            upsell: {
              msBullishSummary: ["EPS $0.14 and EBITDA margin improved"],
              msBearishSummary: ["Guidance remains execution dependent"],
            },
          },
        },
      },
      chart: {
        chart: {
          result: [{ meta: { instrumentType: "EQUITY" } }],
        },
      },
      holders: null,
      secFilings: null,
      etfHoldings: null,
    });

    expect(pack.guidance.evidence).toEqual([]);
    const metricEntries = pack.metrics.groups.flatMap(group => group.metrics);
    expect(metricEntries.map(metric => metric.id)).toEqual([
      "per",
      "pbr",
      "marketCap",
      "eps",
      "roe",
      "operatingMargin",
      "netMargin",
      "freeCashFlow",
      "revenueGrowth",
      "profitGrowth",
      "debtRatio",
      "beta",
      "fiftyTwoWeekHigh",
      "fiftyTwoWeekLow",
      "dividendYield",
    ]);
    expect(metricEntries.every(metric => metric.status === "unavailable")).toBe(
      true
    );
    expect(metricEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "per",
          status: "unavailable",
          unavailableReason: expect.stringMatching(
            /missing_source|missing_value/
          ),
        }),
      ])
    );
    expect(pack.tabData.guidance.highlights.join(" ")).toContain("EPS $0.14");
  });

  it("keeps metric source labels aligned with the structured field that supplied the value", () => {
    const pack = generateAnalysisPack({
      symbol: "msft",
      profile: {
        quoteSummary: {
          result: [
            {
              summaryProfile: { sector: "Technology" },
              price: { shortName: "Microsoft" },
              summaryDetail: { trailingPE: 31.2, beta: 0.94 },
            },
          ],
        },
      },
      insights: null,
      chart: {
        chart: {
          result: [{ meta: { instrumentType: "EQUITY" } }],
        },
      },
      holders: null,
      secFilings: null,
      etfHoldings: null,
    });

    expect(pack.metrics.groups.flatMap(group => group.metrics)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "per",
          status: "available",
          source: {
            name: "Yahoo quoteSummary.summaryDetail",
            basis: "trailingPE",
          },
        }),
        expect.objectContaining({
          id: "beta",
          status: "available",
          source: {
            name: "Yahoo quoteSummary.summaryDetail",
            basis: "beta",
          },
        }),
      ])
    );
  });

  it("normalizes ETF profile, fee, and holdings data into the same shared pack", () => {
    const pack = generateAnalysisPack({
      symbol: "voo",
      profile: {
        quoteSummary: {
          result: [
            {
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
            },
          ],
        },
      },
      insights: null,
      chart: {
        chart: {
          result: [
            {
              meta: { regularMarketPrice: 510, instrumentType: "ETF" },
            },
          ],
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
    const etfMetrics = pack.metrics.groups.flatMap(group => group.metrics);
    expect(etfMetrics.map(metric => metric.id)).not.toContain("per");
    expect(etfMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "topHoldingsWeight",
          status: "available",
          freshness: { kind: "as_of", asOf: "2026-03-31" },
        }),
      ])
    );
    expect(pack.tabData.etf.highlights.join(" ")).toContain("상위 2개");
    expect(pack.tabData.financial.highlights.join(" ")).toContain("총보수율");
  });

  it("marks ETF holding concentration unavailable when holdings lack an as-of date", () => {
    const pack = generateAnalysisPack({
      symbol: "spy",
      profile: {
        quoteSummary: {
          result: [
            {
              price: { shortName: "SPDR S&P 500 ETF" },
              fundProfile: {
                family: "SPDR",
                categoryName: "Large Blend",
                feesExpensesInvestment: {
                  annualReportExpenseRatio: 0.00095,
                },
              },
            },
          ],
        },
      },
      insights: null,
      chart: {
        chart: {
          result: [
            { meta: { regularMarketPrice: 520, instrumentType: "ETF" } },
          ],
        },
      },
      holders: null,
      secFilings: null,
      etfHoldings: {
        source: "stockanalysis.com",
        asOfDate: null,
        holdings: [{ symbol: "MSFT", name: "Microsoft Corp", weight: 7.1 }],
      },
    });

    expect(pack.etf?.topHoldingsWeight).toBeUndefined();
    expect(pack.tabData.etf.highlights.join(" ")).not.toContain("상위");
    expect(pack.metrics.groups.flatMap(group => group.metrics)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "topHoldingsWeight",
          status: "unavailable",
          unavailableReason: "missing_freshness",
        }),
      ])
    );
    expect(pack.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "ETF holdings",
          status: "unavailable",
          asOf: null,
        }),
      ])
    );
  });
});
