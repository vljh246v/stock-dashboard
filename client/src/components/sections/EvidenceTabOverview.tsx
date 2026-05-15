import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AnalysisMetrics,
  FinancialMetric,
  MetricFreshness,
} from "@shared/analysisMetrics";
import { Database, FileText, ShieldCheck } from "lucide-react";

interface AnalysisSource {
  name: string;
  status: "used" | "fallback" | "unavailable";
  asOf?: string;
}

interface GuidanceEvidenceItem {
  label: string;
  value: string;
  comparison?: string;
  source: string;
  asOf?: unknown;
}

interface EtfSummary {
  expenseRatio?: string;
  turnover?: string;
  netAssets?: string;
  topHoldingsWeight?: number;
  holdings?: Array<{
    symbol?: string;
    name?: string;
    weight?: number;
  }>;
  source?: string;
  asOf?: string;
}

interface PriceSummary {
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

interface EvidenceTabOverviewProps {
  hasFilings: boolean;
  isETF: boolean;
  sources?: AnalysisSource[];
  guidanceEvidence?: GuidanceEvidenceItem[];
  metrics?: AnalysisMetrics;
  etf?: EtfSummary;
  price?: PriceSummary;
}

const sourceStatusLabel: Record<AnalysisSource["status"], string> = {
  used: "확인",
  fallback: "보조",
  unavailable: "없음",
};

const ETF_EVIDENCE_METRIC_IDS = new Set([
  "expenseRatio",
  "turnover",
  "netAssets",
  "topHoldingsWeight",
  "holdingsCount",
  "fiftyTwoWeekHigh",
  "fiftyTwoWeekLow",
]);

function freshnessLabel(freshness?: MetricFreshness) {
  if (!freshness) return "기준 확인 불가";
  if (freshness.kind === "as_of") return `기준일 ${freshness.asOf}`;
  if (freshness.kind === "checked_at") {
    return `응답 확인 ${freshness.checkedAt.slice(0, 10)}`;
  }
  return freshness.note;
}

function formatPrice(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function availableMetrics(metrics?: AnalysisMetrics) {
  return (
    metrics?.groups
      .flatMap(group => group.metrics)
      .filter(
        (metric): metric is Extract<FinancialMetric, { status: "available" }> =>
          metric.status === "available" && ETF_EVIDENCE_METRIC_IDS.has(metric.id)
      ) || []
  );
}

function etfEvidenceItems({
  metrics,
  etf,
  price,
}: Pick<EvidenceTabOverviewProps, "metrics" | "etf" | "price">) {
  const items = availableMetrics(metrics).map(metric => ({
    label: metric.labelKo,
    value: metric.value,
    detail: `${metric.source.name} · ${freshnessLabel(metric.freshness)}`,
  }));
  const hasItem = (label: string) => items.some(item => item.label === label);

  if (items.length === 0 && etf?.expenseRatio) {
    items.push({
      label: "총보수율",
      value: etf.expenseRatio,
      detail: "Yahoo fundProfile · 응답 확인",
    });
  }
  if (!hasItem("순자산") && etf?.netAssets) {
    items.push({
      label: "순자산",
      value: etf.netAssets,
      detail: "Yahoo fundProfile · 응답 확인",
    });
  }
  if (!hasItem("회전율") && etf?.turnover) {
    items.push({
      label: "회전율",
      value: etf.turnover,
      detail: "Yahoo fundProfile · 응답 확인",
    });
  }
  if (
    !hasItem("상위 보유종목 비중") &&
    etf?.asOf &&
    typeof etf.topHoldingsWeight === "number"
  ) {
    items.push({
      label: "상위 보유종목 비중",
      value: `${etf.topHoldingsWeight.toFixed(1)}%`,
      detail: `${etf.source || "ETF holdings"} · 기준일 ${etf.asOf}`,
    });
  }
  if (!hasItem("52주 고가") && typeof price?.fiftyTwoWeekHigh === "number") {
    items.push({
      label: "52주 고가",
      value: formatPrice(price.fiftyTwoWeekHigh),
      detail: "Yahoo chart.meta · 응답 확인",
    });
  }
  if (!hasItem("52주 저가") && typeof price?.fiftyTwoWeekLow === "number") {
    items.push({
      label: "52주 저가",
      value: formatPrice(price.fiftyTwoWeekLow),
      detail: "Yahoo chart.meta · 응답 확인",
    });
  }

  return items.slice(0, 5);
}

function CurrentEvidence({
  isETF,
  guidanceEvidence,
  metrics,
  etf,
  price,
}: Pick<
  EvidenceTabOverviewProps,
  "isETF" | "guidanceEvidence" | "metrics" | "etf" | "price"
>) {
  if (isETF) {
    const items = etfEvidenceItems({ metrics, etf, price });
    return items.length > 0 ? (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map(item => (
          <div
            key={`${item.label}-${item.value}`}
            className="rounded-md border border-border bg-secondary/20 p-3"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <Badge variant="outline" className="text-[10px]">
                ETF 데이터
              </Badge>
            </div>
            <p className="font-mono text-lg font-semibold">{item.value}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {item.detail}
            </p>
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-md border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
        ETF 구성/비용 판단에 쓸 수 있는 확인 데이터가 제한적입니다. 기준일이
        필요한 구성 수치는 공식 원천 확인 전까지 표시하지 않습니다.
      </div>
    );
  }

  const items = guidanceEvidence || [];
  return items.length > 0 ? (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.slice(0, 4).map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="rounded-md border border-border bg-secondary/20 p-3"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <Badge variant="outline" className="text-[10px]">
              검증 데이터
            </Badge>
          </div>
          <p className="font-mono text-lg font-semibold">{item.value}</p>
          {item.comparison && (
            <p className="mt-1 text-xs text-muted-foreground">
              {item.comparison}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            출처: {item.source}
          </p>
        </div>
      ))}
    </div>
  ) : (
    <div className="rounded-md border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
      현재 판단에 사용할 수 있는 확인된 실적/가이던스 근거가 없습니다. LLM
      문장형 하이라이트나 과거 판단 성과는 근거로 대체하지 않습니다.
    </div>
  );
}

export default function EvidenceTabOverview({
  hasFilings,
  isETF,
  sources,
  guidanceEvidence,
  metrics,
  etf,
  price,
}: EvidenceTabOverviewProps) {
  const activeSources = (sources || []).filter(
    source => source.status !== "unavailable"
  );

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            현재 판단에 사용된 근거
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            출처와 기준 조건을 통과한 값만 보여줍니다.
          </p>
        </CardHeader>
        <CardContent>
          <CurrentEvidence
            isETF={isETF}
            guidanceEvidence={guidanceEvidence}
            metrics={metrics}
            etf={etf}
            price={price}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Database className="h-4 w-4 text-primary" />
              원천/데이터 상태
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              이 항목은 자료의 확인 상태이며, 곧바로 판단 근거를 뜻하지 않습니다.
            </p>
          </CardHeader>
          <CardContent>
            {activeSources.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeSources.map(source => (
                  <Badge key={source.name} variant="secondary">
                    {source.name}({sourceStatusLabel[source.status]})
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                확인된 원천 상태가 없습니다.
              </p>
            )}
            {isETF && (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                ETF 보유종목 구성 수치는 기준일이 확인될 때만 현재 판단 근거로
                표시합니다.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-primary" />
              원문 참고자료
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              사용자가 직접 확인할 수 있는 공시와 원문 자료입니다.
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {hasFilings
                ? "아래 SEC 공시와 주요 이벤트는 원문 검토용 참고자료입니다."
                : "ETF는 개별 기업 공시 대신 발행사/보유종목 원천 상태를 중심으로 확인합니다."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
