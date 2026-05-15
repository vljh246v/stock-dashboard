import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stockDashboardSource = readFileSync(
  resolve(import.meta.dirname, "../client/src/components/StockDashboard.tsx"),
  "utf-8"
);

describe("StockDashboard current UI contract", () => {
  it("keeps the current compact dashboard labels and excludes the retired tab copy", () => {
    for (const label of [
      "개요",
      "차트",
      "재무",
      "가이던스",
      "공시",
      "의견",
      "뉴스",
    ]) {
      expect(stockDashboardSource).toMatch(
        new RegExp(`>\\s*${label}\\s*</TabsTrigger>`)
      );
    }

    for (const retiredLabel of [
      "기업 개요",
      "기술적 분석",
      "재무/밸류에이션",
      "공시/규제",
      "투자 의견",
      "감성 분석",
    ]) {
      expect(stockDashboardSource).not.toContain(retiredLabel);
    }

    expect(stockDashboardSource).toContain("DecisionSummaryCard");
  });
});
