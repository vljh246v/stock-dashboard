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
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Brain,
  Zap,
  Shield,
  BarChart3,
  LineChart,
  AlertTriangle,
  Users,
} from "lucide-react";

interface AgentResult {
  agentName: string;
  stage?: string;
  signal: string;
  confidence: string;
  reasoning: string;
  keyPoints: string[];
}

interface MultiAgentOpinion {
  agents: AgentResult[];
  finalVerdict: {
    signal: string;
    confidence: string;
    summary: string;
    bullCase: string;
    bearCase: string;
    keyFactors: string[];
    dissent: string;
  };
  workflow?: {
    source: string;
    stages: string[];
  };
  researchReport?: {
    thesis: string;
    sections: Array<{
      title: string;
      bullets: string[];
    }>;
    dataQuality: string[];
    nextChecks: string[];
  };
  disclaimer: string;
  // Legacy single-agent fallback fields
  bullCase?: string;
  bearCase?: string;
  signal?: string;
  confidence?: string;
  summary?: string;
  keyFactors?: string[];
  error?: boolean;
}

interface Props {
  opinion: MultiAgentOpinion | any;
  isLoading: boolean;
}

const getSignalColor = (signal: string) => {
  if (signal === "매수") return "bg-stock-up/10 text-stock-up border-stock-up";
  if (signal === "매도") return "bg-stock-down/10 text-stock-down border-stock-down";
  return "bg-muted/50 text-muted-foreground border-muted";
};

const getSignalBg = (signal: string) => {
  if (signal === "매수") return "border-l-[oklch(0.7_0.18_150)]";
  if (signal === "매도") return "border-l-[oklch(0.65_0.22_25)]";
  return "border-l-muted";
};

const getConfidenceColor = (confidence: string) => {
  if (confidence === "높음") return "text-stock-up";
  if (confidence === "낮음") return "text-stock-down";
  return "text-muted-foreground";
};

const displaySignal = (signal: string | undefined) => `판단: ${signal || "N/A"}`;

const displayConfidence = (confidence: string | undefined) => `신뢰도: ${confidence || "N/A"}`;

const getAgentIcon = (agentName: string) => {
  if (agentName.includes("기술")) return <LineChart className="h-4 w-4" />;
  if (agentName.includes("펀더멘털")) return <BarChart3 className="h-4 w-4" />;
  if (agentName.includes("Bull")) return <TrendingUp className="h-4 w-4" />;
  if (agentName.includes("Bear")) return <TrendingDown className="h-4 w-4" />;
  if (agentName.includes("트레이더")) return <Zap className="h-4 w-4" />;
  if (agentName.includes("포트폴리오")) return <Users className="h-4 w-4" />;
  if (agentName.includes("리스크")) return <Shield className="h-4 w-4" />;
  return <Brain className="h-4 w-4" />;
};

const internalErrorPatterns = [
  "에이전트 실행 중 오류",
  "분석 불가",
];

const isInternalAgentError = (value: unknown) =>
  typeof value === "string" && internalErrorPatterns.some(pattern => value.includes(pattern));

const displayText = (value: unknown, fallback: string) => {
  if (typeof value !== "string" || value.trim().length === 0) return fallback;
  return isInternalAgentError(value) ? fallback : value;
};

const displayKeyPoints = (points: string[] | undefined, fallback: string) => {
  const visiblePoints = (points || []).filter(point => !isInternalAgentError(point));
  return visiblePoints.length > 0 ? visiblePoints : [fallback];
};

export default function InvestmentOpinion({ opinion, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (!opinion || opinion.error) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 text-center space-y-2">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {opinion?.summary || opinion?.finalVerdict?.summary || "투자 의견을 만들지 못했습니다. 잠시 후 다시 시도해 주세요."}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Detect if this is multi-agent format or legacy single-agent format
  const isMultiAgent = !!opinion.agents && !!opinion.finalVerdict;

  if (!isMultiAgent) {
    // Legacy single-agent fallback
    return <LegacyOpinion opinion={opinion} />;
  }

  const { agents, finalVerdict, workflow, researchReport, disclaimer } = opinion as MultiAgentOpinion;
  const workflowStages = workflow?.stages ?? [];

  return (
    <div className="space-y-4">
      {/* Final Verdict Header */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            종합 투자 판단
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {agents.length}개 관점 종합
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge
              variant="outline"
              className={`text-base px-4 py-1.5 font-semibold ${getSignalColor(finalVerdict.signal)}`}
            >
              <Zap className="h-4 w-4 mr-1" />
              {displaySignal(finalVerdict.signal)}
            </Badge>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${getConfidenceColor(finalVerdict.confidence)}`}>
                {displayConfidence(finalVerdict.confidence)}
              </span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-foreground">
            {displayText(finalVerdict.summary, "공개 데이터 기반의 보수적 종합 의견입니다. 세부 데이터가 제한적이므로 추가 확인이 필요합니다.")}
          </p>
        </CardContent>
      </Card>

      {/* Key Factors */}
      {finalVerdict.keyFactors && finalVerdict.keyFactors.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">핵심 투자 요인</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {displayKeyPoints(finalVerdict.keyFactors, "추가 데이터 확인 필요").map((factor: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {factor}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Accordion type="multiple" className="rounded-md border border-border px-4">
        {workflowStages.length > 0 && (
          <AccordionItem value="workflow">
            <AccordionTrigger>분석 과정</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap gap-2">
                {workflowStages.map((stage, idx) => (
                  <Badge key={`${stage}-${idx}`} variant="secondary" className="text-xs">
                    {idx + 1}. {stage}
                  </Badge>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="bull-bear">
          <AccordionTrigger>상승/하락 요인</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="bg-card border-border border-l-2 border-l-[oklch(0.7_0.18_150)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-stock-up">
                    <TrendingUp className="h-4 w-4" />
                    강세 관점
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {displayText(finalVerdict.bullCase, "강세 관점 데이터가 제한적입니다. 가격 흐름과 기업 데이터를 함께 확인하세요.")}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border border-l-2 border-l-[oklch(0.65_0.22_25)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-stock-down">
                    <TrendingDown className="h-4 w-4" />
                    약세 관점
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {displayText(finalVerdict.bearCase, "약세 관점 데이터가 제한적입니다. 밸류에이션과 하방 리스크를 보수적으로 확인하세요.")}
                  </p>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        {researchReport && (
          <AccordionItem value="research-report">
              <AccordionTrigger>상세 리포트</AccordionTrigger>
            <AccordionContent>
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    상세 리포트
                    {workflow?.source && (
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        종합 리포트
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-foreground leading-relaxed">
                    {displayText(researchReport.thesis, "공유 분석 데이터를 기준으로 작성한 리서치 보고서입니다.")}
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {researchReport.sections.map((section, idx) => (
                      <div key={`${section.title}-${idx}`} className="rounded-md border border-border bg-secondary/20 p-3">
                        <p className="text-xs font-semibold text-foreground mb-2">{section.title}</p>
                        <div className="space-y-1.5">
                          {displayKeyPoints(section.bullets, "추가 확인 필요").map((bullet, bulletIdx) => (
                            <div key={bulletIdx} className="flex items-start gap-1.5">
                              <span className="text-primary text-xs mt-0.5">•</span>
                              <span className="text-xs text-muted-foreground leading-relaxed">{bullet}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {(researchReport.dataQuality.length > 0 || researchReport.nextChecks.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">사용 데이터</p>
                        <div className="flex flex-wrap gap-1.5">
                          {researchReport.dataQuality.map((item, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[10px]">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">다음 확인</p>
                        <div className="flex flex-wrap gap-1.5">
                          {researchReport.nextChecks.map((item, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px]">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="agent-details">
          <AccordionTrigger>세부 분석</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {agents.map((agent, idx) => (
                <Card key={idx} className={`bg-card border-border border-l-2 ${getSignalBg(agent.signal)}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold flex items-start gap-2">
                      <span className="mt-0.5">{getAgentIcon(agent.agentName)}</span>
                      <span className="min-w-0">
                        <span className="block">{agent.agentName}</span>
                        {agent.stage && (
                          <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                            {agent.stage}
                          </span>
                        )}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${getSignalColor(agent.signal)}`}>
                        {displaySignal(agent.signal)}
                      </Badge>
                      <span className={`text-xs ${getConfidenceColor(agent.confidence)}`}>
                        {displayConfidence(agent.confidence)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {displayText(agent.reasoning, `${agent.agentName} 데이터가 제한적이어서 신중하게 판단했습니다.`)}
                    </p>
                    <div className="space-y-1">
                      {displayKeyPoints(agent.keyPoints, "공개 데이터 기준으로 추가 확인 필요").map((point, pidx) => (
                        <div key={pidx} className="flex items-start gap-1.5">
                          <span className="text-primary text-xs mt-0.5">•</span>
                          <span className="text-xs text-muted-foreground">{point}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {finalVerdict.dissent && (
          <AccordionItem value="dissent">
            <AccordionTrigger>다른 관점</AccordionTrigger>
            <AccordionContent>
              <Card className="bg-card border-border border-l-2 border-l-amber-500/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    다른 관점
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {displayText(finalVerdict.dissent, "관점별 데이터가 제한적이어서 반대 논거를 추가 확인해야 합니다.")}
                  </p>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Disclaimer */}
      {disclaimer && (
        <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20">
          <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            {disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}

// Legacy single-agent format fallback
function LegacyOpinion({ opinion }: { opinion: any }) {
  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            종합 투자 판단
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge
              variant="outline"
              className={`text-base px-4 py-1.5 font-semibold ${getSignalColor(opinion.signal)}`}
            >
              <Zap className="h-4 w-4 mr-1" />
              {displaySignal(opinion.signal)}
            </Badge>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${getConfidenceColor(opinion.confidence)}`}>
                {displayConfidence(opinion.confidence)}
              </span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-foreground">
            {opinion.summary}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border border-l-2 border-l-[oklch(0.7_0.18_150)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-stock-up">
              <TrendingUp className="h-4 w-4" />
              강세 관점
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {opinion.bullCase || "분석 데이터 없음"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-l-2 border-l-[oklch(0.65_0.22_25)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-stock-down">
              <TrendingDown className="h-4 w-4" />
              약세 관점
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {opinion.bearCase || "분석 데이터 없음"}
            </p>
          </CardContent>
        </Card>
      </div>

      {opinion.keyFactors && opinion.keyFactors.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">핵심 투자 요인</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {opinion.keyFactors.map((factor: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {factor}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
