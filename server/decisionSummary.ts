import { translateFinancialTerm } from "@shared/financialTerms";

export type DecisionState = "interest" | "wait" | "caution" | "unavailable";
export type AssetType = "stock" | "etf" | "unknown";

export interface DecisionReason {
  category:
    | "trend"
    | "valuation"
    | "risk"
    | "fundamental"
    | "etf_exposure"
    | "data_quality";
  label: string;
  detail: string;
  evidence?: string;
}

export interface DecisionSummary {
  symbol: string;
  assetType: AssetType;
  state: DecisionState;
  labelKo: "관심" | "관망" | "주의" | "판단 보류";
  confidence: "높음" | "중간" | "낮음";
  headline: string;
  reasons: DecisionReason[];
  riskNote: string;
  priceZones?: {
    interestBelow?: number;
    invalidationBelow?: number;
    riskManagementNear?: number;
    source: "yahoo_keyTechnicals" | "derived_chart" | "unavailable";
  };
  sources: Array<{
    name: string;
    status: "used" | "fallback" | "unavailable";
    asOf?: string;
  }>;
  disclaimer: string;
}

interface GenerateDecisionSummaryInput {
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
  if (value && typeof value === "object") {
    const fmt = (value as { fmt?: unknown }).fmt;
    if (typeof fmt === "string" && fmt.trim()) return fmt;
  }
  return undefined;
}

function formatPercent(raw: unknown, fmt: unknown) {
  if (typeof fmt === "string" && fmt.trim()) return fmt;
  const value = toNumber(raw);
  if (value === undefined) return undefined;
  return `${(value * 100).toFixed(2)}%`;
}

function formatAssets(raw: unknown) {
  const value = toNumber(raw);
  if (value === undefined) return undefined;
  const dollars = value * 1_000_000;
  if (dollars >= 1_000_000_000_000)
    return `$${(dollars / 1_000_000_000_000).toFixed(1)}T`;
  if (dollars >= 1_000_000_000)
    return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  return `$${dollars.toFixed(0)}`;
}

function detectAssetType(profile: any, chart: any): AssetType {
  if (profile?.fundProfile || chart?.meta?.instrumentType === "ETF")
    return "etf";
  if (profile?.summaryProfile || chart?.meta?.instrumentType === "EQUITY")
    return "stock";
  return "unknown";
}

function stateLabel(state: DecisionState): DecisionSummary["labelKo"] {
  if (state === "interest") return "관심";
  if (state === "wait") return "관망";
  if (state === "caution") return "주의";
  return "판단 보류";
}

function buildPriceZones(
  insights: any,
  chart: any
): DecisionSummary["priceZones"] {
  const keyTechnicals = insights?.instrumentInfo?.keyTechnicals || {};
  const support = toNumber(keyTechnicals.support);
  const stopLoss = toNumber(keyTechnicals.stopLoss);
  const resistance = toNumber(keyTechnicals.resistance);

  if (support || stopLoss || resistance) {
    return {
      interestBelow: support,
      invalidationBelow: stopLoss,
      riskManagementNear: resistance,
      source: "yahoo_keyTechnicals",
    };
  }

  return { source: "unavailable" };
}

function scoreTrend(insights: any) {
  const technicalEvents = insights?.instrumentInfo?.technicalEvents || {};
  const outlooks = [
    technicalEvents.shortTermOutlook,
    technicalEvents.intermediateTermOutlook,
    technicalEvents.longTermOutlook,
  ].filter(Boolean);

  const scores = outlooks
    .map(outlook => toNumber(outlook?.score))
    .filter((score): score is number => score !== undefined);

  if (scores.length === 0) return { score: 0, evidence: "추세 데이터 부족" };

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return {
    score: average,
    evidence: `단기/중기/장기 평균 추세 점수 ${average.toFixed(1)}`,
  };
}

function scoreValuation(insights: any) {
  const valuation = insights?.instrumentInfo?.valuation || {};
  const description = String(valuation.description || "").toLowerCase();
  if (description.includes("undervalued")) {
    return {
      score: 1,
      evidence: `밸류에이션: ${translateFinancialTerm(valuation.description)}`,
    };
  }
  if (description.includes("overvalued")) {
    return {
      score: -1,
      evidence: `밸류에이션: ${translateFinancialTerm(valuation.description)}`,
    };
  }
  return {
    score: 0,
    evidence: valuation.description
      ? `밸류에이션: ${translateFinancialTerm(valuation.description)}`
      : "밸류에이션 데이터 부족",
  };
}

function scoreRecommendation(insights: any) {
  const recommendation = insights?.recommendation || {};
  const rating = String(recommendation.rating || "").toLowerCase();
  if (rating.includes("buy") || rating.includes("outperform")) {
    return {
      score: 1,
      evidence: `애널리스트 의견: ${translateFinancialTerm(recommendation.rating)}`,
    };
  }
  if (rating.includes("sell") || rating.includes("underperform")) {
    return {
      score: -1,
      evidence: `애널리스트 의견: ${translateFinancialTerm(recommendation.rating)}`,
    };
  }
  return {
    score: 0,
    evidence: recommendation.rating
      ? `애널리스트 의견: ${translateFinancialTerm(recommendation.rating)}`
      : "애널리스트 의견 부족",
  };
}

function scoreRisk(insights: any) {
  const company = insights?.companySnapshot?.company || {};
  const insiderSentiments = toNumber(company.insiderSentiments);
  const events = insights?.sigDevs || [];
  let score = 0;
  const signals: string[] = [];

  if (insiderSentiments !== undefined && insiderSentiments < 0.5) {
    score -= 1;
    signals.push("내부자 심리 약함");
  }

  if (events.length > 0) {
    score -= 0.25;
    signals.push(`최근 이벤트 ${events.length}건`);
  }

  return {
    score,
    evidence:
      signals.length > 0 ? signals.join(", ") : "특별한 리스크 신호 부족",
  };
}

function clampReasons(reasons: DecisionReason[]) {
  const fallback: DecisionReason[] = [
    {
      category: "data_quality",
      label: "데이터 확인 필요",
      detail: "일부 판단 근거가 부족해 보수적으로 확인해야 합니다.",
      evidence: "partial-data",
    },
  ];
  return [...reasons, ...fallback].slice(0, Math.max(3, reasons.length));
}

function buildStockSummary(
  symbol: string,
  insights: any,
  chart: any,
  sources: DecisionSummary["sources"]
): DecisionSummary {
  if (!insights) {
    return {
      symbol,
      assetType: "stock",
      state: "unavailable",
      labelKo: "판단 보류",
      confidence: "낮음",
      headline: "판단에 필요한 데이터가 부족합니다.",
      reasons: clampReasons([
        {
          category: "data_quality",
          label: "인사이트 데이터 없음",
          detail:
            "추세, 밸류에이션, 애널리스트 의견을 충분히 확인하지 못했습니다.",
          evidence: "Yahoo insights unavailable",
        },
      ]),
      riskNote: "데이터가 부족할 때는 가격 기준보다 추가 확인이 더 중요합니다.",
      priceZones: buildPriceZones(insights, chart),
      sources,
      disclaimer: "이 요약은 공개 데이터를 바탕으로 만든 참고 정보입니다.",
    };
  }

  const trend = scoreTrend(insights);
  const valuation = scoreValuation(insights);
  const recommendation = scoreRecommendation(insights);
  const risk = scoreRisk(insights);
  const totalScore =
    trend.score + valuation.score + recommendation.score + risk.score;
  const state: DecisionState =
    totalScore >= 1.2 ? "interest" : totalScore <= -0.8 ? "caution" : "wait";
  const confidence: DecisionSummary["confidence"] =
    Math.abs(totalScore) >= 2
      ? "높음"
      : Math.abs(totalScore) >= 1
        ? "중간"
        : "낮음";

  const reasons: DecisionReason[] = [
    {
      category: "trend",
      label:
        trend.score > 0
          ? "추세 우호적"
          : trend.score < 0
            ? "추세 부담"
            : "추세 중립",
      detail:
        trend.score > 0
          ? "기술적 흐름은 단기 판단에 긍정적입니다."
          : trend.score < 0
            ? "기술적 흐름은 아직 회복 신호가 약합니다."
            : "기술적 방향성이 뚜렷하지 않습니다.",
      evidence: trend.evidence,
    },
    {
      category: "valuation",
      label:
        valuation.score > 0
          ? "가격 부담 완화"
          : valuation.score < 0
            ? "밸류에이션 부담"
            : "가치 판단 보류",
      detail:
        valuation.score > 0
          ? "현재 평가는 상대적으로 부담이 낮은 편입니다."
          : valuation.score < 0
            ? "좋은 기업이어도 진입 가격은 신중히 봐야 합니다."
            : "가치 평가 데이터가 충분하지 않습니다.",
      evidence: valuation.evidence,
    },
    {
      category: "risk",
      label: risk.score < 0 ? "리스크 확인 필요" : "리스크 신호 제한적",
      detail:
        risk.score < 0
          ? "긍정 요인이 있어도 하방 기준을 함께 확인할 필요가 있습니다."
          : "뚜렷한 위험 신호는 제한적이지만 변동성은 계속 확인해야 합니다.",
      evidence: risk.evidence,
    },
  ];

  const priceZones = buildPriceZones(insights, chart);
  const labelKo = stateLabel(state);

  return {
    symbol,
    assetType: "stock",
    state,
    labelKo,
    confidence,
    headline: `현재는 ${labelKo}에 가까운 흐름입니다. 추세, 밸류에이션, 리스크를 함께 확인해 주세요.`,
    reasons,
    riskNote: priceZones?.invalidationBelow
      ? `$${priceZones.invalidationBelow} 아래로 내려가면 현재 판단 근거가 약해질 수 있습니다.`
      : "명확한 무효화 기준이 부족하므로 변동성이 커질 때는 추가 확인이 필요합니다.",
    priceZones,
    sources,
    disclaimer: "이 요약은 공개 데이터를 바탕으로 만든 참고 정보입니다.",
  };
}

function buildEtfSummary(
  symbol: string,
  profile: any,
  chart: any,
  etfHoldings: any,
  sources: DecisionSummary["sources"]
): DecisionSummary {
  const hasHoldingsFreshness =
    typeof etfHoldings?.asOfDate === "string" &&
    etfHoldings.asOfDate.trim().length > 0;
  const holdings =
    hasHoldingsFreshness && Array.isArray(etfHoldings?.holdings)
      ? etfHoldings.holdings
      : [];
  const hasUndatedHoldings =
    !hasHoldingsFreshness &&
    Array.isArray(etfHoldings?.holdings) &&
    etfHoldings.holdings.length > 0;
  const topWeight = holdings.reduce(
    (sum: number, holding: any) => sum + (toNumber(holding.weight) || 0),
    0
  );
  const fundProfile = profile?.fundProfile || {};
  const fees = fundProfile.feesExpensesInvestment || {};
  const expenseRaw = toNumber(fees.annualReportExpenseRatio);
  const expenseRatio = formatPercent(
    expenseRaw,
    formatValue(fees.annualReportExpenseRatio)
  );
  const turnoverRaw = toNumber(fees.annualHoldingsTurnover);
  const turnover = formatPercent(
    turnoverRaw,
    formatValue(fees.annualHoldingsTurnover)
  );
  const assets = formatAssets(fees.totalNetAssets);
  const lowCost = expenseRaw !== undefined && expenseRaw <= 0.0015;
  const highCost = expenseRaw !== undefined && expenseRaw >= 0.0075;
  const concentrated = topWeight >= 40;
  const missingCoreData = holdings.length === 0 && expenseRaw === undefined;
  const state: DecisionState = missingCoreData
    ? "unavailable"
    : holdings.length === 0 || highCost || concentrated
      ? "wait"
      : "interest";
  const labelKo = stateLabel(state);
  const headline = missingCoreData
    ? "ETF 핵심 데이터가 부족해 판단을 보류합니다."
    : state === "interest"
      ? "비용과 구성 집중도가 상대적으로 부담이 낮게 보입니다."
      : "비용이나 구성 집중도를 추가로 확인할 필요가 있습니다.";

  return {
    symbol,
    assetType: "etf",
    state,
    labelKo,
    confidence:
      holdings.length >= 3 && expenseRaw !== undefined ? "중간" : "낮음",
    headline,
    reasons: clampReasons([
      {
        category: "fundamental",
        label: lowCost
          ? "장기 비용 부담 낮음"
          : highCost
            ? "장기 비용 부담 확인"
            : expenseRatio
              ? "보수율 확인 필요"
              : "보수 데이터 부족",
        detail: expenseRatio
          ? `총보수율은 ${expenseRatio}로, 장기 보유 시 누적 비용을 먼저 확인해야 합니다.`
          : "총보수율을 확인하지 못해 장기 비용 판단이 제한됩니다.",
        evidence: "Yahoo fundProfile",
      },
      {
        category: "etf_exposure",
        label:
          holdings.length > 0 ? "구성 집중도 확인" : "구성 종목 데이터 부족",
        detail:
          holdings.length > 0
            ? `상위 ${holdings.length}개 종목 비중 합계는 약 ${topWeight.toFixed(1)}%입니다.`
            : hasUndatedHoldings
              ? "구성 종목 기준일이 없어 분산 효과 판단에 쓰지 않았습니다."
              : "구성 종목을 확인하지 못해 분산 효과 판단이 제한됩니다.",
        evidence: etfHoldings?.source || "ETF holdings unavailable",
      },
      {
        category: "risk",
        label: concentrated
          ? "집중도 주의"
          : turnover
            ? "장기 운용 안정성 확인"
            : "운용 리스크 확인",
        detail: concentrated
          ? "상위 종목 비중이 높아 특정 대형주 흐름에 민감할 수 있습니다."
          : turnover
            ? `연간 회전율은 ${turnover}이며, 낮을수록 장기 보유 관점에서 운용 변화가 적은 편입니다.`
            : "회전율이나 운용 변화 데이터를 추가로 확인하면 장기 보유 리스크 판단이 쉬워집니다.",
        evidence: assets
          ? `AUM ${assets}`
          : holdings.length > 0
            ? `top holdings ${topWeight.toFixed(1)}%`
            : "ETF risk data partial",
      },
    ]),
    riskNote:
      "ETF도 시장 하락, 보수 누적, 구성 종목 변경, 특정 섹터나 대형주 집중도에 따라 손실이 날 수 있으므로 장기 보유 전 기준일과 비용을 함께 확인해 주세요.",
    priceZones: buildPriceZones(null, chart),
    sources,
    disclaimer: "이 요약은 공개 데이터를 바탕으로 만든 참고 정보입니다.",
  };
}

export function generateDecisionSummary(
  input: GenerateDecisionSummaryInput
): DecisionSummary {
  const symbol = input.symbol.toUpperCase();
  const profile = unwrapQuoteSummary(input.profile);
  const insights = unwrapInsights(input.insights);
  const chart = unwrapChart(input.chart);
  const assetType = detectAssetType(profile, chart);
  const sources: DecisionSummary["sources"] = [
    { name: "Yahoo profile", status: profile ? "used" : "unavailable" },
    { name: "Yahoo insights", status: insights ? "used" : "unavailable" },
    { name: "Yahoo chart", status: chart ? "used" : "unavailable" },
  ];

  if (assetType === "etf") {
    const hasDatedHoldings =
      input.etfHoldings?.holdings?.length &&
      typeof input.etfHoldings?.asOfDate === "string" &&
      input.etfHoldings.asOfDate.trim().length > 0;
    sources.push({
      name: "ETF holdings",
      status: hasDatedHoldings ? "used" : "unavailable",
      asOf: hasDatedHoldings ? input.etfHoldings.asOfDate : undefined,
    });
    return buildEtfSummary(symbol, profile, chart, input.etfHoldings, sources);
  }

  sources.push({
    name: "SEC filings",
    status: input.secFilings ? "used" : "unavailable",
  });

  return buildStockSummary(symbol, insights, chart, sources);
}
