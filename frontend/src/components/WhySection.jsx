import Icon from './Icon.jsx';
import { Card, Section, StatusPanel } from './Status.jsx';
import { num } from '../lib/format.js';

const CARDS = [
  { id: 'extreme_heat_days', icon: 'thermostat', title: 'Heat days ≥ 35°C', weight: '30%', note: 'Heat during pollination kills kernels even after a wet spring.' },
  { id: 'weeks_in_d2_plus', icon: 'local_fire_department', title: 'Weeks in severe drought', weight: '30%', note: 'How long the drought lasted matters more than how bad one week was.' },
  { id: 'mean_dsci', icon: 'water_loss', title: 'Drought severity', weight: '25%', note: 'The U.S. Drought Monitor intensity index, averaged over the season.' },
  { id: 'precip_anomaly_pct', icon: 'rainy', title: 'Rainfall', weight: '15%', note: 'Season totals hide timing: a wet May can mask a dry July.' },
];

const rStr = (r) => `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(2)}`;

export default function WhySection({ ctx, validation }) {
  const c = validation.data?.correlations;
  const get = (id) => c?.drivers?.find((d) => d.id === id)?.r;
  const heat = get('extreme_heat_days');
  const rain = get('precip_anomaly_pct');
  const d2 = get('weeks_in_d2_plus');

  // The headline must match this state's numbers, not Iowa's.
  let takeaway = 'The score combines heat, drought length, drought severity and rainfall, then gives credit for deep soils.';
  if (heat != null && rain != null) {
    if (Math.abs(rain) <= Math.abs(heat) / 2) takeaway = `Heat and drought length predict crop losses. Rainfall barely does (r ${rStr(heat)} vs ${rStr(rain)}).`;
    else if (Math.abs(heat) >= Math.abs(rain))
      takeaway = `Heat (r ${rStr(heat)}) and drought length (r ${rStr(d2)}) track crop losses at least as well as rainfall (r ${rStr(rain)}).`;
    else takeaway = `Here rainfall (r ${rStr(rain)}) tracks losses more than heat (r ${rStr(heat)}). The score still weighs both, plus drought length.`;
  }

  return (
    <Section
      id="why"
      step="3"
      title="Why these counties"
      takeaway={takeaway}
    >
      {!c?.drivers?.length ? (
        <StatusPanel inline title={`Too few reported ${ctx.crop.toLowerCase()} yields in ${ctx.stateLabel} to measure these links.`} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
            {CARDS.map((k) => {
              const r = get(k.id);
              return (
                <div key={k.id} className="bg-surface-container-high/70 rounded-xl p-space-md">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
                      <Icon name={k.icon} className="text-[18px] text-risk-elevated" />
                      {k.title}
                    </span>
                    <span className="font-label-code text-label-code text-text-muted">weight {k.weight}</span>
                  </div>
                  <div className={`font-headline-lg text-headline-lg mt-1 ${r < -0.3 ? 'text-risk-severe' : 'text-on-surface-variant'}`}>r {rStr(r)}</div>
                  <div className="relative w-full h-2 bg-surface-container-lowest rounded mt-1">
                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-outline" />
                    <div
                      className="absolute top-0 bottom-0 rounded"
                      style={{ left: r < 0 ? `${50 + r * 50}%` : '50%', width: `${Math.abs(r) * 50}%`, background: r < 0 ? '#d96c48' : '#51ad70' }}
                    />
                  </div>
                  <p className="font-body-sm text-body-sm text-text-muted mt-2">{k.note}</p>
                </div>
              );
            })}
          </div>

          <Card className="mt-space-md">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-space-md items-center">
              <div>
                <div className="font-eyebrow text-eyebrow uppercase text-primary-fixed flex items-center gap-1.5">
                  <Icon name="grass" className="text-[18px] text-risk-low" />
                  The soil sponge
                </div>
                <p className="font-body-md text-body-md text-on-surface mt-1">
                  On its own, soil water storage barely tracks yield (r {rStr(get('aws_100cm_mm'))}). It works as a <b>cushion</b>: deep soils carry a
                  crop through a dry spell. So the model cuts a county's drought hazard by up to 25% when its soil holds a lot of water.
                </p>
              </div>
              <div className="font-label-code text-[12px] text-on-surface bg-surface-container-lowest rounded-lg p-3 leading-relaxed">
                Urgency (1–10) = 1 + 9 × hazard × (1 − 0.25 × soil)
                <br />
                <span className="text-text-muted">hazard = 0.30 heat + 0.30 D2+ weeks + 0.25 severity + 0.15 rain deficit</span>
              </div>
            </div>
          </Card>
          <p className="mt-2 font-body-sm text-body-sm text-text-muted">
            r = Pearson correlation with yield vs trend, over {num(c.n)} reported {ctx.stateLabel} {ctx.crop.toLowerCase()} county-seasons ({c.year_min}–
            {c.year_max}). Negative means more of it, worse harvest. Weather and drought cover the crop's growing season, not the calendar year.
          </p>
        </>
      )}
    </Section>
  );
}
