import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, Globe, MapPin, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  data: any;
  isLoading: boolean;
  chartMeta?: any; // chart.result[0].meta for ETF name fallback
}

export default function CompanyOverview({ data, isLoading, chartMeta }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-32 mb-3" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const profile = data?.summaryProfile;
  const fundProfile = data?.fundProfile;
  const price = data?.price;

  // ETF or regular stock name: try price first, then chartMeta
  const companyName =
    price?.shortName || price?.longName ||
    chartMeta?.shortName || chartMeta?.longName || "";

  // Determine if this is an ETF (has fundProfile or instrumentType from chart)
  const isETF = !!fundProfile || chartMeta?.instrumentType === "ETF";

  if (!profile && !fundProfile) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 text-center text-muted-foreground">
          기업 정보를 불러올 수 없습니다.
        </CardContent>
      </Card>
    );
  }

  // For ETF: extract relevant fields from fundProfile
  const etfFamily = fundProfile?.family;
  const etfCategory = fundProfile?.categoryName;
  const etfLegalType = fundProfile?.legalType;
  const etfExpenseRatio = fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio?.fmt;
  const etfTurnover = fundProfile?.feesExpensesInvestment?.annualHoldingsTurnover?.fmt;

  const officers = profile?.companyOfficers || profile?.executiveTeam || [];
  const businessSummary = profile?.longBusinessSummaryKo || profile?.longBusinessSummary;

  return (
    <div className="space-y-4">
      {/* Company / ETF Name */}
      {companyName && (
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">{companyName}</h2>
          {isETF && (
            <Badge variant="secondary" className="text-xs">ETF</Badge>
          )}
        </div>
      )}

      {/* Info Grid */}
      {isETF ? (
        /* ETF-specific info */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoCard
            icon={<Building2 className="h-4 w-4" />}
            label="운용사"
            value={etfFamily || "N/A"}
          />
          <InfoCard
            icon={<Globe className="h-4 w-4" />}
            label="카테고리"
            value={etfCategory || "N/A"}
          />
          <InfoCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="총보수(연)"
            value={etfExpenseRatio || "N/A"}
          />
          <InfoCard
            icon={<MapPin className="h-4 w-4" />}
            label="유형"
            value={etfLegalType || "N/A"}
          />
        </div>
      ) : (
        /* Regular stock info */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoCard
            icon={<Building2 className="h-4 w-4" />}
            label="업종"
            value={profile?.industry || "N/A"}
          />
          <InfoCard
            icon={<Globe className="h-4 w-4" />}
            label="섹터"
            value={profile?.sector || "N/A"}
          />
          <InfoCard
            icon={<Users className="h-4 w-4" />}
            label="직원 수"
            value={profile?.fullTimeEmployees?.toLocaleString() || "N/A"}
          />
          <InfoCard
            icon={<MapPin className="h-4 w-4" />}
            label="소재지"
            value={[profile?.city, profile?.country].filter(Boolean).join(", ") || "N/A"}
          />
        </div>
      )}

      {/* ETF additional details */}
      {isETF && etfTurnover && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">ETF 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {etfExpenseRatio && (
                <div>
                  <span className="text-muted-foreground">총보수율: </span>
                  <span className="font-medium">{etfExpenseRatio}</span>
                </div>
              )}
              {etfTurnover && (
                <div>
                  <span className="text-muted-foreground">회전율: </span>
                  <span className="font-medium">{etfTurnover}</span>
                </div>
              )}
              {etfFamily && (
                <div>
                  <span className="text-muted-foreground">운용사: </span>
                  <span className="font-medium">{etfFamily}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business / Fund Summary */}
      {businessSummary && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              {isETF ? "펀드 요약" : "사업 요약"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {businessSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Executives (regular stocks only) */}
      {!isETF && officers.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">경영진</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {officers.slice(0, 6).map((officer: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-md bg-secondary/50">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {(officer.name || "?").charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{officer.name || "N/A"}</p>
                    <p className="text-xs text-muted-foreground truncate">{officer.title || "N/A"}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Info (regular stocks only) */}
      {!isETF && (profile?.website || profile?.phone || profile?.address1) && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">연락처</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">웹사이트: </span>
                {profile?.website ? (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {profile.website}
                  </a>
                ) : "N/A"}
              </div>
              <div>
                <span className="text-muted-foreground">전화: </span>
                <span>{profile?.phone || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">주소: </span>
                <span>{profile?.address1 || "N/A"}, {profile?.zip || ""}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="text-primary">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
