import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Newspaper, AlertCircle, SmilePlus, Frown, Meh } from "lucide-react";

interface Props {
  sentiment: any;
  isLoading: boolean;
  isETF?: boolean;
}

export default function SentimentSection({ sentiment, isLoading, isETF }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (isETF) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-8 text-center space-y-3">
          <Newspaper className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">ETF 감성 분석 미지원</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            ETF는 개별 종목과 달리 뉴스 기반 감성 데이터가 제공되지 않습니다.<br />
            ETF 정보 탭에서 운용사, 종보율, 상위 구성 종목을 확인하세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!sentiment || sentiment.error || sentiment.noData) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 text-center space-y-2">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {sentiment?.marketImpact || "감성 분석 데이터를 불러올 수 없습니다."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const getSentimentIcon = (s: string) => {
    if (s === "긍정") return <SmilePlus className="h-4 w-4 text-stock-up" />;
    if (s === "부정") return <Frown className="h-4 w-4 text-stock-down" />;
    return <Meh className="h-4 w-4 text-muted-foreground" />;
  };

  const getSentimentBadgeColor = (s: string) => {
    if (s === "긍정") return "bg-stock-up text-stock-up";
    if (s === "부정") return "bg-stock-down text-stock-down";
    return "bg-muted text-muted-foreground";
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 65) return "text-stock-up";
    if (score <= 35) return "text-stock-down";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      {/* Overall Sentiment */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            뉴스 감성 분석 요약
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              {getSentimentIcon(sentiment.overallSentiment)}
              <Badge variant="secondary" className={getSentimentBadgeColor(sentiment.overallSentiment)}>
                {sentiment.overallSentiment || "N/A"}
              </Badge>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">감성 점수</span>
                <span className={`text-sm font-mono font-semibold ${getScoreColor(sentiment.sentimentScore)}`}>
                  {sentiment.sentimentScore !== null ? `${sentiment.sentimentScore}/100` : "N/A"}
                </span>
              </div>
              {sentiment.sentimentScore !== null && (
                <Progress value={sentiment.sentimentScore} className="h-2" />
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {sentiment.marketImpact}
          </p>
        </CardContent>
      </Card>

      {/* News Analysis List */}
      {sentiment.newsAnalysis && sentiment.newsAnalysis.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">뉴스/이벤트 감성 상세</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sentiment.newsAnalysis.map((item: any, idx: number) => (
                <div key={idx} className="p-3 rounded-md bg-secondary/30 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium flex-1">{item.headline}</p>
                    <Badge variant="secondary" className={`text-xs shrink-0 ${getSentimentBadgeColor(item.sentiment)}`}>
                      {item.sentiment}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.impact}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
