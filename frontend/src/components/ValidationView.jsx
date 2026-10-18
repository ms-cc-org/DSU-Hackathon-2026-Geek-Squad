import { useState } from 'react';
import Icon from './Icon.jsx';
import { Panel, StatCard, StatusPanel } from './Status.jsx';
import { apiUrl, useApi } from '../lib/api.js';
import { CHART, num, pct } from '../lib/format.js';

// Tab 2 of app.py: evaluate_out_of_sample_validation, plus the driver correlations it cites.
export default function ValidationView({ ctx }) {
  const { stateCode: state, crop, quotaPct: quota, stateLabel } = ctx;
  const v = useApi(apiUrl('validation', { state, crop, quota }));

  if (v.error) return <StatusPanel tone="error" title="Validation failed" detail={v.error} />;
  if (!v.data) return <StatusPanel title="Running 2016–2025 blind test…" />;
  const d = v.data;
  const [tr0, tr1] = d.train_years;
  const [te0, te1] = d.test_years;

  if (!d.ok) {
    return (
      <StatusPanel
        title={`Limited historical data for ${stateLabel} ${crop} (${te0}–${te1})`}
        detail="NASS published limited or un-detrended yield surveys for this state-crop pair (see data/data_dictionary.md). For the full 10-year out-of-sample benchmark across 90+ counties, switch to Iowa or Nebraska, Corn or Soybeans."
      />
    );
  }

  const s = d.summary;
  const slots = s.total_aid_allocations;

  return (
    <div className="flex flex-col w-full">
      <div className="w-full px-gutter pt-space-md">
        <div className="w-full bg-surface-container-low rounded-xl p-space-md border border-border-glass">
          <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
            Out-of-Sample Validation: {stateLabel} {crop}
          </h2>
          <p className="font-body-md text-body-md text-text-muted mt-1 max-w-4xl">
            <b className="text-on-surface">Training ({tr0}–{tr1})</b>: {tr1 - tr0 + 1} seasons used to set the urgency weights and soil
            buffering. <b className="text-on-surface">Blind test ({te0}–{te1})</b>: {te1 - te0 + 1} later seasons held out and scored
            against real USDA reported yields. Each year, every strategy picks its top {quota}% of counties. A pick is a{' '}
            <i>hit</i> if that county's yield came in at least {Math.abs(d.severe_threshold_pct)}% below trend.
          </p>
        </div>
      </div>

      <div className="w-full px-gutter py-space-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <StatCard eyebrow="Test period" value={s.test_years} caption={`${d.table.length} unseen seasons`} />
          <StatCard
            eyebrow="Disaster events analyzed"
            value={`${s.total_disaster_events} counties`}
            valueClass="text-error"
            caption={`Severe drops (≤ ${d.severe_threshold_pct}%) in years with ≥ 1 disaster`}
          />
          <StatCard
            eyebrow="Our model precision"
            value={s.model_precision}
            valueClass="text-accent-neon"
            note={`${s.model_lift_vs_rain}× vs rain alone`}
            noteClass="text-accent-neon"
            caption={`${s.model_hits} hits from ${slots} relief slots`}
          />
          <StatCard eyebrow="Naive rainfall precision" value={s.rain_precision} caption={`${s.rain_hits} hits from ${slots} relief slots`} />
        </div>
      </div>

      <div className="w-full px-gutter py-space-sm">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-start">
          <div className="xl:col-span-6">
            <PrecisionBars strategies={d.strategies} summary={s} />
          </div>
          <div className="xl:col-span-6">
            <Scoreboard table={d.table} />
          </div>
        </div>
      </div>

      <Correlations data={d.correlations} crop={crop} stateLabel={stateLabel} />
    </div>
  );
}

function PrecisionBars({ strategies, summary: s }) {
  const [hover, setHover] = useState(null);
  const hits = { model: s.model_hits, dsci: s.dsci_hits, rain: s.rain_hits, random: s.random_hits };
  const max = Math.max(30, ...strategies.map((x) => x.precision_pct));
  return (
    <div className="bg-surface-container/90 rounded-xl p-space-md lg:p-space-lg shadow-2xl">
      <h3 className="font-headline-sm text-headline-sm text-primary tracking-tight">Targeting accuracy: model vs baselines</h3>
      <p className="font-body-sm text-body-sm text-text-muted mt-0.5">
        Precision = hits ÷ relief slots ({s.total_aid_allocations}) across test years with at least one disaster.
      </p>
      <div className="mt-space-md space-y-3">
        {strategies.map((x) => {
          const isModel = x.id === 'model';
          return (
            <div
              key={x.id}
              onMouseEnter={() => setHover(x.id)}
              onMouseLeave={() => setHover(null)}
              className={`rounded-lg p-1.5 -m-1.5 ${hover === x.id ? 'bg-surface-container-high/60' : ''}`}
            >
              <div className="flex items-center justify-between font-body-sm text-body-sm mb-1">
                <span className={isModel ? 'text-primary font-bold' : 'text-on-surface-variant'}>{x.label}</span>
                <span className="font-label-code text-label-code text-primary font-bold">
                  {pct(x.precision_pct)}
                  <span className="text-text-muted font-normal ml-2">
                    {x.id === 'random' ? `${num(hits[x.id], 1)} expected` : `${hits[x.id]} hits`}
                  </span>
                </span>
              </div>
              <div className="w-full bg-surface-container-lowest h-3 rounded overflow-hidden">
                <div className="h-full rounded" style={{ width: `${(x.precision_pct / max) * 100}%`, background: isModel ? CHART.accent : CHART.muted }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Scoreboard({ table }) {
  return (
    <div className="bg-surface-container/90 rounded-xl p-space-md lg:p-space-lg shadow-2xl">
      <h3 className="font-headline-sm text-headline-sm text-primary tracking-tight">Unseen test season scoreboard</h3>
      <div className="w-full overflow-x-auto mt-space-sm">
        <table className="w-full text-left border-collapse font-label-code text-label-code">
          <thead>
            <tr className="text-text-muted font-micro text-micro uppercase tracking-wider border-b border-surface-container-highest">
              <th className="py-2 px-2">Year</th>
              <th className="py-2 px-2 text-right">Counties</th>
              <th className="py-2 px-2 text-right">Relief Slots (K)</th>
              <th className="py-2 px-2 text-right">True Disasters</th>
              <th className="py-2 px-2 text-right">Our Model</th>
              <th className="py-2 px-2 text-right">Rain Alone</th>
              <th className="py-2 px-2 text-right">USDM Alone</th>
              <th className="py-2 px-2 text-right">Random (exp.)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-highest/50">
            {table.map((r) => {
              const best = Math.max(r.model_urgency_hits, r.rain_deficit_hits, r.pure_dsci_hits);
              const cell = (v) => (
                <td className={`py-1.5 px-2 text-right ${best > 0 && v === best ? 'text-accent-neon font-bold' : 'text-on-surface'}`}>{v}</td>
              );
              return (
                <tr key={r.year} className={r.actual_severe_counties === 0 ? 'text-text-muted' : ''}>
                  <td className="py-1.5 px-2 text-primary font-bold">{r.year}</td>
                  <td className="py-1.5 px-2 text-right">{r.counties}</td>
                  <td className="py-1.5 px-2 text-right">{r.tier1_quota_k}</td>
                  <td className="py-1.5 px-2 text-right text-error">{r.actual_severe_counties}</td>
                  {cell(r.model_urgency_hits)}
                  {cell(r.rain_deficit_hits)}
                  {cell(r.pure_dsci_hits)}
                  <td className="py-1.5 px-2 text-right text-text-muted">{num(r.random_expected_hits, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 font-micro text-micro text-text-muted">Highlighted = most hits that year. Years with no disasters are excluded from precision.</p>
    </div>
  );
}

function Correlations({ data, crop, stateLabel }) {
  if (!data?.drivers?.length) return null;
  const get = (id) => data.drivers.find((x) => x.id === id)?.r;
  const heat = get('extreme_heat_days');
  const d2 = get('weeks_in_d2_plus');
  const rain = get('precip_anomaly_pct');
  const ratio = rain ? Math.abs(heat / rain) : null;

  return (
    <Panel
      title="Why the model beats rainfall alone"
      subtitle={`Pearson correlation of each model input with yield anomaly across ${num(data.n)} reported ${stateLabel} ${crop.toLowerCase()} county-years (${data.year_min}–${data.year_max}). Negative = more of it, worse harvest.`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
        <div className="space-y-2.5">
          {data.drivers.map((x) => (
            <div key={x.id}>
              <div className="flex justify-between font-body-sm text-body-sm">
                <span className="text-on-surface-variant">{x.label}</span>
                <span className="font-label-code text-label-code text-primary font-bold">r = {x.r >= 0 ? '+' : ''}{x.r.toFixed(2)}</span>
              </div>
              <div className="relative w-full h-2.5 bg-surface-container-lowest rounded mt-1">
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-outline" />
                <div
                  className="absolute top-0 bottom-0 rounded"
                  style={{
                    left: x.r < 0 ? `${50 + x.r * 50}%` : '50%',
                    width: `${Math.abs(x.r) * 50}%`,
                    background: x.r < 0 ? '#d96c48' : '#51ad70',
                  }}
                />
              </div>
            </div>
          ))}
          <div className="flex justify-between font-micro text-micro text-text-muted">
            <span>−1 (hurts yield)</span>
            <span>0</span>
            <span>+1</span>
          </div>
        </div>
        <ul className="space-y-space-sm font-body-sm text-body-sm text-on-surface-variant">
          <li className="flex gap-2">
            <Icon name="thermostat" className="text-[18px] text-risk-elevated shrink-0" />
            <span>
              <b className="text-on-surface">Heat is the strongest signal.</b> Days ≥35°C correlate with yield at r = {heat.toFixed(2)}, versus{' '}
              {rain >= 0 ? '+' : ''}
              {rain.toFixed(2)} for precipitation{ratio ? ` (${ratio.toFixed(1)}× stronger)` : ''}. Weeks in D2+ drought: r = {d2.toFixed(2)}.
            </span>
          </li>
          <li className="flex gap-2">
            <Icon name="calendar_month" className="text-[18px] text-secondary shrink-0" />
            <span>
              <b className="text-on-surface">Rain totals hide timing.</b> A wet May can bring a season to near-normal rainfall even when July
              pollination is dry and hot.
            </span>
          </li>
          <li className="flex gap-2">
            <Icon name="grass" className="text-[18px] text-risk-low shrink-0" />
            <span>
              <b className="text-on-surface">The soil sponge works as a modifier, not a driver.</b> On its own, AWS barely correlates with yield
              (r = {get('aws_100cm_mm').toFixed(2)}). The model uses it only to discount drought hazard, by up to 25% for the deepest soils.
            </span>
          </li>
        </ul>
      </div>
    </Panel>
  );
}
