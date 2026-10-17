import { CoinGeckoError, searchCoins } from "@/lib/coingecko";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  try {
    const coins = await searchCoins(query);
    return Response.json({ coins }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof CoinGeckoError ? error.status : 502;
    const message = error instanceof Error ? error.message : "Search failed.";
    return Response.json({ error: message }, { status: status === 429 ? 429 : 502 });
  }
}
