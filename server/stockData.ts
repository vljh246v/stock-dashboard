import { getCachedData, setCachedData } from "./db";
import * as cheerio from "cheerio";
import YahooFinance from "yahoo-finance2";

// Cache TTL in minutes
const CACHE_TTL = {
  profile: 1440, // 24 hours
  insights: 60,  // 1 hour
  chart: 30,     // 30 minutes
  holders: 1440, // 24 hours
  secFiling: 1440, // 24 hours
};

const yahooFinance = new YahooFinance();

const quoteSummary = (result: unknown) => ({
  quoteSummary: {
    result: [result],
    error: null,
  },
});

const invalidQuoteSummary = (symbol: string, description = "Quote not found") => ({
  quoteSummary: {
    result: null,
    error: { code: "Not Found", description: `${description}: ${symbol.toUpperCase()}` },
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
  const cached = await getCachedData(symbol, "profile");
  if (cached) return cached;

  try {
    const data = await yahooFinance.quoteSummary(symbol.toUpperCase(), {
      modules: ["summaryProfile", "price", "quoteType"],
    });
    const wrapped = quoteSummary(data);
    await setCachedData(symbol, "profile", wrapped, CACHE_TTL.profile);
    return wrapped;
  } catch (error) {
    console.error(`[StockData] Failed to fetch profile for ${symbol}:`, error);
    return invalidQuoteSummary(symbol);
  }
}

export async function getStockInsights(symbol: string) {
  const cached = await getCachedData(symbol, "insights");
  if (cached) return cached;

  try {
    const data = await yahooFinance.insights(symbol.toUpperCase(), {
      reportsCount: 10,
    });
    const wrapped = financeResult(data);
    await setCachedData(symbol, "insights", wrapped, CACHE_TTL.insights);
    return wrapped;
  } catch (error) {
    console.error(`[StockData] Failed to fetch insights for ${symbol}:`, error);
    return null;
  }
}

export async function getStockChart(symbol: string, interval: string = "1d", range: string = "6mo") {
  const cacheKey = `chart_${interval}_${range}`;
  const cached = await getCachedData(symbol, cacheKey);
  if (cached) return cached;

  try {
    const data = await yahooFinance.chart(symbol.toUpperCase(), {
      period1: chartPeriod1(range),
      interval: interval as any,
      return: "object",
    });
    const wrapped = { chart: { result: [data], error: null } };
    await setCachedData(symbol, cacheKey, wrapped, CACHE_TTL.chart);
    return wrapped;
  } catch (error) {
    console.error(`[StockData] Failed to fetch chart for ${symbol}:`, error);
    return null;
  }
}

export async function getStockHolders(symbol: string) {
  const cached = await getCachedData(symbol, "holders");
  if (cached) return cached;

  try {
    const data = await yahooFinance.quoteSummary(symbol.toUpperCase(), {
      modules: [
        "insiderHolders",
        "insiderTransactions",
        "institutionOwnership",
        "majorHoldersBreakdown",
      ],
    });
    const wrapped = quoteSummary(data);
    await setCachedData(symbol, "holders", wrapped, CACHE_TTL.holders);
    return wrapped;
  } catch (error) {
    console.error(`[StockData] Failed to fetch holders for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch ETF top holdings from stockanalysis.com (supports all ETFs)
 */
async function fetchStockAnalysisHoldings(symbol: string): Promise<any[] | null> {
  try {
    const url = `https://stockanalysis.com/etf/${symbol.toLowerCase()}/holdings/`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    const holdings: any[] = [];
    $('table tbody tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 4) return;

      const symbolText = $(cells[1]).text().trim();
      const name = $(cells[2]).text().trim();
      const weightText = $(cells[3]).text().trim().replace('%', '');
      const sharesText = $(cells[4])?.text().trim().replace(/,/g, '') || '';

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
    console.error(`[StockData] stockanalysis.com fetch failed for ${symbol}:`, e);
    return null;
  }
}

export async function getETFHoldings(symbol: string) {
  const cached = await getCachedData(symbol, "etfHoldings");
  if (cached) return cached;

  // 1. Try Vanguard API first (most accurate for Vanguard ETFs)
  try {
    const vanguardUrl = `https://investor.vanguard.com/investment-products/etfs/profile/api/${symbol.toUpperCase()}/portfolio-holding/stock`;
    const vanguardRes = await fetch(vanguardUrl, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (vanguardRes.ok) {
      const data = await vanguardRes.json() as any;
      const entities = data?.fund?.entity || [];
      if (entities.length > 0) {
        const holdings = entities
          .sort((a: any, b: any) => parseFloat(b.percentWeight) - parseFloat(a.percentWeight))
          .slice(0, 10)
          .map((e: any) => ({
            symbol: e.ticker,
            name: e.longName || e.shortName,
            weight: parseFloat(e.percentWeight),
            shares: null,
          }));
        const result = { holdings, source: "Vanguard", asOfDate: data.asOfDate };
        await setCachedData(symbol, "etfHoldings", result, 1440);
        return result;
      }
    }
  } catch (e) {
    // Vanguard API failed, try stockanalysis.com
  }

  // 2. Fallback: stockanalysis.com (supports all ETFs)
  const saHoldings = await fetchStockAnalysisHoldings(symbol);
  if (saHoldings && saHoldings.length > 0) {
    const result = { holdings: saHoldings, source: "stockanalysis.com", asOfDate: null };
    await setCachedData(symbol, "etfHoldings", result, 1440);
    return result;
  }

  return null;
}

export async function getStockSecFiling(symbol: string) {
  const cached = await getCachedData(symbol, "secFiling");
  if (cached) return cached;

  try {
    const data = await yahooFinance.quoteSummary(symbol.toUpperCase(), {
      modules: ["secFilings"],
    });
    const wrapped = quoteSummary(data);
    await setCachedData(symbol, "secFiling", wrapped, CACHE_TTL.secFiling);
    return wrapped;
  } catch (error) {
    console.error(`[StockData] Failed to fetch SEC filings for ${symbol}:`, error);
    return null;
  }
}
