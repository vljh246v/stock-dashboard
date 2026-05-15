import { describe, expect, it } from "vitest";
import { translateFinancialTerm, translateFinancialText } from "@shared/financialTerms";

describe("financial term localization", () => {
  it("translates common Yahoo and analyst terms to Korean labels", () => {
    expect(translateFinancialTerm("Bullish")).toBe("강세");
    expect(translateFinancialTerm("Bearish")).toBe("약세");
    expect(translateFinancialTerm("Bull")).toBe("강세");
    expect(translateFinancialTerm("Bear")).toBe("약세");
    expect(translateFinancialTerm("Neutral")).toBe("중립");
    expect(translateFinancialTerm("Overvalued")).toBe("고평가");
    expect(translateFinancialTerm("Undervalued")).toBe("저평가");
    expect(translateFinancialTerm("Buy")).toBe("매수");
  });

  it("localizes terms inside user-facing report text", () => {
    const text = translateFinancialText("단기 전망 Bullish, 밸류에이션 Overvalued, 애널리스트 Buy");

    expect(text).toContain("단기 전망 강세");
    expect(text).toContain("밸류에이션 고평가");
    expect(text).toContain("애널리스트 매수");
    expect(text).not.toMatch(/\b(Bullish|Overvalued|Buy)\b/);
  });
});
