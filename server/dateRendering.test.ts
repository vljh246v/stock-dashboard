import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FilingsSection from "../client/src/components/sections/FilingsSection";
import GuidanceSection from "../client/src/components/sections/GuidanceSection";
import ETFSection from "../client/src/components/sections/ETFSection";
import EvidenceTabOverview from "../client/src/components/sections/EvidenceTabOverview";
import FinancialValuation from "../client/src/components/sections/FinancialValuation";
import GovernanceSection from "../client/src/components/sections/GovernanceSection";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("dashboard date rendering", () => {
  it("renders Date objects from Yahoo insight events without passing objects to React", () => {
    const eventDate = new Date("2024-05-02T00:00:00.000Z");

    expect(() =>
      renderToString(
        React.createElement(FilingsSection, {
          filings: {
            filings: [
              { type: "10-K", title: "Annual Report", date: eventDate },
            ],
          },
          insights: {
            sigDevs: [{ headline: "Apple reports earnings", date: eventDate }],
          },
          isLoading: false,
        })
      )
    ).not.toThrow();

    expect(() =>
      renderToString(
        React.createElement(GuidanceSection, {
          insights: {
            sigDevs: [
              { headline: "Apple beats earnings estimates", date: eventDate },
            ],
            reports: [],
          },
          evidence: [
            {
              label: "최근 EPS",
              value: "$1.64",
              comparison: "예상 $1.60",
              source: "Yahoo earningsHistory",
              asOf: eventDate,
            },
          ],
          translation: {
            bullPointsKo: [],
            bearPointsKo: [],
            earningsHeadlinesKo: [],
          },
          isLoading: false,
        })
      )
    ).not.toThrow();

    expect(() =>
      renderToString(
        React.createElement(FinancialValuation, {
          insights: {
            reports: [
              {
                reportTitle: "Quarterly note",
                provider: "Test",
                reportDate: eventDate,
              },
            ],
          },
          isLoading: false,
        })
      )
    ).not.toThrow();

    expect(() =>
      renderToString(
        React.createElement(GovernanceSection, {
          holders: {
            insiderHolders: {
              holders: [{ name: "Insider", latestTransDate: eventDate }],
            },
          },
          isLoading: false,
        })
      )
    ).not.toThrow();

    expect(() =>
      renderToString(
        React.createElement(ETFSection, {
          profileData: {
            fundProfile: {
              feesExpensesInvestment: {},
              feesExpensesInvestmentCat: {},
            },
          },
          holdings: { holdings: [], asOfDate: eventDate },
          isLoadingProfile: false,
          isLoadingHoldings: false,
        })
      )
    ).not.toThrow();
  });

  it("renders verified guidance evidence and unavailable states", () => {
    const evidenceHtml = renderToString(
      React.createElement(GuidanceSection, {
        insights: { sigDevs: [], reports: [] },
        evidence: [
          {
            label: "매출",
            value: "$391.0B",
            comparison: "성장률 +6.1%",
            source: "Yahoo financialData",
            asOf: "2025-03-31",
          },
        ],
        translation: {
          bullPointsKo: [],
          bearPointsKo: [],
          earningsHeadlinesKo: [],
        },
        isLoading: false,
      })
    );

    expect(evidenceHtml).toContain("확인된 실적 근거");
    expect(evidenceHtml).toContain("매출");
    expect(evidenceHtml).toContain("$391.0B");
    expect(evidenceHtml).toContain("Yahoo financialData");

    const unavailableHtml = renderToString(
      React.createElement(GuidanceSection, {
        insights: { sigDevs: [], reports: [] },
        evidence: [],
        translation: {
          bullPointsKo: [],
          bearPointsKo: [],
          earningsHeadlinesKo: [],
        },
        isLoading: false,
      })
    );

    expect(unavailableHtml).toContain("확인된 실적 근거 데이터가 없습니다");
  });

  it("does not render ETF composition numbers as evidence when holdings freshness is missing", () => {
    const html = renderToString(
      React.createElement(EvidenceTabOverview, {
        hasFilings: false,
        isETF: true,
        sources: [{ name: "ETF holdings", status: "fallback" }],
        etf: {
          topHoldingsWeight: 66.6,
          holdings: [
            { symbol: "AAPL", name: "Apple Inc.", weight: 33.3 },
            { symbol: "MSFT", name: "Microsoft Corp.", weight: 33.3 },
          ],
          source: "stockanalysis.com",
        },
        metrics: {
          assetType: "etf",
          generatedAt: "2026-05-15T00:00:00.000Z",
          dataQuality: { available: 0, unavailable: 1, total: 1 },
          groups: [
            {
              id: "holdings",
              labelKo: "구성",
              descriptionKo: "ETF 구성 데이터",
              metrics: [
                {
                  id: "topHoldingsWeight",
                  labelKo: "상위 보유종목 비중",
                  descriptionKo: "ETF 상위 보유종목이 전체에서 차지하는 비율입니다.",
                  status: "unavailable",
                  unavailableReason: "missing_freshness",
                  unavailableDetailKo: "기준일 없음",
                  expectedSource: {
                    name: "ETF holdings (stockanalysis.com)",
                    basis: "top 10 holdings weight with asOfDate",
                  },
                },
              ],
            },
          ],
        },
      })
    );

    expect(html).toContain("현재 판단에 사용된 근거");
    expect(html).toContain("원천/데이터 상태");
    expect(html).toContain("원문 참고자료");
    expect(html).toContain("기준일이 필요한 구성 수치");
    expect(html).not.toContain("66.6%");
    expect(html).not.toContain("실적 근거 데이터가 없습니다");
  });
});
