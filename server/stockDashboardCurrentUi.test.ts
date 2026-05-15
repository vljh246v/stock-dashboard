import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stockDashboardSource = readFileSync(
  resolve(import.meta.dirname, "../client/src/components/StockDashboard.tsx"),
  "utf-8"
);

describe("StockDashboard current UI contract", () => {
  it("keeps the consolidated dashboard tab labels and excludes retired top-level tabs", () => {
    for (const label of [
      "핵심",
      "차트",
      "재무/가이던스",
      "ETF 정보",
      "투자 판단",
      "근거",
      "뉴스",
    ]) {
      expect(stockDashboardSource).toMatch(
        new RegExp(`>\\s*${label}\\s*</TabsTrigger>`)
      );
    }

    for (const retiredLabel of [
      "개요",
      "핵심 지표",
      "재무",
      "가이던스",
      "공시",
      "의견 추적",
      "분석 의견",
      "근거/추적",
      "기업 개요",
      "기술적 분석",
      "재무/밸류에이션",
      "공시/규제",
      "투자 의견",
      "감성 분석",
    ]) {
      expect(stockDashboardSource).not.toMatch(
        new RegExp(`>\\s*${retiredLabel}\\s*</TabsTrigger>`)
      );
    }

    expect(stockDashboardSource).toContain('value={activeTab}');
    expect(stockDashboardSource).toContain("DecisionSummaryCard");
    expect(stockDashboardSource).toContain("EvidenceOverview");
  });
});
