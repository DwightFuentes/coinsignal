export type PopularCoin = {
  id: string;
  symbol: string;
  name: string;
};

export const POPULAR_COINS: PopularCoin[] = [
  { id: "bitcoin", symbol: "btc", name: "Bitcoin" },
  { id: "ethereum", symbol: "eth", name: "Ethereum" },
  { id: "solana", symbol: "sol", name: "Solana" },
  { id: "ripple", symbol: "xrp", name: "XRP" },
  { id: "binancecoin", symbol: "bnb", name: "BNB" },
  { id: "dogecoin", symbol: "doge", name: "Dogecoin" },
  { id: "cardano", symbol: "ada", name: "Cardano" },
  { id: "tron", symbol: "trx", name: "TRON" },
  { id: "avalanche-2", symbol: "avax", name: "Avalanche" },
  { id: "chainlink", symbol: "link", name: "Chainlink" },
  { id: "sui", symbol: "sui", name: "Sui" },
  { id: "the-open-network", symbol: "ton", name: "Toncoin" },
  { id: "polkadot", symbol: "dot", name: "Polkadot" },
  { id: "litecoin", symbol: "ltc", name: "Litecoin" },
  { id: "uniswap", symbol: "uni", name: "Uniswap" },
];

export const WATCHLIST_LIMIT = 5;
