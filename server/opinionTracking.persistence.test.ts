import { describe, expect, it } from "vitest";
import {
  createOpinionSnapshotWithPendingOutcomes,
  listRecentOpinionTracking,
  setCachedData,
  updateOpinionOutcome,
} from "./db";

describe("opinion tracking persistence", () => {
  it("creates one immutable snapshot with 1m and 3m pending outcomes", async () => {
    const opinionCreatedAt = new Date("2026-01-15T00:00:00.000Z");

    const result = await createOpinionSnapshotWithPendingOutcomes({
      symbol: "aapl",
      opinionCreatedAt,
      opinionVersion: "test-version-a",
      finalSignal: "매수",
      finalConfidence: "중간",
      startObservedDate: new Date("2026-01-15T00:00:00.000Z"),
      startPrice: 100,
      opinionPayload: { finalVerdict: { signal: "매수" } },
      sourceSummary: { source: "test" },
    });

    expect(result.snapshot.symbol).toBe("AAPL");
    expect(result.outcomes.map(outcome => outcome.horizon).sort()).toEqual(["1m", "3m"]);
    expect(result.outcomes.every(outcome => outcome.status === "pending")).toBe(true);
  });

  it("keeps duplicate snapshot and outcome writes idempotent", async () => {
    const input = {
      symbol: "MSFT",
      opinionCreatedAt: new Date("2026-02-15T00:00:00.000Z"),
      opinionVersion: "test-version-b",
      finalSignal: "보유",
      finalConfidence: "높음",
      startObservedDate: new Date("2026-02-15T00:00:00.000Z"),
      startPrice: 200,
      opinionPayload: { finalVerdict: { signal: "보유" } },
      sourceSummary: { source: "test" },
    };

    const first = await createOpinionSnapshotWithPendingOutcomes(input);
    const second = await createOpinionSnapshotWithPendingOutcomes(input);
    const records = await listRecentOpinionTracking("msft");

    expect(second.snapshot.id).toBe(first.snapshot.id);
    expect(records.filter(record => record.snapshot.opinionVersion === "test-version-b")).toHaveLength(1);
    expect(records[0].outcomes).toHaveLength(2);
  });

  it("updates pending outcomes without downgrading resolved outcomes", async () => {
    const created = await createOpinionSnapshotWithPendingOutcomes({
      symbol: "NVDA",
      opinionCreatedAt: new Date("2026-03-15T00:00:00.000Z"),
      opinionVersion: "test-version-c",
      finalSignal: "매도",
      finalConfidence: "낮음",
      startObservedDate: new Date("2026-03-15T00:00:00.000Z"),
      startPrice: 300,
      opinionPayload: { finalVerdict: { signal: "매도" } },
      sourceSummary: { source: "test" },
    });

    const snapshotId = created.snapshot.id;
    const resolved = await updateOpinionOutcome({
      snapshotId,
      horizon: "1m",
      status: "resolved",
      observedDate: new Date("2026-04-15T00:00:00.000Z"),
      observedPrice: 270,
      returnPct: -10,
      alignment: "방향 일치",
    });
    const downgraded = await updateOpinionOutcome({
      snapshotId,
      horizon: "1m",
      status: "unavailable",
      observedDate: null,
      observedPrice: null,
      returnPct: null,
      alignment: "데이터 부족",
    });

    expect(resolved?.status).toBe("resolved");
    expect(downgraded?.status).toBe("resolved");
    expect(downgraded?.returnPct).toBe(-10);
  });

  it("cache writes do not remove tracking snapshots", async () => {
    const opinionCreatedAt = new Date("2026-04-15T00:00:00.000Z");
    await createOpinionSnapshotWithPendingOutcomes({
      symbol: "AMZN",
      opinionCreatedAt,
      opinionVersion: "test-version-d",
      finalSignal: "매수",
      finalConfidence: "높음",
      startObservedDate: new Date("2026-04-15T00:00:00.000Z"),
      startPrice: 50,
      opinionPayload: { finalVerdict: { signal: "매수" } },
      sourceSummary: { source: "test" },
    });

    await setCachedData("AMZN", "llm_multi_opinion_test", { cached: true }, 1);
    await setCachedData("AMZN", "llm_multi_opinion_test", { cached: true }, 1);

    const records = await listRecentOpinionTracking("AMZN");
    expect(records.some(record => record.snapshot.opinionVersion === "test-version-d")).toBe(true);
  });

  it("keeps more than 20 recent tracking rows available for maturing outcomes", async () => {
    const symbol = "LONGRANGE";
    const oldMaturingDate = new Date("2026-01-15T00:00:00.000Z");
    await createOpinionSnapshotWithPendingOutcomes({
      symbol,
      opinionCreatedAt: oldMaturingDate,
      opinionVersion: "test-version-maturing",
      finalSignal: "매수",
      finalConfidence: "중간",
      startObservedDate: oldMaturingDate,
      startPrice: 100,
      opinionPayload: { finalVerdict: { signal: "매수" } },
      sourceSummary: { source: "test" },
    });

    for (let index = 0; index < 25; index += 1) {
      const opinionCreatedAt = new Date(Date.UTC(2026, 1, index + 1));
      await createOpinionSnapshotWithPendingOutcomes({
        symbol,
        opinionCreatedAt,
        opinionVersion: `test-version-newer-${index}`,
        finalSignal: "보유",
        finalConfidence: "낮음",
        startObservedDate: opinionCreatedAt,
        startPrice: 100 + index,
        opinionPayload: { finalVerdict: { signal: "보유" } },
        sourceSummary: { source: "test" },
      });
    }

    const records = await listRecentOpinionTracking(symbol);

    expect(records).toHaveLength(26);
    expect(records.some(record => record.snapshot.opinionVersion === "test-version-maturing")).toBe(true);
  });
});
