type Point = { ts: string; value: number };

export function EquityChart({ points, start, height = 180 }: { points: Point[]; start: number; height?: number }) {
  const data = points.length >= 2 ? points : [{ ts: "", value: start }, { ts: "", value: points[0]?.value ?? start }];
  const vals = data.map((p) => p.value);
  const min = Math.min(start, ...vals);
  const max = Math.max(start, ...vals);
  const pad = (max - min || start * 0.002) * 0.15;
  const lo = min - pad;
  const hi = max + pad;
  const W = 600;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;
  const line = data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const up = vals.at(-1)! >= start;
  const color = up ? "var(--color-gain)" : "var(--color-loss)";
  const id = up ? "eq-up" : "eq-down";
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img" aria-label="Equity curve">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" x2={W} y1={y(start)} y2={y(start)} stroke="var(--color-line)" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
      <path d={`${line}L${W},${height}L0,${height}Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
