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

function freshnessLabel(freshness?: MetricFreshness) {
  if (!freshness) return "기준 확인 불가";
  if (freshness.kind === "as_of") return `기준일 ${freshness.asOf}`;
  if (freshness.kind === "checked_at") {
    return `확인 ${freshness.checkedAt.slice(0, 10)} · ${freshness.note}`;
  }
  return freshness.note;
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
      <PopoverContent align="start" className="w-80 text-sm leading-relaxed">
        <div className="space-y-2">
          <p className="font-medium text-foreground">{metric.labelKo}</p>
          <p className="text-muted-foreground">{metric.descriptionKo}</p>
          {metric.status === "available" ? (
            <p className="text-xs text-muted-foreground">
              {metric.source.name} · {metric.source.basis} ·{" "}
              {freshnessLabel(metric.freshness)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {metric.unavailableDetailKo}
            </p>
          )}
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
        <p className="text-xs leading-relaxed text-muted-foreground">
          {metric.descriptionKo}
        </p>
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

      <div className="min-w-0 text-xs leading-relaxed text-muted-foreground">
        {isAvailable ? (
          <>
            <p className="truncate">{metric.source.name}</p>
            <p className="truncate">
              {metric.source.basis} · {freshnessLabel(metric.freshness)}
            </p>
          </>
        ) : (
          <>
            <p>{reasonLabel(metric.unavailableReason)}</p>
            <p>{metric.unavailableDetailKo}</p>
            {metric.expectedSource && (
              <p className="truncate">
                기대 출처: {metric.expectedSource.name} ·{" "}
                {metric.expectedSource.basis}
              </p>
            )}
          </>
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
          출처, 계산 기준, 최신성까지 확인되는 숫자만 값으로 표시합니다.
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
