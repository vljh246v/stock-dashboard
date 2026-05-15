import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import InvestmentOpinion from "../client/src/components/sections/InvestmentOpinion";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("InvestmentOpinion labels", () => {
  it("labels multi-agent signal and confidence values", () => {
    const html = renderToStaticMarkup(
      React.createElement(InvestmentOpinion, {
        isLoading: false,
        opinion: {
          agents: [
            {
              agentName: "펀더멘털 분석",
              stage: "Analyst Team",
              signal: "매도",
              confidence: "중간",
              reasoning: "밸류에이션 부담이 큽니다.",
              keyPoints: ["밸류에이션 부담"],
            },
          ],
          finalVerdict: {
            signal: "보유",
            confidence: "낮음",
            summary: "근거가 제한적입니다.",
            bullCase: "강세 근거 제한",
            bearCase: "약세 근거 확인 필요",
            keyFactors: ["추가 확인 필요"],
            dissent: "",
          },
          workflow: { source: "TradingAgents-style research report", stages: [] },
          disclaimer: "투자 조언이 아닙니다.",
        },
      }),
    );

    expect(html).toContain("의견: 보유");
    expect(html).toContain("신뢰도: 낮음");
    expect(html).toContain("핵심 투자 요인");
    expect(html).toContain("에이전트별 상세");
    expect(html).not.toContain("의견: 매도");
    expect(html).not.toContain("신뢰도: 중간");
  });

  it("labels legacy single-agent signal and confidence values", () => {
    const html = renderToStaticMarkup(
      React.createElement(InvestmentOpinion, {
        isLoading: false,
        opinion: {
          signal: "매수",
          confidence: "높음",
          summary: "상승 근거가 우세합니다.",
          bullCase: "강세 근거",
          bearCase: "약세 근거",
          keyFactors: [],
        },
      }),
    );

    expect(html).toContain("의견: 매수");
    expect(html).toContain("신뢰도: 높음");
  });
});
