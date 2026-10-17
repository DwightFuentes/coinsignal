# Wick

Wick watches one to five coins and marks each one **buy**, **sell**, or **hold**.

Prices are read from [CoinGecko](https://www.coingecko.com), [CoinMarketCap](https://coinmarketcap.com), and [CoinStats](https://coinstats.app). The mark uses CoinGecko's daily history. The other two prices are shown beside it, and Wick says when the three disagree.

You choose the coins. Wick polls about once a minute and explains the mark with three rules:

- **Stretch** — RSI(14). Under 30 leans buy. Over 70 leans sell.
- **Trend** — the 7-day average versus the 21-day average. A gap wider than 0.5% votes.
- **Week** — the seven-day price change. A move past 5% votes.

The mark flips only when two rules share a side. A straight rally can stay hold, because a maxed RSI disagrees with the trend.

This is a mechanical reading of public prices. It is not financial advice.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:43127](http://localhost:43127).

```bash
npm test
npm run lint
```

No API key is required. Optional keys:

- `COINGECKO_API_KEY` is sent as `x-cg-demo-api-key`.
- `COINSTATS_API_KEY` is sent as `X-API-KEY` when the public coin route asks for one.
