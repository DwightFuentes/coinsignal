import { formatNumber, formatPct } from "@/lib/format";

function magnitude(value: number): string {
  return `${Math.abs(value).toFixed(1)}%`;
}
import type { ChartPoint, Factor, Side, SignalCore, Vote } from "@/lib/types";

export const RULES = {
  rsiPeriod: 14,
  rsiBuy: 30,
  rsiSell: 70,
  smaFast: 7,
  smaSlow: 21,
  trendGap: 0.005,
  weekBand: 5,
  agree: 2,
} as const;

type DailyClose = { t: number; price: number };

export function toDailyCloses(
  prices: ReadonlyArray<readonly [number, number]>,
): DailyClose[] {
  const byDay = new Map<number, DailyClose>();
  for (const [t, price] of prices) {
    if (!Number.isFinite(t) || !Number.isFinite(price)) continue;
    const day = Math.floor(t / 86_400_000);
    const previous = byDay.get(day);
    if (!previous || t >= previous.t) byDay.set(day, { t, price });
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, close]) => close);
}

export function smaSeries(values: number[], period: number): (number | null)[] {
  const series: (number | null)[] = [];
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];
    if (index >= period) sum -= values[index - period];
    series.push(index >= period - 1 ? sum / period : null);
  }
  return series;
}

export function rsi(values: number[], period = RULES.rsiPeriod): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let index = 1; index <= period; index += 1) {
    const diff = values[index] - values[index - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let averageGain = gain / period;
  let averageLoss = loss / period;
  for (let index = period + 1; index < values.length; index += 1) {
    const diff = values[index] - values[index - 1];
    const up = diff > 0 ? diff : 0;
    const down = diff < 0 ? -diff : 0;
    averageGain = (averageGain * (period - 1) + up) / period;
    averageLoss = (averageLoss * (period - 1) + down) / period;
  }
  if (averageGain === 0 && averageLoss === 0) return 50;
  if (averageLoss === 0) return 100;
  const relative = averageGain / averageLoss;
  return 100 - 100 / (1 + relative);
}

function lastNumber(values: (number | null)[]): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value != null && Number.isFinite(value)) return value;
  }
  return null;
}

function voteSide(vote: Vote): Side {
  if (vote > 0) return "buy";
  if (vote < 0) return "sell";
  return "hold";
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function decisionCopy(factors: Factor[], side: Side): {
  headline: string;
  narrative: string;
} {
  const buys = factors.filter((factor) => factor.vote > 0);
  const sells = factors.filter((factor) => factor.vote < 0);
  const count =
    buys.length >= 3 || sells.length >= 3
      ? "Three rules say"
      : buys.length === 2 || sells.length === 2
        ? "Two rules say"
        : "One rule says";

  if (side === "buy") {
    return {
      headline: `${count} buy.`,
      narrative: `${listNames(buys.map((factor) => factor.name))} lean buy. That is enough to mark buy.`,
    };
  }
  if (side === "sell") {
    return {
      headline: `${count} sell.`,
      narrative: `${listNames(sells.map((factor) => factor.name))} lean sell. That is enough to mark sell.`,
    };
  }
  if (buys.length > 0 && sells.length > 0) {
    return {
      headline: "Rules disagree.",
      narrative: `${listNames(buys.map((factor) => factor.name))} lean buy and ${listNames(sells.map((factor) => factor.name))} lean sell. The mark stays hold until two rules share a side.`,
    };
  }
  if (buys.length === 1) {
    return {
      headline: "Only one rule says buy.",
      narrative: `${buys[0].name} leans buy. One rule is not enough, so the mark stays hold.`,
    };
  }
  if (sells.length === 1) {
    return {
      headline: "Only one rule says sell.",
      narrative: `${sells[0].name} leans sell. One rule is not enough, so the mark stays hold.`,
    };
  }
  return {
    headline: "No strong lean.",
    narrative: "All three rules are inside their bands. The mark stays hold.",
  };
}

function stretchFactor(value: number | null): Factor {
  if (value == null) {
    return {
      id: "stretch",
      name: "Stretch",
      vote: 0,
      side: "hold",
      valueLabel: "—",
      summary: `Fewer than ${RULES.rsiPeriod + 1} daily closes, so RSI stays out of the vote.`,
    };
  }
  const vote: Vote = value < RULES.rsiBuy ? 1 : value > RULES.rsiSell ? -1 : 0;
  const summary =
    vote > 0
      ? `RSI is ${formatNumber(value)}, under ${RULES.rsiBuy}. Price looks stretched down.`
      : vote < 0
        ? `RSI is ${formatNumber(value)}, over ${RULES.rsiSell}. Price looks stretched up.`
        : `RSI is ${formatNumber(value)}, inside ${RULES.rsiBuy} to ${RULES.rsiSell}.`;
  return {
    id: "stretch",
    name: "Stretch",
    vote,
    side: voteSide(vote),
    valueLabel: formatNumber(value),
    summary,
  };
}

function trendFactor(fast: number | null, slow: number | null): Factor {
  if (fast == null || slow == null || slow === 0) {
    return {
      id: "trend",
      name: "Trend",
      vote: 0,
      side: "hold",
      valueLabel: "—",
      summary: `Fewer than ${RULES.smaSlow} daily closes, so the averages stay out of the vote.`,
    };
  }
  const gap = (fast - slow) / slow;
  const vote: Vote = gap >= RULES.trendGap ? 1 : gap <= -RULES.trendGap ? -1 : 0;
  const apart = formatPct(gap * 100);
  const summary =
    vote > 0
      ? `The ${RULES.smaFast}-day average is ${magnitude(gap * 100)} above the ${RULES.smaSlow}-day average.`
      : vote < 0
        ? `The ${RULES.smaFast}-day average is ${magnitude(gap * 100)} below the ${RULES.smaSlow}-day average.`
        : `The ${RULES.smaFast}-day and ${RULES.smaSlow}-day averages are ${magnitude(gap * 100)} apart, inside the ${RULES.trendGap * 100}% band.`;
  return {
    id: "trend",
    name: "Trend",
    vote,
    side: voteSide(vote),
    valueLabel: apart,
    summary,
  };
}

function weekFactor(change7d: number | null): Factor {
  if (change7d == null || !Number.isFinite(change7d)) {
    return {
      id: "week",
      name: "Week",
      vote: 0,
      side: "hold",
      valueLabel: "—",
      summary: "No seven-day change, so this rule stays out of the vote.",
    };
  }
  const vote: Vote =
    change7d >= RULES.weekBand ? 1 : change7d <= -RULES.weekBand ? -1 : 0;
  const summary =
    vote > 0
      ? `Price is up ${magnitude(change7d)} over seven days, past the ${RULES.weekBand}% band.`
      : vote < 0
        ? `Price is down ${magnitude(change7d)} over seven days, past the ${RULES.weekBand}% band.`
        : `The seven-day move is ${formatPct(change7d)}, inside the ${RULES.weekBand}% band.`;
  return {
    id: "week",
    name: "Week",
    vote,
    side: voteSide(vote),
    valueLabel: formatPct(change7d),
    summary,
  };
}

export function buildSignal(input: {
  prices: ReadonlyArray<readonly [number, number]>;
  change7d: number | null;
}): SignalCore {
  const daily = toDailyCloses(input.prices);
  const closes = daily.map((close) => close.price);
  const fastSeries = smaSeries(closes, RULES.smaFast);
  const slowSeries = smaSeries(closes, RULES.smaSlow);
  const chart: ChartPoint[] = daily.slice(-60).map((close, index, slice) => {
    const sourceIndex = daily.length - slice.length + index;
    return {
      t: close.t,
      price: close.price,
      smaFast: fastSeries[sourceIndex] ?? null,
      smaSlow: slowSeries[sourceIndex] ?? null,
    };
  });
  const change7d =
    input.change7d != null && Number.isFinite(input.change7d) ? input.change7d : null;
  const factors = [
    stretchFactor(rsi(closes)),
    trendFactor(lastNumber(fastSeries), lastNumber(slowSeries)),
    weekFactor(change7d),
  ];
  const score = factors.reduce((total, factor) => total + factor.vote, 0);
  const side: Side = score >= RULES.agree ? "buy" : score <= -RULES.agree ? "sell" : "hold";
  const copy = decisionCopy(factors, side);
  return {
    side,
    score,
    headline: copy.headline,
    narrative: copy.narrative,
    rsi: rsi(closes),
    smaFast: lastNumber(fastSeries),
    smaSlow: lastNumber(slowSeries),
    change7d,
    factors,
    chart,
  };
}
