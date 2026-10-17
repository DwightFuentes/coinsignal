import {
  blankQuote,
  parseCmcDetail,
  parseCoinStatsApi,
  parseCoinStatsHtml,
  quoteCandidates,
  type ParsedQuote,
} from "@/lib/sources";
import type { SourceQuote } from "@/lib/types";

const TTL_MS = 60_000;
const cache = new Map<string, { expires: number; value: SourceQuote }>();

async function cached(key: string, load: () => Promise<SourceQuote>): Promise<SourceQuote> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await load();
  cache.set(key, { expires: Date.now() + TTL_MS, value });
  return value;
}

async function readText(url: string, accept: string): Promise<{ status: number; text: string } | null> {
  const headers: Record<string, string> = {
    accept,
    "user-agent": "Mozilla/5.0 (compatible; Wick/1.0)",
  };
  if (url.includes("openapiv1.coinstats.app") && process.env.COINSTATS_API_KEY) {
    headers["X-API-KEY"] = process.env.COINSTATS_API_KEY;
  }
  try {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    return { status: response.status, text: await response.text() };
  } catch {
    return null;
  }
}

function fromParsed(
  source: SourceQuote["source"],
  label: string,
  parsed: ParsedQuote,
  href: string,
): SourceQuote {
  return {
    source,
    label,
    price: parsed.price,
    change24h: parsed.change24h,
    change7d: parsed.change7d,
    href,
    listedAs: parsed.name || null,
  };
}

async function loadCoinMarketCap(id: string, symbol: string): Promise<SourceQuote> {
  for (const slug of quoteCandidates(id, symbol)) {
    const response = await readText(
      `https://api.coinmarketcap.com/data-api/v3/cryptocurrency/detail?slug=${slug}`,
      "application/json",
    );
    if (!response || response.status !== 200) continue;
    try {
      const parsed = parseCmcDetail(JSON.parse(response.text));
      if (!parsed) continue;
      const used = parsed.slug || slug;
      return fromParsed(
        "coinmarketcap",
        "CoinMarketCap",
        parsed,
        `https://coinmarketcap.com/currencies/${used}/`,
      );
    } catch {
      continue;
    }
  }
  return blankQuote("coinmarketcap", "CoinMarketCap");
}

async function loadCoinStats(id: string, symbol: string): Promise<SourceQuote> {
  for (const slug of quoteCandidates(id, symbol)) {
    const api = await readText(`https://openapiv1.coinstats.app/coins/${slug}`, "application/json");
    if (api?.status === 200) {
      try {
        const parsed = parseCoinStatsApi(JSON.parse(api.text));
        if (parsed) {
          const used = parsed.slug || slug;
          return fromParsed("coinstats", "CoinStats", parsed, `https://coinstats.app/coins/${used}/`);
        }
      } catch {
        // The page markup is the fallback.
      }
    }
    const page = await readText(`https://coinstats.app/coins/${slug}`, "text/html");
    if (!page || page.status !== 200) continue;
    const parsed = parseCoinStatsHtml(page.text);
    if (!parsed) continue;
    return fromParsed("coinstats", "CoinStats", { ...parsed, slug }, `https://coinstats.app/coins/${slug}/`);
  }
  return blankQuote("coinstats", "CoinStats");
}

export async function getOutsideQuotes(id: string, symbol: string): Promise<SourceQuote[]> {
  const [coinmarketcap, coinstats] = await Promise.all([
    cached(`cmc:${id}:${symbol}`, () => loadCoinMarketCap(id, symbol)),
    cached(`cs:${id}:${symbol}`, () => loadCoinStats(id, symbol)),
  ]);
  return [coinmarketcap, coinstats];
}
