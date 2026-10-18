import Icon from './Icon.jsx';
import { TIERS, num, score, signedPct, usd } from '../lib/format.js';

const TONE = {
  1: { dot: 'bg-risk-severe animate-pulse', text: 'text-risk-severe' },
  2: { dot: 'bg-risk-moderate', text: 'text-risk-moderate' },
  3: { dot: 'bg-risk-low', text: 'text-risk-low' },
};

export default function DiagnosticCard({ row, total, ctx, onOpenRationale, onOpenReport }) {
  const tone = TONE[row.tier];
  const tier = TIERS[row.tier];
  const gauge = ((row.urgency_score - 1) / 9) * 100;

  return (
    <div
      id="diagnostic-card"
      className="xl:col-span-4 bg-surface-container/90 backdrop-blur-xl rounded-xl p-space-md lg:p-space-lg flex flex-col justify-between min-h-[480px] transition-all duration-300 border border-accent-neon/40 shadow-[0_0_25px_rgba(167,245,90,0.15)]"
    >
      <div>
        <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-highest">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${tone.dot}`} />
            <span className="font-eyebrow text-eyebrow text-primary-fixed uppercase tracking-wider">County Card</span>
          </div>
          <span className={`px-2 py-0.5 rounded font-label-code text-label-code font-bold ${tier.badge}`}>
            {tier.name} · {tier.label}
          </span>
        </div>

        <div className="mt-space-md">
          <h2 className="font-headline-sm text-headline-sm text-primary tracking-tight">
            {row.county_name}, {ctx.stateCode}
          </h2>
          <p className="font-label-code text-label-code text-text-muted">
            FIPS {row.fips} • {ctx.crop} {ctx.year}
          </p>
        </div>

        <div className="my-space-md bg-surface-container-low rounded-xl p-space-md flex items-center justify-between">
          <div>
            <div className="font-micro text-micro uppercase text-text-muted">Drought Urgency Score</div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`font-headline-lg text-headline-lg font-bold ${tone.text}`}>{score(row.urgency_score)}</span>
              <span className="font-body-sm text-body-sm text-text-muted">/ 10</span>
            </div>
            <div className="text-[11px] font-body-sm text-accent-neon font-medium">
              Ranked #{row.rank} of {total} counties
            </div>
          </div>
          <div className="w-16 h-16 relative flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-surface-container-highest"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
              />
              <path
                className={`${tone.text} transition-all duration-500`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray={`${gauge}, 100`}
                strokeLinecap="round"
                strokeWidth="3.5"
              />
            </svg>
            <Icon name="emergency_home" className={`absolute text-[22px] ${tone.text}`} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-space-sm">
          <Metric icon="payments" iconClass="text-accent-neon" label="Allocated relief" value={usd(row.recommended_relief_usd)} valueClass="text-accent-neon" wide />
          <Metric icon="trending_down" iconClass="text-error" label="Est. dollar loss" value={usd(row.estimated_dollar_loss)} valueClass="text-error" wide />
          <Metric
            icon="water_loss"
            iconClass="text-error"
            label="Yield anomaly"
            value={signedPct(row.yield_anomaly_pct)}
            sub={`${num(row.yield_per_acre, 1)} vs ${num(row.trend_yield, 1)} bu/ac trend`}
            valueClass={row.yield_anomaly_pct < 0 ? 'text-error' : 'text-risk-low'}
          />
          <Metric icon="thermostat" iconClass="text-risk-elevated" label="Heat days ≥35°C" value={num(row.extreme_heat_days)} />
          <Metric icon="local_fire_department" iconClass="text-risk-severe" label="Weeks in D2+" value={num(row.weeks_in_d2_plus)} sub={`DSCI ${num(row.mean_dsci, 1)}`} />
          <Metric icon="rainy" iconClass="text-secondary" label="Precip anomaly" value={signedPct(row.precip_anomaly_pct)} />
          <Metric icon="grass" iconClass="text-risk-low" label="Soil sponge (AWS)" value={`${num(row.aws_100cm_mm)} mm`} sub="water held in top 100 cm" wide />
        </div>
      </div>

      <div className="pt-space-md mt-space-md border-t border-surface-container-highest flex items-center gap-space-sm">
        <button
          className="flex-1 py-2 px-3 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-bright transition-colors font-label-code text-label-code flex items-center justify-center gap-1.5"
          onClick={onOpenRationale}
        >
          <Icon name="functions" className="text-[18px]" />
          How this score &amp; check were computed
        </button>
        <button
          className="py-2 px-3 rounded-lg bg-primary-container text-on-primary-container font-label-code text-label-code font-bold hover:bg-accent-hover transition-colors flex items-center gap-1"
          onClick={onOpenReport}
        >
          <Icon name="analytics" className="text-[18px]" />
          26-yr report
        </button>
      </div>
    </div>
  );
}

function Metric({ icon, iconClass, label, value, sub, valueClass = 'text-primary', wide }) {
  return (
    <div className={`p-2.5 rounded bg-surface-container-high/60 ${wide ? 'col-span-2 flex items-center justify-between' : ''}`}>
      <span className="font-body-sm text-body-sm text-text-muted flex items-center gap-1.5">
        <Icon name={icon} className={`text-[16px] ${iconClass}`} />
        <span>{label}</span>
      </span>
      <div className={wide ? 'text-right' : 'mt-0.5'}>
        <div className={`font-label-code text-[13px] font-bold ${valueClass}`}>{value}</div>
        {sub && <div className="font-micro text-micro text-text-muted">{sub}</div>}
      </div>
    </div>
  );
}
