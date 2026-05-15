import type { ComponentProps } from "react";
import OpinionTrackingTable from "./OpinionTrackingTable";

interface Props {
  tracking: ComponentProps<typeof OpinionTrackingTable>["tracking"];
  isLoading: boolean;
}

export default function OpinionTrackingSection({ tracking, isLoading }: Props) {
  return (
    <section className="space-y-3" aria-labelledby="post-opinion-tracking">
      <div>
        <h2 id="post-opinion-tracking" className="text-sm font-semibold">
          사후 판단 기록
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          현재 분석에 사용된 근거가 아니라, 이전 판단과 이후 가격 변화를
          분리해서 추적하는 기록입니다.
        </p>
      </div>
      <OpinionTrackingTable tracking={tracking} isLoading={isLoading} />
    </section>
  );
}
