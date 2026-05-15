export const QUALITY_SECTOR_KEYS = [
  "innovativeness",
  "hiring",
  "sustainability",
  "insiderSentiments",
  "earningsReports",
  "dividends",
] as const;

export type QualitySectorKey = (typeof QUALITY_SECTOR_KEYS)[number];

const NEUTRAL_SCORE = 0.5;
const NEUTRAL_TOLERANCE = 0.000001;
const MIN_PRESENT_VALUES = 3;
const NEUTRAL_SHARE_THRESHOLD = 0.8;
const TRUST_METADATA_KEYS = [
  "source",
  "provider",
  "methodology",
  "asOfDate",
] as const;

function normalizedQualityScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return value;
  if (value >= 0 && value <= 100) return value / 100;
  return null;
}

function hasBenchmarkMetadata(snapshot: Record<string, unknown>) {
  return TRUST_METADATA_KEYS.some(key => {
    const value = snapshot[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function isTrustedQualitySectorComparison(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;

  const sectorSnapshot = snapshot as Record<string, unknown>;
  const values = QUALITY_SECTOR_KEYS.map(key =>
    normalizedQualityScore(sectorSnapshot[key])
  ).filter((value): value is number => value !== null);

  if (values.length < MIN_PRESENT_VALUES) return false;

  const neutralCount = values.filter(
    value => Math.abs(value - NEUTRAL_SCORE) <= NEUTRAL_TOLERANCE
  ).length;
  const neutralShare = neutralCount / values.length;

  if (neutralShare >= NEUTRAL_SHARE_THRESHOLD) return false;
  return hasBenchmarkMetadata(sectorSnapshot);
}
