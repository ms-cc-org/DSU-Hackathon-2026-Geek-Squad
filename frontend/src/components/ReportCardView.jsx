import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { Panel, StatCard, StatusPanel } from './Status.jsx';
import { apiUrl, useApi } from '../lib/api.js';
import { CHART, num, signedPct } from '../lib/format.js';

// Tab 3 of app.py: src/report_card.get_county_report_card for one county and crop.
export default function ReportCardView({ ctx, fips, onSelect }) {
  const { stateCode: state, crop, stateLabel } = ctx;
  const list = useApi(apiUrl('counties', { state, crop }));
  const counties = list.data?.counties ?? [];
  const valid = counties.some((c) => c.fips === fips);

  useEffect(() => {
    if (counties.length && !valid) onSelect(counties[0].fips);
  }, [counties, valid, onSelect]);

  const card = useApi(valid ? apiUrl('report-card', { state, crop, fips }) : null);
  const [showRaw, setShowRaw] = useState(false);

  if (list.error) return <StatusPanel tone="error" title="County list failed" detail={list.error} />;
  if (card.error) return <StatusPanel tone="error" title="Report card failed" detail={card.error} />;

  const c = card.data && card.data.fips === fips ? card.data : null;

  return (
    <div className="flex flex-col w-full">
      <div className="w-full px-gutter pt-space-md">
        <div className="w-full bg-surface-container-low rounded-xl p-space-md border border-border-glass flex flex-wrap items-end justify-between gap-space-md">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">County Report Card</h2>
            <p className="font-body-md text-body-md text-text-muted mt-1 max-w-3xl">
              Each county's soil buffering, drought frequency since 2000, and how hard its {crop.toLowerCase()} yields fall in drought years.
            </p>
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-micro text-micro uppercase text-text-muted">County ({stateLabel}, reports {crop})</span>
            <select
              value={valid ? fips : ''}
              onChange={(e) => onSelect(e.target.value)}
              className="bg-surface-container-lowest border border-surface-container-highest rounded-lg py-1.5 pl-3 pr-8 text-on-surface font-label-code text-label-code focus:outline-none focus:ring-0 min-w-[240px]"
            >
              {counties.map((x) => (
                <option key={x.fips} value={x.fips}>
                  {x.county_name} ({x.fips})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!c ? (
        <StatusPanel title="Loading report card…" />
      ) : c.empty ? (
        <StatusPanel tone="warning" title="No report card available for this selection." />
      ) : (
        <>
          <div className="w-full px-gutter py-space-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
              <StatCard eyebrow="Soil sponge (AWS 100 cm)" value={`${num(c.aws_100cm_mm, 1)} mm`} valueClass="text-risk-low" caption={c.sponge_grade} />
              <StatCard eyebrow="Droughty soil share" value={`${num(c.droughty_pct, 1)}%`} caption="Share of acreage on drought-vulnerable soils" />
              <StatCard
                eyebrow="D2+ drought frequency"
                value={`${c.d2_plus_years} seasons`}
                valueClass="text-risk-elevated"
                caption={`${num(c.d2_frequency_pct, 1)}% of years since 2000`}
                footer={c.worst_drought_year ? `Worst: ${c.worst_drought_year} (DSCI ${num(c.peak_dsci, 1)})` : null}
              />
              <StatCard
                eyebrow="Drought yield loss gap"
                value={`−${num(c.drought_impact_gap_pct, 1)}%`}
                valueClass="text-error"
                caption="Yield drop in drought vs normal years"
                footer={`Drought yrs ${signedPct(c.avg_drought_anomaly_pct)} • normal yrs ${signedPct(c.avg_normal_anomaly_pct)}`}
              />
            </div>
          </div>

          <Panel
            title={`${c.county_name}, ${c.state_alpha}: 2000–2025 climate stress vs yield`}
            subtitle={`FIPS ${c.fips} • ${c.years_recorded} reported seasons • avg ${num(c.avg_yield_bu_acre, 1)} bu/ac (range ${num(c.min_yield_bu_acre, 1)}–${num(
              c.max_yield_bu_acre,
              1,
            )}). Drought season = DSCI ≥ 100 or ≥ 2 weeks in D2+.`}
            right={
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-bright font-label-code text-label-code flex items-center gap-1"
              >
                <Icon name={showRaw ? 'monitoring' : 'table_rows'} className="text-[16px]" />
                {showRaw ? 'Show charts' : 'Show raw records'}
              </button>
            }
          >
            {showRaw ? <RawTable history={c.history} /> : <History history={c.history} />}
          </Panel>
        </>
      )}
    </div>
  );
}

const W = 900;
const M = { l: 56, r: 12 };

// Three aligned strips sharing one x-axis and one hover year (instead of a dual-axis chart).
function History({ history }) {
  const [hoverYear, setHoverYear] = useState(null);
  const years = history.map((h) => h.year);
  const y0 = Math.min(...years);
  const y1 = Math.max(...years);
  const step = (W - M.l - M.r) / (y1 - y0 + 1);
  const xc = (yr) => M.l + (yr - y0 + 0.5) * step;
  const hovered = history.find((h) => h.year === hoverYear);

  const strips = [
    {
      label: 'Yield anomaly vs trend (%)',
      key: 'yield_anomaly_pct',
      kind: 'bar',
      color: (v) => (v >= 0 ? '#51ad70' : '#d96c48'),
      fmt: (v) => signedPct(v),
      h: 170,
    },
    { label: 'Drought severity (DSCI, 0–500)', key: 'mean_dsci', kind: 'line', color: () => '#ef9250', fmt: (v) => num(v, 1), h: 120 },
    { label: 'Extreme heat days (≥35°C)', key: 'extreme_heat_days', kind: 'bar', color: () => '#edc45c', fmt: (v) => num(v), h: 120 },
  ];

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const yr = Math.floor((x - M.l) / step) + y0;
    setHoverYear(yr >= y0 && yr <= y1 ? yr : null);
  };

  return (
    <div className="relative" onMouseLeave={() => setHoverYear(null)}>
      {hovered && (
        <div className="absolute right-0 -top-1 z-10 bg-surface-container-highest/95 px-3 py-2 rounded-lg shadow-2xl font-label-code text-[11px] text-on-surface-variant space-y-0.5">
          <div className="font-headline-sm text-[13px] text-primary font-bold">{hovered.year}</div>
          <div>Yield {num(hovered.yield_per_acre, 1)} bu/ac ({signedPct(hovered.yield_anomaly_pct)})</div>
          <div>DSCI {num(hovered.mean_dsci, 1)} • D2+ {num(hovered.weeks_in_d2_plus)} wk</div>
          <div>Heat {num(hovered.extreme_heat_days)} d • Precip {signedPct(hovered.precip_anomaly_pct)}</div>
        </div>
      )}
      {strips.map((s, i) => {
        const vals = history.map((h) => h[s.key]).filter((v) => v != null);
        const lo = s.key === 'yield_anomaly_pct' ? Math.min(0, ...vals) : 0;
        const hi = Math.max(s.key === 'mean_dsci' ? 100 : 1, ...vals);
        const H = s.h;
        const pad = 10;
        const y = (v) => pad + ((hi - v) / (hi - lo || 1)) * (H - 2 * pad);
        const last = i === strips.length - 1;
        const linePts = history.filter((h) => h[s.key] != null).map((h) => `${xc(h.year)},${y(h[s.key])}`);
        return (
          <div key={s.key} className="mb-1">
            <div className="font-micro text-micro uppercase text-text-muted mb-0.5">{s.label}</div>
            <svg viewBox={`0 0 ${W} ${H + (last ? 22 : 0)}`} className="w-full h-auto block" onMouseMove={onMove}>
              {(lo < 0 ? [lo, 0, hi] : [lo, (lo + hi) / 2, hi]).map((t, k) => (
                <g key={k}>
                  <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke={CHART.grid} />
                  <text x={M.l - 6} y={y(t) + 4} textAnchor="end" fill={CHART.axis} fontSize="11" fontFamily="JetBrains Mono">
                    {Math.round(t)}
                  </text>
                </g>
              ))}
              {lo < 0 && <line x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} stroke={CHART.muted} />}
              {hoverYear && <rect x={xc(hoverYear) - step / 2} y={0} width={step} height={H} fill="#ffffff" opacity="0.05" />}
              {s.kind === 'bar' &&
                history.map((h) => {
                  const v = h[s.key];
                  if (v == null || v === 0) return null;
                  const top = Math.min(y(v), y(Math.max(lo, 0)));
                  const ht = Math.abs(y(v) - y(Math.max(lo, 0)));
                  return <rect key={h.year} x={xc(h.year) - step * 0.35} y={top} width={step * 0.7} height={Math.max(1, ht)} rx="2" fill={s.color(v)} />;
                })}
              {s.kind === 'line' && (
                <>
                  <polyline points={linePts.join(' ')} fill="none" stroke={s.color()} strokeWidth="2" strokeLinejoin="round" />
                  {history.map((h) =>
                    h[s.key] == null ? null : (
                      <circle key={h.year} cx={xc(h.year)} cy={y(h[s.key])} r={h.year === hoverYear ? 5 : 3} fill={s.color()} stroke={CHART.surface} strokeWidth="2" />
                    ),
                  )}
                </>
              )}
              {last &&
                history
                  .filter((h) => h.year % 5 === 0 || h.year === y1)
                  .map((h) => (
                    <text key={h.year} x={xc(h.year)} y={H + 16} textAnchor="middle" fill={CHART.axis} fontSize="11" fontFamily="JetBrains Mono">
                      {h.year}
                    </text>
                  ))}
            </svg>
          </div>
        );
      })}
      <p className="font-micro text-micro text-text-muted mt-1">A year with no bar has a zero value or no published data. Use Show raw records to tell which.</p>
    </div>
  );
}

function RawTable({ history }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse font-label-code text-label-code">
        <thead>
          <tr className="text-text-muted font-micro text-micro uppercase tracking-wider border-b border-surface-container-highest">
            <th className="py-2 px-2">Year</th>
            <th className="py-2 px-2 text-right">Yield (bu/acre)</th>
            <th className="py-2 px-2 text-right">Yield Anomaly</th>
            <th className="py-2 px-2 text-right">Drought DSCI</th>
            <th className="py-2 px-2 text-right">Weeks in D2+</th>
            <th className="py-2 px-2 text-right">Heat Days (≥35°C)</th>
            <th className="py-2 px-2 text-right">Precip Anomaly</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container-highest/50 text-on-surface">
          {history.map((h) => (
            <tr key={h.year}>
              <td className="py-1.5 px-2 text-primary font-bold">{h.year}</td>
              <td className="py-1.5 px-2 text-right">{num(h.yield_per_acre, 1)}</td>
              <td className={`py-1.5 px-2 text-right ${h.yield_anomaly_pct < 0 ? 'text-error' : ''}`}>{signedPct(h.yield_anomaly_pct)}</td>
              <td className="py-1.5 px-2 text-right">{num(h.mean_dsci, 1)}</td>
              <td className="py-1.5 px-2 text-right">{num(h.weeks_in_d2_plus)}</td>
              <td className="py-1.5 px-2 text-right">{num(h.extreme_heat_days)}</td>
              <td className="py-1.5 px-2 text-right">{signedPct(h.precip_anomaly_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
