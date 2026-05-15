export type SavedWatchlistItem = {
  id: number | string;
  symbol: string;
  name?: string | null;
};

export type WatchlistDisplayItem = {
  id: string;
  symbol: string;
  name?: string | null;
  saved: boolean;
  currentOnly: boolean;
};

export function buildWatchlistDisplayItems(
  watchlist: SavedWatchlistItem[],
  selectedSymbol: string,
): WatchlistDisplayItem[] {
  const savedItems = watchlist.map((item) => ({
    id: String(item.id),
    symbol: item.symbol,
    name: item.name,
    saved: true,
    currentOnly: false,
  }));

  if (!selectedSymbol) return savedItems;

  const hasSelectedSymbol = savedItems.some((item) => item.symbol === selectedSymbol);
  if (hasSelectedSymbol) return savedItems;

  return [
    {
      id: `current-${selectedSymbol}`,
      symbol: selectedSymbol,
      name: "현재 분석 중",
      saved: false,
      currentOnly: true,
    },
    ...savedItems,
  ];
}
