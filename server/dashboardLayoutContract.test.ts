import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(import.meta.dirname, "../client/src/pages/Dashboard.tsx"),
  "utf-8"
);
const technicalAnalysisSource = readFileSync(
  resolve(
    import.meta.dirname,
    "../client/src/components/sections/TechnicalAnalysis.tsx"
  ),
  "utf-8"
);
const investmentOpinionSource = readFileSync(
  resolve(
    import.meta.dirname,
    "../client/src/components/sections/InvestmentOpinion.tsx"
  ),
  "utf-8"
);
const guidanceSectionSource = readFileSync(
  resolve(
    import.meta.dirname,
    "../client/src/components/sections/GuidanceSection.tsx"
  ),
  "utf-8"
);

describe("Dashboard layout contract", () => {
  it("keeps mobile content usable without shrinking the main dashboard column", () => {
    expect(dashboardSource).toContain("flex-col");
    expect(dashboardSource).toContain("md:flex-row");
    expect(dashboardSource).toContain("max-h-56");
    expect(dashboardSource).toContain("overflow-hidden");
    expect(dashboardSource).toContain("min-h-0 shrink-0 md:flex-1");
    expect(dashboardSource).toContain(
      "flex gap-2 overflow-x-auto p-2 [scrollbar-width:none] md:block"
    );
    expect(dashboardSource).toContain(
      "flex min-w-[10rem] shrink-0 cursor-pointer"
    );
    expect(dashboardSource).toContain(
      "opacity-100 transition-opacity hover:bg-destructive/20 md:opacity-0"
    );
    expect(dashboardSource).toContain("hidden shrink-0 space-y-2 p-3 md:block");
    expect(dashboardSource).toContain("h-8 w-8 p-0 md:hidden");
    expect(dashboardSource).toContain(
      "hidden shrink-0 items-center justify-between p-3 md:flex"
    );
    expect(dashboardSource).toContain("md:w-64");
    expect(dashboardSource).toContain("min-w-0 flex-1 overflow-y-auto");
  });

  it("keeps populated analysis sections from forcing desktop rows on phones", () => {
    expect(technicalAnalysisSource).toContain(
      "flex flex-col gap-3 sm:flex-row"
    );
    expect(technicalAnalysisSource).toContain("flex flex-wrap gap-x-3 gap-y-1");
    expect(investmentOpinionSource).toContain(
      "grid grid-cols-1 gap-4 sm:grid-cols-3"
    );
    expect(investmentOpinionSource).toContain(
      "flex flex-col items-start gap-3 sm:flex-row"
    );
    expect(guidanceSectionSource).toContain(
      "grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3"
    );
  });
});
