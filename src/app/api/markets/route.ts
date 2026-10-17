import { CoinGeckoError, getMarkets } from "@/lib/coingecko";
import { parseIds } from "@/lib/ids";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const ids = parseIds(request.nextUrl.searchParams.get("ids"), 15);
  if (ids.length === 0) {
    return Response.json({ coins: [] });
  }
  try {
    const coins = await getMarkets(ids);
    return Response.json(
      {
        coins: coins.map((coin) => ({
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          image: coin.image,
          price: coin.price,
          change24h: coin.change24h,
        })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof CoinGeckoError ? error.status : 502;
    const message = error instanceof Error ? error.message : "CoinGecko returned an error.";
    return Response.json({ error: message }, { status: status === 429 ? 429 : 502 });
  }
}
