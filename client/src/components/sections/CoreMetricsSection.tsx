import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
} from "lucide-react";

import type {
  AnalysisMetrics,
  FinancialMetric,
  MetricFreshness,
  MetricGroup,
  MetricUnavailableReason,
} from "@shared/analysisMetrics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CoreMetricsSectionProps {
  metrics?: AnalysisMetrics;
  isLoading?: boolean;
}

interface FreshnessDisplay {
  label: string;
  detail?: string;
}

function sourceNameParts(sourceName: string) {
  if (sourceName.startsWith("Yahoo ")) {
    return {
      provider: "Yahoo",
      dataset: sourceName.slice("Yahoo ".length),
    };
  }

  return {
    provider: sourceName,
    dataset: undefined,
  };
}

function freshnessDisplay(freshness?: MetricFreshness): FreshnessDisplay {
  if (!freshness) return { label: "기준 확인 불가" };
  if (freshness.kind === "as_of") return { label: `기준일 ${freshness.asOf}` };
  if (freshness.kind === "checked_at") {
    return {
      label: `응답 확인 ${freshness.checkedAt.slice(0, 10)}`,
      detail: "API 작성일이나 로컬 캐시 시각과 다를 수 있습니다.",
    };
  }
  return { label: freshness.note };
}

function reasonLabel(reason: MetricUnavailableReason) {
  if (reason === "missing_source") return "원천 없음";
  if (reason === "missing_value") return "값 없음";
  if (reason === "missing_freshness") return "기준일 없음";
  if (reason === "missing_calculation") return "계산 불가";
  if (reason === "weak_prose_source") return "문장 근거 제외";
  return "비적용";
}

function MetricHelpPopover({ metric }: { metric: FinancialMetric }) {
  const [open, setOpen] = useState(false);
  const source =
    metric.status === "available" ? metric.source : metric.expectedSource;
  const sourceParts = source ? sourceNameParts(source.name) : undefined;
  const freshness = freshnessDisplay(metric.freshness);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          aria-label={`${metric.labelKo} 설명`}
          onMouseEnter={() => setOpen(true)}
          onFocus={() => setOpen(true)}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[22rem] max-w-[calc(100vw-2rem)] text-sm leading-relaxed"
      >
        <div className="space-y-3">
          <p className="font-medium text-foreground">{metric.labelKo}</p>
          <p className="text-muted-foreground">{metric.descriptionKo}</p>

          <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">검증 정보</p>
              <Badge
                variant="outline"
                className={cn(
                  "h-5 px-1.5 text-[11px]",
                  metric.status === "available"
                    ? "border-emerald-500/40 text-emerald-600"
                    : "text-muted-foreground"
                )}
              >
                {metric.status === "available"
                  ? "출처 확인"
                  : reasonLabel(metric.unavailableReason)}
              </Badge>
            </div>

            <dl className="space-y-1.5">
              {sourceParts && (
                <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
                  <dt className="text-muted-foreground">원천</dt>
                  <dd className="min-w-0 text-foreground">
                    <span>{sourceParts.provider}</span>
                    {sourceParts.dataset ? (
                      <span className="block break-words font-mono text-muted-foreground">
                        {sourceParts.dataset}
                      </span>
                    ) : null}
                  </dd>
                </div>
              )}
              {source && (
                <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
                  <dt className="text-muted-foreground">필드</dt>
                  <dd className="min-w-0 break-words font-mono text-foreground">
                    {source.basis}
                  </dd>
                </div>
              )}
              <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">기준</dt>
                <dd className="min-w-0 text-foreground">{freshness.label}</dd>
              </div>
            </dl>

            {metric.status === "unavailable" && (
              <p className="mt-2 border-t border-border pt-2 text-muted-foreground">
                {metric.unavailableDetailKo}
              </p>
            )}
            {freshness.detail && (
              <p className="mt-2 border-t border-border pt-2 text-muted-foreground">
                {freshness.detail}
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MetricRow({ metric }: { metric: FinancialMetric }) {
  const isAvailable = metric.status === "available";

  return (
    <div className="grid gap-3 border-t border-border py-4 first:border-t-0 sm:grid-cols-[minmax(0,1.1fr)_minmax(9rem,0.6fr)_minmax(0,1.2fr)] sm:items-start">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 truncate text-sm font-medium text-foreground">
            {metric.labelKo}
          </p>
          <MetricHelpPopover metric={metric} />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        {isAvailable ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="font-mono text-base font-semibold text-foreground">
              {metric.value}
            </p>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <Badge variant="outline" className="text-muted-foreground">
              확인 불가
            </Badge>
          </>
        )}
      </div>

      <div className="min-w-0 text-xs leading-relaxed text-muted-foreground sm:text-right">
        {isAvailable ? (
          <Badge variant="outline" className="text-emerald-600">
            출처 확인
          </Badge>
        ) : (
          <p>{reasonLabel(metric.unavailableReason)}</p>
        )}
      </div>
    </div>
  );
}

function MetricGroupBlock({
  group,
  defaultOpen,
}: {
  group: MetricGroup;
  defaultOpen: boolean;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="border-t border-border first:border-t-0"
    >
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="group h-auto w-full justify-between rounded-none px-0 py-4 text-left hover:bg-transparent"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">
              {group.labelKo}
            </span>
            <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
              {group.descriptionKo}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pb-2">
          {group.metrics.map(metric => (
            <MetricRow key={metric.id} metric={metric} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function CoreMetricsSection({
  metrics,
  isLoading = false,
}: CoreMetricsSectionProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            핵심 지표를 불러오고 있습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.dataQuality.total === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            핵심 지표 데이터가 없습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  const availabilityRatio =
    metrics.dataQuality.total > 0
      ? metrics.dataQuality.available / metrics.dataQuality.total
      : 0;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">핵심 지표</CardTitle>
          <Badge
            variant={availabilityRatio >= 0.7 ? "secondary" : "outline"}
            className={cn(availabilityRatio < 0.7 && "text-muted-foreground")}
          >
            확인됨 {metrics.dataQuality.available}/{metrics.dataQuality.total}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          행에는 값과 검증 상태만 간결히 표시합니다. 설명과 원천 필드는 각
          지표의 ?에서 확인할 수 있습니다.
        </p>
      </CardHeader>
      <CardContent>
        {metrics.groups.map((group, index) => (
          <MetricGroupBlock
            key={group.id}
            group={group}
            defaultOpen={index === 0}
          />
        ))}
      </CardContent>
    </Card>
  );
}
