import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  translateFinancialTerm,
  translateFinancialText,
} from "@shared/financialTerms";
import { formatReportDate, reportDateSortKey } from "@shared/reportDates";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  BarChart3,
  FileText,
} from "lucide-react";

interface Props {
  insights: any;
  evidence?: Array<{
    label: string;
    value: string;
    comparison?: string;
    source: string;
    asOf?: unknown;
  }>;
  translation?: {
    bullPointsKo: string[];
    bearPointsKo: string[];
    earningsHeadlinesKo: string[];
  };
  isLoading: boolean;
}

export default function GuidanceSection({
  insights,
  evidence,
  translation,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  const isTranslating = !translation;
  const evidenceItems = evidence || [];

  // ETF 판별: recommendation, upsell, reports 모두 없으면 ETF/지수 상품
  const isETF =
    evidence === undefined &&
    !insights?.recommendation &&
    !insights?.upsell &&
    !insights?.reports?.length;

  const upsell = insights?.upsell || {};
  const recommendation = insights?.recommendation || {};
  const sigDevs = insights?.sigDevs || [];
  const valuation = insights?.instrumentInfo?.valuation || {};
  const companyName = upsell.companyName || insights?.symbol || "";
  const displayDate = (value: unknown) =>
    formatReportDate(value) || "날짜 미상";

  // Extract earnings-related sigDevs
  const earningsEvents = sigDevs.filter(
    (d: any) =>
      d.headline?.toLowerCase().includes("revenue") ||
      d.headline?.toLowerCase().includes("earnings") ||
      d.headline?.toLowerCase().includes("eps") ||
      d.headline?.toLowerCase().includes("profit") ||
      d.headline?.toLowerCase().includes("guidance") ||
      d.headline?.toLowerCase().includes("forecast") ||
      d.headline?.toLowerCase().includes("outlook") ||
      d.headline?.toLowerCase().includes("estimate") ||
      d.headline?.toLowerCase().includes("quarter") ||
      d.headline?.toLowerCase().includes("q1") ||
      d.headline?.toLowerCase().includes("q2") ||
      d.headline?.toLowerCase().includes("q3") ||
      d.headline?.toLowerCase().includes("q4")
  );

  const bullPoints = upsell.msBullishSummary || [];
  const bearPoints = upsell.msBearishSummary || [];
  const publishDate =
    formatReportDate(upsell.msBullishBearishSummariesPublishDate) || null;

  // recommendation.targetPrice가 없을 경우 reports에서 최신 목표주가 집계
  const reports = insights?.reports || [];
  const reportsWithTarget = reports
    .filter((r: any) => r.targetPrice != null)
    .sort((a: any, b: any) =>
      reportDateSortKey(b.reportDate).localeCompare(
        reportDateSortKey(a.reportDate)
      )
    );
  const latestReportTarget = reportsWithTarget[0];
  // 최종 목표주가: recommendation.targetPrice 우선, 없으면 최신 리포트 targetPrice
  const targetPrice: number | null =
    recommendation.targetPrice ?? latestReportTarget?.targetPrice ?? null;
  const targetPriceProvider: string =
    recommendation.provider || latestReportTarget?.provider || "";
  const targetPriceNote: string | null =
    recommendation.targetPrice == null && latestReportTarget
      ? `최신 리포트 기준 (${reportsWithTarget.length}개 리포트 중)`
      : null;

  // ETF일 경우 전용 안내 UI 표시
  if (isETF) {
    const technicalEvents = insights?.instrumentInfo?.technicalEvents || {};
    const keyTechnicals = insights?.instrumentInfo?.keyTechnicals || {};
    const hasTechnicalData =
      technicalEvents.shortTermOutlook ||
      technicalEvents.intermediateTermOutlook ||
      technicalEvents.longTermOutlook;
    return (
      <div className="space-y-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">ETF / 지수 상품 안내</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ETF와 지수 상품은 개별 종목처럼 목표 주가나 강세·약세 리포트가
              제공되지 않는 경우가 많습니다. 차트 탭에서 단기·중기·장기 흐름을
              확인해 주세요.
            </p>
            {hasTechnicalData && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  {
                    label: "단기 전망",
                    data: technicalEvents.shortTermOutlook,
                  },
                  {
                    label: "중기 전망",
                    data: technicalEvents.intermediateTermOutlook,
                  },
                  { label: "장기 전망", data: technicalEvents.longTermOutlook },
                ].map(({ label, data }) => (
                  <div
                    key={label}
                    className="p-3 rounded-md bg-secondary/40 text-center"
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      {label}
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        data?.direction === "Bullish"
                          ? "text-stock-up"
                          : data?.direction === "Bearish"
                            ? "text-stock-down"
                            : "text-muted-foreground"
                      }`}
                    >
                      {translateFinancialTerm(data?.direction)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {(keyTechnicals.support || keyTechnicals.stopLoss) && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {keyTechnicals.support && (
                  <div className="p-3 rounded-md bg-secondary/40">
                    <p className="text-xs text-muted-foreground">지지선</p>
                    <p className="text-sm font-mono font-semibold">
                      ${keyTechnicals.support.toFixed(2)}
                    </p>
                  </div>
                )}
                {keyTechnicals.stopLoss && (
                  <div className="p-3 rounded-md bg-secondary/40">
                    <p className="text-xs text-muted-foreground">손절 기준</p>
                    <p className="text-sm font-mono font-semibold">
                      ${keyTechnicals.stopLoss.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Analyst Target & Valuation Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">목표 주가</p>
              <p className="text-lg font-mono font-semibold">
                {targetPrice != null ? `$${targetPrice.toFixed(2)}` : "N/A"}
              </p>
              {targetPriceProvider && (
                <p className="text-xs text-muted-foreground">
                  {targetPriceProvider}
                </p>
              )}
              {targetPriceNote && (
                <p className="text-xs text-muted-foreground/70 italic">
                  {targetPriceNote}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-chart-3" />
            <div>
              <p className="text-xs text-muted-foreground">밸류에이션 상태</p>
              <p className="text-sm font-semibold">
                {translateFinancialTerm(valuation.description)}
              </p>
              {valuation.discount && (
                <p className="text-xs text-muted-foreground">
                  할인율: {valuation.discount}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-5 w-5 text-chart-1" />
            <div>
              <p className="text-xs text-muted-foreground">투자 의견</p>
              <p className="text-sm font-semibold">
                {translateFinancialTerm(recommendation.rating)}
              </p>
              {recommendation.provider && (
                <p className="text-xs text-muted-foreground">
                  {recommendation.provider}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            확인된 실적 근거
          </CardTitle>
        </CardHeader>
        <CardContent>
          {evidenceItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {evidenceItems.map((item, idx) => (
                <div
                  key={`${item.label}-${idx}`}
                  className="rounded-md border border-border bg-secondary/20 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {item.label}
                    </p>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      검증 데이터
                    </Badge>
                  </div>
                  <p className="mt-1 text-lg font-mono font-semibold">
                    {item.value}
                  </p>
                  {item.comparison && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.comparison}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    출처: {item.source}
                    {item.asOf ? ` · 기준일: ${displayDate(item.asOf)}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
              확인된 실적 근거 데이터가 없습니다. LLM 추정 숫자는 신뢰 근거로
              표시하지 않습니다.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Earnings Events / Guidance Signals */}
      {earningsEvents.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              실적 발표와 전망 변화
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {earningsEvents.map((event: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-md bg-secondary/30"
                >
                  <div className="shrink-0 mt-0.5">
                    {event.headline?.toLowerCase().includes("beat") ||
                    event.headline?.toLowerCase().includes("above") ||
                    event.headline?.includes("vs IBES") ? (
                      <TrendingUp className="h-4 w-4 text-stock-up" />
                    ) : event.headline?.toLowerCase().includes("miss") ||
                      event.headline?.toLowerCase().includes("below") ? (
                      <TrendingDown className="h-4 w-4 text-stock-down" />
                    ) : (
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {translation?.earningsHeadlinesKo?.[idx] ||
                        event.headline}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {displayDate(event.date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Morningstar 강세/약세 분석 */}
      {(bullPoints.length > 0 || bearPoints.length > 0) && (
        <Accordion type="single" collapsible className="rounded-md border border-border px-4">
          <AccordionItem value="morningstar-details">
            <AccordionTrigger>강세/약세 리포트 상세</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {isTranslating && (
                  <div className="col-span-full text-center py-2">
                    <p className="text-xs text-muted-foreground animate-pulse">
                      한국어로 정리하는 중...
                    </p>
                  </div>
                )}
                {/* 강세 시나리오 */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-stock-up" />
                      강세 요인
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {bullPoints.map((point: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Badge
                            variant="outline"
                            className="shrink-0 mt-0.5 text-stock-up border-stock-up/30 bg-stock-up/10 text-xs px-1.5"
                          >
                            {idx + 1}
                          </Badge>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {translation?.bullPointsKo?.[idx] ||
                              translateFinancialText(point)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 약세 시나리오 */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-stock-down" />
                      약세 요인
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {bearPoints.map((point: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Badge
                            variant="outline"
                            className="shrink-0 mt-0.5 text-stock-down border-stock-down/30 bg-stock-down/10 text-xs px-1.5"
                          >
                            {idx + 1}
                          </Badge>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {translation?.bearPointsKo?.[idx] ||
                              translateFinancialText(point)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Source Info */}
      {(publishDate || upsell.upsellReportType) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            출처:{" "}
            {upsell.upsellReportType === "MORNINGSTAR_ANALYST"
              ? "Morningstar Analyst"
              : upsell.upsellReportType || "N/A"}
          </span>
          {publishDate && <span>· 발행일: {publishDate}</span>}
        </div>
      )}

      {/* No data fallback */}
      {!evidenceItems.length &&
        !earningsEvents.length &&
        !bullPoints.length &&
        !bearPoints.length &&
        targetPrice == null && (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                현재 이 종목에서 확인할 수 있는 전망 정보가 없습니다.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
