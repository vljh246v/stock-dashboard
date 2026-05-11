import { COOKIE_NAME } from "@shared/const";
import { ONE_YEAR_MS } from "@shared/const";
import {
  createSessionToken,
  loginWithEmail,
  registerWithEmail,
} from "./_core/auth";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "./db";
import { getStockProfile, getStockInsights, getStockChart, getStockHolders, getStockSecFiling, getETFHoldings } from "./stockData";
import { generateSentimentAnalysis, translateBusinessSummary, translateGuidanceData } from "./llmAnalysis";
import { generateMultiAgentOpinion } from "./multiAgentAnalysis";

function toPublicUser<T extends { passwordHash?: unknown } | null>(user: T) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => toPublicUser(opts.ctx.user)),
    register: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(8),
          name: z.string().min(1).max(100).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await registerWithEmail(input);
        const sessionToken = await createSessionToken(
          { openId: user.openId, name: user.name || "" },
          { expiresInMs: ONE_YEAR_MS }
        );
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        return toPublicUser(user);
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await loginWithEmail(input);
        const sessionToken = await createSessionToken(
          { openId: user.openId, name: user.name || "" },
          { expiresInMs: ONE_YEAR_MS }
        );
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        return toPublicUser(user);
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Watchlist CRUD
  watchlist: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getWatchlist(ctx.user.id);
    }),

    add: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20), name: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const symbol = input.symbol.toUpperCase();
        // Validate the symbol by attempting to fetch chart data
        const chartData = await getStockChart(symbol, "1d", "5d");
        if (!chartData || (chartData as any)?.chart?.result === null) {
          throw new Error(`유효하지 않은 종목 심볼입니다: ${symbol}. 정확한 티커를 입력해주세요 (예: AAPL, TSLA, MSFT).`);
        }
        // Try to get company name from profile
        let name = input.name;
        if (!name) {
          try {
            const profile = await getStockProfile(symbol);
            const profileData = profile as any;
            name = profileData?.quoteSummary?.result?.[0]?.price?.shortName ||
                   profileData?.price?.shortName ||
                   profileData?.summaryProfile?.longName || undefined;
          } catch (e) {
            // Name is optional, continue without it
          }
        }
        return addToWatchlist(ctx.user.id, symbol, name);
      }),

    remove: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .mutation(async ({ ctx, input }) => {
        await removeFromWatchlist(ctx.user.id, input.symbol);
        return { success: true };
      }),
  }),

  // Stock Analysis APIs
  stock: router({
    // 기업 개요
    profile: publicProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        const profile = await getStockProfile(input.symbol);
        // Translate business summary to Korean
        try {
          const profileData = (profile as any)?.quoteSummary?.result?.[0] || (profile as any);
          const summary = profileData?.summaryProfile?.longBusinessSummary;
          if (summary && typeof summary === "string" && summary.length > 0) {
            const translated = await translateBusinessSummary(input.symbol, summary);
            if (translated && translated !== summary) {
              if ((profile as any)?.quoteSummary?.result?.[0]?.summaryProfile) {
                (profile as any).quoteSummary.result[0].summaryProfile.longBusinessSummaryKo = translated;
              } else if ((profile as any)?.summaryProfile) {
                (profile as any).summaryProfile.longBusinessSummaryKo = translated;
              }
            }
          }
        } catch (e) {
          // Translation is optional, continue without it
        }
        return profile;
      }),

    // 기술적 분석 (insights + chart)
    insights: publicProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        return getStockInsights(input.symbol);
      }),

    // 주가 차트 데이터
    chart: publicProcedure
      .input(z.object({
        symbol: z.string().min(1).max(20),
        interval: z.string().default("1d"),
        range: z.string().default("6mo"),
      }))
      .query(async ({ input }) => {
        return getStockChart(input.symbol, input.interval, input.range);
      }),

    // 내부자 보유 현황
    holders: publicProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        return getStockHolders(input.symbol);
      }),

    // 가이던스 번역
    guidanceTranslation: publicProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        const insights = await getStockInsights(input.symbol);
        const insightsData = (insights as any)?.finance?.result || insights;
        const upsell = insightsData?.upsell || {};
        const sigDevs = insightsData?.sigDevs || [];
        const bullPoints = upsell.msBullishSummary || [];
        const bearPoints = upsell.msBearishSummary || [];
        const earningsHeadlines = sigDevs
          .filter((d: any) => d.headline)
          .map((d: any) => d.headline)
          .slice(0, 10);
        return translateGuidanceData(input.symbol, bullPoints, bearPoints, earningsHeadlines);
      }),

    // SEC 공시
    secFiling: publicProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        return getStockSecFiling(input.symbol);
      }),

    // 멀티 에이전트 종합 투자 의견
    opinion: publicProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        // Fetch sequentially to avoid rate limit issues
        const profile = await getStockProfile(input.symbol);
        const insights = await getStockInsights(input.symbol);
        const holders = await getStockHolders(input.symbol);
        return generateMultiAgentOpinion(input.symbol, profile, insights, holders);
      }),

    // ETF 구성 종목
    etfHoldings: publicProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        return getETFHoldings(input.symbol);
      }),

    // LLM 뉴스 감성 분석
    sentiment: publicProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        const insights = await getStockInsights(input.symbol);
        return generateSentimentAnalysis(input.symbol, insights);
      }),
  }),
});

export type AppRouter = typeof appRouter;
