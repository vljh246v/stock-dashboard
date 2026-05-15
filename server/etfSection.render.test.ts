import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ETFSection from "../client/src/components/sections/ETFSection";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("ETFSection", () => {
  it("renders numeric Yahoo fundProfile ETF fields as formatted values", () => {
    const html = renderToString(
      React.createElement(ETFSection, {
        profileData: {
          fundProfile: {
            family: "Vanguard",
            categoryName: "Large Blend",
            legalType: "Exchange Traded Fund",
            feesExpensesInvestment: {
              annualReportExpenseRatio: 0.00029999999,
              annualHoldingsTurnover: 0.02,
              totalNetAssets: 404537.56,
            },
            feesExpensesInvestmentCat: {
              annualReportExpenseRatio: 0.0072176997,
            },
          },
        },
        holdings: {
          holdings: [{ symbol: "NVDA", name: "NVIDIA Corp.", weight: 7.58, shares: null }],
          asOfDate: "2026-03-31T00:00:00-04:00",
        },
        isLoadingProfile: false,
        isLoadingHoldings: false,
      }),
    );

    expect(html).toContain("Vanguard");
    expect(html).toContain("0.03%");
    expect(html).toContain("0.72%");
    expect(html).toContain("$404.5B");
    expect(html).toContain("2.00%");
  });
});
