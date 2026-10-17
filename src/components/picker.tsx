"use client";

import { CoinMark } from "@/components/coin-mark";
import { Input } from "@/components/ui/input";
import { POPULAR_COINS, WATCHLIST_LIMIT } from "@/lib/coins";
import { formatPct, formatUsd, pctTone } from "@/lib/format";
import type { MarketCoin, SearchCoin, WatchCoin } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

function toWatch(coin: {
  id: string;
  symbol: string;
  name: string;
  image?: string;
}): WatchCoin {
  return {
    id: coin.id,
    symbol: coin.symbol.toLowerCase(),
    name: coin.name,
    image: coin.image,
  };
}

export function Picker({
  selected,
  onChange,
}: {
  selected: WatchCoin[];
  onChange: (next: WatchCoin[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchCoin[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, MarketCoin>>({});
  const [limitNote, setLimitNote] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/markets?ids=${POPULAR_COINS.map((coin) => coin.id).join(",")}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { coins: MarketCoin[] };
        const next: Record<string, MarketCoin> = {};
        for (const coin of body.coins) next[coin.id] = coin;
        setQuotes(next);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(async (response) => {
          const body = (await response.json()) as { coins?: SearchCoin[]; error?: string };
          if (!response.ok) throw new Error(body.error ?? "Search failed.");
          setResults(body.coins ?? []);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSearchError(error instanceof Error ? error.message : "Search failed.");
          setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function toggle(coin: WatchCoin) {
    const exists = selected.some((item) => item.id === coin.id);
    if (exists) {
      setLimitNote(null);
      onChange(selected.filter((item) => item.id !== coin.id));
      return;
    }
    if (selected.length >= WATCHLIST_LIMIT) {
      setLimitNote("Five is the limit. Remove one to add another.");
      return;
    }
    setLimitNote(null);
    onChange([...selected, coin]);
  }

  const searchingNow = query.trim().length > 0;
  const visible: Array<WatchCoin & { price?: number | null; change24h?: number | null; rank?: number | null }> =
    searchingNow
      ? (results ?? []).map((coin) => ({ ...toWatch(coin), rank: coin.rank }))
      : POPULAR_COINS.map((coin) => {
          const quote = quotes[coin.id];
          return {
            ...toWatch({ ...coin, image: quote?.image }),
            price: quote?.price,
            change24h: quote?.change24h,
          };
        });

  return (
    <div className="flex flex-col gap-4">
      <Input
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          if (!value.trim()) {
            setResults(null);
            setSearchError(null);
            setSearching(false);
          }
        }}
        placeholder="Search CoinGecko"
        aria-label="Search coins"
        autoComplete="off"
        className="h-11"
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {selected.length} of {WATCHLIST_LIMIT} selected.
        {limitNote ? ` ${limitNote}` : ""}
      </p>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((coin) => (
            <li key={coin.id}>
              <button
                type="button"
                onClick={() => toggle(coin)}
                className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 py-1 pr-3 pl-1 text-sm"
              >
                <CoinMark image={coin.image} symbol={coin.symbol} />
                <span>{coin.name}</span>
                <span className="text-muted-foreground">Remove</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {(searching || (searchingNow && results == null && !searchError)) && (
        <p className="text-sm text-muted-foreground">Searching CoinGecko…</p>
      )}
      {searchError && <p className="text-sm text-sell">{searchError}</p>}
      {searchingNow && !searching && results?.length === 0 && !searchError && (
        <p className="text-sm text-muted-foreground">No coin matches that name.</p>
      )}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {visible.map((coin) => {
          const on = selected.some((item) => item.id === coin.id);
          return (
            <li key={coin.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(coin)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                  on
                    ? "border-primary bg-primary/15 ring-1 ring-primary"
                    : "border-border bg-card hover:bg-accent",
                )}
              >
                <CoinMark image={coin.image} symbol={coin.symbol} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{coin.name}</span>
                  <span className="font-mono text-xs uppercase text-muted-foreground">
                    {coin.symbol}
                    {coin.rank ? ` · #${coin.rank}` : ""}
                  </span>
                </span>
                {coin.price != null && (
                  <span className="text-right">
                    <span className="block font-mono text-sm">{formatUsd(coin.price)}</span>
                    <span className={cn("block font-mono text-xs", pctTone(coin.change24h))}>
                      {formatPct(coin.change24h)}
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
