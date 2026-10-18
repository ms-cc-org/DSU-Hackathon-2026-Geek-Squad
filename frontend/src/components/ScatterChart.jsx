import { useState } from 'react';
import { CHART, TIERS, score, signedPct, usd } from '../lib/format.js';

const W = 760;
const H = 440;
const M = { l: 56, r: 16, t: 16, b: 44 };
const SEVERE = -10;

// Urgency score vs actual yield anomaly: the Streamlit Tab 1 scatter.
export default function ScatterChart({ rows, activeFips, onSelect }) {
  const [hover, setHover] = useState(null);
  const pts = rows.filter((r) => r.yield_anomaly_pct != null);
  const ys = pts.map((r) => r.yield_anomaly_pct);
  const yMin = Math.floor(Math.min(SEVERE, ...ys) / 10) * 10 - 5;
  const yMax = Math.ceil(Math.max(5, ...ys) / 10) * 10;
  const x = (v) => M.l + ((v - 1) / 9) * (W - M.l - M.r);
  const y = (v) => M.t + ((yMax - v) / (yMax - yMin)) * (H - M.t - M.b);
  const yTicks = [];
  for (let t = Math.ceil(yMin / 10) * 10; t <= yMax; t += 10) yTicks.push(t);
  const counts = [1, 2, 3].map((t) => pts.filter((r) => r.tier === t).length);
  // Draw Tier 3 first so Tier 1 dots sit on top.
  const ordered = [...pts].sort((a, b) => b.tier - a.tier || (a.fips === activeFips) - (b.fips === activeFips));

  return (
    <div className="relative w-full bg-surface-container-lowest/90 rounded-lg overflow-hidden">
      <svg className="w-full h-auto block" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Urgency score versus yield anomaly by county">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHART.muted : CHART.grid} strokeWidth="1" />
            <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fill={CHART.axis} fontSize="11" fontFamily="JetBrains Mono">
              {t > 0 ? `+${t}` : t}%
            </text>
          </g>
        ))}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => (
          <text key={t} x={x(t)} y={H - M.b + 18} textAnchor="middle" fill={CHART.axis} fontSize="11" fontFamily="JetBrains Mono">
            {t}
          </text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" fill={CHART.axis} fontSize="11">
          Drought Urgency Score (1 to 10)
        </text>
        <text x={14} y={(M.t + H - M.b) / 2} textAnchor="middle" fill={CHART.axis} fontSize="11" transform={`rotate(-90 14 ${(M.t + H - M.b) / 2})`}>
          Actual harvest anomaly vs trend (%)
        </text>
        <line x1={M.l} x2={W - M.r} y1={y(SEVERE)} y2={y(SEVERE)} stroke={CHART.axis} strokeDasharray="5 4" strokeWidth="1.5" />
        <text x={W - M.r - 4} y={y(SEVERE) - 6} textAnchor="end" fill={CHART.axis} fontSize="11">
          Severe crop loss threshold (−10%)
        </text>

        {ordered.map((r) => {
          const isActive = r.fips === activeFips;
          return (
            <g
              key={r.fips}
              className="cursor-pointer"
              onClick={() => onSelect(r.fips)}
              onMouseEnter={() => setHover(r)}
              onMouseLeave={() => setHover(null)}
            >
              <circle cx={x(r.urgency_score)} cy={y(r.yield_anomaly_pct)} r="11" fill="transparent" />
              <circle
                cx={x(r.urgency_score)}
                cy={y(r.yield_anomaly_pct)}
                r={isActive ? 7 : 5}
                fill={TIERS[r.tier].color}
                stroke={isActive ? CHART.accent : CHART.surface}
                strokeWidth="2"
              />
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="absolute pointer-events-none bg-surface-container-highest/95 px-3 py-2 rounded-lg shadow-2xl z-20 font-label-code text-[11px] text-on-surface-variant space-y-0.5"
          style={{
            left: `${Math.min(80, (x(hover.urgency_score) / W) * 100 + 2)}%`,
            top: `${Math.min(75, (y(hover.yield_anomaly_pct) / H) * 100)}%`,
          }}
        >
          <div className="font-headline-sm text-[13px] text-primary font-bold">{hover.county_name}</div>
          <div>
            Score <b className="text-primary">{score(hover.urgency_score)}</b> • Yield <b className="text-primary">{signedPct(hover.yield_anomaly_pct)}</b>
          </div>
          <div>
            {TIERS[hover.tier].name} · {TIERS[hover.tier].label}
          </div>
          <div>Relief {usd(hover.recommended_relief_usd)}</div>
          <div>
            Heat {hover.extreme_heat_days ?? '—'}d • D2+ {hover.weeks_in_d2_plus ?? '—'}wk • Soil {hover.aws_100cm_mm?.toFixed(0) ?? '—'}mm
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap px-3 py-2 font-micro text-micro text-on-surface-variant">
        {[1, 2, 3].map((t, i) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: TIERS[t].color }} />
            {TIERS[t].name} · {TIERS[t].label} ({counts[i]})
          </span>
        ))}
        {pts.length < rows.length && <span className="text-text-muted">{rows.length - pts.length} counties without a trend anomaly not plotted</span>}
      </div>
    </div>
  );
}
