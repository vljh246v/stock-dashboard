import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import OpinionTrackingTable from "../client/src/components/sections/OpinionTrackingTable";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const prohibited = /적중률|수익 보장|AI가 맞췄|추천 성과/;

describe("OpinionTrackingTable", () => {
  it("renders an honest collection state when no rows exist", () => {
    const html = renderToStaticMarkup(
      React.createElement(OpinionTrackingTable, {
        isLoading: false,
        tracking: {
          rows: [],
          copy: {
            title: "판단 기록",
            description: "이전에 남긴 판단과 이후 가격 변화를 함께 보여줍니다.",
            empty: "아직 비교할 1개월/3개월 뒤 가격 데이터가 충분하지 않습니다.",
          },
        },
      }),
    );

    expect(html).toContain("가격 데이터가 충분하지 않습니다");
    expect(html).not.toMatch(prohibited);
  });

  it("renders pending and resolved historical alignment labels", () => {
    const html = renderToStaticMarkup(
      React.createElement(OpinionTrackingTable, {
        isLoading: false,
        tracking: {
          rows: [{
            snapshot: {
              opinionCreatedAt: "2026-01-15T00:00:00.000Z",
              finalSignal: "매수",
              finalConfidence: "중간",
              startObservedDate: "2026-01-15T00:00:00.000Z",
              startPrice: 100,
            },
            outcomes: [
              {
                horizon: "1m",
                status: "resolved",
                observedDate: "2026-02-16T00:00:00.000Z",
                observedPrice: 111,
                returnPct: 11,
                alignment: "방향 일치",
              },
              {
                horizon: "3m",
                status: "pending",
                observedDate: null,
                observedPrice: null,
                returnPct: null,
                alignment: "수집 중",
              },
            ],
          }],
        },
      }),
    );

    expect(html).toContain("11.00%");
    expect(html).toContain("방향 일치");
    expect(html).toContain("수집 중");
    expect(html).not.toMatch(prohibited);
  });
});
