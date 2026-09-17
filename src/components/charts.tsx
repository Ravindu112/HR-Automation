"use client";

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

const PALETTE = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#64748b",
];

export function BarChart({
  data,
  unit = "",
  emptyLabel = "No data yet.",
}: {
  data: ChartDatum[];
  unit?: string;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={d.label} className="flex items-center gap-3">
          <div className="w-36 shrink-0 truncate text-xs text-gray-600" title={d.label}>
            {d.label}
          </div>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-gray-100">
            <div
              className="h-full rounded-md transition-all"
              style={{
                width: `${Math.max(4, (d.value / max) * 100)}%`,
                backgroundColor: d.color ?? PALETTE[i % PALETTE.length],
              }}
            />
          </div>
          <div className="w-14 shrink-0 text-right text-xs font-semibold text-gray-900">
            {d.value}
            {unit}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({
  data,
  size = 150,
  emptyLabel = "No data yet.",
}: {
  data: ChartDatum[];
  size?: number;
  emptyLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">{emptyLabel}</p>;
  }
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const segments = data.map((d, i) => {
    const frac = d.value / total;
    return {
      ...d,
      frac,
      color: d.color ?? PALETTE[i % PALETTE.length],
      start: data.slice(0, i).reduce((acc, x) => acc + x.value, 0) / total,
    };
  });
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth="14"
        />
        {segments.map((s) => (
          <circle
            key={s.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth="14"
            strokeDasharray={`${s.frac * circumference} ${circumference}`}
            strokeDashoffset={-s.start * circumference}
          />
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color ?? PALETTE[i % PALETTE.length] }}
            />
            <span className="truncate text-gray-600">{d.label}</span>
            <span className="ml-auto font-semibold text-gray-900">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}