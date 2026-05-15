import type {
  AnalysisMetrics,
  FinancialMetric,
  MetricFreshness,
  MetricGroup,
  MetricSource,
  MetricUnavailableReason,
} from "@shared/analysisMetrics";

type AssetType = AnalysisMetrics["assetType"];

interface BuildAnalysisMetricsInput {
  assetType: AssetType;
  profile: any;
  chart: any;
  etfHoldings: any;
  generatedAt: string;
}

interface MetricDefinition {
  id: string;
  labelKo: string;
  descriptionKo: string;
  source: MetricSource;
  sourceData: unknown;
  value: unknown;
  format: (value: unknown) => string | undefined;
}

interface MetricCandidate {
  sourceData: unknown;
  value: unknown;
  source: MetricSource;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    return toNumber((value as { raw?: unknown }).raw);
  }
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

function pickCandidate(candidates: MetricCandidate[]) {
  return (
    candidates.find(
      candidate =>
        candidate.sourceData && toNumber(candidate.value) !== undefined
    ) ||
    candidates.find(candidate => candidate.sourceData) ||
    candidates[0]
  );
}

function formatNumber(value: unknown, digits = 2) {
  const numeric = toNumber(value);
  if (numeric === undefined) return undefined;
  const rounded = numeric.toFixed(digits);
  return rounded.replace(/\.?0+$/, "");
}

function formatPercent(value: unknown) {
  const formatted = formatValue(value);
  if (formatted) return formatted;
  const numeric = toNumber(value);
  if (numeric === undefined) return undefined;
  const percent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  return `${formatNumber(percent, 2)}%`;
}

function formatRatioPercent(value: unknown) {
  const formatted = formatValue(value);
  if (formatted) return formatted;
  const numeric = toNumber(value);
  if (numeric === undefined) return undefined;
  return `${formatNumber(numeric * 100, 2)}%`;
}

function formatLargeCurrency(value: unknown, currency = "USD") {
  const numeric = toNumber(value);
  if (numeric === undefined) return undefined;
  const prefix = currency === "USD" ? "$" : `${currency} `;
  const abs = Math.abs(numeric);
  if (abs >= 1_000_000_000_000) {
    return `${prefix}${(numeric / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (abs >= 1_000_000_000) {
    return `${prefix}${(numeric / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `${prefix}${(numeric / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) return `${prefix}${(numeric / 1_000).toFixed(1)}K`;
  return `${prefix}${numeric.toFixed(2)}`;
}

function formatFundAssets(value: unknown) {
  const numeric = toNumber(value);
  if (numeric === undefined) return undefined;
  return formatLargeCurrency(numeric * 1_000_000);
}

function checkedAt(generatedAt: string): MetricFreshness {
  return {
    kind: "checked_at",
    checkedAt: generatedAt,
    note: "응답 확인 시각입니다. 원천 API 또는 로컬 캐시의 실제 작성 시각과 다를 수 있습니다.",
  };
}

function asOf(asOfDate: unknown): MetricFreshness | undefined {
  const formatted = formatValue(asOfDate);
  if (formatted) return { kind: "as_of", asOf: formatted };
  if (typeof asOfDate === "string" && asOfDate.trim()) {
    return { kind: "as_of", asOf: asOfDate };
  }
  return undefined;
}

function unavailableDetail(reason: MetricUnavailableReason) {
  if (reason === "missing_source")
    return "원천 데이터가 없어 확인할 수 없습니다.";
  if (reason === "missing_freshness")
    return "기준일이 없어 확인 불가로 표시합니다.";
  if (reason === "missing_calculation")
    return "계산에 필요한 구조화 필드가 부족합니다.";
  if (reason === "weak_prose_source") {
    return "뉴스나 해설 문장만으로는 검증된 숫자로 쓰지 않습니다.";
  }
  if (reason === "not_applicable")
    return "이 자산 유형에는 적용하지 않는 지표입니다.";
  return "구조화된 값이 없어 확인할 수 없습니다.";
}

function buildMetric(
  definition: MetricDefinition,
  freshness: MetricFreshness
): FinancialMetric {
  if (!definition.sourceData) {
    return {
      id: definition.id,
      labelKo: definition.labelKo,
      descriptionKo: definition.descriptionKo,
      status: "unavailable",
      unavailableReason: "missing_source",
      unavailableDetailKo: unavailableDetail("missing_source"),
      expectedSource: definition.source,
    };
  }

  const value = definition.format(definition.value);
  if (!value) {
    return {
      id: definition.id,
      labelKo: definition.labelKo,
      descriptionKo: definition.descriptionKo,
      status: "unavailable",
      unavailableReason: "missing_value",
      unavailableDetailKo: unavailableDetail("missing_value"),
      expectedSource: definition.source,
      freshness,
    };
  }

  return {
    id: definition.id,
    labelKo: definition.labelKo,
    descriptionKo: definition.descriptionKo,
    status: "available",
    value,
    rawValue: toNumber(definition.value),
    source: definition.source,
    freshness,
  };
}

function summarize(
  groups: MetricGroup[],
  assetType: AssetType,
  generatedAt: string
) {
  const metrics = groups.flatMap(group => group.metrics);
  const available = metrics.filter(
    metric => metric.status === "available"
  ).length;
  const total = metrics.length;
  return {
    assetType,
    generatedAt,
    groups,
    dataQuality: {
      available,
      unavailable: total - available,
      total,
    },
  };
}

function stockMetrics(
  profile: any,
  chart: any,
  generatedAt: string
): AnalysisMetrics {
  const financialData = profile?.financialData;
  const summaryDetail = profile?.summaryDetail;
  const defaultKeyStatistics = profile?.defaultKeyStatistics;
  const price = profile?.price;
  const chartMeta = chart?.meta;
  const currency = financialData?.financialCurrency || price?.currency || "USD";
  const freshness = checkedAt(generatedAt);
  const per = pickCandidate([
    {
      sourceData: defaultKeyStatistics,
      value: defaultKeyStatistics?.trailingPE,
      source: {
        name: "Yahoo quoteSummary.defaultKeyStatistics",
        basis: "trailingPE",
      },
    },
    {
      sourceData: summaryDetail,
      value: summaryDetail?.trailingPE,
      source: {
        name: "Yahoo quoteSummary.summaryDetail",
        basis: "trailingPE",
      },
    },
  ]);
  const pbr = pickCandidate([
    {
      sourceData: defaultKeyStatistics,
      value: defaultKeyStatistics?.priceToBook,
      source: {
        name: "Yahoo quoteSummary.defaultKeyStatistics",
        basis: "priceToBook",
      },
    },
    {
      sourceData: summaryDetail,
      value: summaryDetail?.priceToBook,
      source: {
        name: "Yahoo quoteSummary.summaryDetail",
        basis: "priceToBook",
      },
    },
  ]);
  const marketCap = pickCandidate([
    {
      sourceData: summaryDetail,
      value: summaryDetail?.marketCap,
      source: {
        name: "Yahoo quoteSummary.summaryDetail",
        basis: "marketCap",
      },
    },
    {
      sourceData: price,
      value: price?.marketCap,
      source: {
        name: "Yahoo quoteSummary.price",
        basis: "marketCap",
      },
    },
  ]);
  const roe = pickCandidate([
    {
      sourceData: financialData,
      value: financialData?.returnOnEquity,
      source: {
        name: "Yahoo quoteSummary.financialData",
        basis: "returnOnEquity",
      },
    },
    {
      sourceData: defaultKeyStatistics,
      value: defaultKeyStatistics?.returnOnEquity,
      source: {
        name: "Yahoo quoteSummary.defaultKeyStatistics",
        basis: "returnOnEquity",
      },
    },
  ]);
  const beta = pickCandidate([
    {
      sourceData: summaryDetail,
      value: summaryDetail?.beta,
      source: {
        name: "Yahoo quoteSummary.summaryDetail",
        basis: "beta",
      },
    },
    {
      sourceData: defaultKeyStatistics,
      value: defaultKeyStatistics?.beta,
      source: {
        name: "Yahoo quoteSummary.defaultKeyStatistics",
        basis: "beta",
      },
    },
  ]);

  const groups: MetricGroup[] = [
    {
      id: "valuation",
      labelKo: "가치 평가",
      descriptionKo:
        "가격이 이익, 장부가, 규모 대비 어느 정도인지 보는 기본 지표입니다.",
      metrics: [
        buildMetric(
          {
            id: "per",
            labelKo: "PER",
            descriptionKo:
              "주가를 주당순이익으로 나눈 값입니다. 낮을수록 싸다고 단정하지 않고 성장성과 함께 봅니다.",
            source: per.source,
            sourceData: per.sourceData,
            value: per.value,
            format: value => {
              const formatted = formatNumber(value, 2);
              return formatted ? `${formatted}배` : undefined;
            },
          },
          freshness
        ),
        buildMetric(
          {
            id: "pbr",
            labelKo: "PBR",
            descriptionKo:
              "주가를 주당순자산으로 나눈 값입니다. 자산가치 대비 가격을 볼 때 씁니다.",
            source: pbr.source,
            sourceData: pbr.sourceData,
            value: pbr.value,
            format: value => {
              const formatted = formatNumber(value, 2);
              return formatted ? `${formatted}배` : undefined;
            },
          },
          freshness
        ),
        buildMetric(
          {
            id: "marketCap",
            labelKo: "시가총액",
            descriptionKo: "시장 전체가 평가하는 회사의 지분가치입니다.",
            source: marketCap.source,
            sourceData: marketCap.sourceData,
            value: marketCap.value,
            format: value => formatLargeCurrency(value, currency),
          },
          freshness
        ),
        buildMetric(
          {
            id: "eps",
            labelKo: "EPS",
            descriptionKo: "주당순이익입니다. PER 계산의 핵심 입력값입니다.",
            source: {
              name: "Yahoo quoteSummary.defaultKeyStatistics",
              basis: "trailingEps",
            },
            sourceData: defaultKeyStatistics,
            value: defaultKeyStatistics?.trailingEps,
            format: value => {
              const formatted = formatNumber(value, 2);
              return formatted
                ? `${currency === "USD" ? "$" : `${currency} `}${formatted}`
                : undefined;
            },
          },
          freshness
        ),
      ],
    },
    {
      id: "profitability",
      labelKo: "수익성",
      descriptionKo:
        "회사가 매출과 자본을 얼마나 효율적으로 이익으로 바꾸는지 봅니다.",
      metrics: [
        buildMetric(
          {
            id: "roe",
            labelKo: "ROE",
            descriptionKo:
              "자기자본 대비 순이익률입니다. 높은 숫자는 자본 효율성이 좋다는 신호일 수 있습니다.",
            source: roe.source,
            sourceData: roe.sourceData,
            value: roe.value,
            format: formatRatioPercent,
          },
          freshness
        ),
        buildMetric(
          {
            id: "operatingMargin",
            labelKo: "영업이익률",
            descriptionKo: "매출에서 영업활동으로 남기는 이익 비율입니다.",
            source: {
              name: "Yahoo quoteSummary.financialData",
              basis: "operatingMargins",
            },
            sourceData: financialData,
            value: financialData?.operatingMargins,
            format: formatRatioPercent,
          },
          freshness
        ),
        buildMetric(
          {
            id: "netMargin",
            labelKo: "순이익률",
            descriptionKo: "최종 순이익이 매출에서 차지하는 비율입니다.",
            source: {
              name: "Yahoo quoteSummary.financialData",
              basis: "profitMargins",
            },
            sourceData: financialData,
            value: financialData?.profitMargins,
            format: formatRatioPercent,
          },
          freshness
        ),
        buildMetric(
          {
            id: "freeCashFlow",
            labelKo: "FCF",
            descriptionKo:
              "영업과 투자 후 회사가 자유롭게 쓸 수 있는 현금흐름입니다.",
            source: {
              name: "Yahoo quoteSummary.financialData",
              basis: "freeCashflow",
            },
            sourceData: financialData,
            value: financialData?.freeCashflow,
            format: value => formatLargeCurrency(value, currency),
          },
          freshness
        ),
      ],
    },
    {
      id: "growth",
      labelKo: "성장",
      descriptionKo:
        "매출과 이익의 최근 성장 방향을 구조화된 필드로만 표시합니다.",
      metrics: [
        buildMetric(
          {
            id: "revenueGrowth",
            labelKo: "매출 성장률",
            descriptionKo:
              "최근 매출이 전년 또는 비교기간 대비 얼마나 늘었는지 보는 지표입니다.",
            source: {
              name: "Yahoo quoteSummary.financialData",
              basis: "revenueGrowth",
            },
            sourceData: financialData,
            value: financialData?.revenueGrowth,
            format: formatRatioPercent,
          },
          freshness
        ),
        buildMetric(
          {
            id: "profitGrowth",
            labelKo: "이익 성장률",
            descriptionKo:
              "이익 성장의 방향을 보는 지표입니다. 경기와 일회성 요인에 민감합니다.",
            source: {
              name: "Yahoo quoteSummary.financialData",
              basis: "earningsGrowth",
            },
            sourceData: financialData,
            value: financialData?.earningsGrowth,
            format: formatRatioPercent,
          },
          freshness
        ),
      ],
    },
    {
      id: "risk",
      labelKo: "위험/가격 범위",
      descriptionKo:
        "재무 레버리지와 가격 변동성을 볼 때 쓰는 기본 참고값입니다.",
      metrics: [
        buildMetric(
          {
            id: "debtRatio",
            labelKo: "부채비율",
            descriptionKo:
              "자기자본 대비 부채 수준입니다. 높을수록 금리와 경기 변화에 민감할 수 있습니다.",
            source: {
              name: "Yahoo quoteSummary.financialData",
              basis: "debtToEquity",
            },
            sourceData: financialData,
            value: financialData?.debtToEquity,
            format: formatPercent,
          },
          freshness
        ),
        buildMetric(
          {
            id: "beta",
            labelKo: "베타",
            descriptionKo:
              "시장 대비 주가 변동 민감도입니다. 1보다 크면 시장보다 더 크게 움직이는 편입니다.",
            source: beta.source,
            sourceData: beta.sourceData,
            value: beta.value,
            format: value => formatNumber(value, 2),
          },
          freshness
        ),
        buildMetric(
          {
            id: "fiftyTwoWeekHigh",
            labelKo: "52주 고가",
            descriptionKo: "최근 52주 동안 기록한 최고 가격입니다.",
            source: {
              name: "Yahoo chart.meta",
              basis: "fiftyTwoWeekHigh",
            },
            sourceData: chartMeta,
            value: chartMeta?.fiftyTwoWeekHigh,
            format: value => formatLargeCurrency(value, currency),
          },
          freshness
        ),
        buildMetric(
          {
            id: "fiftyTwoWeekLow",
            labelKo: "52주 저가",
            descriptionKo: "최근 52주 동안 기록한 최저 가격입니다.",
            source: {
              name: "Yahoo chart.meta",
              basis: "fiftyTwoWeekLow",
            },
            sourceData: chartMeta,
            value: chartMeta?.fiftyTwoWeekLow,
            format: value => formatLargeCurrency(value, currency),
          },
          freshness
        ),
      ],
    },
    {
      id: "shareholder",
      labelKo: "주주 환원",
      descriptionKo: "배당을 통해 주주에게 현금이 돌아오는 정도를 봅니다.",
      metrics: [
        buildMetric(
          {
            id: "dividendYield",
            labelKo: "배당수익률",
            descriptionKo: "현재 주가 대비 연간 배당금 비율입니다.",
            source: {
              name: "Yahoo quoteSummary.summaryDetail",
              basis: "dividendYield",
            },
            sourceData: summaryDetail,
            value: summaryDetail?.dividendYield,
            format: formatRatioPercent,
          },
          freshness
        ),
      ],
    },
  ];

  return summarize(groups, "stock", generatedAt);
}

function unavailableEtfMetric(
  id: string,
  labelKo: string,
  descriptionKo: string,
  reason: MetricUnavailableReason,
  expectedSource?: MetricSource
): FinancialMetric {
  return {
    id,
    labelKo,
    descriptionKo,
    status: "unavailable",
    unavailableReason: reason,
    unavailableDetailKo: unavailableDetail(reason),
    expectedSource,
  };
}

function etfMetrics(
  profile: any,
  chart: any,
  etfHoldings: any,
  generatedAt: string
): AnalysisMetrics {
  const fundProfile = profile?.fundProfile;
  const fees = fundProfile?.feesExpensesInvestment;
  const chartMeta = chart?.meta;
  const holdings = Array.isArray(etfHoldings?.holdings)
    ? etfHoldings.holdings
    : [];
  const holdingsFreshness = asOf(etfHoldings?.asOfDate);
  const freshness = checkedAt(generatedAt);
  const holdingsSource = {
    name: etfHoldings?.source
      ? `ETF holdings (${etfHoldings.source})`
      : "ETF holdings",
    basis: "top 10 holdings weight with asOfDate",
  };

  const topHoldingsWeight =
    holdings.length > 0
      ? holdings.reduce(
          (sum: number, holding: any) => sum + (toNumber(holding.weight) || 0),
          0
        )
      : undefined;

  const topHoldingsMetric =
    holdings.length === 0
      ? unavailableEtfMetric(
          "topHoldingsWeight",
          "상위 보유종목 비중",
          "ETF 상위 보유종목이 전체에서 차지하는 비율입니다.",
          etfHoldings ? "missing_value" : "missing_source",
          holdingsSource
        )
      : holdingsFreshness
        ? {
            id: "topHoldingsWeight",
            labelKo: "상위 보유종목 비중",
            descriptionKo: "ETF 상위 보유종목이 전체에서 차지하는 비율입니다.",
            status: "available" as const,
            value: `${formatNumber(topHoldingsWeight, 2)}%`,
            rawValue: topHoldingsWeight,
            source: holdingsSource,
            freshness: holdingsFreshness,
          }
        : unavailableEtfMetric(
            "topHoldingsWeight",
            "상위 보유종목 비중",
            "ETF 상위 보유종목이 전체에서 차지하는 비율입니다.",
            "missing_freshness",
            holdingsSource
          );

  const holdingsCountMetric =
    holdings.length > 0 && holdingsFreshness
      ? {
          id: "holdingsCount",
          labelKo: "표시 보유종목 수",
          descriptionKo: "현재 수집된 ETF 상위 보유종목 수입니다.",
          status: "available" as const,
          value: `${holdings.length}개`,
          rawValue: holdings.length,
          source: holdingsSource,
          freshness: holdingsFreshness,
        }
      : unavailableEtfMetric(
          "holdingsCount",
          "표시 보유종목 수",
          "현재 수집된 ETF 상위 보유종목 수입니다.",
          holdings.length > 0 ? "missing_freshness" : "missing_value",
          holdingsSource
        );

  const groups: MetricGroup[] = [
    {
      id: "cost",
      labelKo: "비용/규모",
      descriptionKo: "ETF를 오래 보유할 때 비용과 규모를 먼저 확인합니다.",
      metrics: [
        buildMetric(
          {
            id: "expenseRatio",
            labelKo: "총보수율",
            descriptionKo: "ETF를 보유하면서 매년 부담하는 비용 비율입니다.",
            source: {
              name: "Yahoo quoteSummary.fundProfile",
              basis: "feesExpensesInvestment.annualReportExpenseRatio",
            },
            sourceData: fees,
            value: fees?.annualReportExpenseRatio,
            format: formatPercent,
          },
          freshness
        ),
        buildMetric(
          {
            id: "turnover",
            labelKo: "회전율",
            descriptionKo:
              "보유 종목이 얼마나 자주 바뀌는지 보여주는 지표입니다.",
            source: {
              name: "Yahoo quoteSummary.fundProfile",
              basis: "feesExpensesInvestment.annualHoldingsTurnover",
            },
            sourceData: fees,
            value: fees?.annualHoldingsTurnover,
            format: formatPercent,
          },
          freshness
        ),
        buildMetric(
          {
            id: "netAssets",
            labelKo: "순자산",
            descriptionKo: "ETF가 운용 중인 전체 자산 규모입니다.",
            source: {
              name: "Yahoo quoteSummary.fundProfile",
              basis: "feesExpensesInvestment.totalNetAssets",
            },
            sourceData: fees,
            value: fees?.totalNetAssets,
            format: formatFundAssets,
          },
          freshness
        ),
      ],
    },
    {
      id: "holdings",
      labelKo: "구성",
      descriptionKo: "ETF가 실제로 무엇을 담고 있는지 확인합니다.",
      metrics: [topHoldingsMetric, holdingsCountMetric],
    },
    {
      id: "range",
      labelKo: "가격 범위",
      descriptionKo: "최근 52주 가격 범위로 현재 위치를 참고합니다.",
      metrics: [
        buildMetric(
          {
            id: "fiftyTwoWeekHigh",
            labelKo: "52주 고가",
            descriptionKo: "최근 52주 동안 기록한 최고 가격입니다.",
            source: {
              name: "Yahoo chart.meta",
              basis: "fiftyTwoWeekHigh",
            },
            sourceData: chartMeta,
            value: chartMeta?.fiftyTwoWeekHigh,
            format: value => formatLargeCurrency(value),
          },
          freshness
        ),
        buildMetric(
          {
            id: "fiftyTwoWeekLow",
            labelKo: "52주 저가",
            descriptionKo: "최근 52주 동안 기록한 최저 가격입니다.",
            source: {
              name: "Yahoo chart.meta",
              basis: "fiftyTwoWeekLow",
            },
            sourceData: chartMeta,
            value: chartMeta?.fiftyTwoWeekLow,
            format: value => formatLargeCurrency(value),
          },
          freshness
        ),
      ],
    },
  ];

  return summarize(groups, "etf", generatedAt);
}

export function buildAnalysisMetrics(
  input: BuildAnalysisMetricsInput
): AnalysisMetrics {
  if (input.assetType === "stock") {
    return stockMetrics(input.profile, input.chart, input.generatedAt);
  }
  if (input.assetType === "etf") {
    return etfMetrics(
      input.profile,
      input.chart,
      input.etfHoldings,
      input.generatedAt
    );
  }
  return summarize([], input.assetType, input.generatedAt);
}
