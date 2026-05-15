import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History } from "lucide-react";

interface Outcome {
  horizon: string;
  status: string;
  observedDate: Date | string | null;
  observedPrice: number | null;
  returnPct: number | null;
  alignment: string;
}

interface TrackingRow {
  snapshot: {
    opinionCreatedAt: Date | string;
    finalSignal: string;
    finalConfidence: string;
    startObservedDate: Date | string | null;
    startPrice: number | null;
  };
  outcomes: Outcome[];
}

interface Props {
  tracking: {
    rows: TrackingRow[];
    copy?: {
      title?: string;
      description?: string;
      empty?: string;
    };
  } | undefined;
  isLoading: boolean;
}

const getOutcome = (row: TrackingRow, horizon: string) =>
  row.outcomes.find(outcome => outcome.horizon === horizon);

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return "확인 불가";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 불가";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const formatPrice = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? `$${value.toFixed(2)}`
    : "데이터 부족";

const formatOutcome = (outcome: Outcome | undefined) => {
  if (!outcome || outcome.status === "pending") return "수집 중";
  if (outcome.status === "unavailable") return "데이터 부족";
  const pct = typeof outcome.returnPct === "number" ? `${outcome.returnPct.toFixed(2)}%` : "확인 불가";
  return `${pct} · ${outcome.alignment}`;
};

const badgeVariant = (outcome: Outcome | undefined) => {
  if (!outcome || outcome.status === "pending") return "secondary" as const;
  if (outcome.status === "unavailable") return "outline" as const;
  return outcome.alignment === "방향 일치" ? "default" as const : "outline" as const;
};

export default function OpinionTrackingTable({ tracking, isLoading }: Props) {
  const rows = tracking?.rows ?? [];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          {tracking?.copy?.title || "판단 기록"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {tracking?.copy?.description || "이전에 남긴 판단과 이후 가격 변화를 함께 보여줍니다."}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">기록을 불러오고 있습니다.</div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            {tracking?.copy?.empty || "아직 비교할 1개월/3개월 뒤 가격 데이터가 충분하지 않습니다."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>분석일</TableHead>
                  <TableHead>당시 판단</TableHead>
                  <TableHead>당시 가격</TableHead>
                  <TableHead>1개월 뒤</TableHead>
                  <TableHead>3개월 뒤</TableHead>
                  <TableHead>확인 상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => {
                  const oneMonth = getOutcome(row, "1m");
                  const threeMonth = getOutcome(row, "3m");
                  const pendingCount = [oneMonth, threeMonth].filter(
                    outcome => !outcome || outcome.status === "pending"
                  ).length;
                  return (
                    <TableRow key={`${row.snapshot.opinionCreatedAt}-${index}`}>
                      <TableCell className="whitespace-nowrap">{formatDate(row.snapshot.opinionCreatedAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{row.snapshot.finalSignal}</span>
                          <span className="text-xs text-muted-foreground">신뢰도 {row.snapshot.finalConfidence}</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatPrice(row.snapshot.startPrice)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant(oneMonth)}>{formatOutcome(oneMonth)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant(threeMonth)}>{formatOutcome(threeMonth)}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {pendingCount > 0 ? "수집 중" : "확인 가능"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
