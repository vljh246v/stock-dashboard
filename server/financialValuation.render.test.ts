import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FinancialValuation from "../client/src/components/sections/FinancialValuation";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("FinancialValuation rendering", () => {
  it("hides untrusted neutral sector comparisons while preserving company quality scores", () => {
    const html = renderToString(
      React.createElement(FinancialValuation, {
        isLoading: false,
        insights: {
          recommendation: {
            rating: "Buy",
            targetPrice: 450,
            provider: "Argus Research",
          },
          instrumentInfo: {
            valuation: {
              description: "Overvalued",
              discount: "-15%",
              relativeValue: "Premium",
              provider: "Trading Central",
            },
          },
          companySnapshot: {
            company: {
              innovativeness: 0.82,
              hiring: 0.85,
              sustainability: 0.07,
              insiderSentiments: 0.17,
              earningsReports: 0.97,
            },
            sector: {
              innovativeness: 0.5,
              hiring: 0.5,
              sustainability: 0.5,
              insiderSentiments: 0.5,
              earningsReports: 0.5,
              dividends: 0.5,
            },
          },
        },
      })
    );

    expect(html).toContain("기업 품질 점수");
    expect(html).toContain("혁신성");
    expect(html).toContain("채용 활동");
    expect(html).toContain("82");
    expect(html).toContain("85");
    expect(html).toContain("우수");

    expect(html).not.toContain("섹터 50");
    expect(html).not.toContain("섹터 평균");
  });
});
