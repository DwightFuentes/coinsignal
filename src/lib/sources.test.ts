import assert from "node:assert/strict";
import test from "node:test";
import {
  blankQuote,
  describeSources,
  parseCmcDetail,
  parseCoinStatsApi,
  parseCoinStatsHtml,
  quoteCandidates,
} from "./sources";
import type { SourceQuote } from "./sources";

function quote(label: SourceQuote["label"], price: number | null): SourceQuote {
  const source =
    label === "CoinGecko" ? "coingecko" : label === "CoinMarketCap" ? "coinmarketcap" : "coinstats";
  return { ...blankQuote(source, label), price };
}

test("slug candidates try the CoinGecko id, then known aliases", () => {
  assert.deepEqual(quoteCandidates("bitcoin", "btc"), ["bitcoin", "btc"]);
  assert.deepEqual(quoteCandidates("binancecoin", "bnb"), ["binancecoin", "binance-coin", "bnb"]);
  assert.deepEqual(quoteCandidates("avalanche-2", "avax"), ["avalanche-2", "avalanche", "avax"]);
  assert.deepEqual(quoteCandidates("ripple", "xrp"), ["ripple", "xrp"]);
});

test("CoinMarketCap detail parses a live price and ignores an error body", () => {
  const parsed = parseCmcDetail({
    data: {
      slug: "bitcoin",
      name: "Bitcoin",
      statistics: { price: 81000, priceChangePercentage24h: -0.2, priceChangePercentage7d: -2.1 },
    },
  });
  assert.equal(parsed?.price, 81000);
  assert.equal(parsed?.change7d, -2.1);
  assert.equal(parseCmcDetail({ status: { error_code: "500" } }), null);
  assert.equal(parseCmcDetail({ data: { statistics: { price: 0 } } }), null);
});

test("CoinStats JSON and page markup both yield a price", () => {
  assert.equal(parseCoinStatsApi({ price: 100, priceChange1d: -1, priceChange1w: -4, slug: "bitcoin", name: "Bitcoin" })?.change7d, -4);
  assert.equal(parseCoinStatsApi({ statusCode: 401, message: "Unauthorized" }), null);
  const html = `<script type="application/ld+json">{"@type":"Product","name":"Ethereum","offers":{"price":2400},"additionalProperty":[{"name":"Percent Change 24H","value":-1.2}]}</script><p>7d Change</p><span data-value="-3.4"></span>`;
  const parsed = parseCoinStatsHtml(html);
  assert.equal(parsed?.price, 2400);
  assert.equal(parsed?.change24h, -1.2);
  assert.equal(parsed?.change7d, -3.4);
});

test("source spread says when the three prices agree or split", () => {
  const close = describeSources([quote("CoinGecko", 100), quote("CoinMarketCap", 100.2), quote("CoinStats", 100.3)]);
  assert.match(close.note, /agree within/);
  const split = describeSources([quote("CoinGecko", 100), quote("CoinMarketCap", 103), quote("CoinStats", null)]);
  assert.match(split.note, /differ by 3.0%/);
  assert.match(split.note, /CoinStats did not return a price/);
  assert.match(split.note, /CoinGecko/);
});
