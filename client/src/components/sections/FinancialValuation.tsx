import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { translateFinancialTerm } from "@shared/financialTerms";
import { formatReportDate } from "@shared/reportDates";
import { Star, Lightbulb, Leaf, Users, TrendingUp, DollarSign } from "lucide-react";

interface Props {
  insights: any;
  isLoading: boolean;
}

// API returns 0~1 float values; convert to 0~100 for display
function toScore(val: number | undefined | null): number | null {
  if (val === undefined || val === null) return null;
  // If already > 1, assume it's already 0~100 scale
  if (val > 1) return Math.round(val);
  return Math.round(val * 100);
}

function getScoreColor(score: number): string {
  if (score >= 75) return "text-stock-up";
  if (score >= 50) return "text-yellow-400";
  return "text-stock-down";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "우수";
  if (score >= 60) return "양호";
  if (score >= 40) return "보통";
  return "미흡";
}

export default function FinancialValuation({ insights, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    );
  }

  const valuation = insights?.instrumentInfo?.valuation || {};
  const recommendation = insights?.recommendation || {};
  const companySnapshot = insights?.companySnapshot?.company || {};
  const sectorSnapshot = insights?.companySnapshot?.sector || {};

  const getRatingColor = (rating: string) => {
    const r = rating?.toLowerCase();
    if (r === "buy" || r === "strong buy" || r === "outperform") return "bg-stock-up/20 text-stock-up border-stock-up/30";
    if (r === "sell" || r === "strong sell" || r === "underperform") return "bg-stock-down/20 text-stock-down border-stock-down/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const getRatingLabel = (rating: string) => {
    return translateFinancialTerm(rating);
  };

  const qualityScores = [
    { label: "혁신성", key: "innovativeness", icon: <Lightbulb className="h-4 w-4" /> },
    { label: "채용 활동", key: "hiring", icon: <Users className="h-4 w-4" /> },
    { label: "지속가능성", key: "sustainability", icon: <Leaf className="h-4 w-4" /> },
    { label: "내부자 심리", key: "insiderSentiments", icon: <TrendingUp className="h-4 w-4" /> },
    { label: "실적 보고", key: "earningsReports", icon: <DollarSign className="h-4 w-4" /> },
    { label: "배당", key: "dividends", icon: <Star className="h-4 w-4" /> },
  ].map(({ label, key, icon }) => ({
    label,
    icon,
    score: toScore(companySnapshot[key]),
    sectorScore: toScore(sectorSnapshot[key]),
  }));

  const hasQualityData = qualityScores.some(s => s.score !== null);

  return (
    <div className="space-y-4">
      {/* Analyst Rating & Valuation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">애널리스트 평가</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={`text-sm px-3 py-1 border ${getRatingColor(recommendation.rating)}`}
              >
                {getRatingLabel(recommendation.rating)}
              </Badge>
              {recommendation.provider && (
                <span className="text-xs text-muted-foreground">출처: {recommendation.provider}</span>
              )}
            </div>
            {recommendation.targetPrice && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">목표 주가</span>
                <span className="text-lg font-mono font-semibold">${recommendation.targetPrice?.toFixed(2)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">밸류에이션</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {valuation.description ? translateFinancialTerm(valuation.description) : "밸류에이션 정보 없음"}
              </span>
            </div>
            {valuation.discount && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">할인율</span>
                <span className="text-sm font-medium">{valuation.discount}</span>
              </div>
            )}
            {valuation.relativeValue && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">상대 가치</span>
                <span className="text-sm font-medium">{translateFinancialTerm(valuation.relativeValue)}</span>
              </div>
            )}
            {valuation.provider && (
              <p className="text-xs text-muted-foreground">제공: {valuation.provider}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Company Quality Scores */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">기업 품질 점수</CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-1 bg-primary rounded inline-block" />
                기업
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-1 bg-muted-foreground/40 rounded inline-block" />
                섹터 평균
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasQualityData ? (
            <p className="text-sm text-muted-foreground text-center py-4">품질 점수 데이터가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {qualityScores.map((score) => (
                <div key={score.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-primary">{score.icon}</span>
                      <span className="text-xs font-medium">{score.label}</span>
                    </div>
                    {score.score !== null ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-bold font-mono ${getScoreColor(score.score)}`}>
                          {score.score}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${getScoreColor(score.score)} bg-current/10`}
                          style={{ backgroundColor: score.score >= 75 ? 'rgba(34,197,94,0.1)' : score.score >= 50 ? 'rgba(250,204,21,0.1)' : 'rgba(239,68,68,0.1)' }}>
                          {getScoreLabel(score.score)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </div>
                  {/* Company score bar */}
                  {score.score !== null && (
                    <div className="space-y-1">
                      <Progress value={score.score} className="h-2" />
                      {/* Sector average bar */}
                      {score.sectorScore !== null && (
                        <div className="flex items-center gap-2">
                          <Progress value={score.sectorScore} className="h-1 opacity-40" />
                          <span className="text-xs text-muted-foreground shrink-0">섹터 {score.sectorScore}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Research Reports */}
      {insights?.reports && insights.reports.length > 0 && (
        <Accordion type="single" collapsible className="rounded-md border border-border px-4">
          <AccordionItem value="research-reports">
            <AccordionTrigger>리서치 리포트</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {insights.reports.slice(0, 5).map((report: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{report.reportTitle || "제목 없음"}</p>
                      <p className="text-xs text-muted-foreground">{report.provider || "N/A"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {formatReportDate(report.reportDate)}
                    </span>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
