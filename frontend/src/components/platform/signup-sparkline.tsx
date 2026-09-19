'use client';

interface SignupSparklineProps {
  data: { date: string; count: number }[];
}

// Plain inline SVG bar chart — 30 daily bars, no charting lib (ponytail: nothing fancy needed).
export function SignupSparkline({ data }: SignupSparklineProps) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const width = 100;
  const height = 32;
  const barWidth = width / data.length;

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Signups, last 30 days</p>
        <p className="font-heading text-sm font-semibold tabular-nums text-foreground">
          {data.reduce((sum, d) => sum + d.count, 0)}
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="mt-3 h-10 w-full overflow-visible">
        {data.map((d, i) => {
          const barHeight = (d.count / max) * (height - 2);
          return (
            <rect
              key={d.date}
              x={i * barWidth + 0.4}
              y={height - barHeight}
              width={Math.max(0.6, barWidth - 0.8)}
              height={Math.max(0.6, barHeight)}
              rx={0.4}
              className="fill-tertiary transition-opacity"
              opacity={d.count === 0 ? 0.25 : 0.9}
            >
              <title>{`${d.date}: ${d.count}`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
