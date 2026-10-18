import Icon from './Icon.jsx';
import QuotaSimulator from './QuotaSimulator.jsx';
import { Panel, StatCard, StatusPanel } from './Status.jsx';
import { num, pct, signedPct, usd, usdShort } from '../lib/format.js';

export default function AssistanceView({ ctx, ranking, onQuotaChange, onBack, onOpenReport, csvUrl, showToast }) {
  const data = ranking.data;
  if (ranking.error) return <StatusPanel tone="error" title="Ranking failed" detail={ranking.error} />;
  if (!data) return <StatusPanel title="Running priority model…" />;
  if (data.empty) {
    return <StatusPanel tone="warning" title={`No reported crop yield data available for ${ctx.stateLabel} ${ctx.crop} in ${ctx.year}.`} />;
  }

  const s = data.summary;
  const tier1 = data.rows.filter((r) => r.tier === 1);
  const checks = tier1.map((r) => r.recommended_relief_usd);
  const maxCheck = Math.max(...checks);
  const byLoss = s.allocation_basis === 'dollar_loss';

  return (
    <div className="flex flex-col w-full relative">
      <div className="w-full px-gutter pt-space-md">
        <div className="w-full bg-surface-container-low rounded-xl px-space-md py-space-md flex flex-wrap items-center justify-between gap-space-sm shadow-md border border-border-glass">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">Relief Allocation</h2>
            <p className="font-body-md text-body-md text-text-muted mt-1 max-w-3xl">
              {ctx.stateLabel} {ctx.crop.toLowerCase()}, {ctx.year}. The ${ctx.budgetM}M emergency fund is never spread evenly. It goes only to the{' '}
              {s.tier1_count} Tier 1 counties (top {ctx.quotaPct}%), each getting fund × its dollar loss ÷ total Tier 1 loss.
            </p>
          </div>
          <div className="flex items-center gap-space-sm">
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-lg bg-secondary-container text-primary-fixed hover:bg-surface-container-high border border-border-glass font-headline-sm text-body-sm font-bold transition-all flex items-center gap-2 shadow-sm"
            >
              <Icon name="arrow_back" className="text-[18px] text-accent-neon" />
              <span>Back to Ranking</span>
            </button>
            <a
              href={csvUrl}
              download
              onClick={() => showToast('Ledger exported', `${ctx.stateCode}_${ctx.crop}_${ctx.year}_relief_priorities.csv`)}
              className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-body-sm font-bold hover:bg-accent-hover transition-all flex items-center gap-1.5 shadow-md"
            >
              <Icon name="file_download" className="text-[18px]" />
              <span>Export Ledger (CSV)</span>
            </a>
          </div>
        </div>
      </div>

      <div className="w-full px-gutter py-space-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
          <StatCard
            eyebrow="Emergency fund vs Tier 1 losses"
            value={`$${ctx.budgetM}M`}
            note={s.tier1_coverage != null ? `covers ${pct(Math.min(100, s.tier1_coverage * 100))}` : 'no Tier 1 losses'}
            noteClass="text-accent-neon"
            caption={`Tier 1 counties lost ${usd(s.tier1_total_loss)}`}
            bar={s.tier1_coverage != null ? s.tier1_coverage * 100 : 100}
            footer={`Statewide loss across all ${s.total_counties} counties: ${usdShort(s.total_loss)}`}
          />
          <StatCard
            eyebrow="Tier 1 counties funded"
            value={s.tier1_count}
            valueClass="text-risk-severe"
            note={`${signedPct(s.avg_tier1_loss_pct)} avg yield`}
            noteClass="text-error"
            caption={`${num(s.tier1_acres)} harvested acres in Tier 1`}
            footer={`${usdShort(s.tier1_acres > 0 ? (ctx.budgetM * 1e6) / s.tier1_acres : null)} per Tier 1 acre on average`}
          />
          <StatCard
            eyebrow="Check size range"
            value={`${usdShort(Math.min(...checks))} – ${usdShort(maxCheck)}`}
            valueClass="text-accent-neon"
            caption={`Average ${usd(s.avg_aid_per_county)} per county`}
            footer={`Total allocated ${usd(s.allocated_total)} (rounded to cents per county)`}
          />
        </div>
      </div>

      <Panel
        title="Tier 1 Allocation Ledger"
        subtitle={
          byLoss
            ? 'Share = county dollar loss ÷ total Tier 1 dollar loss. Check = share × fund.'
            : 'No Tier 1 county lost money this year, so the model splits the fund by urgency score × harvested acres.'
        }
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-text-muted font-micro text-micro uppercase tracking-wider border-b border-surface-container-highest">
                <th className="py-2.5 px-3 text-right">Rank</th>
                <th className="py-2.5 px-3">County</th>
                <th className="py-2.5 px-3 text-right">Yield Anomaly</th>
                <th className="py-2.5 px-3 text-right">Harvested Acres</th>
                <th className="py-2.5 px-3 text-right">Est. Dollar Loss</th>
                <th className="py-2.5 px-3 text-right">Share</th>
                <th className="py-2.5 px-3">Relief Check</th>
                <th className="py-2.5 px-3 text-right">Per Acre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-highest/50 font-label-code text-label-code">
              {tier1.map((r) => {
                const share = r.recommended_relief_usd / (ctx.budgetM * 1e6);
                const ac = r.acres_harvested ?? r.acres_planted;
                return (
                  <tr key={r.fips} className="hover:bg-surface-container-high/40 cursor-pointer" onClick={() => onOpenReport(r.fips)} title="Open 26-year report card">
                    <td className="py-2 px-3 text-right text-text-muted">{r.rank}</td>
                    <td className="py-2 px-3 font-body-sm text-body-sm text-primary font-bold">{r.county_name}</td>
                    <td className={`py-2 px-3 text-right ${r.yield_anomaly_pct < 0 ? 'text-error' : 'text-risk-low'}`}>{signedPct(r.yield_anomaly_pct)}</td>
                    <td className="py-2 px-3 text-right text-on-surface">{num(ac)}</td>
                    <td className="py-2 px-3 text-right text-on-surface">{usd(r.estimated_dollar_loss)}</td>
                    <td className="py-2 px-3 text-right text-on-surface">{pct(share * 100)}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-28 bg-surface-container-lowest h-2 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-accent-neon" style={{ width: `${(r.recommended_relief_usd / maxCheck) * 100}%` }} />
                        </div>
                        <span className="text-accent-neon font-bold">{usd(r.recommended_relief_usd)}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right text-on-surface">{ac ? `$${(r.recommended_relief_usd / ac).toFixed(2)}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-surface-container-highest font-label-code text-label-code font-bold text-primary">
                <td className="py-2 px-3" colSpan="3">
                  Tier 1 total
                </td>
                <td className="py-2 px-3 text-right">{num(s.tier1_acres)}</td>
                <td className="py-2 px-3 text-right">{usd(s.tier1_total_loss)}</td>
                <td className="py-2 px-3 text-right">100%</td>
                <td className="py-2 px-3 text-accent-neon">{usd(s.allocated_total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <QuotaSimulator ctx={ctx} onQuotaChange={onQuotaChange} />
    </div>
  );
}
