import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stockDashboardSource = readFileSync(
  resolve(import.meta.dirname, "../client/src/components/StockDashboard.tsx"),
  "utf-8"
);
const decisionSummarySource = readFileSync(
  resolve(
    import.meta.dirname,
    "../client/src/components/sections/DecisionSummaryCard.tsx"
  ),
  "utf-8"
);

function tabContentSource(value: string, nextValue: string) {
  const start = stockDashboardSource.indexOf(
    `<TabsContent value="${value}"`
  );
  const end = stockDashboardSource.indexOf(
    `<TabsContent value="${nextValue}"`,
    start + 1
  );
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return stockDashboardSource.slice(start, end);
}

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
    expect(stockDashboardSource).toContain("EvidenceTabOverview");
  });

  it("separates current evidence, source status, raw references, and post-judgment tracking", () => {
    const opinionTab = tabContentSource("opinion", "evidence");
    const evidenceTab = tabContentSource("evidence", "sentiment");

    expect(evidenceTab).toContain("EvidenceTabOverview");
    expect(evidenceTab).not.toContain("OpinionTrackingTable");
    expect(evidenceTab).not.toContain("OpinionTrackingSection");
    expect(evidenceTab).toContain("guidanceEvidence=");
    expect(evidenceTab).toContain("metrics=");
    expect(evidenceTab).toContain("etf=");

    expect(opinionTab).toContain("OpinionTrackingSection");
    expect(opinionTab).toContain("InvestmentOpinion");
    expect(opinionTab).not.toContain("FilingsSection");

    expect(stockDashboardSource).toContain("출처 상태 보기");
    expect(stockDashboardSource).not.toContain("근거 보기");
    expect(decisionSummarySource).toContain("자료 상태:");
    expect(decisionSummarySource).not.toContain("근거:");
  });
});
