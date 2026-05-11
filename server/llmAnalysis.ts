import { invokeLLM } from "./_core/llm";
import { getCachedData, setCachedData } from "./db";

const CACHE_TTL_OPINION = 120; // 2 hours
const CACHE_TTL_SENTIMENT = 60; // 1 hour
// Version suffix to invalidate stale caches after data parsing fixes
const CACHE_VERSION = "_v2";

export async function generateSentimentAnalysis(
  symbol: string,
  insightsData: any
) {
  const cached = await getCachedData(symbol, "llm_sentiment" + CACHE_VERSION);
  if (cached) return cached;

  // Unwrap insights data from finance.result wrapper
  const insights = insightsData?.finance?.result || insightsData;
  const sigDevs = insights?.sigDevs || [];
  const reports = insights?.reports || [];

  // reports 중 해당 종목 티커가 포함된 것만 필터링하여 종목별 고유성 확보
  const symbolUpper = symbol.toUpperCase();
  const relevantReports = reports.filter((r: any) => {
    const tickers: string[] = r.tickers || [];
    // 티커 목록이 없거나 해당 종목이 포함된 경우만 사용
    return tickers.length === 0 || tickers.includes(symbolUpper);
  });

  const newsItems = [
    ...sigDevs.map((d: any) => `[주요이벤트] ${d.headline} (${d.date || "날짜 미상"})`),
    ...relevantReports.slice(0, 8).map((r: any) => {
      const headline = r.headHtml || r.title || r.reportTitle || "제목 없음";
      const date = r.reportDate ? r.reportDate.substring(0, 10) : "날짜 미상";
      return `[애널리스트리포트] ${headline} - ${r.provider || "N/A"} (${date})`;
    }),
  ].slice(0, 10);

  if (newsItems.length === 0) {
    return {
      noData: true,
      overallSentiment: "",
      sentimentScore: null,
      newsAnalysis: [],
      marketImpact: "현재 이 종목에 대한 최신 뉴스/이벤트 데이터가 없습니다.",
    };
  }

  const systemPrompt = `당신은 금융 뉴스 감성 분석 전문가입니다. 제공된 실제 뉴스/이벤트 데이터만을 기반으로 감성 분석을 수행합니다.
절대 사실을 지어내거나 거짓 정보를 생성하지 마세요. 데이터가 없는 부분은 "데이터 부족"으로 명시하세요.
모든 응답은 자연스러운 한국어로 작성하세요.`;

  const userPrompt = `다음 ${symbol} 종목 관련 뉴스/이벤트를 분석하여 감성 점수를 매겨주세요.

## 뉴스/이벤트 목록:
${newsItems.map((item: string, i: number) => `${i + 1}. ${item}`).join("\n")}

## 응답 형식 (JSON):
{
  "overallSentiment": "긍정/부정/중립 중 하나",
  "sentimentScore": 0-100 사이 숫자 (50이 중립, 100이 매우 긍정),
  "newsAnalysis": [
    {"headline": "뉴스 제목 요약(한글)", "sentiment": "긍정/부정/중립", "impact": "시장 영향 한줄 설명(한글)"}
  ],
  "marketImpact": "전체 시장 영향 요약 (2-3문장, 한글)"
}`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "sentiment_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              overallSentiment: { type: "string", description: "전체 감성" },
              sentimentScore: { type: "number", description: "감성 점수 0-100" },
              newsAnalysis: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    headline: { type: "string" },
                    sentiment: { type: "string" },
                    impact: { type: "string" },
                  },
                  required: ["headline", "sentiment", "impact"],
                  additionalProperties: false,
                },
              },
              marketImpact: { type: "string", description: "시장 영향 요약" },
            },
            required: ["overallSentiment", "sentimentScore", "newsAnalysis", "marketImpact"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    await setCachedData(symbol, "llm_sentiment" + CACHE_VERSION, parsed, CACHE_TTL_SENTIMENT);
    return parsed;
  } catch (error) {
    console.error("[LLM] Sentiment analysis failed:", error);
    return {
      error: true,
      overallSentiment: "",
      sentimentScore: null,
      newsAnalysis: [],
      marketImpact: "감성 분석을 생성할 수 없습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}

export async function translateBusinessSummary(
  symbol: string,
  englishSummary: string
): Promise<string> {
  if (!englishSummary || englishSummary.trim() === "") return "";

  // Check cache first
  const cached = await getCachedData(symbol, "llm_summary_ko");
  if (cached && typeof cached === "string") return cached;

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `당신은 전문 금융 번역가입니다. 영문 기업 사업 요약을 자연스럽고 정확한 한국어로 번역합니다.
번역 시 금융/비즈니스 용어를 정확히 사용하고, 원문의 의미를 충실히 전달하세요.
번역문만 출력하고 다른 설명은 추가하지 마세요.`,
        },
        {
          role: "user",
          content: `다음 기업 사업 요약을 한국어로 번역해주세요:\n\n${englishSummary}`,
        },
      ],
    });
    const translated = result.choices[0]?.message?.content;
    if (translated && typeof translated === "string") {
      await setCachedData(symbol, "llm_summary_ko", translated, 1440); // 24h cache
      return translated;
    }
    return englishSummary;
  } catch (error) {
    console.error("[LLM] Translation failed:", error);
    return englishSummary; // fallback to English
  }
}

export async function translateGuidanceData(
  symbol: string,
  bullPoints: string[],
  bearPoints: string[],
  earningsHeadlines: string[]
): Promise<{ bullPointsKo: string[]; bearPointsKo: string[]; earningsHeadlinesKo: string[] }> {
  const cacheKey = "llm_guidance_ko";
  const cached = await getCachedData(symbol, cacheKey);
  if (cached) return cached as any;

  const textToTranslate: string[] = [];
  const bullCount = bullPoints.length;
  const bearCount = bearPoints.length;
  const earningsCount = earningsHeadlines.length;

  textToTranslate.push(...bullPoints, ...bearPoints, ...earningsHeadlines);

  if (textToTranslate.length === 0) {
    return { bullPointsKo: [], bearPointsKo: [], earningsHeadlinesKo: [] };
  }

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `당신은 전문 금융 번역가입니다. 영문 금융 분석 텍스트를 자연스럽고 정확한 한국어로 번역합니다.
각 항목을 줄바꿈으로 구분하여 번역해주세요. 원문의 개수와 동일한 개수의 번역문을 출력하세요.
번역문만 출력하고 다른 설명은 추가하지 마세요. 번호를 붙이지 마세요.`,
        },
        {
          role: "user",
          content: `다음 ${textToTranslate.length}개 항목을 각각 한국어로 번역해주세요. 각 번역은 줄바꿈으로 구분:\n\n${textToTranslate.join("\n---\n")}`,
        },
      ],
    });
    const content = result.choices[0]?.message?.content;
    if (content && typeof content === "string") {
      const lines = content.split(/\n---\n|\n/).filter((l: string) => l.trim() !== "");
      const bullPointsKo = lines.slice(0, bullCount);
      const bearPointsKo = lines.slice(bullCount, bullCount + bearCount);
      const earningsHeadlinesKo = lines.slice(bullCount + bearCount, bullCount + bearCount + earningsCount);

      const result_data = {
        bullPointsKo: bullPointsKo.length === bullCount ? bullPointsKo : bullPoints,
        bearPointsKo: bearPointsKo.length === bearCount ? bearPointsKo : bearPoints,
        earningsHeadlinesKo: earningsHeadlinesKo.length === earningsCount ? earningsHeadlinesKo : earningsHeadlines,
      };
      await setCachedData(symbol, cacheKey, result_data, 720); // 12h cache
      return result_data;
    }
    return { bullPointsKo: bullPoints, bearPointsKo: bearPoints, earningsHeadlinesKo: earningsHeadlines };
  } catch (error) {
    console.error("[LLM] Guidance translation failed:", error);
    return { bullPointsKo: bullPoints, bearPointsKo: bearPoints, earningsHeadlinesKo: earningsHeadlines };
  }
}
