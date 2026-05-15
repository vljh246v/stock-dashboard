import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatReportDate } from "@shared/reportDates";
import { UserCheck, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface Props {
  holders: any;
  profile?: any;
  isLoading: boolean;
}

export default function GovernanceSection({ holders, profile, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  // Handle quoteSummary wrapper from Yahoo API
  const holdersData = holders?.quoteSummary?.result?.[0] || holders;
  const insiderHolders = holdersData?.insiderHolders?.holders || [];
  const officers = profile?.summaryProfile?.companyOfficers || [];
  const displayDate = (value: unknown) => formatReportDate(value) || "N/A";

  if (insiderHolders.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 text-center text-muted-foreground">
          내부자 보유 정보를 불러오지 못했습니다.
        </CardContent>
      </Card>
    );
  }

  const getTransactionBadge = (desc: string) => {
    const d = desc?.toLowerCase() || "";
    if (d.includes("buy") || d.includes("purchase") || d.includes("acquisition")) {
      return <Badge variant="secondary" className="bg-stock-up text-stock-up text-xs">매수</Badge>;
    }
    if (d.includes("sell") || d.includes("sale") || d.includes("disposition")) {
      return <Badge variant="secondary" className="bg-stock-down text-stock-down text-xs">매도</Badge>;
    }
    if (d.includes("option") || d.includes("exercise")) {
      return <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">옵션 행사</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">{desc || "N/A"}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Insider Holdings Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            내부자 보유 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">이름</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">직위</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">보유 주식</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">최근 거래</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">거래일</th>
                </tr>
              </thead>
              <tbody>
                {insiderHolders.map((holder: any, idx: number) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium">{holder.name || "N/A"}</td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">{holder.relation || "N/A"}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs">
                      {holder.positionDirect?.fmt || "N/A"}
                    </td>
                    <td className="py-2.5 px-3">
                      {getTransactionBadge(holder.transactionDescription)}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">
                      {displayDate(holder.latestTransDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">확인된 내부자</p>
            <p className="text-2xl font-bold mt-1">{insiderHolders.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">최근 매수 건수</p>
            <p className="text-2xl font-bold mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-4 w-4 text-stock-up" />
              {insiderHolders.filter((h: any) =>
                (h.transactionDescription || "").toLowerCase().includes("buy") ||
                (h.transactionDescription || "").toLowerCase().includes("purchase")
              ).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">최근 매도 건수</p>
            <p className="text-2xl font-bold mt-1 flex items-center gap-1">
              <ArrowDownRight className="h-4 w-4 text-stock-down" />
              {insiderHolders.filter((h: any) =>
                (h.transactionDescription || "").toLowerCase().includes("sell") ||
                (h.transactionDescription || "").toLowerCase().includes("sale")
              ).length}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
