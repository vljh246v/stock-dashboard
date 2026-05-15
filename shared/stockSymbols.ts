const SYMBOL_ALIASES: Record<string, string> = {
  APPLE: "AAPL",
  "APPLE INC": "AAPL",
  "APPLE INC.": "AAPL",
};

export function normalizeStockSymbol(input: string): string {
  const normalized = input.trim().toUpperCase().replace(/\s+/g, " ");
  return SYMBOL_ALIASES[normalized] ?? normalized;
}
