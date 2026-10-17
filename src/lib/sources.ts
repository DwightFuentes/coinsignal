import type { SourceId, SourceQuote } from "@/lib/types";

export type { SourceId, SourceQuote };

export type ParsedQuote = {
  slug: string;
  name: string;
  price: number;
  change24h: number | null;
  change7d: number | null;
};

const ALIASES: Record<string, string[]> = {
  binancecoin: ["binance-coin", "bnb"],
  "avalanche-2": ["avalanche"],
  "the-open-network": ["toncoin"],
  "matic-network": ["polygon-ecosystem-token", "polygon"],
  "polygon-ecosystem-token": ["pol"],
  ripple: ["xrp"],
};

const SLUG = /^[a-z0-9-]{1,80}$/;

export function quoteCandidates(id: string, symbol: string): string[] {
  const slugs = [id, ...(ALIASES[id] ?? []), symbol.toLowerCase()];
  const unique: string[] = [];
  for (const slug of slugs) {
    if (!SLUG.test(slug) || unique.includes(slug)) continue;
    unique.push(slug);
  }
  return unique;
}

export function blankQuote(source: SourceId, label: string): SourceQuote {
  return {
    source,
    label,
    price: null,
    change24h: null,
    change7d: null,
    href: null,
    listedAs: null,
  };
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

export function parseCmcDetail(payload: unknown): ParsedQuote | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const statistics = row.statistics;
  if (!statistics || typeof statistics !== "object") return null;
  const stats = statistics as Record<string, unknown>;
  const price = numberOrNull(stats.price);
  if (price == null || price <= 0) return null;
  return {
    slug: typeof row.slug === "string" ? row.slug : "",
    name: typeof row.name === "string" ? row.name : "",
    price,
    change24h: numberOrNull(stats.priceChangePercentage24h),
    change7d: numberOrNull(stats.priceChangePercentage7d),
  };
}

export function parseCoinStatsApi(payload: unknown): ParsedQuote | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const price = numberOrNull(row.price);
  if (price == null || price <= 0) return null;
  return {
    slug: typeof row.slug === "string" ? row.slug : typeof row.id === "string" ? row.id : "",
    name: typeof row.name === "string" ? row.name : "",
    price,
    change24h: numberOrNull(row.priceChange1d),
    change7d: numberOrNull(row.priceChange1w),
  };
}

export function parseCoinStatsHtml(html: string): ParsedQuote | null {
  const blocks = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  for (const block of blocks) {
    let payload: unknown;
    try {
      payload = JSON.parse(block[1]);
    } catch {
      continue;
    }
    if (!payload || typeof payload !== "object") continue;
    const product = payload as {
      "@type"?: string;
      name?: string;
      offers?: { price?: unknown };
      additionalProperty?: Array<{ name?: string; value?: unknown }>;
    };
    if (product["@type"] !== "Product") continue;
    const price = numberOrNull(product.offers?.price);
    if (price == null || price <= 0) continue;
    const day = product.additionalProperty?.find((item) => item.name === "Percent Change 24H");
    const weekChunk = html.split(">7d Change<")[1] ?? "";
    const week = weekChunk.match(/data-value="(-?\d+(?:\.\d+)?)"/);
    return {
      slug: "",
      name: product.name ?? "",
      price,
      change24h: numberOrNull(day?.value),
      change7d: week ? numberOrNull(week[1]) : null,
    };
  }
  return null;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function describeSources(quotes: SourceQuote[]): { gapPct: number | null; note: string } {
  const priced = quotes.filter((quote) => quote.price != null && quote.price > 0);
  const missing = quotes.filter((quote) => quote.price == null).map((quote) => quote.label);
  const missingSentence = missing.length ? ` ${joinNames(missing)} did not return a price.` : "";
  if (priced.length === 0) {
    return { gapPct: null, note: "None of the sources returned a price." };
  }
  if (priced.length === 1) {
    return {
      gapPct: null,
      note: `${missingSentence.trim()} ${priced[0].label} is the only live price.`.trim(),
    };
  }
  const prices = priced.map((quote) => quote.price as number);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const gapPct = ((high - low) / low) * 100;
  const names = joinNames(priced.map((quote) => quote.label));
  if (gapPct < 0.05) {
    return { gapPct, note: `${names} match.${missingSentence}` };
  }
  if (gapPct < 0.5) {
    return { gapPct, note: `${names} agree within ${gapPct.toFixed(1)}%.${missingSentence}` };
  }
  return {
    gapPct,
    note: `${names} differ by ${gapPct.toFixed(1)}%. The mark still follows CoinGecko.${missingSentence}`,
  };
}
