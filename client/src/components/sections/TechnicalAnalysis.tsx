import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, Target, CandlestickChart, LineChart as LineChartIcon } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Bar, BarChart, Cell, ComposedChart, Line } from "recharts";
import { useState, useMemo } from "react";

interface Props {
  insights: any;
  chartData: any;
  isLoading: boolean;
  isETF?: boolean;
}

export default function TechnicalAnalysis({ insights, chartData, isLoading, isETF: isETFProp }: Props) {
  const [chartType, setChartType] = useState<"line" | "candle">("line");

  const priceData = useMemo(() => {
    const chartResult = chartData?.chart?.result?.[0];
    const timestamps = chartResult?.timestamp || [];
    const quotes = chartResult?.indicators?.quote?.[0] || {};

    return timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }),
      open: quotes.open?.[i] ? Number(quotes.open[i].toFixed(2)) : null,
      close: quotes.close?.[i] ? Number(quotes.close[i].toFixed(2)) : null,
      high: quotes.high?.[i] ? Number(quotes.high[i].toFixed(2)) : null,
      low: quotes.low?.[i] ? Number(quotes.low[i].toFixed(2)) : null,
      volume: quotes.volume?.[i] || 0,
    })).filter((d: any) => d.close !== null);
  }, [chartData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const technicals = insights?.instrumentInfo?.technicalEvents || {};
  const keyTechnicals = insights?.instrumentInfo?.keyTechnicals || {};
  const recommendation = insights?.recommendation || {};
  const meta = chartData?.chart?.result?.[0]?.meta || {};

  // ETF 판별: prop 우선, fallback으로 insights 기반
  const isETF = isETFProp ?? (!insights?.recommendation && !insights?.upsell && !(insights?.reports?.length));

  // recommendation.targetPrice가 없을 경우 reports[]에서 최신 목표가 fallback
  const reports = insights?.reports || [];
  const latestReportWithTarget = reports
    .filter((r: any) => r.targetPrice != null)
    .sort((a: any, b: any) => (b.reportDate || "").localeCompare(a.reportDate || ""))[0];
  const targetPrice: number | null = recommendation.targetPrice ?? latestReportWithTarget?.targetPrice ?? null;
  const targetPriceProvider: string = recommendation.provider || latestReportWithTarget?.provider || "";

  const getDirectionIcon = (direction: string) => {
    if (direction === "Bullish" || direction === "bullish") return <TrendingUp className="h-4 w-4 text-stock-up" />;
    if (direction === "Bearish" || direction === "bearish") return <TrendingDown className="h-4 w-4 text-stock-down" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getDirectionLabel = (direction: string) => {
    if (direction === "Bullish" || direction === "bullish") return "강세";
    if (direction === "Bearish" || direction === "bearish") return "약세";
    return "중립";
  };

  const getDirectionColor = (direction: string) => {
    if (direction === "Bullish" || direction === "bullish") return "bg-stock-up text-stock-up";
    if (direction === "Bearish" || direction === "bearish") return "bg-stock-down text-stock-down";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      {/* Price Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">주가 차트 (6개월)</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
                <Button
                  variant={chartType === "line" ? "default" : "ghost"}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setChartType("line")}
                >
                  <LineChartIcon className="h-3 w-3 mr-1" />
                  라인
                </Button>
                <Button
                  variant={chartType === "candle" ? "default" : "ghost"}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setChartType("candle")}
                >
                  <CandlestickChart className="h-3 w-3 mr-1" />
                  캔들
                </Button>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>현재가: ${meta.regularMarketPrice?.toFixed(2) || "N/A"}</span>
                <span>52주 최고: ${meta.fiftyTwoWeekHigh?.toFixed(2) || "N/A"}</span>
                <span>52주 최저: ${meta.fiftyTwoWeekLow?.toFixed(2) || "N/A"}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {priceData.length > 0 ? (
            chartType === "line" ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={priceData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <defs>
                    <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.65 0.18 250)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.65 0.18 250)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.01 260)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "oklch(0.65 0.015 260)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 10, fill: "oklch(0.65 0.015 260)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.19 0.012 260)",
                      border: "1px solid oklch(0.28 0.01 260)",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "oklch(0.93 0.005 260)",
                    }}
                    formatter={(value: number) => [`$${value}`, "종가"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke="oklch(0.65 0.18 250)"
                    strokeWidth={2}
                    fill="url(#colorClose)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={priceData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.01 260)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "oklch(0.65 0.015 260)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 10, fill: "oklch(0.65 0.015 260)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.19 0.012 260)",
                      border: "1px solid oklch(0.28 0.01 260)",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "oklch(0.93 0.005 260)",
                    }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      const isUp = d.close >= d.open;
                      return (
                        <div className="bg-popover border border-border rounded-md p-2 text-xs">
                          <p className="font-medium mb-1">{d.date}</p>
                          <p>시가: ${d.open}</p>
                          <p>종가: <span className={isUp ? "text-stock-up" : "text-stock-down"}>${d.close}</span></p>
                          <p>고가: ${d.high}</p>
                          <p>저가: ${d.low}</p>
                        </div>
                      );
                    }}
                  />
                  {/* Candle body as bar */}
                  <Bar dataKey="high" fill="transparent" />
                  {priceData.map((entry: any, index: number) => {
                    const isUp = entry.close >= entry.open;
                    return null; // Handled below
                  })}
                  {/* High-Low line */}
                  <Line type="monotone" dataKey="high" stroke="oklch(0.5 0.01 260)" strokeWidth={1} dot={false} />
                  <Line type="monotone" dataKey="low" stroke="oklch(0.5 0.01 260)" strokeWidth={1} dot={false} />
                  {/* Close line colored by direction */}
                  <Line type="monotone" dataKey="close" stroke="oklch(0.65 0.18 250)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="open" stroke="oklch(0.6 0.1 30)" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                </ComposedChart>
              </ResponsiveContainer>
            )
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              차트 데이터를 불러올 수 없습니다.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Technical Outlook */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OutlookCard
          title="단기 전망"
          outlook={technicals.shortTermOutlook}
          getDirectionIcon={getDirectionIcon}
          getDirectionLabel={getDirectionLabel}
          getDirectionColor={getDirectionColor}
        />
        <OutlookCard
          title="중기 전망"
          outlook={technicals.intermediateTermOutlook}
          getDirectionIcon={getDirectionIcon}
          getDirectionLabel={getDirectionLabel}
          getDirectionColor={getDirectionColor}
        />
        <OutlookCard
          title="장기 전망"
          outlook={technicals.longTermOutlook}
          getDirectionIcon={getDirectionIcon}
          getDirectionLabel={getDirectionLabel}
          getDirectionColor={getDirectionColor}
        />
      </div>

      {/* Key Technicals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">지지선</p>
              {keyTechnicals.support != null ? (
                <p className="text-lg font-mono font-semibold">${keyTechnicals.support.toFixed(2)}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">데이터 없음</p>
              )}
              {keyTechnicals.provider && (
                <p className="text-xs text-muted-foreground">{keyTechnicals.provider}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-stock-down" />
            <div>
              <p className="text-xs text-muted-foreground">손절가</p>
              <p className="text-lg font-mono font-semibold">
                {keyTechnicals.stopLoss != null ? `$${keyTechnicals.stopLoss.toFixed(2)}` : "N/A"}
              </p>
              {keyTechnicals.provider && (
                <p className="text-xs text-muted-foreground">{keyTechnicals.provider}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-chart-1" />
            <div>
              <p className="text-xs text-muted-foreground">목표가</p>
              {isETF ? (
                <p className="text-sm text-muted-foreground italic">ETF 해당 없음</p>
              ) : (
                <>
                  <p className="text-lg font-mono font-semibold">
                    {targetPrice != null ? `$${targetPrice.toFixed(2)}` : "N/A"}
                  </p>
                  {targetPriceProvider && (
                    <p className="text-xs text-muted-foreground">{targetPriceProvider}</p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OutlookCard({ title, outlook, getDirectionIcon, getDirectionLabel, getDirectionColor }: any) {
  const direction = outlook?.direction || "Neutral";
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          {getDirectionIcon(direction)}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={getDirectionColor(direction)}>
            {getDirectionLabel(direction)}
          </Badge>
          {outlook?.score !== undefined && (
            <span className="text-xs text-muted-foreground">점수: {outlook.score}</span>
          )}
        </div>
        {outlook?.stateDescription && (
          <p className="text-xs text-muted-foreground">{outlook.stateDescription}</p>
        )}
      </CardContent>
    </Card>
  );
}
