import { invokeLLM } from "./_core/llm";
import { generateAnalysisPack, type AnalysisPack } from "./analysisPack";
import { defaultCacheCoordinator } from "./cacheCoordinator";
import { createOpinionSnapshotWithPendingOutcomes, getCachedData, getLastGoodCachedData, setCachedData } from "./db";
import { OPINION_TRACKING_VERSION, selectOpinionBaselineClose } from "./opinionTracking";
import { translateFinancialTerm, translateFinancialText } from "@shared/financialTerms";
import { isTrustedQualitySectorComparison } from "@shared/qualitySectorComparison";
import type { AnalysisMetrics, MetricFreshness } from "@shared/analysisMetrics";

const CACHE_TTL_OPINION = 120; // 2 hours
const CACHE_VERSION = "_v12_metric_context";

type Signal = "매수" | "보유" | "매도";
type Confidence = "높음" | "중간" | "낮음";

interface AgentResult {
  agentName: string;
  stage: string;
  signal: Signal;
  confidence: Confidence;
  reasoning: string;
  keyPoints: string[];
}

interface FinalVerdict {
  signal: Signal;
  confidence: Confidence;
  summary: string;
  bullCase: string;
  bearCase: string;
  keyFactors: string[];
  dissent: string;
}

interface ResearchReportSection {
  title: string;
  bullets: string[];
}

interface ResearchReport {
  thesis: string;
  sections: ResearchReportSection[];
  dataQuality: string[];
  nextChecks: string[];
}

interface MultiAgentOpinion {
  generatedAt: string;
  opinionVersion: string;
  agents: AgentResult[];
  workflow: {
    source: "TradingAgents-style research report";
    stages: string[];
  };
  finalVerdict: FinalVerdict;
  researchReport: ResearchReport;
  disclaimer: string;
}

type UnwrappedData = ReturnType<typeof unwrapData>;

function unwrapData(profileData: any, insightsData: any, chartData?: any) {
  const profile = profileData?.quoteSummary?.result?.[0] || profileData;
  const insights = insightsData?.finance?.result || insightsData;
  const chartMeta = chartData?.chart?.result?.[0]?.meta || chartData?.meta || {};
  const price = profile?.price || {};

  const technicalOutlook = insights?.instrumentInfo?.technicalEvents || {};
  const keyTechnicals = insights?.instrumentInfo?.keyTechnicals || {};
  const valuation = insights?.instrumentInfo?.valuation || {};
  const recommendation = insights?.recommendation || {};
  const companySnapshot = insights?.companySnapshot?.company || {};
  const sectorSnapshot = insights?.companySnapshot?.sector || {};
  const sigDevs = insights?.sigDevs || [];
  const upsell = insights?.upsell || {};
  const currentPrice =
    toNumber(chartMeta.regularMarketPrice) ??
    toNumber(price.regularMarketPrice?.raw) ??
    toNumber(price.regularMarketPrice) ??
    null;

  return {
    profile,
    insights,
    currentPrice,
    technicalOutlook,
    keyTechnicals,
    valuation,
    recommendation,
    companySnapshot,
    sectorSnapshot,
    sigDevs,
    upsell,
  };
}

const signalScore: Record<Signal, number> = {
  매수: 1,
  보유: 0,
  매도: -1,
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSignal(value: unknown, fallback: Signal = "보유"): Signal {
  if (value === "매수" || value === "보유" || value === "매도") return value;
  if (typeof value !== "string") return fallback;
  if (/buy|bull|overweight|매수|비중확대/i.test(value)) return "매수";
  if (/sell|bear|underweight|매도|비중축소/i.test(value)) return "매도";
  return fallback;
}

function normalizeConfidence(value: unknown, fallback: Confidence = "낮음"): Confidence {
  if (value === "높음" || value === "중간" || value === "낮음") return value;
  if (typeof value !== "string") return fallback;
  if (/high|높/i.test(value)) return "높음";
  if (/medium|mid|중/i.test(value)) return "중간";
  return fallback;
}

function confidenceFromScore(score: number | null, evidenceCount: number): Confidence {
  if (evidenceCount >= 3 && score !== null && Math.abs(score) >= 2) return "높음";
  if (evidenceCount >= 2 || (score !== null && Math.abs(score) >= 1)) return "중간";
  return "낮음";
}

function confidenceFromCount(count: number): Confidence {
  if (count >= 3) return "높음";
  if (count >= 1) return "중간";
  return "낮음";
}

function normalizeKeyPoints(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const points = value
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim())
    .filter(Boolean);
  return points.length > 0 ? points.slice(0, 4) : fallback;
}

function signalFromScore(score: number | null): Signal {
  if (score === null) return "보유";
  if (score >= 2) return "매수";
  if (score <= -2) return "매도";
  return "보유";
}

function outlookScore(outlook: any): number | null {
  const numericScore = toNumber(outlook?.score);
  if (numericScore !== null) return numericScore;
  if (outlook?.direction === "Bullish") return 2;
  if (outlook?.direction === "Bearish") return -2;
  return null;
}

function resultSchema(name: string) {
  return {
    type: "json_schema" as const,
    json_schema: {
      name,
      strict: true,
      schema: {
        type: "object",
        properties: {
          signal: { type: "string", description: "매수/보유/매도 중 하나" },
          confidence: { type: "string", description: "높음/중간/낮음 중 하나" },
          reasoning: { type: "string", description: "판단 근거 2-4문장" },
          keyPoints: {
            type: "array",
            items: { type: "string" },
            description: "핵심 포인트 2-4개",
          },
        },
        required: ["signal", "confidence", "reasoning", "keyPoints"],
        additionalProperties: false,
      },
    },
  };
}

function finalVerdictSchema() {
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "portfolio_manager_verdict",
      strict: true,
      schema: {
        type: "object",
        properties: {
          signal: { type: "string", description: "매수/보유/매도 중 하나" },
          confidence: { type: "string", description: "높음/중간/낮음 중 하나" },
          summary: { type: "string", description: "최종 종합 의견 3-4문장" },
          bullCase: { type: "string", description: "강세 논거 2-3문장" },
          bearCase: { type: "string", description: "약세 논거 2-3문장" },
          keyFactors: {
            type: "array",
            items: { type: "string" },
            description: "핵심 투자 요인 3-4개",
          },
          dissent: { type: "string", description: "소수 의견 또는 반대 논거" },
        },
        required: ["signal", "confidence", "summary", "bullCase", "bearCase", "keyFactors", "dissent"],
        additionalProperties: false,
      },
    },
  };
}

function parseContent(content: unknown): any {
  return typeof content === "string" ? JSON.parse(content) : content;
}

function localizedTerm(value: unknown, fallback = "N/A"): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return translateFinancialTerm(value.trim());
}

function localizedText(value: string): string {
  return translateFinancialText(value);
}

function formattedScore(value: unknown): string {
  const numeric = toNumber(value);
  if (numeric === null) return "N/A";
  const score = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  const rounded = Number(score.toFixed(1));
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}점`;
}

function qualitySectorPromptLine(sectorSnapshot: unknown): string | null {
  if (!isTrustedQualitySectorComparison(sectorSnapshot)) return null;
  const sector = sectorSnapshot as Record<string, unknown>;
  return `- 섹터 평균: 혁신 ${formattedScore(sector.innovativeness)}, 채용 ${formattedScore(sector.hiring)}, 지속가능성 ${formattedScore(sector.sustainability)}, 내부자 심리 ${formattedScore(sector.insiderSentiments)}`;
}

function localizeAgentResult(agent: AgentResult): AgentResult {
  return {
    ...agent,
    reasoning: localizedText(agent.reasoning),
    keyPoints: agent.keyPoints.map(localizedText),
  };
}

function localizeFinalVerdict(verdict: FinalVerdict): FinalVerdict {
  return {
    ...verdict,
    summary: localizedText(verdict.summary),
    bullCase: localizedText(verdict.bullCase),
    bearCase: localizedText(verdict.bearCase),
    keyFactors: verdict.keyFactors.map(localizedText),
    dissent: localizedText(verdict.dissent),
  };
}

function localizeResearchReport(report: ResearchReport): ResearchReport {
  return {
    thesis: localizedText(report.thesis),
    sections: report.sections.map(section => ({
      ...section,
      bullets: section.bullets.map(localizedText),
    })),
    dataQuality: report.dataQuality.map(localizedText),
    nextChecks: report.nextChecks.map(localizedText),
  };
}

function sourceStatusLabel(status: AnalysisPack["sources"][number]["status"]): string {
  if (status === "used") return "사용됨";
  if (status === "fallback") return "대체 데이터";
  return "사용 불가";
}

function metricFreshnessLabel(freshness: MetricFreshness): string {
  if (freshness.kind === "checked_at") {
    return freshness.note ? `확인 ${freshness.checkedAt} (${freshness.note})` : `확인 ${freshness.checkedAt}`;
  }
  if (freshness.kind === "as_of") return `기준 ${freshness.asOf}`;
  return freshness.note;
}

function formatMetricContextLines(
  metrics: Partial<AnalysisMetrics> | null | undefined,
  allowGroupsOrIds: readonly string[],
  limit = 8
): string[] {
  if (!Array.isArray(metrics?.groups)) return [];

  const allowSet = new Set(allowGroupsOrIds);
  const allowAll = allowSet.size === 0;
  const lines: string[] = [];

  for (const group of metrics.groups) {
    const groupAllowed = allowAll || allowSet.has(group.id);
    for (const metric of group.metrics) {
      if (!groupAllowed && !allowSet.has(metric.id)) continue;
      if (metric.status !== "available") continue;

      lines.push(`- ${metric.labelKo}: ${metric.value} · 출처 ${metric.source.name}/${metric.source.basis} · 신선도 ${metricFreshnessLabel(metric.freshness)}`);
      if (lines.length >= limit) return lines;
    }
  }

  return lines;
}

function metricContextBlock(title: string, lines: string[]): string {
  return lines.length > 0 ? `\n\n## ${title}\n${lines.join("\n")}` : "";
}

function portfolioMetricAllowlist(pack: AnalysisPack): readonly string[] {
  if (pack.asset.assetType === "etf") return ["cost", "holdings", "range"];
  return ["valuation", "profitability", "growth", "risk", "shareholder"];
}

function agentContext(agent: AgentResult): string {
  return `${agent.agentName}: ${agent.signal}/${agent.confidence}. ${agent.reasoning} 핵심: ${agent.keyPoints.join(", ")}`;
}

function formatGuidanceEvidenceLines(pack: AnalysisPack, max = 5): string[] {
  const evidence = Array.isArray(pack.guidance?.evidence)
    ? pack.guidance.evidence
    : [];
  const lines = evidence
    .slice(0, max)
    .map(metric => {
      const label = metric.label?.trim();
      const value = metric.value?.trim();
      const source = metric.source?.trim();
      if (!label || !value || !source) return "";

      const comparisonPart = metric.comparison?.trim()
        ? ` (${metric.comparison.trim()})`
        : "";
      const asOfPart = metric.asOf?.trim()
        ? ` · 기준 ${metric.asOf.trim()}`
        : "";
      const categoryPart = metric.category
        ? ` · 분류 ${metric.category}`
        : "";
      return `검증된 가이던스 근거: ${label}: ${value}${comparisonPart} · 출처 ${source}${asOfPart}${categoryPart}`;
    })
    .filter(Boolean);

  return lines.length > 0 ? lines : ["검증된 가이던스 근거: 확인 불가"];
}

function packContext(pack: AnalysisPack): string {
  const metricLines = formatMetricContextLines(pack.metrics, portfolioMetricAllowlist(pack), 16);
  const lines = [
    `자산: ${pack.asset.assetType} · ${pack.asset.displayName}`,
    `가격: 현재가 ${pack.price.current ?? "N/A"}, 52주 고점 ${pack.price.fiftyTwoWeekHigh ?? "N/A"}, 52주 저점 ${pack.price.fiftyTwoWeekLow ?? "N/A"}`,
    `기술: ${pack.technical.summary}; ${pack.technical.outlooks.join(", ") || "N/A"}`,
    `밸류에이션: ${pack.valuation.summary}`,
    metricLines.length > 0 ? `핵심 지표:\n${metricLines.join("\n")}` : null,
    ...formatGuidanceEvidenceLines(pack),
    `뉴스/이벤트: ${pack.news.events.map(event => event.headline).slice(0, 4).join("; ") || "N/A"}`,
    `공시: ${pack.filings.latest.slice(0, 3).join("; ") || "N/A"}`,
    `보유/거버넌스: ${pack.governance.qualitySignals.concat(pack.governance.insiderTransactions).slice(0, 5).join("; ") || "N/A"}`,
  ].filter((line): line is string => typeof line === "string");

  if (pack.etf) {
    lines.push(`ETF: 보수 ${pack.etf.expenseRatio ?? "N/A"}, AUM ${pack.etf.netAssets ?? "N/A"}, 회전율 ${pack.etf.turnover ?? "N/A"}, 상위 보유 비중 ${pack.etf.topHoldingsWeight ?? "N/A"}%`);
  }

  return lines.join("\n");
}

function normalizeAgent(
  agentName: string,
  stage: string,
  parsed: any,
  fallback: AgentResult
): AgentResult {
  const parsedSignal = normalizeSignal(parsed?.signal, fallback.signal);
  const parsedConfidence = normalizeConfidence(parsed?.confidence, fallback.confidence);

  return localizeAgentResult({
    agentName,
    stage,
    signal: parsedSignal === "보유" && fallback.signal !== "보유" ? fallback.signal : parsedSignal,
    confidence: parsedConfidence === "중간" && fallback.confidence !== "중간" ? fallback.confidence : parsedConfidence,
    reasoning: typeof parsed?.reasoning === "string" && parsed.reasoning.trim()
      ? parsed.reasoning.trim()
      : fallback.reasoning,
    keyPoints: normalizeKeyPoints(parsed?.keyPoints, fallback.keyPoints),
  });
}

async function runAgent(
  agentName: string,
  stage: string,
  schemaName: string,
  system: string,
  prompt: string,
  fallback: AgentResult
): Promise<AgentResult> {
  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: resultSchema(schemaName),
    });
    const parsed = parseContent(result.choices[0]?.message?.content);
    return normalizeAgent(agentName, stage, parsed, fallback);
  } catch (error) {
    console.error(`[MultiAgent] ${agentName} failed:`, error);
    return localizeAgentResult(fallback);
  }
}

function buildMarketFallback(symbol: string, data: UnwrappedData): AgentResult {
  const outlooks = [
    data.technicalOutlook?.shortTermOutlook,
    data.technicalOutlook?.intermediateTermOutlook,
    data.technicalOutlook?.longTermOutlook,
  ];
  const scores = outlooks
    .map(outlookScore)
    .filter((score): score is number => score !== null);
  const averageScore = scores.length > 0
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : null;

  return {
    agentName: "시장/기술 분석",
    stage: "Analyst Team",
    signal: signalFromScore(averageScore),
    confidence: confidenceFromScore(averageScore, scores.length),
    reasoning: scores.length > 0
      ? `${symbol}의 공개 기술 지표 평균 점수는 ${averageScore?.toFixed(1)}입니다. 가격 흐름만으로는 확정적 판단을 피하고 보수적으로 해석했습니다.`
      : "기술 지표 데이터가 제한적이어서 보유 관점으로 판단했습니다.",
    keyPoints: [
      `단기 전망: ${localizedTerm(data.technicalOutlook?.shortTermOutlook?.direction, "데이터 부족")}`,
      `중기 전망: ${localizedTerm(data.technicalOutlook?.intermediateTermOutlook?.direction, "데이터 부족")}`,
      `현재가/지지선: ${data.currentPrice ?? "현재가 부족"} / ${data.keyTechnicals?.support || "데이터 부족"}`,
    ],
  };
}

function buildFundamentalFallback(symbol: string, data: UnwrappedData): AgentResult {
  const valuationText = String(data.valuation?.description || "");
  const ratingText = String(data.recommendation?.rating || "");
  const valuationLabel = localizedTerm(valuationText, "데이터 부족");
  const ratingLabel = localizedTerm(ratingText, "데이터 부족");
  const targetPrice = data.recommendation?.targetPrice || "데이터 부족";
  const isOvervalued = /overvalued|고평가/i.test(valuationText);
  const isUndervalued = /undervalued|저평가/i.test(valuationText);
  const isPositiveRating = /buy|outperform|매수/i.test(ratingText);
  const hasTargetPrice = data.recommendation?.targetPrice !== undefined && data.recommendation?.targetPrice !== null;
  const hasConflictingSignals = isOvervalued && isPositiveRating;
  const evidenceCount = [valuationText, ratingText, hasTargetPrice].filter(Boolean).length;

  return {
    agentName: "펀더멘털 분석",
    stage: "Analyst Team",
    signal: isOvervalued ? "보유" : isUndervalued || isPositiveRating ? "매수" : "보유",
    confidence: hasConflictingSignals ? "중간" : confidenceFromCount(evidenceCount),
    reasoning: `${symbol}의 밸류에이션과 애널리스트 추천 데이터를 우선 반영했습니다. 고평가 신호가 있으면 매수 의견을 낮추는 보수 기준을 적용했습니다.`,
    keyPoints: [
      `밸류에이션: ${valuationLabel}`,
      `애널리스트 추천: ${ratingLabel}`,
      `현재가/목표가: ${data.currentPrice ?? "현재가 부족"} / ${targetPrice}`,
    ],
  };
}

function buildNewsFallback(symbol: string, data: UnwrappedData): AgentResult {
  const headlines = data.sigDevs
    .map((event: any) => event?.headline)
    .filter((headline: unknown): headline is string => typeof headline === "string" && headline.trim().length > 0)
    .slice(0, 3);

  return {
    agentName: "뉴스·시장 심리 분석",
    stage: "Analyst Team",
    signal: headlines.length > 0 ? "보유" : "보유",
    confidence: headlines.length >= 3 ? "중간" : "낮음",
    reasoning: headlines.length > 0
      ? `${symbol} 관련 공개 이벤트가 확인되지만, 뉴스만으로 방향성을 단정하지 않고 중립적으로 반영했습니다.`
      : "최신 뉴스/이벤트 데이터가 제한적이어서 시장 심리 판단을 보수적으로 유지했습니다.",
    keyPoints: headlines.length > 0 ? headlines : ["뉴스 데이터 부족"],
  };
}

function buildBullFallback(analysts: AgentResult[]): AgentResult {
  const bullish = analysts.filter(agent => agent.signal === "매수");
  return {
    agentName: "강세 리서처",
    stage: "Research Debate",
    signal: bullish.length > 0 ? "매수" : "보유",
    confidence: bullish.length >= 2 ? "높음" : bullish.length === 1 ? "중간" : "낮음",
    reasoning: bullish.length > 0
      ? `강세 리서처는 ${bullish.map(agent => agent.agentName).join(", ")}의 긍정 신호를 근거로 제한적 상승 여지를 봅니다.`
      : "강한 매수 논거가 제한적이어서 신중한 강세 판단에 머뭅니다.",
    keyPoints: bullish.flatMap(agent => agent.keyPoints).slice(0, 3).length > 0
      ? bullish.flatMap(agent => agent.keyPoints).slice(0, 3)
      : ["강세 근거 제한"],
  };
}

function buildBearFallback(data: UnwrappedData, analysts: AgentResult[]): AgentResult {
  const valuationText = String(data.valuation?.description || "");
  const valuationLabel = localizedTerm(valuationText, "데이터 부족");
  const bearish = analysts.filter(agent => agent.signal === "매도");
  const isOvervalued = /overvalued|고평가/i.test(valuationText);

  return {
    agentName: "약세 리서처",
    stage: "Research Debate",
    signal: bearish.length > 0 ? "매도" : "보유",
    confidence: bearish.length > 0 && isOvervalued ? "높음" : bearish.length > 0 || isOvervalued ? "중간" : "낮음",
    reasoning: isOvervalued
      ? "약세 리서처는 고평가 신호와 하방 리스크를 우선 반영해 추격 매수를 경계합니다."
      : "명확한 약세 데이터는 제한적이지만, 데이터 공백 자체를 리스크로 봅니다.",
    keyPoints: [
      `밸류에이션: ${valuationLabel}`,
      `손절가: ${data.keyTechnicals?.stopLoss || "데이터 부족"}`,
      bearish[0]?.reasoning || "명확한 약세 신호 제한",
    ],
  };
}

function buildTraderFallback(
  analysts: AgentResult[],
  bull: AgentResult,
  bear: AgentResult
): AgentResult {
  const totalScore = [...analysts, bull, bear].reduce(
    (sum, agent) => sum + signalScore[agent.signal],
    0
  );
  const signal = bear.signal === "매도" && totalScore <= 0 ? "보유" : signalFromScore(totalScore);

  return {
    agentName: "트레이더",
    stage: "Trader",
    signal,
    confidence: Math.abs(totalScore) >= 3 ? "높음" : Math.abs(totalScore) >= 1 ? "중간" : "낮음",
    reasoning: "트레이더는 리서치 토론 결과를 실행 관점으로 바꾸되, 하방 리스크가 남아 있으면 포지션을 보수적으로 제한합니다.",
    keyPoints: [
      `종합 점수: ${totalScore}`,
      `강세 판단: ${bull.signal}`,
      `약세 판단: ${bear.signal}`,
    ],
  };
}

function buildRiskFallback(symbol: string, data: UnwrappedData, trader: AgentResult): AgentResult {
  const valuationText = String(data.valuation?.description || "");
  const valuationLabel = localizedTerm(valuationText, "데이터 부족");
  const insiderSentiment = toNumber(data.companySnapshot?.insiderSentiments);
  const isOvervalued = /overvalued|고평가/i.test(valuationText);
  const weakInsiderSentiment = insiderSentiment !== null && insiderSentiment < 0.5;
  const hasStopLoss = data.keyTechnicals?.stopLoss !== undefined && data.keyTechnicals?.stopLoss !== null;
  const evidenceCount = [valuationText, insiderSentiment !== null, hasStopLoss].filter(Boolean).length;

  return {
    agentName: "리스크 관리자",
    stage: "Risk Management",
    signal: isOvervalued && weakInsiderSentiment ? "매도" : trader.signal === "매수" && isOvervalued ? "보유" : "보유",
    confidence: (isOvervalued || weakInsiderSentiment) && evidenceCount >= 3 ? "높음" : confidenceFromCount(evidenceCount),
    reasoning: `${symbol}의 하방 리스크를 우선해 판단했습니다. 고평가, 손절선, 내부자 심리 중 확인 가능한 항목만 반영했습니다.`,
    keyPoints: [
      `밸류에이션 리스크: ${valuationLabel}`,
      `현재가/손절가: ${data.currentPrice ?? "현재가 부족"} / ${data.keyTechnicals?.stopLoss || "데이터 부족"}`,
      `내부자 심리: ${formattedScore(insiderSentiment)}`,
    ],
  };
}

function buildFinalFallback(agents: AgentResult[]): FinalVerdict {
  const riskSignal = agents.find(agent => agent.stage === "Risk Management")?.signal;
  const totalScore = agents.reduce((sum, agent) => sum + signalScore[agent.signal], 0);
  const signal = riskSignal === "매도" ? "매도" : signalFromScore(totalScore / 2);
  const bullish = agents.filter(agent => agent.signal === "매수");
  const bearish = agents.filter(agent => agent.signal === "매도");

  return localizeFinalVerdict({
    signal,
    confidence: new Set(agents.map(agent => agent.signal)).size <= 2 ? "중간" : "낮음",
    summary: "공개 데이터 기반의 신중한 종합 의견입니다. 가격, 재무, 뉴스, 리스크 관점을 차례로 반영했습니다.",
    bullCase: bullish.length > 0
      ? bullish.map(agent => `${agent.agentName}: ${agent.reasoning}`).join(" ")
      : "강한 매수 근거는 제한적이므로 추가 데이터 확인이 필요합니다.",
    bearCase: bearish.length > 0
      ? bearish.map(agent => `${agent.agentName}: ${agent.reasoning}`).join(" ")
      : "밸류에이션, 손절 기준, 데이터 공백 등 하방 리스크는 별도로 확인해야 합니다.",
    keyFactors: agents.flatMap(agent => agent.keyPoints).slice(0, 4),
    dissent: bullish.length > 0 && bearish.length > 0
      ? "강세와 약세 논거가 모두 존재해 포트폴리오 매니저가 리스크 관점을 더 크게 반영했습니다."
      : "주요 관점 간 방향성이 크게 엇갈리지 않았습니다.",
  });
}

function buildPortfolioAgent(verdict: FinalVerdict): AgentResult {
  return {
    agentName: "포트폴리오 매니저",
    stage: "Portfolio Manager",
    signal: verdict.signal,
    confidence: verdict.confidence,
    reasoning: verdict.summary,
    keyPoints: verdict.keyFactors,
  };
}

function buildResearchReport(symbol: string, pack: AnalysisPack, agents: AgentResult[], verdict: FinalVerdict): ResearchReport {
  const riskAgent = agents.find(agent => agent.stage === "Risk Management");
  const topAgentPoints = agents
    .flatMap(agent => agent.keyPoints.map(point => `${agent.agentName}: ${point}`))
    .slice(0, 6);
  const technicalBullets = [
    pack.technical.summary,
    ...pack.technical.outlooks.slice(0, 3),
    pack.price.support !== undefined ? `지지선 ${pack.price.support}` : undefined,
    pack.price.stopLoss !== undefined ? `무효화 기준 ${pack.price.stopLoss}` : undefined,
  ].filter((item): item is string => typeof item === "string" && item.length > 0);
  const stockEvidenceBullets = [
    ...formatGuidanceEvidenceLines(pack),
    pack.valuation.summary,
    pack.valuation.targetPrice !== undefined ? `목표가 ${pack.valuation.targetPrice}` : "목표가 데이터 부족",
    ...pack.governance.qualitySignals.slice(0, 4),
    ...pack.filings.latest.slice(0, 2),
  ];
  const evidenceBullets = pack.asset.assetType === "etf"
    ? [
        pack.etf?.expenseRatio ? `총보수율 ${pack.etf.expenseRatio}` : "총보수율 데이터 부족",
        pack.etf?.netAssets ? `AUM ${pack.etf.netAssets}` : "AUM 데이터 부족",
        pack.etf?.topHoldingsWeight !== undefined ? `상위 보유 종목 비중 ${pack.etf.topHoldingsWeight.toFixed(1)}%` : "구성 종목 데이터 부족",
        ...pack.tabData.etf.highlights.slice(0, 3),
      ]
    : stockEvidenceBullets;

  return localizeResearchReport({
    thesis: `${symbol}은 현재 ${verdict.signal} 의견입니다. ${pack.asset.displayName}의 가격, 기술 흐름, 밸류에이션, 뉴스/공시, 리스크 의견을 함께 반영했습니다.`,
    sections: [
      {
        title: "핵심 판단",
        bullets: [
          verdict.summary,
          `최종 신뢰도: ${verdict.confidence}`,
          `현재가: ${pack.price.current ?? "데이터 부족"}`,
        ],
      },
      {
        title: "근거 데이터",
        bullets: evidenceBullets.filter(Boolean).slice(0, pack.asset.assetType === "etf" ? 7 : 10),
      },
      {
        title: "기술·가격 구조",
        bullets: technicalBullets.length > 0 ? technicalBullets : ["기술 데이터가 제한적입니다."],
      },
      {
        title: "리스크와 반대 논거",
        bullets: [
          verdict.bearCase,
          verdict.dissent,
          riskAgent?.reasoning || "리스크 관리자 데이터가 제한적입니다.",
        ].filter(Boolean).slice(0, 5),
      },
      {
        title: "시나리오",
        bullets: [
          `강세: ${verdict.bullCase}`,
          `중립: ${verdict.signal === "보유" ? "현재 데이터로는 관망과 추가 확인이 우선입니다." : "가격과 새 데이터 확인 후 포지션 크기를 조절해야 합니다."}`,
          `약세: ${verdict.bearCase}`,
        ],
      },
      {
        title: "세부 근거",
        bullets: topAgentPoints.length > 0 ? topAgentPoints : ["세부 근거 데이터 부족"],
      },
    ],
    dataQuality: pack.sources.map(source => `${source.name}: ${sourceStatusLabel(source.status)}`),
    nextChecks: [
      pack.asset.assetType === "etf" ? "ETF 구성 종목 기준일과 보수 변경 여부" : "다음 실적 발표와 가이던스 변화",
      "최근 뉴스가 가격에 이미 반영되었는지",
      "무효화 가격 아래로 이탈하는지",
    ],
  });
}

async function runMarketAgent(symbol: string, data: UnwrappedData): Promise<AgentResult> {
  const fallback = buildMarketFallback(symbol, data);
  const shortTerm = localizedTerm(data.technicalOutlook?.shortTermOutlook?.direction);
  const intermediateTerm = localizedTerm(data.technicalOutlook?.intermediateTermOutlook?.direction);
  const longTerm = localizedTerm(data.technicalOutlook?.longTermOutlook?.direction);
  const prompt = `TradingAgents의 Analyst Team 중 시장/기술 분석가 역할입니다.
절대 사실을 지어내지 말고 제공 데이터만 사용하세요.

## ${symbol} 시장/기술 데이터
- 현재가: ${data.currentPrice ?? "N/A"}
- 단기 전망: ${shortTerm}, 점수 ${data.technicalOutlook?.shortTermOutlook?.score || "N/A"}
- 중기 전망: ${intermediateTerm}, 점수 ${data.technicalOutlook?.intermediateTermOutlook?.score || "N/A"}
- 장기 전망: ${longTerm}, 점수 ${data.technicalOutlook?.longTermOutlook?.score || "N/A"}
- 지지선: ${data.keyTechnicals?.support || "N/A"}
- 손절가: ${data.keyTechnicals?.stopLoss || "N/A"}`;

  return runAgent(
    "시장/기술 분석",
    "Analyst Team",
    "market_technical_analyst",
    "당신은 TradingAgents의 시장/기술 분석가입니다. 모든 응답은 한국어 JSON으로 작성하세요.",
    prompt,
    fallback
  );
}

async function runFundamentalAgent(symbol: string, data: UnwrappedData, analysisPack: AnalysisPack): Promise<AgentResult> {
  const fallback = buildFundamentalFallback(symbol, data);
  const valuation = localizedTerm(data.valuation?.description);
  const relativeValue = localizedTerm(data.valuation?.relativeValue);
  const rating = localizedTerm(data.recommendation?.rating);
  const sectorPromptLine = qualitySectorPromptLine(data.sectorSnapshot);
  const metricLines = formatMetricContextLines(
    analysisPack.metrics,
    analysisPack.asset.assetType === "etf" ? ["cost", "holdings"] : ["valuation", "profitability", "growth", "shareholder"],
    12
  );
  const prompt = `TradingAgents의 Analyst Team 중 펀더멘털 분석가 역할입니다.
절대 사실을 지어내지 말고 제공 데이터만 사용하세요.

## ${symbol} 펀더멘털 데이터
- 밸류에이션: ${valuation}, 할인율: ${data.valuation?.discount || "N/A"}, 상대가치: ${relativeValue}
- 애널리스트 추천: ${rating}, 목표가 ${data.recommendation?.targetPrice || "N/A"}, 애널리스트 수 ${data.recommendation?.numberOfAnalysts || "N/A"}
- 현재가: ${data.currentPrice ?? "N/A"}
- 기업 품질: 혁신 ${formattedScore(data.companySnapshot?.innovativeness)}, 채용 ${formattedScore(data.companySnapshot?.hiring)}, 지속가능성 ${formattedScore(data.companySnapshot?.sustainability)}, 내부자 심리 ${formattedScore(data.companySnapshot?.insiderSentiments)}${sectorPromptLine ? `\n${sectorPromptLine}` : ""}${metricContextBlock("핵심 지표", metricLines)}`;

  return runAgent(
    "펀더멘털 분석",
    "Analyst Team",
    "fundamental_analyst",
    "당신은 TradingAgents의 펀더멘털 분석가입니다. 고평가 신호를 과소평가하지 말고 모든 응답은 한국어 JSON으로 작성하세요.",
    prompt,
    fallback
  );
}

async function runNewsAgent(symbol: string, data: UnwrappedData): Promise<AgentResult> {
  const fallback = buildNewsFallback(symbol, data);
  const headlines = data.sigDevs
    .map((event: any) => event?.headline)
    .filter(Boolean)
    .slice(0, 8)
    .join("\n- ");
  const prompt = `TradingAgents의 Analyst Team 중 뉴스·시장 심리 분석가 역할입니다.
절대 사실을 지어내지 말고 제공 뉴스와 이벤트만 사용하세요.

## ${symbol} 뉴스/시장 심리 데이터
- 주요 이벤트:
- ${headlines || "N/A"}
- 강세 요약: ${(data.upsell?.msBullishSummary || []).map(localizedText).join("; ") || "N/A"}
- 약세 요약: ${(data.upsell?.msBearishSummary || []).map(localizedText).join("; ") || "N/A"}`;

  return runAgent(
    "뉴스·시장 심리 분석",
    "Analyst Team",
    "news_sentiment_analyst",
    "당신은 TradingAgents의 뉴스·시장 심리 분석가입니다. 모든 응답은 한국어 JSON으로 작성하세요.",
    prompt,
    fallback
  );
}

async function runBullResearcher(symbol: string, analysts: AgentResult[]): Promise<AgentResult> {
  const fallback = buildBullFallback(analysts);
  const prompt = `TradingAgents의 강세 리서처 역할입니다.
분석팀 보고서에서 강세 논거를 찾아 투자 가능성을 주장하세요. 약세 리스크를 무시하지 말고, 제공된 분석 안에서만 주장하세요.

## ${symbol} 분석팀 보고서
${analysts.map(agentContext).join("\n")}`;

  return runAgent(
    "강세 리서처",
    "Research Debate",
    "bull_researcher",
    "당신은 TradingAgents의 강세 리서처입니다. 모든 응답은 한국어 JSON으로 작성하세요.",
    prompt,
    fallback
  );
}

async function runBearResearcher(
  symbol: string,
  data: UnwrappedData,
  analysts: AgentResult[],
  bull: AgentResult
): Promise<AgentResult> {
  const fallback = buildBearFallback(data, analysts);
  const prompt = `TradingAgents의 약세 리서처 역할입니다.
분석팀 보고서와 강세 리서처 의견을 비판적으로 검토해 하방 리스크를 주장하세요. 제공된 분석 안에서만 주장하세요.

## ${symbol} 분석팀 보고서
${analysts.map(agentContext).join("\n")}

## 강세 리서처 의견
${agentContext(bull)}`;

  return runAgent(
    "약세 리서처",
    "Research Debate",
    "bear_researcher",
    "당신은 TradingAgents의 약세 리서처입니다. 모든 응답은 한국어 JSON으로 작성하세요.",
    prompt,
    fallback
  );
}

async function runTrader(
  symbol: string,
  analysts: AgentResult[],
  bull: AgentResult,
  bear: AgentResult
): Promise<AgentResult> {
  const fallback = buildTraderFallback(analysts, bull, bear);
  const prompt = `TradingAgents의 Trader 역할입니다.
분석팀과 강세/약세 토론을 실행 가능한 거래 계획으로 바꾸세요. 최종 투자 조언이 아니라 포트폴리오 매니저에게 넘길 거래 제안입니다.

## ${symbol} 분석팀 보고서
${analysts.map(agentContext).join("\n")}

## 리서치 토론
${agentContext(bull)}
${agentContext(bear)}`;

  return runAgent(
    "트레이더",
    "Trader",
    "trader",
    "당신은 TradingAgents의 트레이더입니다. 모든 응답은 한국어 JSON으로 작성하세요.",
    prompt,
    fallback
  );
}

async function runRiskManager(
  symbol: string,
  data: UnwrappedData,
  analysts: AgentResult[],
  trader: AgentResult,
  bear: AgentResult,
  analysisPack: AnalysisPack
): Promise<AgentResult> {
  const fallback = buildRiskFallback(symbol, data, trader);
  const valuation = localizedTerm(data.valuation?.description);
  const currentPrice = data.currentPrice ?? analysisPack.price.current ?? "N/A";
  const stopLoss = data.keyTechnicals?.stopLoss ?? analysisPack.price.stopLoss ?? "N/A";
  const metricLines = formatMetricContextLines(
    analysisPack.metrics,
    ["debtRatio", "beta", "fiftyTwoWeekHigh", "fiftyTwoWeekLow"],
    6
  );
  const prompt = `TradingAgents의 Risk Management 역할입니다.
트레이더 제안을 공격적/중립/보수 관점으로 검토한 뒤 리스크 조정 의견을 내세요. 제공된 분석 안에서만 판단하세요.

## ${symbol} 리스크 데이터
- 현재가: ${currentPrice}
- 밸류에이션: ${valuation}
- 손절가: ${stopLoss}
- 내부자 심리: ${data.companySnapshot?.insiderSentiments ?? "N/A"}${metricContextBlock("핵심 리스크 지표", metricLines)}

## 분석팀 보고서
${analysts.map(agentContext).join("\n")}

## 트레이더 제안
${agentContext(trader)}

## 약세 리서처 의견
${agentContext(bear)}`;

  return runAgent(
    "리스크 관리자",
    "Risk Management",
    "risk_manager",
    "당신은 TradingAgents의 리스크 관리자입니다. 낙관적 편향을 경계하고 모든 응답은 한국어 JSON으로 작성하세요.",
    prompt,
    fallback
  );
}

async function runPortfolioManager(symbol: string, agents: AgentResult[], analysisPack: AnalysisPack): Promise<FinalVerdict> {
  const fallback = buildFinalFallback(agents);
  const prompt = `TradingAgents의 Portfolio Manager 역할입니다.
아래 공유 분석 데이터와 단계별 결과를 종합해 최종 포트폴리오 관점의 판단을 내리세요. 리스크 관리자가 매도라면 최종 의견을 매수로 내지 마세요.
짧은 감상이 아니라 리서치 보고서의 결론 문단처럼 근거와 반대 논거를 모두 연결하세요.
숫자형 가이던스 주장은 아래 검증된 가이던스 근거에 있는 값만 사용하세요. EPS, 매출, 마진, 백로그, 수주, 가이던스 숫자를 계산·추론·창작하지 말고, 근거가 없으면 확인 불가로 다루세요.

## ${symbol} 공유 분석 데이터
${packContext(analysisPack)}

## ${symbol} 단계별 결과
${agents.map(agentContext).join("\n")}`;

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "당신은 TradingAgents의 포트폴리오 매니저입니다. 모든 응답은 한국어 JSON으로 작성하세요.",
        },
        { role: "user", content: prompt },
      ],
      response_format: finalVerdictSchema(),
    });
    const parsed = parseContent(result.choices[0]?.message?.content);
    return localizeFinalVerdict({
      signal: normalizeSignal(parsed?.signal, fallback.signal),
      confidence: normalizeConfidence(parsed?.confidence, fallback.confidence),
      summary: typeof parsed?.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : fallback.summary,
      bullCase: typeof parsed?.bullCase === "string" && parsed.bullCase.trim()
        ? parsed.bullCase.trim()
        : fallback.bullCase,
      bearCase: typeof parsed?.bearCase === "string" && parsed.bearCase.trim()
        ? parsed.bearCase.trim()
        : fallback.bearCase,
      keyFactors: normalizeKeyPoints(parsed?.keyFactors, fallback.keyFactors),
      dissent: typeof parsed?.dissent === "string" && parsed.dissent.trim()
        ? parsed.dissent.trim()
        : fallback.dissent,
    });
  } catch (error) {
    console.error("[MultiAgent] 포트폴리오 매니저 failed:", error);
    return localizeFinalVerdict(fallback);
  }
}

export async function generateMultiAgentOpinion(
  symbol: string,
  profileData: any,
  insightsData: any,
  holdersData: any,
  chartData?: any,
  options?: { analysisPack?: AnalysisPack }
): Promise<MultiAgentOpinion> {
  const normalized = symbol.toUpperCase();
  const cacheKey = "llm_multi_opinion" + CACHE_VERSION;

  return defaultCacheCoordinator.refresh<MultiAgentOpinion>({
    key: `${normalized}:${cacheKey}`,
    readFresh: async () => await getCachedData(normalized, cacheKey) as MultiAgentOpinion | null,
    readLastGood: async () => await getLastGoodCachedData(normalized, cacheKey) as MultiAgentOpinion | null,
    write: value => setCachedData(normalized, cacheKey, value, CACHE_TTL_OPINION),
    produce: () => generateFreshMultiAgentOpinion(
      normalized,
      profileData,
      insightsData,
      holdersData,
      chartData,
      options
    ),
    failureValue: buildUnavailableOpinion(normalized),
    isCacheable: value => value.finalVerdict.summary !== "의견 생성이 지연되고 있습니다. 잠시 후 다시 시도해주세요.",
    lockTimeoutSeconds: 180,
  }) as Promise<MultiAgentOpinion>;
}

function buildUnavailableOpinion(symbol: string): MultiAgentOpinion {
  return {
    generatedAt: new Date().toISOString(),
    opinionVersion: OPINION_TRACKING_VERSION,
    agents: [],
    workflow: {
      source: "TradingAgents-style research report",
      stages: [],
    },
    finalVerdict: {
      signal: "보유",
      confidence: "낮음",
      summary: "의견 생성이 지연되고 있습니다. 잠시 후 다시 시도해주세요.",
      bullCase: "확인 가능한 최신 의견이 아직 준비되지 않았습니다.",
      bearCase: "생성 지연 중에는 새 투자 판단을 단정하지 않습니다.",
      keyFactors: ["의견 생성 지연", "공식 원천 확인 필요"],
      dissent: "새 의견 생성 완료 후 다시 확인해야 합니다.",
    },
    researchReport: {
      thesis: `${symbol} 의견 생성이 지연되고 있습니다.`,
      sections: [],
      dataQuality: ["공식 원천 확인 필요"],
      nextChecks: ["잠시 후 다시 조회"],
    },
    disclaimer: "본 분석은 공개 데이터를 바탕으로 자동 생성한 참고 정보이며, 실제 투자 결정의 근거로 사용해서는 안 됩니다. 투자에 따른 손실은 전적으로 투자자 본인에게 있습니다.",
  };
}

async function generateFreshMultiAgentOpinion(
  symbol: string,
  profileData: any,
  insightsData: any,
  holdersData: any,
  chartData?: any,
  options?: { analysisPack?: AnalysisPack }
): Promise<MultiAgentOpinion> {
  const opinionCreatedAt = new Date();
  const data = unwrapData(profileData, insightsData, chartData);
  const analysisPack = options?.analysisPack || generateAnalysisPack({
    symbol,
    profile: profileData,
    insights: insightsData,
    chart: chartData,
    holders: holdersData,
    secFilings: null,
    etfHoldings: null,
  });

  const market = await runMarketAgent(symbol, data);
  const fundamentals = await runFundamentalAgent(symbol, data, analysisPack);
  const news = await runNewsAgent(symbol, data);
  const analystTeam = [market, fundamentals, news];
  const bull = await runBullResearcher(symbol, analystTeam);
  const bear = await runBearResearcher(symbol, data, analystTeam, bull);
  const trader = await runTrader(symbol, analystTeam, bull, bear);
  const risk = await runRiskManager(symbol, data, analystTeam, trader, bear, analysisPack);
  const prePortfolioAgents = [...analystTeam, bull, bear, trader, risk];
  const finalVerdict = await runPortfolioManager(symbol, prePortfolioAgents, analysisPack);
  const portfolioManager = buildPortfolioAgent(finalVerdict);
  const researchReport = buildResearchReport(symbol, analysisPack, prePortfolioAgents, finalVerdict);

  const opinion: MultiAgentOpinion = {
    generatedAt: opinionCreatedAt.toISOString(),
    opinionVersion: OPINION_TRACKING_VERSION,
    agents: [...prePortfolioAgents, portfolioManager],
    workflow: {
      source: "TradingAgents-style research report",
      stages: ["Analyst Team", "Research Debate", "Trader", "Risk Management", "Portfolio Manager"],
    },
    finalVerdict,
    researchReport,
    disclaimer: "본 분석은 공개 데이터를 바탕으로 자동 생성한 참고 정보이며, 실제 투자 결정의 근거로 사용해서는 안 됩니다. 투자에 따른 손실은 전적으로 투자자 본인에게 있습니다.",
  };

  await recordOpinionSnapshot(symbol, opinionCreatedAt, chartData, opinion, analysisPack);
  return opinion;
}

async function recordOpinionSnapshot(
  symbol: string,
  opinionCreatedAt: Date,
  chartData: unknown,
  opinion: MultiAgentOpinion,
  analysisPack: AnalysisPack
) {
  const startClose = selectOpinionBaselineClose(chartData, opinionCreatedAt);
  try {
    await createOpinionSnapshotWithPendingOutcomes({
      symbol,
      opinionCreatedAt,
      opinionVersion: OPINION_TRACKING_VERSION,
      finalSignal: opinion.finalVerdict.signal,
      finalConfidence: opinion.finalVerdict.confidence,
      startObservedDate: startClose?.observedDate ?? null,
      startPrice: startClose?.close ?? null,
      opinionPayload: {
        finalVerdict: opinion.finalVerdict,
        agents: opinion.agents.map(agent => ({
          agentName: agent.agentName,
          signal: agent.signal,
          confidence: agent.confidence,
        })),
      },
      sourceSummary: {
        sources: analysisPack.sources,
        asset: analysisPack.asset,
      },
    });
  } catch (error) {
    console.error(`[OpinionTracking] Failed to record snapshot for ${symbol}:`, error);
  }
}
