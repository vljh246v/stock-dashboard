import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CompanyOverview from "../client/src/components/sections/CompanyOverview";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("CompanyOverview", () => {
  it("renders basic market information when a symbol has quote data but no profile", () => {
    const html = renderToStaticMarkup(
      React.createElement(CompanyOverview, {
        data: {
          quoteType: {
            quoteType: "INDEX",
            exchange: "SNP",
          },
          price: {
            shortName: "S&P 500",
            regularMarketPrice: 7497.36,
            currency: "USD",
          },
        },
        chartMeta: {
          instrumentType: "INDEX",
        },
        isLoading: false,
      }),
    );

    expect(html).toContain("S&amp;P 500");
    expect(html).toContain("자산 유형");
    expect(html).toContain("INDEX");
    expect(html).toContain("거래소");
    expect(html).toContain("SNP");
    expect(html).not.toContain("기업 정보를 불러오지 못했습니다.");
  });
});
