import { describe, expect, it } from "vitest";

import { isTrustedQualitySectorComparison } from "../shared/qualitySectorComparison";

describe("isTrustedQualitySectorComparison", () => {
  it("rejects neutral default sector snapshots even when enough values are present", () => {
    expect(
      isTrustedQualitySectorComparison({
        innovativeness: 0.5,
        hiring: 0.5,
        sustainability: 0.5,
        insiderSentiments: 0.5,
        earningsReports: 0.5,
        dividends: 0.5,
        provider: "Yahoo insights",
      })
    ).toBe(false);
  });

  it("rejects sparse sector snapshots", () => {
    expect(
      isTrustedQualitySectorComparison({
        innovativeness: 0.7,
        hiring: 0.6,
        provider: "Yahoo insights",
      })
    ).toBe(false);
  });

  it("requires benchmark metadata even when sector values vary", () => {
    expect(
      isTrustedQualitySectorComparison({
        innovativeness: 0.7,
        hiring: 0.6,
        sustainability: 0.8,
      })
    ).toBe(false);
  });

  it("trusts varied sector snapshots with explicit benchmark metadata", () => {
    expect(
      isTrustedQualitySectorComparison({
        innovativeness: 70,
        hiring: 60,
        sustainability: 80,
        methodology: "documented benchmark",
      })
    ).toBe(true);
  });
});
