import assert from "node:assert/strict";
import test from "node:test";
import { parseIds } from "./ids";
import { RULES, buildSignal, decisionCopy, rsi, smaSeries, toDailyCloses } from "./signal";
import type { Factor } from "./types";

const DAY = 86_400_000;

function pricesFrom(closes: number[]): Array<[number, number]> {
  return closes.map((price, index) => [Date.UTC(2026, 0, index + 1), price]);
}

function factor(id: Factor["id"], vote: Factor["vote"], name: string): Factor {
  const side = vote > 0 ? "buy" : vote < 0 ? "sell" : "hold";
  return { id, name, vote, side, valueLabel: "", summary: "" };
}

test("daily closes keep the last print of each UTC day", () => {
  const closes = toDailyCloses([
    [DAY * 10 + 1_000, 1],
    [DAY * 10 + 5_000, 2],
    [DAY * 11, 3],
    [Number.NaN, 4],
  ]);
  assert.deepEqual(closes, [
    { t: DAY * 10 + 5_000, price: 2 },
    { t: DAY * 11, price: 3 },
  ]);
});

test("simple moving average waits for a full window", () => {
  assert.deepEqual(smaSeries([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
});

test("RSI is neutral when price is flat and pinned at the extremes when it only rises or falls", () => {
  assert.equal(rsi(Array.from({ length: 20 }, () => 100)), 50);
  assert.equal(
    rsi(Array.from({ length: 20 }, (_, index) => 100 + index)),
    100,
  );
  assert.ok((rsi(Array.from({ length: 20 }, (_, index) => 100 - index)) ?? 100) < 1);
  assert.equal(rsi([1, 2, 3]), null);
});

test("a flat market with no weekly move holds", () => {
  const signal = buildSignal({
    prices: pricesFrom(Array.from({ length: 40 }, () => 100)),
    change7d: 0,
  });
  assert.equal(signal.side, "hold");
  assert.equal(signal.score, 0);
  assert.deepEqual(
    signal.factors.map((item) => item.vote),
    [0, 0, 0],
  );
  assert.equal(signal.headline, "No strong lean.");
});

test("two bullish rules mark buy even when stretch is quiet", () => {
  const closes = [100];
  for (let index = 1; index < 60; index += 1) {
    const previous = closes[index - 1];
    closes.push(previous + (index % 3 === 0 ? -2.4 : 1.5));
  }
  const signal = buildSignal({ prices: pricesFrom(closes), change7d: 6 });
  const votes = Object.fromEntries(signal.factors.map((item) => [item.id, item.vote]));
  assert.equal(votes.stretch, 0);
  assert.equal(votes.trend, 1);
  assert.equal(votes.week, 1);
  assert.equal(signal.side, "buy");
  assert.equal(signal.headline, "Two rules say buy.");
});

test("two bearish rules mark sell", () => {
  const closes = [200];
  for (let index = 1; index < 60; index += 1) {
    const previous = closes[index - 1];
    closes.push(previous + (index % 3 === 0 ? 2.4 : -1.5));
  }
  const signal = buildSignal({ prices: pricesFrom(closes), change7d: -6 });
  const votes = Object.fromEntries(signal.factors.map((item) => [item.id, item.vote]));
  assert.equal(votes.stretch, 0);
  assert.equal(votes.trend, -1);
  assert.equal(votes.week, -1);
  assert.equal(signal.side, "sell");
});

test("a straight rally is a hold because stretch disagrees with the trend", () => {
  const signal = buildSignal({
    prices: pricesFrom(Array.from({ length: 40 }, (_, index) => 100 + index)),
    change7d: 8,
  });
  assert.equal(signal.factors.find((item) => item.id === "stretch")?.vote, -1);
  assert.equal(signal.factors.find((item) => item.id === "trend")?.vote, 1);
  assert.equal(signal.factors.find((item) => item.id === "week")?.vote, 1);
  assert.equal(signal.side, "hold");
  assert.equal(signal.score, 1);
});

test("short history does not invent a trend or an RSI", () => {
  const signal = buildSignal({
    prices: pricesFrom([10, 11, 12, 13, 14]),
    change7d: null,
  });
  assert.equal(signal.rsi, null);
  assert.equal(signal.smaSlow, null);
  assert.equal(signal.side, "hold");
  assert.match(signal.factors[0].summary, /RSI stays out/);
});

test("weekly band is inclusive at five percent", () => {
  assert.equal(buildSignal({ prices: pricesFrom([1, 1]), change7d: 5 }).factors[2].vote, 1);
  assert.equal(buildSignal({ prices: pricesFrom([1, 1]), change7d: -5 }).factors[2].vote, -1);
  assert.equal(buildSignal({ prices: pricesFrom([1, 1]), change7d: 4.9 }).factors[2].vote, 0);
});

test("decision copy names the rules that agree", () => {
  const copy = decisionCopy(
    [factor("stretch", 1, "Stretch"), factor("trend", 1, "Trend"), factor("week", -1, "Week")],
    "buy",
  );
  assert.equal(copy.headline, "Two rules say buy.");
  assert.match(copy.narrative, /Stretch and Trend lean buy/);
  assert.equal(RULES.agree, 2);
});

test("parseIds keeps at most five real CoinGecko ids", () => {
  assert.deepEqual(parseIds("Bitcoin, bitcoin, ethereum, nope!, solana"), [
    "bitcoin",
    "ethereum",
    "solana",
  ]);
  assert.equal(parseIds("a,b,c,d,e,f").length, 5);
  assert.deepEqual(parseIds(null), []);
});
