import { trpc } from "@/lib/trpc";
import { AlertCircle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import CompanyOverview from "./sections/CompanyOverview";
import TechnicalAnalysis from "./sections/TechnicalAnalysis";
import FinancialValuation from "./sections/FinancialValuation";
import GuidanceSection from "./sections/GuidanceSection";
import ETFSection from "./sections/ETFSection";
import FilingsSection from "./sections/FilingsSection";
import InvestmentOpinion from "./sections/InvestmentOpinion";
import SentimentSection from "./sections/SentimentSection";

interface StockDashboardProps {
  symbol: string;
}

export default function StockDashboard({ symbol }: StockDashboardProps) {
  const profileQuery = trpc.stock.profile.useQuery({ symbol }, { retry: 1 });
  const insightsQuery = trpc.stock.insights.useQuery({ symbol }, { retry: 1 });
  const chartQuery = trpc.stock.chart.useQuery({ symbol, interval: "1d", range: "6mo" }, { retry: 1 });

  const secFilingQuery = trpc.stock.secFiling.useQuery({ symbol }, { retry: 1 });
  const guidanceTranslationQuery = trpc.stock.guidanceTranslation.useQuery({ symbol }, { retry: 1 });
  const opinionQuery = trpc.stock.opinion.useQuery({ symbol }, { retry: 1 });
  const sentimentQuery = trpc.stock.sentiment.useQuery({ symbol }, { retry: 1 });
  const etfHoldingsQuery = trpc.stock.etfHoldings.useQuery({ symbol }, { retry: 1 });

  const isLoading = profileQuery.isLoading;

  // Detect invalid symbol: profile returned null or has error
  const rawProfile = profileQuery.data as any;
  const isInvalidSymbol = !isLoading && (
    rawProfile === null ||
    rawProfile?.quoteSummary?.error ||
    (rawProfile?.quoteSummary?.result === null)
  );

  // Yahoo Finance API returns data wrapped in quoteSummary.result[0]
  const profileData = rawProfile?.quoteSummary?.result?.[0] || rawProfile;

  // Extract insights data from finance.result wrapper
  const rawInsights = insightsQuery.data as any;
  const insightsData = rawInsights?.finance?.result || rawInsights;

  // Extract chart meta for ETF name fallback
  const rawChart = chartQuery.data as any;
  const chartMeta = rawChart?.chart?.result?.[0]?.meta;

  // ETF 판별: fundProfile 존재 또는 chart meta의 instrumentType이 ETF인 경우
  // fundProfile은 Yahoo Finance가 ETF/뮤추얼펀드에만 반환하는 필드
  const isETF = !!(profileData?.fundProfile) || chartMeta?.instrumentType === "ETF";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            <span className="font-mono font-semibold">{symbol}</span> 데이터를 불러오는 중...
          </p>
        </div>
      </div>
    );
  }

  if (isInvalidSymbol) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Card className="bg-card border-border max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">
              유효하지 않은 종목 심볼
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-mono font-semibold text-foreground">{symbol}</span>에 해당하는 종목을 찾을 수 없습니다.
              정확한 티커 심볼을 입력해주세요.
            </p>
            <p className="text-xs text-muted-foreground">
              예시: AAPL (Apple), TSLA (Tesla), MSFT (Microsoft), GOOGL (Google)
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="font-mono">{symbol}</span>
            {(profileData?.price?.shortName || chartMeta?.shortName || chartMeta?.longName) && (
              <span className="ml-3 text-base font-normal text-muted-foreground">
                {profileData?.price?.shortName || chartMeta?.shortName || chartMeta?.longName}
              </span>
            )}
          </h1>
          {profileData?.summaryProfile?.industry && (
            <p className="text-sm text-muted-foreground mt-1">
              {profileData.summaryProfile.industry} · {profileData.summaryProfile.sector}
            </p>
          )}
          {profileData?.fundProfile && (
            <p className="text-sm text-muted-foreground mt-1">
              {profileData.fundProfile.legalType} · {profileData.fundProfile.categoryName}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-secondary border border-border w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="overview" className="text-xs">기업 개요</TabsTrigger>
          <TabsTrigger value="technical" className="text-xs">기술적 분석</TabsTrigger>
          {!isETF && <TabsTrigger value="financial" className="text-xs">재무/밸류에이션</TabsTrigger>}
          {isETF
            ? <TabsTrigger value="etf" className="text-xs">ETF 정보</TabsTrigger>
            : <TabsTrigger value="guidance" className="text-xs">가이던스</TabsTrigger>
          }
          {!isETF && <TabsTrigger value="filings" className="text-xs">공시/규제</TabsTrigger>}
          <TabsTrigger value="opinion" className="text-xs">투자 의견</TabsTrigger>
          <TabsTrigger value="sentiment" className="text-xs">감성 분석</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <CompanyOverview data={profileData} isLoading={profileQuery.isLoading} chartMeta={chartMeta} />
        </TabsContent>

        <TabsContent value="technical" className="mt-4">
          <TechnicalAnalysis
            insights={insightsData}
            chartData={chartQuery.data}
            isLoading={insightsQuery.isLoading || chartQuery.isLoading}
            isETF={isETF}
          />
        </TabsContent>

        {!isETF && (
          <TabsContent value="financial" className="mt-4">
            <FinancialValuation
              insights={insightsData}
              isLoading={insightsQuery.isLoading}
            />
          </TabsContent>
        )}

        {isETF ? (
          <TabsContent value="etf" className="mt-4">
            <ETFSection
              profileData={profileData}
              holdings={etfHoldingsQuery.data}
              isLoadingProfile={profileQuery.isLoading}
              isLoadingHoldings={etfHoldingsQuery.isLoading}
            />
          </TabsContent>
        ) : (
          <TabsContent value="guidance" className="mt-4">
            <GuidanceSection
              insights={insightsData}
              translation={guidanceTranslationQuery.data}
              isLoading={insightsQuery.isLoading}
            />
          </TabsContent>
        )}

        {!isETF && (
          <TabsContent value="filings" className="mt-4">
            <FilingsSection
              filings={secFilingQuery.data}
              insights={insightsData}
              isLoading={secFilingQuery.isLoading}
            />
          </TabsContent>
        )}

        <TabsContent value="opinion" className="mt-4">
          <InvestmentOpinion
            opinion={opinionQuery.data}
            isLoading={opinionQuery.isLoading}
          />
        </TabsContent>

        <TabsContent value="sentiment" className="mt-4">
          <SentimentSection
            sentiment={sentimentQuery.data}
            isLoading={sentimentQuery.isLoading}
            isETF={isETF}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
