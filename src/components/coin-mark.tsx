export function CoinMark({
  image,
  symbol,
}: {
  image?: string;
  symbol: string;
}) {
  if (image) {
    return (
      // CoinGecko hosts images on more than one CDN, so a plain img stays reliable.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        className="size-8 rounded-full bg-muted object-cover"
      />
    );
  }
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-muted font-mono text-[10px] uppercase">
      {symbol.slice(0, 3)}
    </span>
  );
}
