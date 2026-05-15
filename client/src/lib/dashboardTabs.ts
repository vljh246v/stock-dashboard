export const STOCK_DASHBOARD_TAB_VALUES = [
  "core",
  "technical",
  "financial-guidance",
  "opinion",
  "evidence",
  "sentiment",
] as const;

export const ETF_DASHBOARD_TAB_VALUES = [
  "core",
  "technical",
  "etf",
  "opinion",
  "evidence",
  "sentiment",
] as const;

export type DashboardTabValue =
  | (typeof STOCK_DASHBOARD_TAB_VALUES)[number]
  | (typeof ETF_DASHBOARD_TAB_VALUES)[number];

export function getDashboardTabValues(isETF: boolean) {
  return isETF ? ETF_DASHBOARD_TAB_VALUES : STOCK_DASHBOARD_TAB_VALUES;
}

export function coerceDashboardTabForAsset(
  activeTab: string,
  isETF: boolean
): DashboardTabValue {
  const validTabs: readonly string[] = getDashboardTabValues(isETF);
  return validTabs.includes(activeTab)
    ? (activeTab as DashboardTabValue)
    : "core";
}
