import { Panel, StatusPanel } from './Status.jsx';
import { apiUrl, useApi } from '../lib/api.js';
import { pct, usd, usdShort } from '../lib/format.js';

// Re-runs allocate_relief_budget for every quota on the slider (server side) so the trade-off is visible.
export default function QuotaSimulator({ ctx, onQuotaChange }) {
  const { stateCode: state, crop, year, budgetM, sortBy: sort } = ctx;
  const sweep = useApi(apiUrl('quota-sweep', { state, crop, year, budget: budgetM * 1e6, sort }));

  if (sweep.error) return <StatusPanel tone="error" title="Quota simulation failed" detail={sweep.error} />;
  const rows = sweep.data?.sweep ?? [];

  return (
    <Panel
      title="Tier 1 Quota Simulator"
      subtitle={`Same $${budgetM}M fund, different Tier 1 sizes. A wider quota reaches more counties but shrinks each check. Click a row to apply it.`}
    >
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-text-muted font-micro text-micro uppercase tracking-wider border-b border-surface-container-highest">
              <th className="py-2.5 px-3">Quota</th>
              <th className="py-2.5 px-3 text-right">Tier 1 Counties</th>
              <th className="py-2.5 px-3 text-right">Of Which Severe Loss (≤ −10%)</th>
              <th className="py-2.5 px-3 text-right">Tier 1 Dollar Loss</th>
              <th className="py-2.5 px-3 text-right">Fund Covers</th>
              <th className="py-2.5 px-3 text-right">Average Check</th>
              <th className="py-2.5 px-3 text-right">Smallest – Largest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-highest/50 font-label-code text-label-code">
            {rows.map((r) => {
              const active = r.quota_pct === ctx.quotaPct;
              return (
                <tr
                  key={r.quota_pct}
                  onClick={() => onQuotaChange(r.quota_pct)}
                  className={`cursor-pointer hover:bg-surface-container-high/40 ${active ? 'bg-surface-container-high/60 ring-1 ring-inset ring-accent-neon/30' : ''}`}
                >
                  <td className="py-2 px-3 text-primary font-bold">
                    Top {r.quota_pct}% {active && <span className="ml-1 text-accent-neon">(current)</span>}
                  </td>
                  <td className="py-2 px-3 text-right text-on-surface">{r.tier1_count}</td>
                  <td className="py-2 px-3 text-right text-on-surface">
                    {r.tier1_severe_hits} <span className="text-text-muted">({pct((r.tier1_severe_hits / r.tier1_count) * 100, 0)})</span>
                  </td>
                  <td className="py-2 px-3 text-right text-on-surface">{usd(r.tier1_total_loss)}</td>
                  <td className="py-2 px-3 text-right text-on-surface">{r.tier1_coverage != null ? pct(Math.min(100, r.tier1_coverage * 100)) : '—'}</td>
                  <td className="py-2 px-3 text-right text-accent-neon font-bold">{usd(r.avg_aid_per_county)}</td>
                  <td className="py-2 px-3 text-right text-on-surface">
                    {usdShort(r.min_check)} – {usdShort(r.max_check)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!sweep.data && <div className="py-4 font-label-code text-label-code text-text-muted">Running quota sweep…</div>}
      </div>
    </Panel>
  );
}
