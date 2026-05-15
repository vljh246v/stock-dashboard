import { describe, expect, it } from "vitest";

import { formatReportDate, reportDateSortKey } from "@shared/reportDates";

describe("report date helpers", () => {
  it("sorts Date reportDate values without relying on string methods", () => {
    const dates = [
      new Date("2024-04-30T00:00:00.000Z"),
      "2024-05-01",
      null,
      1714694400000,
    ];

    const sorted = dates
      .toSorted((a, b) => reportDateSortKey(b).localeCompare(reportDateSortKey(a)))
      .map(formatReportDate);

    expect(sorted).toEqual(["2024-05-03", "2024-05-01", "2024-04-30", ""]);
  });

  it("formats Yahoo date objects with fmt or raw values", () => {
    expect(formatReportDate({ raw: 1714348800, fmt: "2024-04-29" })).toBe("2024-04-29");
    expect(formatReportDate({ raw: 1714435200000 })).toBe("2024-04-30");
    expect(reportDateSortKey({ raw: 1714435200 })).toBe("2024-04-30");
  });
});
