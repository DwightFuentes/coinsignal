import { CoinGeckoError, getDailyPrices, getMarkets } from "@/lib/coingecko";
import { parseIds } from "@/lib/ids";
import { buildSignal } from "@/lib/signal";
import type { CoinSignal, SignalsResponse } from "@/lib/types";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const ids = parseIds(request.nextUrl.searchParams.get("ids"));
  if (ids.length === 0) {
    return Response.json({ error: "Pick at least one coin." }, { status: 400 });
  }

  try {
    const markets = await getMarkets(ids);
    const charts = await Promise.all(
      ids.map(async (id) => {
        try {
          return { id, prices: await getDailyPrices(id), error: null };
        } catch (error) {
          const message =
            error instanceof CoinGeckoError ? error.message : "Price history did not load.";
          return { id, prices: [] as Array<[number, number]>, error: message };
        }
      }),
    );

    const coins: CoinSignal[] = [];
    const errors: SignalsResponse["errors"] = [];

    for (const id of ids) {
      const market = markets.find((quote) => quote.id === id);
      const chart = charts.find((entry) => entry.id === id);
      if (!market || market.price == null) {
        errors.push({
          id,
          message: chart?.error ?? "CoinGecko has no USD market for this coin.",
        });
        continue;
      }
      if (chart?.error) errors.push({ id, message: chart.error });
      const signal = buildSignal({
        prices: chart?.prices ?? [],
        change7d: market.change7d,
      });
      coins.push({
        ...signal,
        id: market.id,
        symbol: market.symbol,
        name: market.name,
        image: market.image,
        price: market.price,
        change24h: market.change24h,
        marketCap: market.marketCap,
        volume24h: market.volume24h,
      });
    }

    const body: SignalsResponse = {
      updatedAt: new Date().toISOString(),
      coins,
      errors,
    };
    return Response.json(body, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof CoinGeckoError ? error.status : 502;
    const message = error instanceof Error ? error.message : "CoinGecko returned an error.";
    return Response.json({ error: message }, { status: status === 429 ? 429 : 502 });
  }
}
