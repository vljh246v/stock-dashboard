import {
  translateFinancialTerm,
  translateFinancialText,
} from "@shared/financialTerms";

export type AssetType = "stock" | "etf" | "unknown";

export interface AnalysisSource {
  name: string;
  status: "used" | "fallback" | "unavailable";
  asOf?: string;
}

export interface GuidanceEvidenceMetric {
  label: string;
  value: string;
  comparison?: string;
  source: string;
  asOf?: string;
  category: "reported" | "forward" | "margin";
}

export interface AnalysisPack {
  symbol: string;
  asset: {
    assetType: AssetType;
    displayName: string;
    sector?: string;
    industry?: string;
    fundFamily?: string;
    fundCategory?: string;
  };
  price: {
    current?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    support?: number;
    resistance?: number;
    stopLoss?: number;
  };
  technical: {
    averageScore?: number;
    outlooks: string[];
    summary: string;
  };
  valuation: {
    summary: string;
    rating?: string;
    targetPrice?: number;
    analystCount?: number;
  };
  news: {
    events: Array<{ headline: string; date?: string }>;
    bullishPoints: string[];
    bearishPoints: string[];
  };
  guidance: {
    evidence: GuidanceEvidenceMetric[];
  };
  governance: {
    qualitySignals: string[];
    insiderTransactions: string[];
  };
  filings: {
    latest: string[];
  };
  etf?: {
    expenseRatio?: string;
    turnover?: string;
    netAssets?: string;
    topHoldingsWeight?: number;
    holdings: Array<{ symbol?: string; name?: string; weight?: number }>;
    source?: string;
    asOf?: string;
  };
  tabData: Record<
    | "overview"
    | "technical"
    | "financial"
    | "guidance"
    | "filings"
    | "etf"
    | "sentiment",
    {
      highlights: string[];
    }
  >;
  sources: AnalysisSource[];
}

interface GenerateAnalysisPackInput {
  symbol: string;
  profile: any;
  insights: any;
  chart: any;
  holders: any;
  secFilings: any;
  etfHoldings: any;
}

function unwrapQuoteSummary(data: any) {
  return data?.quoteSummary?.result?.[0] || data;
}

function unwrapInsights(data: any) {
  return data?.finance?.result || data;
}

function unwrapChart(data: any) {
  return data?.chart?.result?.[0] || data;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object")
    return toNumber((value as { raw?: unknown }).raw);
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,%]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function formatValue(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const fmt = (value as { fmt?: unknown }).fmt;
    if (typeof fmt === "string" && fmt.trim()) return fmt;
  }
  return undefined;
}

function formatPercent(value: unknown) {
  const fmt = formatValue(value);
  if (fmt) return fmt;
  const numeric = toNumber(value);
  return numeric === undefined ? undefined : `${(numeric * 100).toFixed(2)}%`;
}

function formatScore(value: unknown) {
  const numeric = toNumber(value);
  if (numeric === undefined) return undefined;
  const score = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  const rounded = Number(score.toFixed(1));
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}점`;
}

function formatDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  const formatted = formatValue(value);
  if (formatted) return formatted;
  if (typeof value === "string" && value.trim()) return value;
  return undefined;
}

function formatLargeCurrency(value: unknown, currency = "USD") {
  const numeric = toNumber(value);
  if (numeric === undefined) return undefined;
  const prefix = currency === "USD" ? "$" : `${currency} `;
  const abs = Math.abs(numeric);
  if (abs >= 1_000_000_000_000)
    return `${prefix}${(numeric / 1_000_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000_000)
    return `${prefix}${(numeric / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${prefix}${(numeric / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${prefix}${(numeric / 1_000).toFixed(1)}K`;
  return `${prefix}${numeric.toFixed(2)}`;
}

function formatSmallCurrency(value: unknown, currency = "USD") {
  const numeric = toNumber(value);
  if (numeric === undefined) return undefined;
  const prefix = currency === "USD" ? "$" : `${currency} `;
  return `${prefix}${numeric.toFixed(2)}`;
}

function formatSignedPercent(value: unknown) {
  const numeric = toNumber(value);
  if (numeric === undefined) return undefined;
  const percent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(1)}%`;
}

function formatAssets(value: unknown) {
  const numeric = toNumber(value);
  if (numeric === undefined) return undefined;
  const dollars = numeric * 1_000_000;
  if (dollars >= 1_000_000_000_000)
    return `$${(dollars / 1_000_000_000_000).toFixed(1)}T`;
  if (dollars >= 1_000_000_000)
    return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  return `$${dollars.toFixed(0)}`;
}

function compact(values: Array<string | undefined | null | false>) {
  return values.filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0
  );
}

function source(name: string, data: unknown, asOf?: string): AnalysisSource {
  return { name, status: data ? "used" : "unavailable", asOf };
}

function buildTechnical(insights: any) {
  const technicalEvents = insights?.instrumentInfo?.technicalEvents || {};
  const outlooks = [
    ["단기", technicalEvents.shortTermOutlook],
    ["중기", technicalEvents.intermediateTermOutlook],
    ["장기", technicalEvents.longTermOutlook],
  ] as const;
  const scores = outlooks
    .map(([, outlook]) => toNumber(outlook?.score))
    .filter((score): score is number => score !== undefined);
  const averageScore =
    scores.length > 0
      ? Number(
          (
            scores.reduce((sum, score) => sum + score, 0) / scores.length
          ).toFixed(2)
        )
      : undefined;
  const readableOutlooks = outlooks
    .filter(([, outlook]) => outlook)
    .map(
      ([label, outlook]) =>
        `${label}: ${translateFinancialTerm(outlook.direction)}${outlook.score !== undefined ? ` ${outlook.score}` : ""}`
    );

  return {
    averageScore,
    outlooks: readableOutlooks,
    summary:
      averageScore === undefined
        ? "추세 데이터가 제한적입니다."
        : `평균 추세 점수 ${averageScore.toFixed(2)}입니다.`,
  };
}

function buildInsiderTransactions(holders: any) {
  const holderRows = holders?.insiderHolders?.holders || [];
  if (!Array.isArray(holderRows)) return [];
  return holderRows
    .map((holder: any) =>
      compact([
        holder.name,
        holder.transactionDescription,
        formatValue(holder.latestTransDate),
      ]).join(" · ")
    )
    .filter(Boolean)
    .slice(0, 5);
}

function buildFilings(secFilings: any) {
  const filings = secFilings?.secFilings?.filings || secFilings?.filings || [];
  if (!Array.isArray(filings)) return [];
  return filings
    .map((filing: any) =>
      compact([filing.type, filing.title, filing.date]).join(" · ")
    )
    .filter(Boolean)
    .slice(0, 5);
}

function pushEvidence(
  metrics: GuidanceEvidenceMetric[],
  metric: GuidanceEvidenceMetric | null
) {
  if (metric && metric.value.trim()) metrics.push(metric);
}

function buildGuidanceEvidence(profile: any): GuidanceEvidenceMetric[] {
  const metrics: GuidanceEvidenceMetric[] = [];
  const financialData = profile?.financialData || {};
  const currency = financialData.financialCurrency || "USD";
  const latestEarnings = Array.isArray(profile?.earningsHistory?.history)
    ? profile.earningsHistory.history.find(
        (row: any) => toNumber(row?.epsActual) !== undefined
      )
    : null;

  const epsValue = formatSmallCurrency(
    latestEarnings?.epsActual,
    latestEarnings?.currency || currency
  );
  pushEvidence(
    metrics,
    epsValue
      ? {
          label: "최근 EPS",
          value: epsValue,
          comparison:
            compact([
              formatSmallCurrency(
                latestEarnings?.epsEstimate,
                latestEarnings?.currency || currency
              )
                ? `예상 ${formatSmallCurrency(latestEarnings?.epsEstimate, latestEarnings?.currency || currency)}`
                : undefined,
              formatSignedPercent(latestEarnings?.surprisePercent)
                ? `서프라이즈 ${formatSignedPercent(latestEarnings?.surprisePercent)}`
                : undefined,
            ]).join(" · ") || undefined,
          source: "Yahoo earningsHistory",
          asOf: formatDate(latestEarnings?.quarter),
          category: "reported",
        }
      : null
  );

  const revenueValue = formatLargeCurrency(
    financialData.totalRevenue,
    currency
  );
  pushEvidence(
    metrics,
    revenueValue
      ? {
          label: "매출",
          value: revenueValue,
          comparison: formatSignedPercent(financialData.revenueGrowth)
            ? `성장률 ${formatSignedPercent(financialData.revenueGrowth)}`
            : undefined,
          source: "Yahoo financialData",
          category: "reported",
        }
      : null
  );

  const ebitdaValue = formatLargeCurrency(financialData.ebitda, currency);
  pushEvidence(
    metrics,
    ebitdaValue
      ? {
          label: "EBITDA",
          value: ebitdaValue,
          source: "Yahoo financialData",
          category: "reported",
        }
      : null
  );

  for (const [label, value] of [
    ["EBITDA 마진", financialData.ebitdaMargins],
    ["영업 마진", financialData.operatingMargins],
    ["순이익 마진", financialData.profitMargins],
  ] as const) {
    const formatted = formatSignedPercent(value);
    pushEvidence(
      metrics,
      formatted
        ? {
            label,
            value: formatted,
            source: "Yahoo financialData",
            category: "margin",
          }
        : null
    );
  }

  const currentTrend = Array.isArray(profile?.earningsTrend?.trend)
    ? profile.earningsTrend.trend.find((row: any) => row?.period === "0q") ||
      profile.earningsTrend.trend[0]
    : null;
  const revenueEstimate = currentTrend?.revenueEstimate || {};
  const forwardRevenue = formatLargeCurrency(
    revenueEstimate.avg,
    revenueEstimate.revenueCurrency || currency
  );
  pushEvidence(
    metrics,
    forwardRevenue
      ? {
          label: "다음 분기 매출 예상",
          value: forwardRevenue,
          comparison:
            compact([
              formatSignedPercent(revenueEstimate.growth)
                ? `성장률 ${formatSignedPercent(revenueEstimate.growth)}`
                : undefined,
              toNumber(revenueEstimate.numberOfAnalysts) !== undefined
                ? `애널리스트 ${toNumber(revenueEstimate.numberOfAnalysts)}명`
                : undefined,
            ]).join(" · ") || undefined,
          source: "Yahoo earningsTrend",
          asOf: formatDate(currentTrend?.endDate),
          category: "forward",
        }
      : null
  );

  const earningsEstimate = currentTrend?.earningsEstimate || {};
  const forwardEps = formatSmallCurrency(
    earningsEstimate.avg,
    earningsEstimate.earningsCurrency || currency
  );
  pushEvidence(
    metrics,
    forwardEps
      ? {
          label: "다음 분기 EPS 예상",
          value: forwardEps,
          comparison:
            toNumber(earningsEstimate.numberOfAnalysts) !== undefined
              ? `애널리스트 ${toNumber(earningsEstimate.numberOfAnalysts)}명`
              : undefined,
          source: "Yahoo earningsTrend",
          asOf: formatDate(currentTrend?.endDate),
          category: "forward",
        }
      : null
  );

  const nextEarningsDate = profile?.calendarEvents?.earnings?.earningsDate?.[0];
  const formattedDate = formatDate(nextEarningsDate);
  pushEvidence(
    metrics,
    formattedDate
      ? {
          label: "다음 실적 예정일",
          value: formattedDate,
          source: "Yahoo calendarEvents",
          category: "forward",
        }
      : null
  );

  return metrics.slice(0, 8);
}

export function generateAnalysisPack(
  input: GenerateAnalysisPackInput
): AnalysisPack {
  const symbol = input.symbol.toUpperCase();
  const profile = unwrapQuoteSummary(input.profile);
  const insights = unwrapInsights(input.insights);
  const chart = unwrapChart(input.chart);
  const holders = unwrapQuoteSummary(input.holders);
  const secFilings = unwrapQuoteSummary(input.secFilings);
  const hasFundProfile = !!profile?.fundProfile;
  const fundProfile = profile?.fundProfile || {};
  const chartMeta = chart?.meta || {};
  const assetType: AssetType =
    hasFundProfile || chartMeta.instrumentType === "ETF"
      ? "etf"
      : profile?.summaryProfile || chartMeta.instrumentType === "EQUITY"
        ? "stock"
        : "unknown";
  const keyTechnicals = insights?.instrumentInfo?.keyTechnicals || {};
  const technical = buildTechnical(insights);
  const valuation = insights?.instrumentInfo?.valuation || {};
  const recommendation = insights?.recommendation || {};
  const companySnapshot = insights?.companySnapshot?.company || {};
  const events = Array.isArray(insights?.sigDevs) ? insights.sigDevs : [];
  const bullishPoints = Array.isArray(insights?.upsell?.msBullishSummary)
    ? insights.upsell.msBullishSummary
    : [];
  const bearishPoints = Array.isArray(insights?.upsell?.msBearishSummary)
    ? insights.upsell.msBearishSummary
    : [];
  const fees = fundProfile.feesExpensesInvestment || {};
  const holdings = Array.isArray(input.etfHoldings?.holdings)
    ? input.etfHoldings.holdings
    : [];
  const etf =
    assetType === "etf"
      ? {
          expenseRatio: formatPercent(fees.annualReportExpenseRatio),
          turnover: formatPercent(fees.annualHoldingsTurnover),
          netAssets: formatAssets(fees.totalNetAssets),
          topHoldingsWeight:
            holdings.length > 0
              ? Number(
                  holdings
                    .reduce(
                      (sum: number, holding: any) =>
                        sum + (toNumber(holding.weight) || 0),
                      0
                    )
                    .toFixed(2)
                )
              : undefined,
          holdings: holdings.slice(0, 10).map((holding: any) => ({
            symbol: holding.symbol,
            name: holding.name,
            weight: toNumber(holding.weight),
          })),
          source: input.etfHoldings?.source,
          asOf: input.etfHoldings?.asOfDate,
        }
      : undefined;

  const price = {
    current: toNumber(
      chartMeta.regularMarketPrice || profile?.price?.regularMarketPrice
    ),
    fiftyTwoWeekHigh: toNumber(chartMeta.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: toNumber(chartMeta.fiftyTwoWeekLow),
    support: toNumber(keyTechnicals.support),
    resistance: toNumber(keyTechnicals.resistance),
    stopLoss: toNumber(keyTechnicals.stopLoss),
  };

  const valuationSummary =
    compact([
      valuation.description
        ? `밸류에이션: ${translateFinancialTerm(valuation.description)}`
        : undefined,
      valuation.discount ? `할인율 ${valuation.discount}` : undefined,
      valuation.relativeValue
        ? `상대가치 ${translateFinancialTerm(valuation.relativeValue)}`
        : undefined,
      recommendation.rating
        ? `애널리스트 ${translateFinancialTerm(recommendation.rating)}`
        : undefined,
    ]).join(" · ") || "밸류에이션 데이터가 제한적입니다.";

  const governanceSignals = compact([
    companySnapshot.innovativeness !== undefined
      ? `혁신 ${formatScore(companySnapshot.innovativeness)}`
      : undefined,
    companySnapshot.hiring !== undefined
      ? `채용 ${formatScore(companySnapshot.hiring)}`
      : undefined,
    companySnapshot.sustainability !== undefined
      ? `지속가능성 ${formatScore(companySnapshot.sustainability)}`
      : undefined,
    companySnapshot.insiderSentiments !== undefined
      ? `내부자 심리 ${formatScore(companySnapshot.insiderSentiments)}`
      : undefined,
  ]);

  const latestFilings = buildFilings(secFilings);
  const insiderTransactions = buildInsiderTransactions(holders);
  const displayName =
    profile?.price?.shortName ||
    profile?.price?.longName ||
    chartMeta.shortName ||
    chartMeta.longName ||
    symbol;
  const guidanceEvidence =
    assetType === "stock" ? buildGuidanceEvidence(profile) : [];

  const pack: AnalysisPack = {
    symbol,
    asset: {
      assetType,
      displayName,
      sector: profile?.summaryProfile?.sector,
      industry: profile?.summaryProfile?.industry,
      fundFamily: fundProfile.family,
      fundCategory: fundProfile.categoryName,
    },
    price,
    technical,
    valuation: {
      summary: valuationSummary,
      rating: recommendation.rating
        ? translateFinancialTerm(recommendation.rating)
        : undefined,
      targetPrice: toNumber(recommendation.targetPrice),
      analystCount: toNumber(recommendation.numberOfAnalysts),
    },
    news: {
      events: events
        .map((event: any) => ({
          headline: String(event.headline || ""),
          date: event.date,
        }))
        .filter((event: { headline: string; date?: string }) => event.headline)
        .slice(0, 8),
      bullishPoints: bullishPoints
        .filter((point: unknown): point is string => typeof point === "string")
        .slice(0, 5),
      bearishPoints: bearishPoints
        .filter((point: unknown): point is string => typeof point === "string")
        .slice(0, 5),
    },
    guidance: {
      evidence: guidanceEvidence,
    },
    governance: {
      qualitySignals: governanceSignals,
      insiderTransactions,
    },
    filings: {
      latest: latestFilings,
    },
    etf,
    tabData: {
      overview: {
        highlights: compact([
          displayName,
          profile?.summaryProfile?.sector,
          profile?.summaryProfile?.industry,
          fundProfile.categoryName,
        ]),
      },
      technical: {
        highlights: compact([
          technical.summary,
          price.support ? `지지선 ${price.support}` : undefined,
          price.resistance ? `저항선 ${price.resistance}` : undefined,
        ]),
      },
      financial: {
        highlights:
          assetType === "etf"
            ? compact([
                etf?.expenseRatio ? `총보수율 ${etf.expenseRatio}` : undefined,
                etf?.netAssets ? `AUM ${etf.netAssets}` : undefined,
              ])
            : compact([
                valuationSummary,
                recommendation.targetPrice
                  ? `목표가 ${recommendation.targetPrice}`
                  : undefined,
              ]),
      },
      guidance: {
        highlights: compact([
          ...guidanceEvidence
            .slice(0, 2)
            .map(metric => `${metric.label}: ${metric.value}`),
          ...bullishPoints.slice(0, 2),
          ...bearishPoints.slice(0, 2),
        ]).map(translateFinancialText),
      },
      filings: { highlights: latestFilings },
      etf: {
        highlights: compact([
          fundProfile.family,
          fundProfile.categoryName,
          etf?.topHoldingsWeight !== undefined
            ? `상위 ${etf.holdings.length}개 비중 ${etf.topHoldingsWeight.toFixed(1)}%`
            : undefined,
        ]),
      },
      sentiment: {
        highlights: compact([
          ...events
            .slice(0, 3)
            .map((event: { headline?: string }) => event.headline),
          ...bullishPoints.slice(0, 1),
          ...bearishPoints.slice(0, 1),
        ]).map(translateFinancialText),
      },
    },
    sources: [
      source("Yahoo profile", profile),
      source("Yahoo insights", insights),
      source("Yahoo chart", chart),
      source("Yahoo holders", holders),
      source("SEC filings", secFilings),
      ...(assetType === "etf"
        ? [
            source(
              "ETF holdings",
              input.etfHoldings,
              input.etfHoldings?.asOfDate
            ),
          ]
        : []),
    ],
  };

  return pack;
}
