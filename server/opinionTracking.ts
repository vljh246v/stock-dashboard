export type OpinionSignal = "매수" | "보유" | "매도";
export type OpinionConfidence = "높음" | "중간" | "낮음";
export type OpinionTrackingHorizon = "1m" | "3m";
export type OpinionTrackingStatus = "pending" | "resolved" | "unavailable";
export type OpinionAlignment = "방향 일치" | "보합권" | "방향 차이" | "수집 중" | "데이터 부족";

export const OPINION_TRACKING_VERSION = "llm_multi_opinion_v10_guidance_evidence";
export const OPINION_TRACKING_HORIZONS: OpinionTrackingHorizon[] = ["1m", "3m"];
export const PROHIBITED_TRUST_COPY = ["적중률", "수익 보장", "AI가 맞췄", "추천 성과"];

export interface ChartClosePoint {
  observedDate: Date;
  close: number;
}

interface YahooChartLike {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: unknown;
      };
      timestamp?: unknown;
      indicators?: {
        quote?: Array<{ close?: unknown }>;
      };
    }> | null;
  };
  timestamp?: unknown;
  indicators?: {
    quote?: Array<{ close?: unknown }>;
  };
}

export interface OpinionTrackingOutcomeLike {
  snapshotId: number;
  horizon: OpinionTrackingHorizon;
  targetDate: Date;
  status: OpinionTrackingStatus;
  observedDate: Date | null;
  observedPrice: number | null;
  returnPct: number | null;
  alignment: OpinionAlignment;
}

export function calculateReturnPct(startPrice: unknown, endPrice: unknown): number | null {
  const start = toFiniteNumber(startPrice);
  const end = toFiniteNumber(endPrice);
  if (start === null || end === null || start <= 0) return null;
  return Number((((end - start) / start) * 100).toFixed(2));
}

export function classifyAlignment(signal: OpinionSignal, returnPct: number | null): OpinionAlignment {
  if (returnPct === null) return "데이터 부족";
  if (signal === "매수") {
    if (returnPct >= 2) return "방향 일치";
    if (returnPct <= -2) return "방향 차이";
    return "보합권";
  }
  if (signal === "매도") {
    if (returnPct <= -2) return "방향 일치";
    if (returnPct >= 2) return "방향 차이";
    return "보합권";
  }
  return Math.abs(returnPct) <= 5 ? "보합권" : "방향 차이";
}

export function assertNoProhibitedTrustCopy(value: string) {
  const matched = PROHIBITED_TRUST_COPY.find(term => value.includes(term));
  if (matched) {
    throw new Error(`Prohibited trust copy found: ${matched}`);
  }
}

export function createPendingOutcomes(snapshotId: number, opinionCreatedAt: Date): OpinionTrackingOutcomeLike[] {
  return OPINION_TRACKING_HORIZONS.map(horizon => ({
    snapshotId,
    horizon,
    targetDate: addMonths(opinionCreatedAt, horizon === "1m" ? 1 : 3),
    status: "pending",
    observedDate: null,
    observedPrice: null,
    returnPct: null,
    alignment: "수집 중",
  }));
}

export function extractChartClosePoints(chartData: unknown): ChartClosePoint[] {
  const data = chartData as YahooChartLike;
  const result = data.chart?.result?.[0] || data;
  const timestamps = result?.timestamp;
  const closes = result?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return [];

  return timestamps
    .map((timestamp, index) => {
      const close = toFiniteNumber(closes[index]);
      if (typeof timestamp !== "number" || close === null) return null;
      return {
        observedDate: new Date(timestamp * 1000),
        close,
      };
    })
    .filter((point): point is ChartClosePoint => point !== null)
    .sort((a, b) => a.observedDate.getTime() - b.observedDate.getTime());
}

export function selectCloseOnOrAfter(
  chartData: unknown,
  targetDate: Date,
  toleranceDays = 7
): ChartClosePoint | null {
  const targetTime = startOfUtcDay(targetDate).getTime();
  const maxTime = targetTime + toleranceDays * 24 * 60 * 60 * 1000;

  return extractChartClosePoints(chartData).find(point => {
    const observedTime = startOfUtcDay(point.observedDate).getTime();
    return observedTime >= targetTime && observedTime <= maxTime;
  }) ?? null;
}

export function selectCloseOnOrBefore(
  chartData: unknown,
  targetDate: Date,
  toleranceDays = 7
): ChartClosePoint | null {
  const targetTime = startOfUtcDay(targetDate).getTime();
  const minTime = targetTime - toleranceDays * 24 * 60 * 60 * 1000;

  return [...extractChartClosePoints(chartData)]
    .reverse()
    .find(point => {
      const observedTime = startOfUtcDay(point.observedDate).getTime();
      return observedTime <= targetTime && observedTime >= minTime;
    }) ?? null;
}

export function selectOpinionBaselineClose(chartData: unknown, opinionCreatedAt: Date): ChartClosePoint | null {
  const priorClose = selectCloseOnOrBefore(chartData, opinionCreatedAt);
  if (priorClose) return priorClose;

  const data = chartData as YahooChartLike;
  const metaPrice = toFiniteNumber(data.chart?.result?.[0]?.meta?.regularMarketPrice);
  if (metaPrice === null) return null;
  return {
    observedDate: opinionCreatedAt,
    close: metaPrice,
  };
}

export function resolveOutcomeFromChart(
  signal: OpinionSignal,
  startPrice: number | null,
  outcome: OpinionTrackingOutcomeLike,
  chartData: unknown,
  now = new Date(),
  toleranceDays = 7
): OpinionTrackingOutcomeLike {
  if (outcome.status === "resolved") return outcome;
  if (outcome.targetDate.getTime() > now.getTime()) return outcome;

  const observedClose = selectCloseOnOrAfter(chartData, outcome.targetDate, toleranceDays);
  const toleranceEnd = startOfUtcDay(outcome.targetDate).getTime() + toleranceDays * 24 * 60 * 60 * 1000;
  if (!observedClose && now.getTime() <= toleranceEnd) return outcome;

  if (!observedClose || startPrice === null) {
    return {
      ...outcome,
      status: "unavailable",
      observedDate: null,
      observedPrice: null,
      returnPct: null,
      alignment: "데이터 부족",
    };
  }

  const returnPct = calculateReturnPct(startPrice, observedClose.close);
  return {
    ...outcome,
    status: returnPct === null ? "unavailable" : "resolved",
    observedDate: observedClose.observedDate,
    observedPrice: observedClose.close,
    returnPct,
    alignment: classifyAlignment(signal, returnPct),
  };
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
