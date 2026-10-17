"use client";

import { Board } from "@/components/board";
import { Picker } from "@/components/picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RULES } from "@/lib/signal";
import {
  emptyWatchlist,
  parseWatchlist,
  readWatchlistRaw,
  subscribeWatchlist,
  writeWatchlist,
} from "@/lib/storage";
import type { SignalsResponse, WatchCoin } from "@/lib/types";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const POLL_MS = 60_000;

function errorMessage(error: unknown): string {
  if (error instanceof TypeError) return "The network request failed. Refresh to try again.";
  if (error instanceof Error && error.message) return error.message;
  return "Could not reach the desk.";
}

export function Desk() {
  const stored = useSyncExternalStore(subscribeWatchlist, readWatchlistRaw, emptyWatchlist);
  const watch = parseWatchlist(stored);
  const [draft, setDraft] = useState<WatchCoin[]>([]);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState<{ key: string; data: SignalsResponse } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(0);

  const idsKey = watch.map((coin) => coin.id).join(",");
  const signals = loaded?.key === idsKey ? loaded.data : null;
  const error = failure?.key === idsKey ? failure.message : null;
  const loading = idsKey.length > 0 && signals == null && error == null;
  const loadRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!idsKey) return;
    const ids = idsKey.split(",");
    let cancelled = false;
    let currentRequest = 0;

    async function load() {
      const request = currentRequest + 1;
      currentRequest = request;
      try {
        const response = await fetch(`/api/signals?ids=${idsKey}`);
        const body = (await response.json()) as SignalsResponse & { error?: string };
        if (cancelled || request !== currentRequest) return;
        if (!response.ok) throw new Error(body.error ?? "Could not load prices.");
        setLoaded({ key: idsKey, data: body });
        setFailure(
          body.coins.length === 0
            ? { key: idsKey, message: body.errors[0]?.message ?? "No quotes came back." }
            : null,
        );
        setSelectedId((current) => {
          if (current && ids.includes(current)) return current;
          return body.coins[0]?.id ?? ids[0] ?? null;
        });
      } catch (caught) {
        if (cancelled || request !== currentRequest) return;
        setFailure({ key: idsKey, message: errorMessage(caught) });
      } finally {
        if (!cancelled && request === currentRequest) setRefreshing(false);
      }
    }

    loadRef.current = () => {
      void load();
    };
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        setRefreshing(true);
        void load();
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [idsKey]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const immediate = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 5000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, []);

  function save(next: WatchCoin[]) {
    const clean = next.map(({ id, symbol, name, image }) => ({ id, symbol, name, image }));
    writeWatchlist(clean);
    setDraft(clean);
    setEditing(false);
  }

  if (watch.length === 0) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-6 sm:px-8">
        <header>
          <p className="font-serif text-2xl italic">Wick</p>
          <p className="text-sm text-muted-foreground">A signal desk for five coins</p>
        </header>
        <h1 className="mt-10 max-w-3xl font-serif text-5xl leading-tight italic sm:text-6xl">
          Which coins should Wick watch?
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Pick one to five. Wick marks each coin buy, sell, or hold from CoinGecko, then checks that
          price against CoinMarketCap and CoinStats.
        </p>
        <div className="mt-8 pb-28">
          <Picker selected={draft} onChange={setDraft} />
          <p className="mt-8 text-xs leading-5 text-muted-foreground">
            Marks are a mechanical reading of public prices, not financial advice. Stretch is RSI(
            {RULES.rsiPeriod}), Trend is the {RULES.smaFast}-day average against the {RULES.smaSlow}-day
            average, and Week is the seven-day move. The mark follows{" "}
            <a className="underline underline-offset-2" href="https://www.coingecko.com" target="_blank" rel="noreferrer">
              CoinGecko
            </a>
            .{" "}
            <a className="underline underline-offset-2" href="https://coinmarketcap.com" target="_blank" rel="noreferrer">
              CoinMarketCap
            </a>{" "}
            and{" "}
            <a className="underline underline-offset-2" href="https://coinstats.app" target="_blank" rel="noreferrer">
              CoinStats
            </a>{" "}
            are the other two live prices.
          </p>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
            <p className="text-sm text-muted-foreground">
              {draft.length === 0 ? "Select a coin to start." : `${draft.length} ready.`}
            </p>
            <Button className="h-11 px-5" disabled={draft.length === 0} onClick={() => save(draft)}>
              Start watching
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <Board
        watch={watch}
        signals={signals}
        selectedId={selectedId}
        onSelect={setSelectedId}
        loading={loading}
        refreshing={refreshing}
        error={error}
        now={now}
        onRefresh={() => {
          setRefreshing(true);
          loadRef.current();
        }}
        onEdit={() => {
          setDraft(watch);
          setEditing(true);
        }}
      />
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[min(90vh,860px)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl italic">Edit the watchlist</DialogTitle>
            <DialogDescription>One to five coins. The desk reloads when you save.</DialogDescription>
          </DialogHeader>
          <Picker selected={draft} onChange={setDraft} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button disabled={draft.length === 0} onClick={() => save(draft)}>
              Save watchlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
