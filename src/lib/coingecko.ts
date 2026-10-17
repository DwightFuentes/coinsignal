import { parseIds } from "@/lib/ids";
import type { MarketCoin, SearchCoin } from "@/lib/types";

const BASE = "https://api.coingecko.com/api/v3";
const TTL_MS = 45_000;

export class CoinGeckoError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CoinGeckoError";
    this.status = status;
  }
}

type CacheEntry<T> = { expires: number; value: T };

const memory = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load();
  memory.set(key, { expires: Date.now() + TTL_MS, value });
  return value;
}

async function readJson<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "Wick/1.0",
  };
  const apiKey = process.env.COINGECKO_API_KEY;
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { headers, cache: "no-store" });
  } catch {
    throw new CoinGeckoError(503, "CoinGecko could not be reached.");
  }

  if (!response.ok) {
    const message =
      response.status === 429
        ? "CoinGecko is rate-limiting requests. Wait a minute, then refresh."
        : "CoinGecko returned an error.";
    throw new CoinGeckoError(response.status, message);
  }

  return (await response.json()) as T;
}

type RawMarket = {
  id?: string;
  symbol?: string;
  name?: string;
  image?: string;
  current_price?: number | null;
  market_cap?: number | null;
  total_volume?: number | null;
  price_change_percentage_24h?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
};

export type MarketQuote = MarketCoin & {
  change7d: number | null;
  marketCap: number | null;
  volume24h: number | null;
};

function finite(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

export async function getMarkets(ids: string[]): Promise<MarketQuote[]> {
  const clean = parseIds(ids.join(","), 15);
  if (clean.length === 0) return [];
  const rows = await cached(`markets:${clean.join(",")}`, () =>
    readJson<RawMarket[]>(
      `/coins/markets?vs_currency=usd&ids=${clean.join(",")}&price_change_percentage=7d`,
    ),
  );
  const byId = new Map<string, MarketQuote>();
  for (const row of rows) {
    if (!row.id || !row.symbol || !row.name) continue;
    byId.set(row.id, {
      id: row.id,
      symbol: row.symbol.toLowerCase(),
      name: row.name,
      image: row.image ?? "",
      price: finite(row.current_price),
      change24h: finite(row.price_change_percentage_24h),
      change7d: finite(row.price_change_percentage_7d_in_currency),
      marketCap: finite(row.market_cap),
      volume24h: finite(row.total_volume),
    });
  }
  return clean.flatMap((id) => {
    const quote = byId.get(id);
    return quote ? [quote] : [];
  });
}

export async function getDailyPrices(id: string): Promise<Array<[number, number]>> {
  const clean = parseIds(id)[0];
  if (!clean) return [];
  const payload = await cached(`chart:${clean}`, () =>
    readJson<{ prices?: Array<[number, number]> }>(
      `/coins/${clean}/market_chart?vs_currency=usd&days=90&interval=daily`,
    ),
  );
  return (payload.prices ?? []).filter(
    (point): point is [number, number] =>
      Array.isArray(point) && point.length >= 2 && point.every((value) => Number.isFinite(value)),
  );
}

type RawSearch = {
  coins?: Array<{
    id?: string;
    name?: string;
    symbol?: string;
    thumb?: string;
    market_cap_rank?: number | null;
  }>;
};

export async function searchCoins(query: string): Promise<SearchCoin[]> {
  const q = query.trim();
  if (q.length < 1 || q.length > 40) return [];
  const payload = await cached(`search:${q.toLowerCase()}`, () =>
    readJson<RawSearch>(`/search?query=${encodeURIComponent(q)}`),
  );
  return (payload.coins ?? [])
    .filter((coin) => coin.id && coin.name && coin.symbol)
    .map((coin) => ({
      id: coin.id as string,
      name: coin.name as string,
      symbol: (coin.symbol as string).toLowerCase(),
      image: coin.thumb,
      rank: coin.market_cap_rank ?? null,
    }))
    .sort((a, b) => {
      if (a.rank == null) return 1;
      if (b.rank == null) return -1;
      return a.rank - b.rank;
    })
    .slice(0, 8);
}
