import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

const getAgentIcon = (agentName: string) => {
  if (agentName.includes("기술")) return <LineChart className="h-4 w-4" />;
  if (agentName.includes("펀더멘털")) return <BarChart3 className="h-4 w-4" />;
  if (agentName.includes("리스크")) return <Shield className="h-4 w-4" />;
  return <Brain className="h-4 w-4" />;
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
            {opinion?.summary || opinion?.finalVerdict?.summary || "투자 의견을 생성할 수 없습니다. 잠시 후 다시 시도해주세요."}
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

  const { agents, finalVerdict, disclaimer } = opinion as MultiAgentOpinion;

  return (
    <div className="space-y-4">
      {/* Final Verdict Header */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            멀티 에이전트 종합 투자 의견
            <Badge variant="secondary" className="text-[10px] ml-auto">
              4개 에이전트 합의
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
              {finalVerdict.signal || "N/A"}
            </Badge>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">신뢰도:</span>
              <span className={`text-sm font-medium ${getConfidenceColor(finalVerdict.confidence)}`}>
                {finalVerdict.confidence || "N/A"}
              </span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-foreground">
            {finalVerdict.summary}
          </p>
        </CardContent>
      </Card>

      {/* Individual Agent Opinions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {agents.map((agent, idx) => (
          <Card key={idx} className={`bg-card border-border border-l-2 ${getSignalBg(agent.signal)}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                {getAgentIcon(agent.agentName)}
                {agent.agentName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs ${getSignalColor(agent.signal)}`}>
                  {agent.signal}
                </Badge>
                <span className={`text-xs ${getConfidenceColor(agent.confidence)}`}>
                  {agent.confidence}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {agent.reasoning}
              </p>
              <div className="space-y-1">
                {agent.keyPoints.map((point, pidx) => (
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

      {/* Bull / Bear Cases */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border border-l-2 border-l-[oklch(0.7_0.18_150)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-stock-up">
              <TrendingUp className="h-4 w-4" />
              강세 관점 (Bull Case)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {finalVerdict.bullCase || "분석 데이터 없음"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border border-l-2 border-l-[oklch(0.65_0.22_25)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-stock-down">
              <TrendingDown className="h-4 w-4" />
              약세 관점 (Bear Case)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {finalVerdict.bearCase || "분석 데이터 없음"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dissent */}
      {finalVerdict.dissent && (
        <Card className="bg-card border-border border-l-2 border-l-amber-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              소수 의견 / 반대 논거
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {finalVerdict.dissent}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Key Factors */}
      {finalVerdict.keyFactors && finalVerdict.keyFactors.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">핵심 투자 요인</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {finalVerdict.keyFactors.map((factor: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {factor}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
            AI 종합 투자 의견
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge
              variant="outline"
              className={`text-base px-4 py-1.5 font-semibold ${getSignalColor(opinion.signal)}`}
            >
              <Zap className="h-4 w-4 mr-1" />
              {opinion.signal || "N/A"}
            </Badge>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">신뢰도:</span>
              <span className={`text-sm font-medium ${getConfidenceColor(opinion.confidence)}`}>
                {opinion.confidence || "N/A"}
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
              강세 관점 (Bull Case)
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
              약세 관점 (Bear Case)
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
