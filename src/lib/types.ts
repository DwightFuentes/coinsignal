export type Side = "buy" | "sell" | "hold";
export type Vote = -1 | 0 | 1;
export type FactorId = "stretch" | "trend" | "week";

export type Factor = {
  id: FactorId;
  name: string;
  vote: Vote;
  side: Side;
  valueLabel: string;
  summary: string;
};

export type ChartPoint = {
  t: number;
  price: number;
  smaFast: number | null;
  smaSlow: number | null;
};

export type SignalCore = {
  side: Side;
  score: number;
  headline: string;
  narrative: string;
  rsi: number | null;
  smaFast: number | null;
  smaSlow: number | null;
  change7d: number | null;
  factors: Factor[];
  chart: ChartPoint[];
};

export type SourceId = "coingecko" | "coinmarketcap" | "coinstats";

export type SourceQuote = {
  source: SourceId;
  label: string;
  price: number | null;
  change24h: number | null;
  change7d: number | null;
  href: string | null;
  listedAs: string | null;
};

export type CoinSignal = SignalCore & {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  sources: SourceQuote[];
  spreadNote: string;
};

export type SignalsResponse = {
  updatedAt: string;
  coins: CoinSignal[];
  errors: { id: string; message: string }[];
};

export type MarketCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number | null;
  change24h: number | null;
};

export type SearchCoin = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  rank: number | null;
};

export type WatchCoin = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
};
