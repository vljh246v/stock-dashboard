import { AlertCircle, Database, ShieldAlert, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface DecisionReason {
  category: string;
  label: string;
  detail: string;
  evidence?: string;
}

interface DecisionSummary {
  state: "interest" | "wait" | "caution" | "unavailable";
  labelKo: "관심" | "관망" | "주의" | "판단 보류";
  confidence: "높음" | "중간" | "낮음";
  headline: string;
  reasons: DecisionReason[];
  riskNote: string;
  priceZones?: {
    interestBelow?: number;
    invalidationBelow?: number;
    riskManagementNear?: number;
    source: string;
  };
  sources: Array<{
    name: string;
    status: "used" | "fallback" | "unavailable";
    asOf?: string;
  }>;
  disclaimer: string;
}

interface Props {
  summary: DecisionSummary | null | undefined;
  isLoading: boolean;
}

const stateStyles: Record<DecisionSummary["state"], string> = {
  interest: "border-stock-up/40 bg-stock-up/10 text-stock-up",
  wait: "border-chart-3/40 bg-chart-3/10 text-chart-3",
  caution: "border-stock-down/40 bg-stock-down/10 text-stock-down",
  unavailable: "border-muted bg-muted/30 text-muted-foreground",
};

const statusLabel = {
  used: "확인",
  fallback: "보조",
  unavailable: "없음",
};

function formatPrice(value?: number) {
  if (value == null) return "정보 부족";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function DecisionSummaryCard({ summary, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">요약을 만들 수 없습니다.</p>
            <p className="text-xs text-muted-foreground mt-1">데이터가 더 확보되면 다시 확인해 주세요.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const reasons = summary.reasons.slice(0, 3);
  const activeSources = summary.sources.filter(source => source.status !== "unavailable");

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          빠른 판단 요약
          <Badge variant="outline" className={`ml-auto text-xs ${stateStyles[summary.state]}`}>
            {summary.labelKo}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
          <div className="min-w-0">
            <p className="text-base font-semibold leading-snug break-keep">{summary.headline}</p>
            <p className="text-xs text-muted-foreground mt-1">신뢰도: {summary.confidence}</p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {summary.priceZones?.interestBelow != null && (
              <Badge variant="secondary" className="text-xs">관심가 {formatPrice(summary.priceZones.interestBelow)} 이하</Badge>
            )}
            {summary.priceZones?.invalidationBelow != null && (
              <Badge variant="secondary" className="text-xs">무효화 {formatPrice(summary.priceZones.invalidationBelow)} 이탈</Badge>
            )}
            {summary.priceZones?.riskManagementNear != null && (
              <Badge variant="secondary" className="text-xs">점검가 {formatPrice(summary.priceZones.riskManagementNear)} 근처</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {reasons.map((reason, index) => (
            <div key={`${reason.category}-${index}`} className="rounded-md border border-border bg-secondary/30 p-3 min-w-0">
              <p className="text-sm font-medium leading-snug break-keep">{reason.label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1 break-keep">{reason.detail}</p>
              {reason.evidence && (
                <p className="text-[11px] text-muted-foreground/80 mt-2 truncate">{reason.evidence}</p>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-md border border-stock-down/20 bg-stock-down/5 p-3 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-stock-down shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed break-keep">{summary.riskNote}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0">
            <Database className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              자료 상태: {activeSources.length > 0 ? activeSources.map(source => `${source.name}(${statusLabel[source.status]})`).join(", ") : "확인된 출처 없음"}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Target className="h-3.5 w-3.5" />
            <span>참고용 요약</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
