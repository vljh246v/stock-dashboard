import {
  ACCOUNT_PENDING_APPROVAL_MSG,
  COOKIE_NAME,
  INVALID_EMAIL_OR_PASSWORD_MSG,
  ONE_YEAR_MS,
} from "@shared/const";
import { normalizeStockSymbol } from "@shared/stockSymbols";
import { TRPCError } from "@trpc/server";
import {
  createSessionToken,
  isUserApproved,
  loginWithEmail,
  registerWithEmail,
} from "./_core/auth";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  approveUser,
  listRecentOpinionTracking,
  getPendingUsers,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateOpinionOutcome,
} from "./db";
import {
  getStockProfile,
  getStockInsights,
  getStockChart,
  getStockHolders,
  getStockSecFiling,
  getETFHoldings,
} from "./stockData";
import { generateAnalysisPack } from "./analysisPack";
import { generateDecisionSummary } from "./decisionSummary";
import {
  generateSentimentAnalysis,
  translateBusinessSummary,
  translateGuidanceData,
} from "./llmAnalysis";
import { generateMultiAgentOpinion } from "./multiAgentAnalysis";
import {
  addMonths,
  resolveOutcomeFromChart,
  type OpinionAlignment,
  type OpinionSignal,
  type OpinionTrackingHorizon,
  type OpinionTrackingStatus,
} from "./opinionTracking";

function toPublicUser(user: {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  approvedAt: Date | null;
} | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    openId: user.openId,
    name: user.name,
    email: user.email,
    loginMethod: user.loginMethod,
    role: user.role,
    approvedAt: user.approvedAt,
  };
}

function toLoginTrpcError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === INVALID_EMAIL_OR_PASSWORD_MSG) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: INVALID_EMAIL_OR_PASSWORD_MSG,
      });
    }
    if (error.message === ACCOUNT_PENDING_APPROVAL_MSG) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ACCOUNT_PENDING_APPROVAL_MSG,
      });
    }
  }

  throw error;
}

async function buildDashboardAnalysis(symbol: string) {
  const profile = await getStockProfile(symbol);
  const [insights, chart, holders, secFilings] = await Promise.all([
    getStockInsights(symbol),
    getStockChart(symbol, "1d", "6mo"),
    getStockHolders(symbol),
    getStockSecFiling(symbol),
  ]);
  const profileData = (profile as any)?.quoteSummary?.result?.[0] || profile;
  const chartMeta = (chart as any)?.chart?.result?.[0]?.meta;
  const isETF =
    !!profileData?.fundProfile || chartMeta?.instrumentType === "ETF";
  const etfHoldings = isETF ? await getETFHoldings(symbol) : null;
  const pack = generateAnalysisPack({
    symbol,
    profile,
    insights,
    chart,
    holders,
    secFilings,
    etfHoldings,
  });
  const decisionSummary = generateDecisionSummary({
    symbol,
    profile,
    insights,
    chart,
    holders,
    secFilings,
    etfHoldings,
  });

  return {
    symbol,
    raw: {
      profile,
      insights,
      chart,
      holders,
      secFilings,
      etfHoldings,
    },
    pack,
    decisionSummary,
  };
}

const dashboardAnalysisInFlight = new Map<
  string,
  Promise<Awaited<ReturnType<typeof buildDashboardAnalysis>>>
>();

async function getDashboardAnalysis(symbol: string) {
  const existing = dashboardAnalysisInFlight.get(symbol);
  if (existing) return existing;

  const pending = buildDashboardAnalysis(symbol);
  dashboardAnalysisInFlight.set(symbol, pending);
  try {
    return await pending;
  } finally {
    dashboardAnalysisInFlight.delete(symbol);
  }
}

async function buildOpinionTracking(symbol: string) {
  const records = await listRecentOpinionTracking(symbol, 1200, addMonths(new Date(), -4));
  const hasResolvableOutcome = records.some(record =>
    record.outcomes.some(outcome =>
      outcome.status !== "resolved" && outcome.targetDate.getTime() <= Date.now()
    )
  );
  const chart = hasResolvableOutcome ? await getStockChart(symbol, "1d", "6mo") : null;

  const rows = [];
  for (const record of records) {
    const outcomes = [];
    for (const outcome of record.outcomes) {
      const resolved = chart
        ? resolveOutcomeFromChart(
            record.snapshot.finalSignal as OpinionSignal,
            record.snapshot.startPrice,
            {
              snapshotId: outcome.snapshotId,
              horizon: outcome.horizon as OpinionTrackingHorizon,
              targetDate: outcome.targetDate,
              status: outcome.status as OpinionTrackingStatus,
              observedDate: outcome.observedDate,
              observedPrice: outcome.observedPrice,
              returnPct: outcome.returnPct,
              alignment: outcome.alignment as OpinionAlignment,
            },
            chart
          )
        : outcome;

      const shouldPersist =
        resolved.status !== outcome.status ||
        resolved.observedDate?.getTime() !== outcome.observedDate?.getTime() ||
        resolved.observedPrice !== outcome.observedPrice ||
        resolved.returnPct !== outcome.returnPct ||
        resolved.alignment !== outcome.alignment;

      const stored = shouldPersist
        ? await updateOpinionOutcome({
            snapshotId: resolved.snapshotId,
            horizon: resolved.horizon as OpinionTrackingHorizon,
            status: resolved.status as OpinionTrackingStatus,
            observedDate: resolved.observedDate,
            observedPrice: resolved.observedPrice,
            returnPct: resolved.returnPct,
            alignment: resolved.alignment as OpinionAlignment,
          })
        : outcome;

      outcomes.push(stored ?? resolved);
    }

    rows.push({
      snapshot: record.snapshot,
      outcomes: outcomes.sort((a, b) => String(a.horizon).localeCompare(String(b.horizon))),
    });
  }

  return {
    symbol,
    rows,
    copy: {
      title: "판단 기록",
      description: "이전에 남긴 판단과 이후 가격 변화를 함께 보여줍니다.",
      empty: "아직 비교할 1개월/3개월 뒤 가격 데이터가 충분하지 않습니다.",
    },
  };
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
        if (isUserApproved(user)) {
          const sessionToken = await createSessionToken(
            { openId: user.openId, name: user.name || "" },
            { expiresInMs: ONE_YEAR_MS }
          );
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, {
            ...cookieOptions,
            maxAge: ONE_YEAR_MS,
          });
        }
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
        const user = await loginWithEmail(input).catch(toLoginTrpcError);
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
    pendingUsers: adminProcedure.query(async () => {
      const users = await getPendingUsers();
      return users.map(toPublicUser);
    }),
    approveUser: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
        })
      )
      .mutation(async ({ input }) => {
        const user = await approveUser(input.userId);
        if (!user) {
          throw new Error("사용자를 찾을 수 없습니다.");
        }
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
      .input(
        z.object({
          symbol: z.string().min(1).max(20),
          name: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const symbol = normalizeStockSymbol(input.symbol);
        // Validate the symbol by attempting to fetch chart data
        const chartData = await getStockChart(symbol, "1d", "5d");
        if (!chartData || (chartData as any)?.chart?.result === null) {
          throw new Error(
            `유효하지 않은 종목 심볼입니다: ${symbol}. 정확한 티커를 입력해주세요 (예: AAPL, TSLA, MSFT).`
          );
        }
        // Try to get company name from profile
        let name = input.name;
        if (!name) {
          try {
            const profile = await getStockProfile(symbol);
            const profileData = profile as any;
            name =
              profileData?.quoteSummary?.result?.[0]?.price?.shortName ||
              profileData?.price?.shortName ||
              profileData?.summaryProfile?.longName ||
              undefined;
          } catch (e) {
            // Name is optional, continue without it
          }
        }
        return addToWatchlist(ctx.user.id, symbol, name);
      }),

    remove: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .mutation(async ({ ctx, input }) => {
        await removeFromWatchlist(
          ctx.user.id,
          normalizeStockSymbol(input.symbol)
        );
        return { success: true };
      }),
  }),

  // Stock Analysis APIs
  stock: router({
    // 회사 기본 정보
    profile: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        const symbol = normalizeStockSymbol(input.symbol);
        const profile = await getStockProfile(symbol);
        // Translate business summary to Korean
        try {
          const profileData =
            (profile as any)?.quoteSummary?.result?.[0] || (profile as any);
          const summary = profileData?.summaryProfile?.longBusinessSummary;
          if (summary && typeof summary === "string" && summary.length > 0) {
            const translated = await translateBusinessSummary(symbol, summary);
            if (translated && translated !== summary) {
              if ((profile as any)?.quoteSummary?.result?.[0]?.summaryProfile) {
                (
                  profile as any
                ).quoteSummary.result[0].summaryProfile.longBusinessSummaryKo =
                  translated;
              } else if ((profile as any)?.summaryProfile) {
                (profile as any).summaryProfile.longBusinessSummaryKo =
                  translated;
              }
            }
          }
        } catch (e) {
          // Translation is optional, continue without it
        }
        return profile;
      }),

    // 차트 분석 (insights + chart)
    insights: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        return getStockInsights(normalizeStockSymbol(input.symbol));
      }),

    // 주가 차트 데이터
    chart: protectedProcedure
      .input(
        z.object({
          symbol: z.string().min(1).max(20),
          interval: z.string().default("1d"),
          range: z.string().default("6mo"),
        })
      )
      .query(async ({ input }) => {
        return getStockChart(
          normalizeStockSymbol(input.symbol),
          input.interval,
          input.range
        );
      }),

    // 내부자 보유 현황
    holders: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        return getStockHolders(normalizeStockSymbol(input.symbol));
      }),

    // 가이던스 번역
    guidanceTranslation: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        const symbol = normalizeStockSymbol(input.symbol);
        const insights = await getStockInsights(symbol);
        const insightsData = (insights as any)?.finance?.result || insights;
        const upsell = insightsData?.upsell || {};
        const sigDevs = insightsData?.sigDevs || [];
        const bullPoints = upsell.msBullishSummary || [];
        const bearPoints = upsell.msBearishSummary || [];
        const earningsHeadlines = sigDevs
          .filter((d: any) => d.headline)
          .map((d: any) => d.headline)
          .slice(0, 10);
        return translateGuidanceData(
          symbol,
          bullPoints,
          bearPoints,
          earningsHeadlines
        );
      }),

    // SEC 공시
    secFiling: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        return getStockSecFiling(normalizeStockSymbol(input.symbol));
      }),

    // 멀티 에이전트 종합 투자 의견
    opinion: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        const symbol = normalizeStockSymbol(input.symbol);
        const analysis = await getDashboardAnalysis(symbol);
        return generateMultiAgentOpinion(
          symbol,
          analysis.raw.profile,
          analysis.raw.insights,
          analysis.raw.holders,
          analysis.raw.chart,
          { analysisPack: analysis.pack }
        );
      }),

    opinionTracking: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        return buildOpinionTracking(normalizeStockSymbol(input.symbol));
      }),

    // 공용 분석 데이터: 각 탭과 보고서가 같은 가공 결과를 공유
    analysisPack: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        return getDashboardAnalysis(normalizeStockSymbol(input.symbol));
      }),

    // 초보자용 조건부 판단 요약
    decisionSummary: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        const analysis = await getDashboardAnalysis(
          normalizeStockSymbol(input.symbol)
        );
        return analysis.decisionSummary;
      }),

    // ETF 구성 종목
    etfHoldings: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        return getETFHoldings(normalizeStockSymbol(input.symbol));
      }),

    // LLM 뉴스 심리 분석
    sentiment: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        const symbol = normalizeStockSymbol(input.symbol);
        const insights = await getStockInsights(symbol);
        return generateSentimentAnalysis(symbol, insights);
      }),
  }),
});

export type AppRouter = typeof appRouter;
