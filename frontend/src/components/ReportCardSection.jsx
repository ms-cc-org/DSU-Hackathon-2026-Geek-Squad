import { useState } from 'react';
import Icon from './Icon.jsx';
import { BigStat, Card, Section, StatusPanel } from './Status.jsx';
import { apiUrl, useApi } from '../lib/api.js';
import { CHART, TIERS, num, score, signedPct, usd } from '../lib/format.js';

// Same definition as src/report_card.py
const isDroughtSeason = (h) => (h.mean_dsci ?? 0) >= 100 || (h.weeks_in_d2_plus ?? 0) >= 2;

export default function ReportCardSection({ ctx, row, rows, onSelect, onShowMath }) {
  const card = useApi(apiUrl('report-card', { state: ctx.stateCode, crop: ctx.crop, fips: row.fips }));
  const c = card.data?.fips === row.fips ? card.data : null;
  const tier = TIERS[row.tier];
  const options = [...rows].sort((a, b) => a.county_name.localeCompare(b.county_name));

  const takeaway = c && !c.empty
    ? `${c.county_name}: severe drought hit ${c.d2_plus_years} of ${c.history.length} seasons. ${
        c.drought_impact_gap_pct > 0
          ? `In drought years its ${ctx.crop.toLowerCase()} yield ran ${num(c.drought_impact_gap_pct, 1)} points worse than in normal years.`
          : `Its ${ctx.crop.toLowerCase()} yield was no worse in drought years than in normal years.`
      }`
    : `${row.county_name}`;

  return (
    <Section
      id="county"
      step="5"
      title="County report card"
      takeaway={takeaway}
      right={
        <label className="flex flex-col gap-1">
          <span className="font-micro text-micro uppercase text-text-muted">Pick a county</span>
          <select
            value={row.fips}
            onChange={(e) => onSelect(e.target.value)}
            className="bg-surface-container-lowest border border-surface-container-highest rounded-lg py-1.5 pl-3 pr-8 text-on-surface font-label-code text-label-code focus:outline-none focus:ring-1 focus:ring-accent-neon min-w-[220px]"
          >
            {options.map((x) => (
              <option key={x.fips} value={x.fips}>
                {x.county_name} (#{x.rank})
              </option>
            ))}
          </select>
        </label>
      }
    >
      {card.error && <StatusPanel inline tone="error" title="Report card failed" detail={card.error} />}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-start">
        <Card className="xl:col-span-4 border border-accent-neon/30">
          <div className="flex items-center justify-between">
            <span className="font-eyebrow text-eyebrow uppercase text-primary-fixed">{ctx.year} decision</span>
            <span className={`px-2 py-0.5 rounded font-label-code text-label-code font-bold ${tier.badge}`}>
              {row.tier === 1 ? 'Gets relief' : row.tier === 2 ? 'Watch list' : 'Lower risk'}
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-space-sm">
            <span className="font-headline-lg text-headline-lg" style={{ color: tier.color }}>
              {score(row.urgency_score)}
            </span>
            <span className="font-body-sm text-body-sm text-text-muted">/ 10 urgency · rank #{row.rank}</span>
          </div>
          <dl className="mt-space-sm space-y-1.5 font-body-sm text-body-sm">
            <Line k="Relief check" v={usd(row.recommended_relief_usd)} vCls={row.recommended_relief_usd > 0 ? 'text-accent-neon' : 'text-text-muted'} />
            <Line k="Estimated crop loss" v={usd(row.estimated_dollar_loss)} />
            <Line k="Harvest vs trend" v={signedPct(row.yield_anomaly_pct)} vCls={row.yield_anomaly_pct < 0 ? 'text-error' : 'text-risk-low'} />
            <Line k="Heat days ≥ 35°C" v={num(row.extreme_heat_days)} />
            <Line k="Weeks in severe drought" v={num(row.weeks_in_d2_plus)} />
            <Line k="Rain vs normal" v={signedPct(row.precip_anomaly_pct)} />
            <Line k="Soil water storage" v={`${num(row.aws_100cm_mm)} mm`} />
          </dl>
          <button
            onClick={onShowMath}
            className="mt-space-md w-full py-2 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-body-sm font-bold hover:bg-accent-hover flex items-center justify-center gap-1.5"
          >
            <Icon name="functions" className="text-[18px]" />
            Show the math behind this score &amp; check
          </button>
        </Card>

        <div className="xl:col-span-8 space-y-space-md">
          {c && !c.empty ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
                <BigStat label="Soil sponge" value={`${num(c.aws_100cm_mm)} mm`} valueClass="text-risk-low" sub={c.sponge_grade.replace(/ \(.*\)/, '')} />
                <BigStat label="Drought seasons" value={`${c.d2_plus_years} of ${c.history.length}`} valueClass="text-risk-elevated" sub={`${num(c.d2_frequency_pct, 0)}% of years in D2+`} />
                <BigStat label="Yield in drought years" value={signedPct(c.avg_drought_anomaly_pct)} valueClass="text-error" sub={`vs ${signedPct(c.avg_normal_anomaly_pct)} in normal years`} />
                <BigStat label="Worst drought" value={c.worst_drought_year ?? '—'} sub={c.worst_drought_year ? `DSCI ${num(c.peak_dsci, 0)}` : 'none recorded'} />
              </div>
              <Card>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-eyebrow text-eyebrow uppercase text-primary-fixed">Harvest vs trend, 2000–2025</span>
                  <span className="flex items-center gap-3 font-micro text-micro text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-risk-elevated" /> drought season
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#d96c48' }} /> below trend
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#51ad70' }} /> above trend
                    </span>
                  </span>
                </div>
                <YieldChart history={c.history} />
                <p className="font-body-sm text-body-sm text-text-muted">
                  {c.years_recorded} reported seasons. A gap means NASS published no yield or trend for that year. Drought season = DSCI ≥ 100 or ≥ 2 weeks in
                  D2+.
                </p>
              </Card>
            </>
          ) : (
            !card.error && <StatusPanel inline title="Loading report card…" />
          )}
        </div>
      </div>
    </Section>
  );
}

function Line({ k, v, vCls = 'text-on-surface' }) {
  return (
    <div className="flex justify-between gap-2 border-b border-surface-container-highest/50 pb-1">
      <dt className="text-text-muted">{k}</dt>
      <dd className={`font-label-code text-[13px] font-bold ${vCls}`}>{v}</dd>
    </div>
  );
}

const W = 860;
const H = 230;
const M = { l: 44, r: 8, t: 10, b: 40 };

function YieldChart({ history }) {
  const [hover, setHover] = useState(null);
  const years = history.map((h) => h.year);
  const y0 = Math.min(...years);
  const y1 = Math.max(...years);
  const vals = history.map((h) => h.yield_anomaly_pct).filter((v) => v != null);
  const lo = Math.min(-10, ...vals);
  const hi = Math.max(10, ...vals);
  const step = (W - M.l - M.r) / (y1 - y0 + 1);
  const xc = (yr) => M.l + (yr - y0 + 0.5) * step;
  const y = (v) => M.t + ((hi - v) / (hi - lo)) * (H - M.t - M.b);
  const ticks = [Math.ceil(lo / 10) * 10, 0, Math.floor(hi / 10) * 10].filter((t, i, a) => a.indexOf(t) === i);
  const h = history.find((x) => x.year === hover);

  return (
    <div className="relative mt-space-sm">
      {h && (
        <div
          className="absolute z-10 pointer-events-none bg-surface-container-highest/95 px-3 py-2 rounded-lg shadow-2xl font-label-code text-[11px] text-on-surface-variant space-y-0.5"
          style={{ left: `${Math.min(75, (xc(h.year) / W) * 100)}%`, top: 0 }}
        >
          <div className="text-primary font-bold text-[13px]">
            {h.year}
            {isDroughtSeason(h) ? ' · drought season' : ''}
          </div>
          <div>
            Harvest {signedPct(h.yield_anomaly_pct)} ({num(h.yield_per_acre, 1)} bu/ac)
          </div>
          <div>
            Heat {num(h.extreme_heat_days)} d · D2+ {num(h.weeks_in_d2_plus)} wk · DSCI {num(h.mean_dsci, 0)}
          </div>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" onMouseLeave={() => setHover(null)} role="img" aria-label="Yield versus trend by year">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHART.muted : CHART.grid} />
            <text x={M.l - 6} y={y(t) + 4} textAnchor="end" fill={CHART.axis} fontSize="11" fontFamily="JetBrains Mono">
              {t > 0 ? `+${t}` : t}%
            </text>
          </g>
        ))}
        {history.map((d) => {
          const v = d.yield_anomaly_pct;
          return (
            <g key={d.year} onMouseEnter={() => setHover(d.year)}>
              <rect x={xc(d.year) - step / 2} y={0} width={step} height={H} fill={hover === d.year ? '#ffffff0d' : 'transparent'} />
              {v != null && (
                <rect
                  x={xc(d.year) - step * 0.35}
                  y={Math.min(y(v), y(0))}
                  width={step * 0.7}
                  height={Math.max(1, Math.abs(y(v) - y(0)))}
                  rx="2"
                  fill={v >= 0 ? '#51ad70' : '#d96c48'}
                />
              )}
              {isDroughtSeason(d) && <circle cx={xc(d.year)} cy={H - M.b + 10} r="4" fill="#ef9250" />}
              {(d.year % 5 === 0 || d.year === y1) && (
                <text x={xc(d.year)} y={H - 6} textAnchor="middle" fill={CHART.axis} fontSize="11" fontFamily="JetBrains Mono">
                  {d.year}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
