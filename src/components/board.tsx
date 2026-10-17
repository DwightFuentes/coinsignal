"use client";

import { CoinMark } from "@/components/coin-mark";
import { PriceChart } from "@/components/price-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatCompact,
  formatPct,
  formatUsd,
  pctTone,
  sideLabel,
  sideTone,
} from "@/lib/format";
import { RULES } from "@/lib/signal";
import type { CoinSignal, SignalsResponse, WatchCoin } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

function ageLabel(updatedAt: string | null, loading: boolean, refreshing: boolean, now: number) {
  if (refreshing) return "Refreshing…";
  if (loading && !updatedAt) return "Reading CoinGecko…";
  if (!updatedAt) return "Checks every minute";
  const seconds = Math.max(0, Math.round((now - Date.parse(updatedAt)) / 1000));
  const when = seconds < 5 ? "just now" : seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`;
  return `Updated ${when} · every minute`;
}

export function Board({
  watch,
  signals,
  selectedId,
  onSelect,
  loading,
  refreshing,
  error,
  now,
  onRefresh,
  onEdit,
}: {
  watch: WatchCoin[];
  signals: SignalsResponse | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  now: number;
  onRefresh: () => void;
  onEdit: () => void;
}) {
  const activeId = selectedId ?? signals?.coins[0]?.id ?? watch[0]?.id ?? null;
  const selected = signals?.coins.find((coin) => coin.id === activeId) ?? null;
  const selectedError = signals?.errors.find((item) => item.id === activeId);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="font-serif text-2xl leading-none italic">Wick</p>
            <p className="text-xs text-muted-foreground">CoinGecko signal desk</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <p className="hidden text-xs text-muted-foreground sm:block">
              {ageLabel(signals?.updatedAt ?? null, loading, refreshing, now)}
            </p>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing || loading}>
              <RefreshCw className={cn((refreshing || loading) && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={onEdit}>
              Edit coins
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-6">
          <p className="text-sell">{error}</p>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Try again
          </Button>
        </div>
      )}

      <div className="mx-auto grid max-w-6xl lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex gap-2 overflow-x-auto border-b p-3 lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:border-r lg:border-b-0">
          {watch.map((coin) => {
            const quote = signals?.coins.find((item) => item.id === coin.id);
            const problem = signals?.errors.find((item) => item.id === coin.id);
            const active = activeId === coin.id;
            return (
              <button
                key={coin.id}
                type="button"
                onClick={() => onSelect(coin.id)}
                aria-pressed={active}
                className={cn(
                  "flex min-w-[220px] items-center gap-3 rounded-xl px-3 py-3 text-left lg:mb-1 lg:min-w-0 lg:w-full",
                  active ? "bg-card ring-1 ring-foreground/15" : "hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "h-8 w-1 shrink-0 rounded-full",
                    quote ? (quote.side === "buy" ? "bg-buy" : quote.side === "sell" ? "bg-sell" : "bg-hold") : "bg-border",
                  )}
                />
                <CoinMark image={quote?.image || coin.image} symbol={coin.symbol} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{coin.name}</span>
                    <span className={cn("font-serif italic", quote ? sideTone(quote.side) : "text-muted-foreground")}>
                      {quote ? sideLabel(quote.side) : problem ? "Error" : "…"}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-baseline justify-between gap-2 font-mono text-xs">
                    <span>{quote ? formatUsd(quote.price) : loading ? "…" : "—"}</span>
                    <span className={pctTone(quote?.change24h)}>{formatPct(quote?.change24h)}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </aside>

        <main className="px-4 py-6 sm:px-8">
          <p className="mb-4 text-xs text-muted-foreground sm:hidden">
            {ageLabel(signals?.updatedAt ?? null, loading, refreshing, now)}
          </p>
          {!selected && loading && <LoadingMark />}
          {!selected && !loading && (
            <div className="max-w-md">
              <h1 className="font-serif text-4xl italic">No quote yet</h1>
              <p className="mt-3 text-muted-foreground">
                {selectedError?.message ?? error ?? "CoinGecko did not return this coin."}
              </p>
            </div>
          )}
          {selected && <MarkDetail coin={selected} />}
        </main>
      </div>
    </div>
  );
}

function LoadingMark() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="mt-4 h-20 w-48 rounded bg-muted" />
      <div className="mt-6 h-4 w-full max-w-md rounded bg-muted" />
      <div className="mt-8 h-40 rounded bg-muted" />
    </div>
  );
}

function MarkDetail({ coin }: { coin: CoinSignal }) {
  return (
    <article>
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">The mark</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <h1
          className={cn("font-serif text-7xl leading-none italic sm:text-8xl", sideTone(coin.side))}
          aria-live="polite"
        >
          {sideLabel(coin.side)}
        </h1>
        <a
          href={`https://www.coingecko.com/en/coins/${coin.id}`}
          target="_blank"
          rel="noreferrer"
          className="mb-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {coin.name} on CoinGecko
        </a>
      </div>
      <p className="mt-4 text-xl">{coin.headline}</p>
      <p className="mt-2 max-w-2xl text-muted-foreground">{coin.narrative}</p>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Price" value={formatUsd(coin.price)} />
        <Stat label="24h" value={formatPct(coin.change24h)} className={pctTone(coin.change24h)} />
        <Stat label="7d" value={formatPct(coin.change7d)} className={pctTone(coin.change7d)} />
        <Stat label="Market cap" value={formatCompact(coin.marketCap)} />
        <Stat label="Volume" value={formatCompact(coin.volume24h)} />
      </dl>

      <ul className="mt-8 divide-y border-y">
        {coin.factors.map((factor) => (
          <li
            key={factor.id}
            className="grid gap-2 py-4 sm:grid-cols-[140px_88px_minmax(0,1fr)] sm:items-center"
          >
            <span className="font-medium">{factor.name}</span>
            <Badge
              variant="outline"
              className={cn(
                "uppercase",
                factor.side === "buy" && "border-buy/40 text-buy",
                factor.side === "sell" && "border-sell/40 text-sell",
                factor.side === "hold" && "border-hold/40 text-hold",
              )}
            >
              {sideLabel(factor.side)}
            </Badge>
            <span>
              <span className="font-mono text-sm">{factor.valueLabel}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{factor.summary}</span>
            </span>
          </li>
        ))}
      </ul>

      <PriceChart points={coin.chart} />

      <details className="mt-8 text-sm text-muted-foreground">
        <summary className="cursor-pointer text-foreground">How the mark is chosen</summary>
        <p className="mt-3 max-w-2xl leading-6">
          Wick reads public CoinGecko prices. Stretch is RSI({RULES.rsiPeriod}): under {RULES.rsiBuy}{" "}
          leans buy, over {RULES.rsiSell} leans sell. Trend compares the {RULES.smaFast}-day average
          with the {RULES.smaSlow}-day average and votes when they differ by more than{" "}
          {RULES.trendGap * 100}%. Week votes when the seven-day move is past {RULES.weekBand}% in
          either direction. The mark flips only when {RULES.agree} rules share a side. A straight
          rally can stay hold, because a maxed RSI disagrees with the trend. This is not financial
          advice.
        </p>
      </details>
    </article>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className={cn("mt-1 font-mono text-lg", className)}>{value}</dd>
    </div>
  );
}
