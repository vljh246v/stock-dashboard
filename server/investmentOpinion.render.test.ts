import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import InvestmentOpinion, { displayWorkflowStage } from "../client/src/components/sections/InvestmentOpinion";

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
          workflow: {
            source: "TradingAgents-style research report",
            stages: ["Analyst Team", "Research Debate", "Trader", "Risk Management", "Portfolio Manager"],
          },
          disclaimer: "투자 조언이 아닙니다.",
        },
      }),
    );

    expect(html).toContain("판단: 보유");
    expect(html).toContain("신뢰도: 낮음");
    expect(html).toContain("핵심 투자 요인");
    expect(html).toContain("판단에 반영한 항목");
    expect(html).toContain("세부 분석");
    expect(html).toContain("1개 분석 반영");
    expect(html).not.toContain("판단: 매도");
    expect(html).not.toContain("신뢰도: 중간");
    expect(html).not.toContain("TradingAgents");
    expect(html).not.toContain("Analyst Team");
    expect(html).not.toContain("Research Debate");
    expect(html).not.toContain("Portfolio Manager");
    expect(html).not.toContain("관점 종합");
    expect(html).not.toContain("검토한 관점");
  });

  it("localizes internal workflow stage names for UI display", () => {
    expect(displayWorkflowStage("Analyst Team")).toBe("가격·재무·뉴스");
    expect(displayWorkflowStage("Research Debate")).toBe("상승·하락 요인");
    expect(displayWorkflowStage("Trader")).toBe("매매 시나리오");
    expect(displayWorkflowStage("Risk Management")).toBe("리스크 점검");
    expect(displayWorkflowStage("Portfolio Manager")).toBe("최종 판단");
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

    expect(html).toContain("판단: 매수");
    expect(html).toContain("신뢰도: 높음");
  });
});
