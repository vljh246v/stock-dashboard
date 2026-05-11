import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink, Calendar } from "lucide-react";

interface Props {
  filings: any;
  insights: any;
  isLoading: boolean;
}

export default function FilingsSection({ filings, insights, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  // Handle quoteSummary wrapper from Yahoo API
  const filingsData = filings?.quoteSummary?.result?.[0] || filings;
  const secFilings = filingsData?.secFilings?.filings || filings?.filings || [];
  const sigDevs = insights?.sigDevs || [];

  const getFilingBadgeColor = (type: string) => {
    const t = type?.toUpperCase() || "";
    if (t.includes("10-K")) return "bg-primary/20 text-primary";
    if (t.includes("10-Q")) return "bg-chart-1/20 text-chart-1";
    if (t.includes("8-K")) return "bg-chart-3/20 text-chart-3";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      {/* SEC Filings */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            SEC 공시 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {secFilings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              공시 정보를 불러올 수 없습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {secFilings.slice(0, 15).map((filing: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-md bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="secondary" className={`text-xs shrink-0 ${getFilingBadgeColor(filing.type)}`}>
                      {filing.type || "N/A"}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm truncate">{filing.title || "제목 없음"}</p>
                      <p className="text-xs text-muted-foreground">{filing.date || "날짜 미상"}</p>
                    </div>
                  </div>
                  {filing.edgarUrl && (
                    <a
                      href={filing.edgarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 shrink-0 ml-2"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Significant Events Timeline */}
      {sigDevs.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              주요 이벤트 타임라인
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4 pl-8">
                {sigDevs.slice(0, 10).map((event: any, idx: number) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm">{event.headline || "이벤트 정보 없음"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.date || "날짜 미상"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
