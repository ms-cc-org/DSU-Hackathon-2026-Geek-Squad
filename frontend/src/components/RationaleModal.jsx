import Icon from './Icon.jsx';
import { TIERS, num, score, usd } from '../lib/format.js';

const f3 = (v) => (v == null ? '—' : v.toFixed(3));

// Step-by-step reproduction of priority_model.urgency_components / calculate_economic_losses /
// allocate_relief_budget for the selected county, using the API's own intermediate values.
export default function RationaleModal({ open, row, ranking, onClose }) {
  if (!open) return null;
  const s = ranking.summary;
  const price = ranking.price_per_bushel;
  const acres = row.acres_harvested ?? row.acres_planted ?? 0;
  const terms = [
    { w: 0.3, label: 'Heat days', raw: `${num(row.extreme_heat_days)} days ÷ 15`, norm: row.heat_norm },
    { w: 0.3, label: 'Weeks in D2+', raw: `${num(row.weeks_in_d2_plus)} wk ÷ 20`, norm: row.d2_norm },
    { w: 0.25, label: 'Drought severity', raw: `DSCI ${num(row.mean_dsci, 1)} ÷ 500`, norm: row.dsci_norm },
    { w: 0.15, label: 'Rain deficit', raw: `−(${num(row.precip_anomaly_pct, 1)}%) ÷ 50, floor 0`, norm: row.precip_deficit_norm },
  ];
  const unrounded = 1 + Math.min(9, Math.max(0, row.net_urgency * 9));

  let relief;
  if (row.tier !== 1) {
    relief = `Not in Tier 1 (rank #${row.rank} > ${s.tier1_count}), so the policy allocates $0. The fund goes only to Tier 1.`;
  } else if (s.allocation_basis === 'dollar_loss') {
    relief = `$${(ranking.budget / 1e6).toFixed(0)}M × ${usd(row.estimated_dollar_loss)} ÷ ${usd(s.tier1_total_loss)} (all Tier 1 losses) = ${usd(row.recommended_relief_usd)}`;
  } else {
    relief = `No Tier 1 county lost money this year, so the fund is split by urgency score × harvested acres: ${usd(row.recommended_relief_usd)}`;
  }

  return (
    <div className="fixed inset-0 bg-surface-container-lowest/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface-container rounded-2xl max-w-2xl w-full p-space-lg shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-highest">
          <div className="flex items-center gap-2">
            <Icon name="functions" className="text-primary-fixed text-[24px]" />
            <h4 className="font-headline-sm text-headline-sm text-primary">
              {row.county_name}: how the numbers were computed
            </h4>
          </div>
          <button className="p-1 rounded-lg text-text-muted hover:text-primary hover:bg-surface-container-high transition-colors" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <section className="mt-space-md">
          <div className="font-label-code text-label-code text-accent-neon font-bold uppercase mb-2">1 · Drought Urgency Score</div>
          <table className="w-full font-label-code text-[12px]">
            <thead>
              <tr className="text-text-muted text-left">
                <th className="py-1 font-normal">Input</th>
                <th className="py-1 font-normal">Normalized (0–1, capped)</th>
                <th className="py-1 font-normal text-right">Weight</th>
                <th className="py-1 font-normal text-right">Contribution</th>
              </tr>
            </thead>
            <tbody className="text-on-surface">
              {terms.map((t) => (
                <tr key={t.label} className="border-t border-surface-container-highest">
                  <td className="py-1.5">{t.label}</td>
                  <td className="py-1.5 text-text-muted">
                    {t.raw} = <span className="text-on-surface">{f3(t.norm)}</span>
                  </td>
                  <td className="py-1.5 text-right">× {t.w.toFixed(2)}</td>
                  <td className="py-1.5 text-right">{f3(t.w * t.norm)}</td>
                </tr>
              ))}
              <tr className="border-t border-surface-container-highest font-bold">
                <td className="py-1.5" colSpan="3">Hazard score</td>
                <td className="py-1.5 text-right">{f3(row.hazard_score)}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-2 p-3 rounded-lg bg-surface-container-lowest font-label-code text-[12px] text-text-muted space-y-1">
            <div>
              Soil buffer = {num(row.aws_100cm_mm, 1)} mm ÷ {num(row.soil_aws_p95_mm, 1)} mm (95th pct in this state-year) ={' '}
              <span className="text-on-surface">{f3(row.soil_buffer_norm)}</span>
            </div>
            <div>
              Net urgency = {f3(row.hazard_score)} × (1 − 0.25 × {f3(row.soil_buffer_norm)}) = <span className="text-on-surface">{f3(row.net_urgency)}</span>
            </div>
            <div className="text-on-surface">
              Score = 1 + 9 × {f3(row.net_urgency)} = {unrounded.toFixed(2)} → <b className="text-accent-neon">{score(row.urgency_score)}</b>
            </div>
          </div>
        </section>

        <section className="mt-space-md">
          <div className="font-label-code text-label-code text-accent-neon font-bold uppercase mb-2">2 · Estimated dollar loss</div>
          {row.yield_anomaly_pct == null && (
            <div className="mb-2 font-label-code text-[12px] text-risk-moderate">
              No trend anomaly is published for this county-year, so the model counts no loss.
            </div>
          )}
          <div className="p-3 rounded-lg bg-surface-container-lowest font-label-code text-[12px] text-text-muted space-y-1">
            <div>
              Trend yield = {num(row.yield_per_acre, 1)} ÷ (1 + {num(row.yield_anomaly_pct, 2)}%) = <span className="text-on-surface">{num(row.trend_yield, 1)} bu/ac</span>
            </div>
            <div>
              Deficit = {row.yield_anomaly_pct < 0 ? `${num(row.trend_yield, 1)} − ${num(row.yield_per_acre, 1)}` : 'above trend → 0'} ={' '}
              <span className="text-on-surface">{num(row.bushel_deficit_per_acre, 1)} bu/ac</span>
            </div>
            <div>
              Bushels lost = {num(row.bushel_deficit_per_acre, 1)} × {num(acres)} harvested acres = <span className="text-on-surface">{num(row.total_bushels_lost)}</span>
            </div>
            <div className="text-on-surface">
              Dollar loss = {num(row.total_bushels_lost)} × ${price.toFixed(2)}/bu = <b className="text-error">{usd(row.estimated_dollar_loss)}</b>
            </div>
          </div>
        </section>

        <section className="mt-space-md">
          <div className="font-label-code text-label-code text-accent-neon font-bold uppercase mb-2">
            3 · Relief check ({TIERS[row.tier].name} · {TIERS[row.tier].label})
          </div>
          <div className="p-3 rounded-lg bg-surface-container-lowest font-label-code text-[12px] text-on-surface">{relief}</div>
        </section>

        <p className="mt-space-md font-micro text-micro text-text-muted">
          Source: src/priority_model.py. These are the same values the Streamlit app and the CSV export use.
        </p>

        <div className="mt-space-md flex justify-end">
          <button
            className="py-2 px-4 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-body-sm font-bold hover:bg-accent-hover transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
