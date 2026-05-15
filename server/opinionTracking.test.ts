import { describe, expect, it } from "vitest";
import {
  assertNoProhibitedTrustCopy,
  calculateReturnPct,
  classifyAlignment,
  createPendingOutcomes,
  extractChartClosePoints,
  resolveOutcomeFromChart,
  selectCloseOnOrAfter,
  selectCloseOnOrBefore,
  selectOpinionBaselineClose,
} from "./opinionTracking";

const chart = {
  chart: {
    result: [{
      timestamp: [
        Date.UTC(2026, 0, 2) / 1000,
        Date.UTC(2026, 0, 5) / 1000,
        Date.UTC(2026, 1, 16) / 1000,
      ],
      indicators: {
        quote: [{
          close: [100, 103, 111],
        }],
      },
    }],
  },
};

describe("opinion tracking metrics", () => {
  it("calculates return percentages", () => {
    expect(calculateReturnPct(100, 110)).toBe(10);
    expect(calculateReturnPct(100, 90)).toBe(-10);
    expect(calculateReturnPct(0, 90)).toBeNull();
    expect(calculateReturnPct(null, 90)).toBeNull();
  });

  it("classifies buy, sell, and hold alignment conservatively", () => {
    expect(classifyAlignment("매수", 2)).toBe("방향 일치");
    expect(classifyAlignment("매수", -2)).toBe("방향 차이");
    expect(classifyAlignment("매수", 1.2)).toBe("보합권");
    expect(classifyAlignment("매도", -2)).toBe("방향 일치");
    expect(classifyAlignment("매도", 2)).toBe("방향 차이");
    expect(classifyAlignment("보유", 4.99)).toBe("보합권");
    expect(classifyAlignment("보유", 5.01)).toBe("방향 차이");
    expect(classifyAlignment("보유", null)).toBe("데이터 부족");
  });

  it("extracts and selects the first daily close on or after the target date", () => {
    expect(extractChartClosePoints(chart)).toHaveLength(3);

    const selected = selectCloseOnOrAfter(chart, new Date(Date.UTC(2026, 0, 3)));

    expect(selected?.close).toBe(103);
    expect(selected?.observedDate.toISOString()).toBe("2026-01-05T00:00:00.000Z");
  });

  it("returns null when no close exists within tolerance", () => {
    expect(selectCloseOnOrAfter(chart, new Date(Date.UTC(2026, 0, 6)), 2)).toBeNull();
  });

  it("selects the latest known close on or before an opinion timestamp for baseline capture", () => {
    const selected = selectCloseOnOrBefore(chart, new Date(Date.UTC(2026, 0, 4)));

    expect(selected?.close).toBe(100);
    expect(selected?.observedDate.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });

  it("uses chart regular market price when no baseline close exists", () => {
    const selected = selectOpinionBaselineClose(
      { chart: { result: [{ meta: { regularMarketPrice: 185.5 } }] } },
      new Date(Date.UTC(2026, 0, 4, 12))
    );

    expect(selected?.close).toBe(185.5);
    expect(selected?.observedDate.toISOString()).toBe("2026-01-04T12:00:00.000Z");
  });

  it("keeps pending outcomes pending before the target date", () => {
    const [outcome] = createPendingOutcomes(1, new Date(Date.UTC(2026, 0, 1)));

    const resolved = resolveOutcomeFromChart(
      "매수",
      100,
      outcome,
      chart,
      new Date(Date.UTC(2026, 0, 20))
    );

    expect(resolved.status).toBe("pending");
    expect(resolved.alignment).toBe("수집 중");
  });

  it("resolves eligible outcomes from chart closes", () => {
    const [outcome] = createPendingOutcomes(1, new Date(Date.UTC(2026, 0, 15)));

    const resolved = resolveOutcomeFromChart(
      "매수",
      100,
      outcome,
      chart,
      new Date(Date.UTC(2026, 1, 20))
    );

    expect(resolved.status).toBe("resolved");
    expect(resolved.returnPct).toBe(11);
    expect(resolved.alignment).toBe("방향 일치");
  });

  it("keeps mature outcomes pending while the observation tolerance window is still open", () => {
    const [outcome] = createPendingOutcomes(1, new Date(Date.UTC(2026, 0, 15)));

    const resolved = resolveOutcomeFromChart(
      "매수",
      100,
      outcome,
      { chart: { result: [{ timestamp: [], indicators: { quote: [{ close: [] }] } }] } },
      new Date(Date.UTC(2026, 1, 17)),
      7
    );

    expect(resolved.status).toBe("pending");
    expect(resolved.alignment).toBe("수집 중");
  });

  it("marks mature outcomes unavailable only after the observation tolerance window expires", () => {
    const [outcome] = createPendingOutcomes(1, new Date(Date.UTC(2026, 0, 15)));

    const resolved = resolveOutcomeFromChart(
      "매수",
      100,
      outcome,
      { chart: { result: [{ timestamp: [], indicators: { quote: [{ close: [] }] } }] } },
      new Date(Date.UTC(2026, 1, 24)),
      7
    );

    expect(resolved.status).toBe("unavailable");
    expect(resolved.alignment).toBe("데이터 부족");
  });

  it("does not downgrade already resolved outcomes", () => {
    const [outcome] = createPendingOutcomes(1, new Date(Date.UTC(2026, 0, 15)));
    const alreadyResolved = {
      ...outcome,
      status: "resolved" as const,
      observedDate: new Date(Date.UTC(2026, 1, 16)),
      observedPrice: 111,
      returnPct: 11,
      alignment: "방향 일치" as const,
    };

    expect(resolveOutcomeFromChart("매수", 100, alreadyResolved, null).status).toBe("resolved");
  });

  it("guards against prohibited performance copy", () => {
    expect(() => assertNoProhibitedTrustCopy("과거 의견과 이후 가격 흐름")).not.toThrow();
    expect(() => assertNoProhibitedTrustCopy("AI가 맞췄다")).toThrow(/Prohibited/);
  });
});
