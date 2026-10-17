"use client";

import { formatDay, formatUsd } from "@/lib/format";
import type { ChartPoint } from "@/lib/types";
import { useState } from "react";

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 16, right: 12, bottom: 28, left: 12 };

function pathFrom(points: Array<{ x: number; y: number } | null>): string[] {
  const paths: string[] = [];
  let current = "";
  for (const point of points) {
    if (!point) {
      if (current) paths.push(current);
      current = "";
      continue;
    }
    current += `${current ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }
  if (current) paths.push(current);
  return paths;
}

export function PriceChart({ points }: { points: ChartPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough daily history to draw a chart.
      </p>
    );
  }

  const values = points.flatMap((point) =>
    [point.price, point.smaFast, point.smaSlow].filter(
      (value): value is number => value != null && Number.isFinite(value),
    ),
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) =>
    PAD.left + (index / Math.max(points.length - 1, 1)) * innerWidth;
  const y = (value: number) => PAD.top + ((max - value) / span) * innerHeight;

  const priceDots = points.map((point, index) => ({ x: x(index), y: y(point.price) }));
  const pricePath = pathFrom(priceDots)[0] ?? "";
  const area = `${pricePath}L${x(points.length - 1).toFixed(1)},${(PAD.top + innerHeight).toFixed(1)}L${x(0).toFixed(1)},${(PAD.top + innerHeight).toFixed(1)}Z`;
  const fastPath = pathFrom(
    points.map((point, index) =>
      point.smaFast == null ? null : { x: x(index), y: y(point.smaFast) },
    ),
  );
  const slowPath = pathFrom(
    points.map((point, index) =>
      point.smaSlow == null ? null : { x: x(index), y: y(point.smaSlow) },
    ),
  );
  const active = hover == null ? null : points[hover];

  return (
    <figure className="mt-8">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <figcaption className="text-sm text-muted-foreground">Daily close</figcaption>
        <p className="font-mono text-xs text-muted-foreground">
          {active
            ? `${formatDay(active.t)} · ${formatUsd(active.price)}`
            : `${formatUsd(min)} – ${formatUsd(max)}`}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-56 w-full touch-none"
        role="img"
        aria-label="Daily close with 7-day and 21-day averages"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const index = Math.round(ratio * (points.length - 1));
          setHover(Math.min(points.length - 1, Math.max(0, index)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <path d={area} fill="color-mix(in oklab, var(--buy) 16%, transparent)" />
        <path d={pricePath} fill="none" stroke="var(--foreground)" strokeWidth="2" />
        {fastPath.map((d, index) => (
          <path key={`fast-${index}`} d={d} fill="none" stroke="var(--buy)" strokeWidth="1.5" />
        ))}
        {slowPath.map((d, index) => (
          <path
            key={`slow-${index}`}
            d={d}
            fill="none"
            stroke="var(--hold)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        ))}
        {hover != null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={PAD.top + innerHeight}
            stroke="var(--muted-foreground)"
            strokeWidth="1"
          />
        )}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-foreground" /> Price
        </li>
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-buy" /> 7-day average
        </li>
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-4 border-t border-dashed border-hold" /> 21-day average
        </li>
      </ul>
    </figure>
  );
}
