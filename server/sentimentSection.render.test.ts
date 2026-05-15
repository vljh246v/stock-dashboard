import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SentimentSection from "../client/src/components/sections/SentimentSection";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("SentimentSection Korean labels", () => {
  it("uses market psychology wording instead of literal sentiment wording", () => {
    const html = renderToStaticMarkup(
      React.createElement(SentimentSection, {
        isLoading: false,
        sentiment: {
          overallSentiment: "긍정",
          sentimentScore: 72,
          marketImpact: "뉴스 흐름은 긍정적입니다.",
          newsAnalysis: [
            { headline: "신제품 출시", sentiment: "긍정", impact: "시장 기대가 높아졌습니다." },
          ],
        },
      }),
    );

    expect(html).toContain("뉴스 심리 요약");
    expect(html).toContain("심리 점수");
    expect(html).toContain("뉴스별 심리");
    expect(html).not.toContain("감성");
  });
});
