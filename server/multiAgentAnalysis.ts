import { invokeLLM } from "./_core/llm";
import { getCachedData, setCachedData } from "./db";

const CACHE_TTL_OPINION = 120; // 2 hours
const CACHE_VERSION = "_v3_multi";

interface AgentResult {
  agentName: string;
  signal: string; // 매수/보유/매도
  confidence: string; // 높음/중간/낮음
  reasoning: string;
  keyPoints: string[];
}

interface MultiAgentOpinion {
  agents: AgentResult[];
  finalVerdict: {
    signal: string;
    confidence: string;
    summary: string;
    bullCase: string;
    bearCase: string;
    keyFactors: string[];
    dissent: string; // 소수 의견
  };
  disclaimer: string;
}

// Helper to unwrap API data
function unwrapData(profileData: any, insightsData: any) {
  const profile = profileData?.quoteSummary?.result?.[0] || profileData;
  const insights = insightsData?.finance?.result || insightsData;

  const technicalOutlook = insights?.instrumentInfo?.technicalEvents || {};
  const keyTechnicals = insights?.instrumentInfo?.keyTechnicals || {};
  const valuation = insights?.instrumentInfo?.valuation || {};
  const recommendation = insights?.recommendation || {};
  const companySnapshot = insights?.companySnapshot?.company || {};
  const sectorSnapshot = insights?.companySnapshot?.sector || {};
  const sigDevs = insights?.sigDevs || [];
  const upsell = insights?.upsell || {};

  return {
    profile,
    insights,
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

// Agent 1: Technical Analysis Agent
async function runTechnicalAgent(symbol: string, data: ReturnType<typeof unwrapData>): Promise<AgentResult> {
  const { technicalOutlook, keyTechnicals } = data;

  const prompt = `당신은 기술적 분석 전문가입니다. 차트 패턴과 기술적 지표만을 기반으로 냉철하게 분석합니다.
절대 사실을 지어내지 마세요. 데이터가 없으면 "데이터 부족"이라고 명시하세요.

## ${symbol} 기술적 데이터:
- 단기 전망: 방향 ${technicalOutlook?.shortTermOutlook?.direction || "N/A"}, 점수 ${technicalOutlook?.shortTermOutlook?.score || "N/A"}, 설명 ${technicalOutlook?.shortTermOutlook?.stateDescription || "N/A"}
- 중기 전망: 방향 ${technicalOutlook?.intermediateTermOutlook?.direction || "N/A"}, 점수 ${technicalOutlook?.intermediateTermOutlook?.score || "N/A"}, 설명 ${technicalOutlook?.intermediateTermOutlook?.stateDescription || "N/A"}
- 장기 전망: 방향 ${technicalOutlook?.longTermOutlook?.direction || "N/A"}, 점수 ${technicalOutlook?.longTermOutlook?.score || "N/A"}, 설명 ${technicalOutlook?.longTermOutlook?.stateDescription || "N/A"}
- 지지선: ${keyTechnicals?.support || "N/A"}
- 손절가: ${keyTechnicals?.stopLoss || "N/A"}
- 제공사: ${keyTechnicals?.provider || "N/A"}

## 지시사항:
기술적 지표만으로 판단하세요. 기업 펀더멘털은 무시하세요.
단기/중기/장기 전망의 방향과 점수를 종합하여 투자 시그널을 결정하세요.
점수가 양수면 강세, 음수면 약세입니다. 방향이 "Bullish"면 상승, "Bearish"면 하락 추세입니다.`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "당신은 기술적 분석 전문가입니다. 차트와 기술적 지표만으로 냉철하게 판단합니다. 모든 응답은 한국어로 작성하세요." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "technical_agent",
          strict: true,
          schema: {
            type: "object",
            properties: {
              signal: { type: "string", description: "매수/보유/매도 중 하나" },
              confidence: { type: "string", description: "높음/중간/낮음 중 하나" },
              reasoning: { type: "string", description: "판단 근거 2-3문장" },
              keyPoints: { type: "array", items: { type: "string" }, description: "핵심 포인트 2-3개" },
            },
            required: ["signal", "confidence", "reasoning", "keyPoints"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = result.choices[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return { agentName: "기술적 분석", ...parsed };
  } catch (error) {
    console.error("[MultiAgent] Technical agent failed:", error);
    return {
      agentName: "기술적 분석",
      signal: "보유",
      confidence: "낮음",
      reasoning: "기술적 분석 에이전트 실행 중 오류가 발생했습니다.",
      keyPoints: ["분석 불가"],
    };
  }
}

// Agent 2: Fundamental Analysis Agent
async function runFundamentalAgent(symbol: string, data: ReturnType<typeof unwrapData>): Promise<AgentResult> {
  const { valuation, recommendation, companySnapshot, sectorSnapshot } = data;

  const prompt = `당신은 펀더멘털 분석 전문가입니다. 기업의 내재가치, 밸류에이션, 기업 품질을 기반으로 분석합니다.
절대 사실을 지어내지 마세요. 데이터가 없으면 "데이터 부족"이라고 명시하세요.

## ${symbol} 펀더멘털 데이터:
- 밸류에이션: ${valuation?.description || "N/A"}, 할인율: ${valuation?.discount || "N/A"}, 상대가치: ${valuation?.relativeValue || "N/A"}
- 애널리스트 추천: 등급 ${recommendation?.rating || "N/A"}, 목표가 ${recommendation?.targetPrice || "N/A"}, 애널리스트 수 ${recommendation?.numberOfAnalysts || "N/A"}
- 기업 품질 점수 (0~1 스케일):
  - 혁신성: ${companySnapshot?.innovativeness ?? "N/A"} (섹터 평균: ${sectorSnapshot?.innovativeness ?? "N/A"})
  - 채용: ${companySnapshot?.hiring ?? "N/A"} (섹터 평균: ${sectorSnapshot?.hiring ?? "N/A"})
  - 지속가능성: ${companySnapshot?.sustainability ?? "N/A"} (섹터 평균: ${sectorSnapshot?.sustainability ?? "N/A"})
  - 내부자 감성: ${companySnapshot?.insiderSentiments ?? "N/A"} (섹터 평균: ${sectorSnapshot?.insiderSentiments ?? "N/A"})
  - 배당: ${companySnapshot?.dividends ?? "N/A"} (섹터 평균: ${sectorSnapshot?.dividends ?? "N/A"})

## 지시사항:
밸류에이션이 "Undervalued"면 저평가, "Overvalued"면 고평가입니다.
기업 품질 점수가 섹터 평균보다 높으면 긍정적, 낮으면 부정적으로 판단하세요.
목표가와 현재가의 괴리도 고려하세요.
고평가 상태에서는 매수를 권하지 마세요.`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "당신은 펀더멘털 분석 전문가입니다. 기업 가치와 재무 건전성을 냉철하게 평가합니다. 고평가 종목에 대해서는 비판적 시각을 유지하세요. 모든 응답은 한국어로 작성하세요." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "fundamental_agent",
          strict: true,
          schema: {
            type: "object",
            properties: {
              signal: { type: "string", description: "매수/보유/매도 중 하나" },
              confidence: { type: "string", description: "높음/중간/낮음 중 하나" },
              reasoning: { type: "string", description: "판단 근거 2-3문장" },
              keyPoints: { type: "array", items: { type: "string" }, description: "핵심 포인트 2-3개" },
            },
            required: ["signal", "confidence", "reasoning", "keyPoints"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = result.choices[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return { agentName: "펀더멘털 분석", ...parsed };
  } catch (error) {
    console.error("[MultiAgent] Fundamental agent failed:", error);
    return {
      agentName: "펀더멘털 분석",
      signal: "보유",
      confidence: "낮음",
      reasoning: "펀더멘털 분석 에이전트 실행 중 오류가 발생했습니다.",
      keyPoints: ["분석 불가"],
    };
  }
}

// Agent 3: Risk Management Agent
async function runRiskAgent(symbol: string, data: ReturnType<typeof unwrapData>): Promise<AgentResult> {
  const { technicalOutlook, keyTechnicals, valuation, companySnapshot, sigDevs } = data;

  // Extract recent significant events
  const recentEvents = sigDevs.slice(0, 5).map((e: any) => e.headline || "").filter(Boolean);

  const prompt = `당신은 리스크 관리 전문가입니다. 투자의 하방 리스크와 위험 요인을 식별하는 것이 주 역할입니다.
당신의 임무는 다른 분석가들이 놓칠 수 있는 위험 요인을 찾아내는 것입니다.
절대 사실을 지어내지 마세요. 데이터가 없으면 "데이터 부족"이라고 명시하세요.

## ${symbol} 리스크 관련 데이터:
- 밸류에이션 상태: ${valuation?.description || "N/A"}, 할인율: ${valuation?.discount || "N/A"}
- 손절가: ${keyTechnicals?.stopLoss || "N/A"}
- 지지선: ${keyTechnicals?.support || "N/A"}
- 내부자 감성: ${companySnapshot?.insiderSentiments ?? "N/A"}
- 최근 주요 이벤트: ${recentEvents.length > 0 ? recentEvents.join("; ") : "없음"}
- 기술적 단기 점수: ${technicalOutlook?.shortTermOutlook?.score || "N/A"}

## 지시사항:
항상 비판적 시각을 유지하세요. 리스크를 과소평가하지 마세요.
다음을 반드시 고려하세요:
1. 밸류에이션이 고평가(Overvalued)인 경우 하락 리스크
2. 내부자 감성이 낮은 경우 (0.5 미만) 경영진 신뢰 부족
3. 손절가와 현재가의 거리 (가까우면 위험)
4. 최근 부정적 이벤트 존재 여부
매수를 권하더라도 반드시 리스크 요인을 함께 제시하세요.`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "당신은 리스크 관리 전문가입니다. 항상 비판적이고 보수적인 시각으로 투자 위험을 평가합니다. 낙관적 편향을 경계하세요. 모든 응답은 한국어로 작성하세요." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "risk_agent",
          strict: true,
          schema: {
            type: "object",
            properties: {
              signal: { type: "string", description: "매수/보유/매도 중 하나" },
              confidence: { type: "string", description: "높음/중간/낮음 중 하나" },
              reasoning: { type: "string", description: "판단 근거 2-3문장" },
              keyPoints: { type: "array", items: { type: "string" }, description: "핵심 리스크 요인 2-3개" },
            },
            required: ["signal", "confidence", "reasoning", "keyPoints"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = result.choices[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return { agentName: "리스크 관리", ...parsed };
  } catch (error) {
    console.error("[MultiAgent] Risk agent failed:", error);
    return {
      agentName: "리스크 관리",
      signal: "보유",
      confidence: "낮음",
      reasoning: "리스크 분석 에이전트 실행 중 오류가 발생했습니다.",
      keyPoints: ["분석 불가"],
    };
  }
}

// Agent 4: Final Decision Agent (synthesizes all other agents)
async function runFinalAgent(
  symbol: string,
  technicalResult: AgentResult,
  fundamentalResult: AgentResult,
  riskResult: AgentResult
): Promise<MultiAgentOpinion["finalVerdict"]> {
  const prompt = `당신은 최종 투자 결정을 내리는 수석 분석가입니다. 3명의 전문 분석가의 의견을 종합하여 최종 투자 의견을 도출합니다.
절대 사실을 지어내지 마세요.

## ${symbol} - 각 분석가 의견:

### 1. 기술적 분석가
- 시그널: ${technicalResult.signal} (신뢰도: ${technicalResult.confidence})
- 근거: ${technicalResult.reasoning}
- 핵심 포인트: ${technicalResult.keyPoints.join(", ")}

### 2. 펀더멘털 분석가
- 시그널: ${fundamentalResult.signal} (신뢰도: ${fundamentalResult.confidence})
- 근거: ${fundamentalResult.reasoning}
- 핵심 포인트: ${fundamentalResult.keyPoints.join(", ")}

### 3. 리스크 관리 전문가
- 시그널: ${riskResult.signal} (신뢰도: ${riskResult.confidence})
- 근거: ${riskResult.reasoning}
- 핵심 리스크: ${riskResult.keyPoints.join(", ")}

## 지시사항:
1. 3명의 의견이 일치하면 해당 방향으로 높은 신뢰도를 부여하세요.
2. 의견이 엇갈리면 리스크 관리 전문가의 의견에 더 큰 가중치를 두세요.
3. 리스크 관리 전문가가 "매도"를 권하면 최종 의견을 "매수"로 내지 마세요.
4. 소수 의견(dissent)도 반드시 기록하세요.
5. 강세/약세 관점을 모두 균형 있게 제시하세요.`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "당신은 수석 투자 분석가입니다. 여러 전문가의 의견을 종합하여 균형 잡힌 최종 투자 의견을 도출합니다. 편향 없이 객관적으로 판단하세요. 모든 응답은 한국어로 작성하세요." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "final_verdict",
          strict: true,
          schema: {
            type: "object",
            properties: {
              signal: { type: "string", description: "매수/보유/매도 중 하나" },
              confidence: { type: "string", description: "높음/중간/낮음 중 하나" },
              summary: { type: "string", description: "종합 투자 의견 요약 3-4문장" },
              bullCase: { type: "string", description: "강세 관점 분석 2-3문장" },
              bearCase: { type: "string", description: "약세 관점 분석 2-3문장" },
              keyFactors: { type: "array", items: { type: "string" }, description: "핵심 투자 요인 3-4개" },
              dissent: { type: "string", description: "소수 의견 또는 반대 논거 1-2문장" },
            },
            required: ["signal", "confidence", "summary", "bullCase", "bearCase", "keyFactors", "dissent"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = result.choices[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return parsed;
  } catch (error) {
    console.error("[MultiAgent] Final agent failed:", error);
    return {
      signal: "보유",
      confidence: "낮음",
      summary: "최종 분석 에이전트 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      bullCase: "",
      bearCase: "",
      keyFactors: [],
      dissent: "",
    };
  }
}

// Main multi-agent orchestrator
export async function generateMultiAgentOpinion(
  symbol: string,
  profileData: any,
  insightsData: any,
  holdersData: any
): Promise<MultiAgentOpinion> {
  // Check cache
  const cached = await getCachedData(symbol, "llm_multi_opinion" + CACHE_VERSION);
  if (cached) return cached as MultiAgentOpinion;

  const data = unwrapData(profileData, insightsData);

  // Run agents sequentially to avoid rate limits
  const technicalResult = await runTechnicalAgent(symbol, data);
  const fundamentalResult = await runFundamentalAgent(symbol, data);
  const riskResult = await runRiskAgent(symbol, data);
  const finalVerdict = await runFinalAgent(symbol, technicalResult, fundamentalResult, riskResult);

  const opinion: MultiAgentOpinion = {
    agents: [technicalResult, fundamentalResult, riskResult],
    finalVerdict,
    disclaimer: "본 분석은 AI가 공개 데이터를 기반으로 생성한 참고 정보이며, 실제 투자 결정의 근거로 사용해서는 안 됩니다. 투자에 따른 손실은 전적으로 투자자 본인에게 있습니다.",
  };

  await setCachedData(symbol, "llm_multi_opinion" + CACHE_VERSION, opinion, CACHE_TTL_OPINION);
  return opinion;
}
