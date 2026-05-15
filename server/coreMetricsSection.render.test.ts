import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CoreMetricsSection from "../client/src/components/sections/CoreMetricsSection";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("CoreMetricsSection rendering", () => {
  it("renders verified values, unavailable states, and compact verification status", () => {
    const html = renderToString(
      React.createElement(CoreMetricsSection, {
        isLoading: false,
        metrics: {
          assetType: "stock",
          generatedAt: "2026-05-15T00:00:00.000Z",
          dataQuality: { available: 1, unavailable: 1, total: 2 },
          groups: [
            {
              id: "valuation",
              labelKo: "가치 평가",
              descriptionKo: "기본 밸류에이션 지표입니다.",
              metrics: [
                {
                  id: "per",
                  labelKo: "PER",
                  descriptionKo: "주가를 주당순이익으로 나눈 값입니다.",
                  status: "available",
                  value: "28.4배",
                  rawValue: 28.4,
                  source: {
                    name: "Yahoo quoteSummary.defaultKeyStatistics",
                    basis: "trailingPE",
                  },
                  freshness: {
                    kind: "checked_at",
                    checkedAt: "2026-05-15T00:00:00.000Z",
                    note: "응답 확인 시각입니다. 원천 API 또는 로컬 캐시의 실제 작성 시각과 다를 수 있습니다.",
                  },
                },
                {
                  id: "pbr",
                  labelKo: "PBR",
                  descriptionKo: "주가를 주당순자산으로 나눈 값입니다.",
                  status: "unavailable",
                  unavailableReason: "missing_value",
                  unavailableDetailKo: "구조화된 값이 없어 확인할 수 없습니다.",
                  expectedSource: {
                    name: "Yahoo quoteSummary.defaultKeyStatistics",
                    basis: "priceToBook",
                  },
                },
              ],
            },
          ],
        },
      })
    );

    expect(html).toContain("핵심 지표");
    expect(html).toContain("PER");
    expect(html).toContain("28.4배");
    expect(html).toContain("출처 확인");
    expect(html).not.toContain("Yahoo quoteSummary.defaultKeyStatistics");
    expect(html).not.toContain("trailingPE");
    expect(html).not.toContain("응답 확인 시각입니다.");
    expect(html).toContain("확인 불가");
    expect(html).toContain("값 없음");
    expect(html).not.toContain("구조화된 값이 없어 확인할 수 없습니다.");
  });

  it("keeps metric descriptions inside the help overlay instead of the row body", () => {
    const html = renderToString(
      React.createElement(CoreMetricsSection, {
        isLoading: false,
        metrics: {
          assetType: "stock",
          generatedAt: "2026-05-15T00:00:00.000Z",
          dataQuality: { available: 1, unavailable: 0, total: 1 },
          groups: [
            {
              id: "valuation",
              labelKo: "가치 평가",
              descriptionKo: "기본 밸류에이션 지표입니다.",
              metrics: [
                {
                  id: "per",
                  labelKo: "PER",
                  descriptionKo: "주가를 주당순이익으로 나눈 값입니다.",
                  status: "available",
                  value: "28.4배",
                  rawValue: 28.4,
                  source: {
                    name: "Yahoo quoteSummary.defaultKeyStatistics",
                    basis: "trailingPE",
                  },
                  freshness: {
                    kind: "checked_at",
                    checkedAt: "2026-05-15T00:00:00.000Z",
                    note: "응답 확인 시각입니다. 원천 API 또는 로컬 캐시의 실제 작성 시각과 다를 수 있습니다.",
                  },
                },
              ],
            },
          ],
        },
      })
    );

    expect(html).toContain("PER");
    expect(html).toContain('aria-label="PER 설명"');
    expect(html).not.toContain("주가를 주당순이익으로 나눈 값입니다.");
  });
});
