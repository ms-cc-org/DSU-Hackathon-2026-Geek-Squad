import { useState } from 'react';
import Icon from './Icon.jsx';
import { SORT_OPTIONS, TIERS, num, score, signedPct, usd } from '../lib/format.js';

const TIER_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 1, label: 'Tier 1' },
  { id: 2, label: 'Tier 2' },
  { id: 3, label: 'Tier 3' },
];

// Same columns as the Streamlit "County Relief Action Ranking" table.
export default function PriorityTable({ ctx, rows, activeFips, onInspect, csvUrl, showToast }) {
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState('all');
  const sortLabel = SORT_OPTIONS.find((o) => o.id === ctx.sortBy)?.label;

  const shown = rows.filter(
    (r) => (r.county_name.toLowerCase().includes(query.toLowerCase()) || r.fips.includes(query)) && (tier === 'all' || r.tier === tier),
  );

  return (
    <div className="w-full px-gutter py-space-md mb-space-lg">
      <div className="w-full bg-surface-container/90 backdrop-blur-xl rounded-xl p-space-md lg:p-space-lg shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md pb-space-md">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-primary tracking-tight">County Relief Action Ranking</h3>
            <p className="font-body-sm text-body-sm text-text-muted mt-0.5">
              Ranked by <b className="text-on-surface">{sortLabel}</b>. The ${ctx.budgetM}M fund goes to Tier 1 counties in
              proportion to their dollar loss. Click a row to load it into the county card.
            </p>
          </div>
          <div className="flex items-center gap-space-sm flex-wrap">
            <div className="relative">
              <Icon name="filter_list" className="absolute left-2.5 top-2 text-[18px] text-text-muted" />
              <input
                className="bg-surface-container-low border-0 pl-8 pr-3 py-1.5 rounded-lg text-body-sm font-body-sm text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-0 focus:bg-surface-container-high transition-colors w-48"
                placeholder="Filter county or FIPS..."
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-lg">
              {TIER_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTier(f.id)}
                  className={`px-2.5 py-1 rounded font-label-code text-label-code ${
                    tier === f.id ? 'bg-secondary-container text-primary-fixed' : 'text-text-muted hover:text-on-surface'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <a
              href={csvUrl}
              download
              onClick={() => showToast('Ledger exported', `${ctx.stateCode}_${ctx.crop}_${ctx.year}_relief_priorities.csv`)}
              className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-label-code text-label-code font-bold hover:bg-accent-hover flex items-center gap-1"
            >
              <Icon name="file_download" className="text-[16px]" />
              CSV
            </a>
          </div>
        </div>

        <div className="w-full overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-left border-collapse" id="counties-priority-table">
            <thead className="sticky top-0 bg-surface-container z-10">
              <tr className="text-text-muted font-micro text-micro uppercase tracking-wider border-b border-surface-container-highest">
                <th className="py-3 px-3 text-right">Rank</th>
                <th className="py-3 px-3">County &amp; FIPS</th>
                <th className="py-3 px-3">Urgency (1-10)</th>
                <th className="py-3 px-3">Action Tier</th>
                <th className="py-3 px-3 text-right">Allocated Relief</th>
                <th className="py-3 px-3 text-right">Est. Dollar Loss</th>
                <th className="py-3 px-3 text-right">Yield Anomaly</th>
                <th className="py-3 px-3 text-right">Heat Days</th>
                <th className="py-3 px-3 text-right">D2+ Weeks</th>
                <th className="py-3 px-3 text-right">Soil Sponge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-highest/50 font-body-sm text-body-sm">
              {shown.map((r) => {
                const t = TIERS[r.tier];
                const isActive = r.fips === activeFips;
                return (
                  <tr
                    key={r.fips}
                    onClick={() => onInspect(r.fips)}
                    className={`hover:bg-surface-container-high/40 transition-colors cursor-pointer ${
                      isActive ? 'bg-surface-container-high/60 ring-1 ring-inset ring-accent-neon/30' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-right font-label-code text-label-code text-text-muted">{r.rank}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2 text-primary font-bold">
                        <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                        {r.county_name}
                      </div>
                      <span className="font-label-code text-[11px] text-text-muted ml-4">{r.fips}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-label-code text-label-code text-primary font-bold w-7">{score(r.urgency_score)}</span>
                        <div className="w-20 bg-surface-container-lowest h-2 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${((r.urgency_score - 1) / 9) * 100}%`, background: t.color }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded font-label-code text-label-code font-bold whitespace-nowrap ${t.badge}`}>
                        {t.name} · {t.label}
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 text-right font-label-code text-label-code ${r.recommended_relief_usd > 0 ? 'text-accent-neon font-bold' : 'text-text-muted'}`}>
                      {usd(r.recommended_relief_usd)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-label-code text-label-code text-on-surface">{usd(r.estimated_dollar_loss)}</td>
                    <td className={`py-2.5 px-3 text-right font-label-code text-label-code ${r.yield_anomaly_pct < 0 ? 'text-error' : 'text-risk-low'}`}>
                      {signedPct(r.yield_anomaly_pct)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-label-code text-label-code text-on-surface">{num(r.extreme_heat_days)}</td>
                    <td className="py-2.5 px-3 text-right font-label-code text-label-code text-on-surface">{num(r.weeks_in_d2_plus)}</td>
                    <td className="py-2.5 px-3 text-right font-label-code text-label-code text-on-surface">{num(r.aws_100cm_mm)} mm</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && <div className="py-6 text-center font-label-code text-label-code text-text-muted">No counties match.</div>}
        </div>
        <div className="pt-2 font-label-code text-[11px] text-text-muted">
          Showing {shown.length} of {rows.length} counties
        </div>
      </div>
    </div>
  );
}
