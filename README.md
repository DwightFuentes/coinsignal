# Wick

Wick watches one to five coins on [CoinGecko](https://www.coingecko.com) and marks each one **buy**, **sell**, or **hold**.

You choose the coins. Wick polls public prices about once a minute and explains the mark with three rules:

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

The public CoinGecko API needs no key. If you have a demo key, set `COINGECKO_API_KEY` and the server will send it as `x-cg-demo-api-key`.
