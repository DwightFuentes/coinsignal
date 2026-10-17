import type { WatchCoin } from "@/lib/types";

const KEY = "wick.watchlist.v1";
const CHANGE = "wick-watchlist";

export function subscribeWatchlist(onStoreChange: () => void) {
  window.addEventListener(CHANGE, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CHANGE, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function readWatchlistRaw(): string {
  return localStorage.getItem(KEY) ?? "[]";
}

export function emptyWatchlist(): string {
  return "[]";
}

function isWatchCoin(value: unknown): value is WatchCoin {
  if (!value || typeof value !== "object") return false;
  const coin = value as WatchCoin;
  return (
    typeof coin.id === "string" &&
    /^[a-z0-9-]{1,80}$/.test(coin.id) &&
    typeof coin.symbol === "string" &&
    coin.symbol.length > 0 &&
    coin.symbol.length < 20 &&
    typeof coin.name === "string" &&
    coin.name.length > 0 &&
    coin.name.length < 80
  );
}

export function parseWatchlist(raw: string): WatchCoin[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWatchCoin).slice(0, 5);
  } catch {
    return [];
  }
}

export function writeWatchlist(coins: WatchCoin[]) {
  localStorage.setItem(KEY, JSON.stringify(coins.slice(0, 5)));
  window.dispatchEvent(new Event(CHANGE));
}
