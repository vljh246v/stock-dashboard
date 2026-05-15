import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatReportDate } from "@shared/reportDates";
import { Building2, Percent, BarChart3, Calendar, TrendingUp, Info } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface ETFSectionProps {
  profileData: any;
  holdings: any;
  isLoadingProfile: boolean;
  isLoadingHoldings: boolean;
}

const CHART_COLORS = [
  "oklch(0.65 0.18 250)",
  "oklch(0.60 0.16 160)",
  "oklch(0.65 0.18 30)",
  "oklch(0.60 0.16 300)",
  "oklch(0.65 0.18 60)",
  "oklch(0.60 0.16 200)",
  "oklch(0.65 0.18 340)",
  "oklch(0.60 0.16 100)",
  "oklch(0.65 0.18 220)",
  "oklch(0.60 0.16 20)",
];

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    const raw = (value as { raw?: unknown }).raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  }
  return null;
}

function fmtValue(value: unknown): string | null {
  if (value && typeof value === "object") {
    const fmt = (value as { fmt?: unknown }).fmt;
    if (typeof fmt === "string" && fmt.trim()) return fmt;
  }
  return null;
}

function formatPercentField(value: unknown) {
  const formatted = fmtValue(value);
  if (formatted) return formatted;

  const raw = numericValue(value);
  if (raw === null) return null;
  const percent = raw <= 1 ? raw * 100 : raw;
  return `${percent.toFixed(2)}%`;
}

function formatNetAssetsField(value: unknown) {
  const formatted = fmtValue(value);
  if (formatted) return formatted;

  const raw = numericValue(value);
  if (!raw) return null;
  const dollars = raw * 1_000_000;
  if (dollars >= 1_000_000_000_000) return `$${(dollars / 1_000_000_000_000).toFixed(1)}T`;
  if (dollars >= 1_000_000_000) return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  return `$${dollars.toFixed(0)}`;
}

export default function ETFSection({ profileData, holdings, isLoadingProfile, isLoadingHoldings }: ETFSectionProps) {
  const fundProfile = profileData?.fundProfile || {};
  const fees = fundProfile.feesExpensesInvestment || {};
  const feesCategory = fundProfile.feesExpensesInvestmentCat || {};

  const expenseRatio = formatPercentField(fees.annualReportExpenseRatio);
  const categoryExpenseRatio = formatPercentField(feesCategory.annualReportExpenseRatio);
  const totalNetAssets = fees.totalNetAssets;
  const turnover = formatPercentField(fees.annualHoldingsTurnover);
  const expenseRatioRaw = numericValue(fees.annualReportExpenseRatio);
  const categoryExpenseRatioRaw = numericValue(feesCategory.annualReportExpenseRatio);
  const family = fundProfile.family;
  const categoryName = fundProfile.categoryName;
  const legalType = fundProfile.legalType;
  const netAssets = formatNetAssetsField(totalNetAssets);

  // 파이 차트용 데이터 (상위 10개 + 기타)
  const holdingsList: Array<{ symbol: string; name: string; weight: number; marketValue: number }> =
    holdings?.holdings || [];

  const topWeight = holdingsList.reduce((sum, h) => sum + h.weight, 0);
  const otherWeight = Math.max(0, 100 - topWeight);

  const pieData = [
    ...holdingsList.map((h) => ({ name: h.symbol, value: h.weight })),
    ...(otherWeight > 0.5 ? [{ name: "기타", value: parseFloat(otherWeight.toFixed(2)) }] : []),
  ];

  if (isLoadingProfile) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ETF 기본 정보 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 운용사 */}
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-start gap-3">
            <Building2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">운용사</p>
              <p className="text-sm font-semibold">{family || "N/A"}</p>
              {legalType && <p className="text-xs text-muted-foreground mt-0.5">{legalType}</p>}
            </div>
          </CardContent>
        </Card>

        {/* 총보수율 */}
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-start gap-3">
            <Percent className="h-5 w-5 text-chart-3 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">총보수율 (TER)</p>
              <p className="text-lg font-mono font-semibold text-stock-up">
                {expenseRatio || "N/A"}
              </p>
              {categoryExpenseRatio && (
                <p className="text-xs text-muted-foreground">카테고리 평균: {categoryExpenseRatio}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 순자산 */}
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-start gap-3">
            <BarChart3 className="h-5 w-5 text-chart-1 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">순자산</p>
              <p className="text-sm font-mono font-semibold">
                {netAssets || "N/A"}
              </p>
              {categoryName && (
                <Badge variant="secondary" className="text-xs mt-1">{categoryName}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 회전율 */}
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-chart-2 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">연간 회전율</p>
              <p className="text-lg font-mono font-semibold">{turnover || "N/A"}</p>
              <p className="text-xs text-muted-foreground">낮을수록 거래가 적습니다</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 구성 종목 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">상위 10개 구성 종목</CardTitle>
            {holdings?.asOfDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>기준일: {formatReportDate(holdings.asOfDate) || "날짜 미상"}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHoldings ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : holdingsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <Info className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                이 ETF의 구성 종목을 불러오지 못했습니다.
              </p>
              <p className="text-xs text-muted-foreground">
                운용사나 공개 데이터가 구성 종목을 제공하지 않으면 일부 정보만 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 테이블 */}
              <div className="space-y-1">
                {holdingsList.map((holding, idx) => (
                  <div
                    key={holding.symbol}
                    className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-secondary/40 transition-colors"
                  >
                    {/* 순위 */}
                    <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{idx + 1}</span>
                    {/* 색상 인디케이터 */}
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: CHART_COLORS[idx] }}
                    />
                    {/* 종목 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-semibold">{holding.symbol}</span>
                        <span className="text-xs text-muted-foreground truncate">{holding.name}</span>
                      </div>
                    </div>
                    {/* 비중 바 */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (holding.weight / (holdingsList[0]?.weight || 1)) * 100)}%`,
                            backgroundColor: CHART_COLORS[idx],
                          }}
                        />
                      </div>
                      <span className="text-sm font-mono font-semibold w-12 text-right">
                        {holding.weight.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-secondary/20 mt-2">
                  <span className="text-xs text-muted-foreground w-5" />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground">상위 10개 합계</span>
                  </div>
                  <span className="text-sm font-mono font-semibold text-muted-foreground">
                    {topWeight.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* 파이 차트 */}
              <div className="flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={1}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index < CHART_COLORS.length ? CHART_COLORS[index] : "oklch(0.4 0.01 260)"}
                          opacity={entry.name === "기타" ? 0.3 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0];
                        return (
                          <div style={{
                            backgroundColor: "oklch(0.19 0.012 260)",
                            border: "1px solid oklch(0.28 0.01 260)",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            fontSize: "12px",
                            color: "oklch(0.93 0.005 260)",
                          }}>
                            <p style={{ fontWeight: 600, marginBottom: 2 }}>{item.name}</p>
                            <p>{Number(item.value).toFixed(2)}%</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-xs text-muted-foreground text-center -mt-2">
                  상위 10개와 기타 비중
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 비용 비교 */}
      {expenseRatioRaw != null && (
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">총보수 비교</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs w-32 shrink-0">이 ETF ({family})</span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-stock-up rounded-full"
                    style={{ width: `${Math.min(100, (expenseRatioRaw / 0.01) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono w-12 text-right text-stock-up">{expenseRatio}</span>
              </div>
              {categoryExpenseRatioRaw != null && categoryExpenseRatio && (
                <div className="flex items-center gap-3">
                  <span className="text-xs w-32 shrink-0">카테고리 평균</span>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-muted-foreground rounded-full"
                      style={{ width: `${Math.min(100, (categoryExpenseRatioRaw / 0.01) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono w-12 text-right">{categoryExpenseRatio}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              총보수가 낮을수록 장기 보유 비용을 줄이는 데 유리합니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
