export type MetricFreshness =
  | {
      kind: "checked_at";
      checkedAt: string;
      note: string;
    }
  | {
      kind: "as_of";
      asOf: string;
    }
  | {
      kind: "not_material";
      note: string;
    };

export type MetricUnavailableReason =
  | "missing_source"
  | "missing_value"
  | "missing_freshness"
  | "missing_calculation"
  | "weak_prose_source"
  | "not_applicable";

export interface MetricSource {
  name: string;
  basis: string;
}

export interface AvailableMetric {
  id: string;
  labelKo: string;
  descriptionKo: string;
  status: "available";
  value: string;
  rawValue?: number;
  source: MetricSource;
  freshness: MetricFreshness;
}

export interface UnavailableMetric {
  id: string;
  labelKo: string;
  descriptionKo: string;
  status: "unavailable";
  unavailableReason: MetricUnavailableReason;
  unavailableDetailKo: string;
  expectedSource?: MetricSource;
  freshness?: MetricFreshness;
}

export type FinancialMetric = AvailableMetric | UnavailableMetric;

export interface MetricGroup {
  id: string;
  labelKo: string;
  descriptionKo: string;
  metrics: FinancialMetric[];
}

export interface AnalysisMetrics {
  assetType: "stock" | "etf" | "unknown";
  generatedAt: string;
  groups: MetricGroup[];
  dataQuality: {
    available: number;
    unavailable: number;
    total: number;
  };
}
