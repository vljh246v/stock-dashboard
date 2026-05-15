import { defaultCacheCoordinator } from "./cacheCoordinator";
import { getCachedData, getLastGoodCachedData, setCachedData } from "./db";
import * as cheerio from "cheerio";
import YahooFinance from "yahoo-finance2";

// Cache TTL in minutes
const CACHE_TTL = {
  profile: 1440, // 24 hours
  insights: 60, // 1 hour
  chart: 30, // 30 minutes
  holders: 1440, // 24 hours
  secFiling: 1440, // 24 hours
};

const yahooFinance = new YahooFinance();
const PROFILE_CACHE_KEY = "profile_v4_financialMetrics";

const quoteSummary = (result: unknown) => ({
  quoteSummary: {
    result: [result],
    error: null,
  },
});

const invalidQuoteSummary = (
  symbol: string,
  description = "Quote not found"
) => ({
  quoteSummary: {
    result: null,
    error: {
      code: "Not Found",
      description: `${description}: ${symbol.toUpperCase()}`,
    },
  },
});

const financeResult = (result: unknown) => ({
  finance: {
    result,
  },
});

function chartPeriod1(range: string): Date {
  const now = new Date();
  const match = /^(\d+)(d|mo|y)$/.exec(range);
  if (!match) {
    now.setMonth(now.getMonth() - 6);
    return now;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "d") now.setDate(now.getDate() - amount);
  if (unit === "mo") now.setMonth(now.getMonth() - amount);
  if (unit === "y") now.setFullYear(now.getFullYear() - amount);
  return now;
}

export async function getStockProfile(symbol: string) {
  const normalized = symbol.toUpperCase();
  return defaultCacheCoordinator.refresh({
    key: `${normalized}:${PROFILE_CACHE_KEY}`,
    readFresh: () => getCachedData(normalized, PROFILE_CACHE_KEY),
    readLastGood: () => getLastGoodCachedData(normalized, PROFILE_CACHE_KEY),
    write: value => setCachedData(normalized, PROFILE_CACHE_KEY, value, CACHE_TTL.profile),
    produce: async () => {
      const data = await yahooFinance.quoteSummary(normalized, {
        modules: [
          "summaryProfile",
          "price",
          "summaryDetail",
          "defaultKeyStatistics",
          "quoteType",
          "fundProfile",
          "financialData",
          "earnings",
          "earningsHistory",
          "earningsTrend",
          "calendarEvents",
        ],
      });
      return quoteSummary(data);
    },
    failureValue: invalidQuoteSummary(normalized),
  });
}

export async function getStockInsights(symbol: string) {
  const normalized = symbol.toUpperCase();
  return defaultCacheCoordinator.refresh({
    key: `${normalized}:insights`,
    readFresh: () => getCachedData(normalized, "insights"),
    readLastGood: () => getLastGoodCachedData(normalized, "insights"),
    write: value => setCachedData(normalized, "insights", value, CACHE_TTL.insights),
    produce: async () => {
      try {
        const data = await yahooFinance.insights(normalized, {
          reportsCount: 10,
        });
        return financeResult(data);
      } catch (error) {
        console.error(`[StockData] Failed to fetch insights for ${normalized}:`, error);
        throw error;
      }
    },
    failureValue: null as any,
  });
}

export async function getStockChart(
  symbol: string,
  interval: string = "1d",
  range: string = "6mo"
) {
  const normalized = symbol.toUpperCase();
  const cacheKey = `chart_${interval}_${range}`;
  return defaultCacheCoordinator.refresh({
    key: `${normalized}:${cacheKey}`,
    readFresh: () => getCachedData(normalized, cacheKey),
    readLastGood: () => getLastGoodCachedData(normalized, cacheKey),
    write: value => setCachedData(normalized, cacheKey, value, CACHE_TTL.chart),
    produce: async () => {
      try {
        const data = await yahooFinance.chart(normalized, {
          period1: chartPeriod1(range),
          interval: interval as any,
          return: "object",
        });
        return { chart: { result: [data], error: null } };
      } catch (error) {
        console.error(`[StockData] Failed to fetch chart for ${normalized}:`, error);
        throw error;
      }
    },
    failureValue: null as any,
  });
}

export async function getStockHolders(symbol: string) {
  const normalized = symbol.toUpperCase();
  return defaultCacheCoordinator.refresh({
    key: `${normalized}:holders`,
    readFresh: () => getCachedData(normalized, "holders"),
    readLastGood: () => getLastGoodCachedData(normalized, "holders"),
    write: value => setCachedData(normalized, "holders", value, CACHE_TTL.holders),
    produce: async () => {
      try {
        const data = await yahooFinance.quoteSummary(normalized, {
          modules: [
            "insiderHolders",
            "insiderTransactions",
            "institutionOwnership",
            "majorHoldersBreakdown",
          ],
        });
        return quoteSummary(data);
      } catch (error) {
        console.error(`[StockData] Failed to fetch holders for ${normalized}:`, error);
        throw error;
      }
    },
    failureValue: null as any,
  });
}

/**
 * Fetch ETF top holdings from stockanalysis.com (supports all ETFs)
 */
async function fetchStockAnalysisHoldings(
  symbol: string
): Promise<any[] | null> {
  try {
    const url = `https://stockanalysis.com/etf/${symbol.toLowerCase()}/holdings/`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    const holdings: any[] = [];
    $("table tbody tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 4) return;

      const symbolText = $(cells[1]).text().trim();
      const name = $(cells[2]).text().trim();
      const weightText = $(cells[3]).text().trim().replace("%", "");
      const sharesText = $(cells[4])?.text().trim().replace(/,/g, "") || "";

      const weight = parseFloat(weightText);
      if (!name || isNaN(weight)) return;

      holdings.push({
        symbol: symbolText || name,
        name,
        weight,
        shares: sharesText ? parseInt(sharesText, 10) || null : null,
      });
    });

    return holdings.length > 0 ? holdings.slice(0, 10) : null;
  } catch (e) {
    console.error(
      `[StockData] stockanalysis.com fetch failed for ${symbol}:`,
      e
    );
    return null;
  }
}

export async function getETFHoldings(symbol: string) {
  const normalized = symbol.toUpperCase();
  return defaultCacheCoordinator.refresh({
    key: `${normalized}:etfHoldings`,
    readFresh: () => getCachedData(normalized, "etfHoldings"),
    readLastGood: () => getLastGoodCachedData(normalized, "etfHoldings"),
    write: value => setCachedData(normalized, "etfHoldings", value, 1440),
    produce: () => fetchETFHoldingsFresh(normalized),
    failureValue: null as any,
  });
}

async function fetchETFHoldingsFresh(symbol: string) {
  // 1. Try Vanguard API first (most accurate for Vanguard ETFs)
  try {
    const vanguardUrl = `https://investor.vanguard.com/investment-products/etfs/profile/api/${symbol.toUpperCase()}/portfolio-holding/stock`;
    const vanguardRes = await fetch(vanguardUrl, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (vanguardRes.ok) {
      const data = (await vanguardRes.json()) as any;
      const entities = data?.fund?.entity || [];
      if (entities.length > 0) {
        const holdings = entities
          .sort(
            (a: any, b: any) =>
              parseFloat(b.percentWeight) - parseFloat(a.percentWeight)
          )
          .slice(0, 10)
          .map((e: any) => ({
            symbol: e.ticker,
            name: e.longName || e.shortName,
            weight: parseFloat(e.percentWeight),
            shares: null,
          }));
        const result = {
          holdings,
          source: "Vanguard",
          asOfDate: data.asOfDate,
        };
        return result;
      }
    }
  } catch (e) {
    // Vanguard API failed, try stockanalysis.com
  }

  // 2. Fallback: stockanalysis.com (supports all ETFs)
  const saHoldings = await fetchStockAnalysisHoldings(symbol);
  if (saHoldings && saHoldings.length > 0) {
    const result = {
      holdings: saHoldings,
      source: "stockanalysis.com",
      asOfDate: null,
    };
    return result;
  }

  return null;
}

export async function getStockSecFiling(symbol: string) {
  const normalized = symbol.toUpperCase();
  return defaultCacheCoordinator.refresh({
    key: `${normalized}:secFiling`,
    readFresh: () => getCachedData(normalized, "secFiling"),
    readLastGood: () => getLastGoodCachedData(normalized, "secFiling"),
    write: value => setCachedData(normalized, "secFiling", value, CACHE_TTL.secFiling),
    produce: async () => {
      try {
        const data = await yahooFinance.quoteSummary(normalized, {
          modules: ["secFilings"],
        });
        return quoteSummary(data);
      } catch (error) {
        console.error(
          `[StockData] Failed to fetch SEC filings for ${normalized}:`,
          error
        );
        throw error;
      }
    },
    failureValue: null as any,
  });
}
