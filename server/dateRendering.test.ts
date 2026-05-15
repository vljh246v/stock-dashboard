import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FilingsSection from "../client/src/components/sections/FilingsSection";
import GuidanceSection from "../client/src/components/sections/GuidanceSection";
import ETFSection from "../client/src/components/sections/ETFSection";
import FinancialValuation from "../client/src/components/sections/FinancialValuation";
import GovernanceSection from "../client/src/components/sections/GovernanceSection";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("dashboard date rendering", () => {
  it("renders Date objects from Yahoo insight events without passing objects to React", () => {
    const eventDate = new Date("2024-05-02T00:00:00.000Z");

    expect(() =>
      renderToString(
        React.createElement(FilingsSection, {
          filings: { filings: [{ type: "10-K", title: "Annual Report", date: eventDate }] },
          insights: { sigDevs: [{ headline: "Apple reports earnings", date: eventDate }] },
          isLoading: false,
        }),
      ),
    ).not.toThrow();

    expect(() =>
      renderToString(
        React.createElement(GuidanceSection, {
          insights: {
            sigDevs: [{ headline: "Apple beats earnings estimates", date: eventDate }],
            reports: [],
          },
          translation: { bullPointsKo: [], bearPointsKo: [], earningsHeadlinesKo: [] },
          isLoading: false,
        }),
      ),
    ).not.toThrow();

    expect(() =>
      renderToString(
        React.createElement(FinancialValuation, {
          insights: { reports: [{ reportTitle: "Quarterly note", provider: "Test", reportDate: eventDate }] },
          isLoading: false,
        }),
      ),
    ).not.toThrow();

    expect(() =>
      renderToString(
        React.createElement(GovernanceSection, {
          holders: { insiderHolders: { holders: [{ name: "Insider", latestTransDate: eventDate }] } },
          isLoading: false,
        }),
      ),
    ).not.toThrow();

    expect(() =>
      renderToString(
        React.createElement(ETFSection, {
          profileData: { fundProfile: { feesExpensesInvestment: {}, feesExpensesInvestmentCat: {} } },
          holdings: { holdings: [], asOfDate: eventDate },
          isLoadingProfile: false,
          isLoadingHoldings: false,
        }),
      ),
    ).not.toThrow();
  });
});
