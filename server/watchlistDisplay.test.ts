import { describe, expect, it } from "vitest";

import { buildWatchlistDisplayItems } from "../client/src/lib/watchlistDisplay";

describe("watchlist display items", () => {
  it("shows the selected route symbol even when it has not been saved yet", () => {
    const items = buildWatchlistDisplayItems([], "AAPL");

    expect(items).toEqual([
      {
        id: "current-AAPL",
        symbol: "AAPL",
        name: "현재 분석 중",
        saved: false,
        currentOnly: true,
      },
    ]);
  });

  it("does not duplicate the selected symbol when it is already saved", () => {
    const items = buildWatchlistDisplayItems(
      [{ id: 1, symbol: "AAPL", name: "Apple Inc." }],
      "AAPL",
    );

    expect(items).toEqual([
      {
        id: "1",
        symbol: "AAPL",
        name: "Apple Inc.",
        saved: true,
        currentOnly: false,
      },
    ]);
  });
});
