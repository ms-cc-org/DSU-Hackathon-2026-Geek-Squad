import Icon from './Icon.jsx';
import { StatCard } from './Status.jsx';
import { signedPct, usd, usdShort } from '../lib/format.js';

// The four st.metric cards from Tab 1 of app.py, same definitions.
export default function KpiBar({ summary, ctx }) {
  const s = summary;
  return (
    <div className="w-full px-gutter py-space-md">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <StatCard
          eyebrow="Counties Analyzed"
          badge={<span className="font-label-code text-label-code text-primary-fixed">{ctx.crop} • {ctx.year}</span>}
          value={s.total_counties}
          caption={`${ctx.stateLabel} counties with a reported ${ctx.crop.toLowerCase()} yield`}
          footer={`${s.severe_counties} of them had a severe loss (yield ≤ ${s.severe_threshold_pct}% vs trend)`}
        />
        <StatCard
          eyebrow="High Priority Aid (Tier 1)"
          badge={<span className="px-1.5 py-0.5 rounded bg-risk-severe/20 text-risk-severe font-label-code text-label-code font-bold">TOP {ctx.quotaPct}%</span>}
          value={`${s.tier1_count} counties`}
          valueClass="text-risk-severe"
          caption={`Tier 2 monitoring: ${s.tier2_count} • Tier 3 resilient: ${s.tier3_count}`}
          bar={(s.tier1_count / s.total_counties) * 100}
        />
        <StatCard
          eyebrow="Statewide Crop Loss ($)"
          value={s.total_loss > 0 ? usdShort(s.total_loss) : '$0'}
          valueClass="text-error"
          note={s.avg_tier1_loss_pct != null ? `${signedPct(s.avg_tier1_loss_pct)} avg Tier 1 anomaly` : null}
          noteClass="text-error"
          caption={s.total_loss > 0 ? usd(s.total_loss) : 'No county yielded below trend'}
          footer={`Bushels below trend × harvested acres × $${ctx.priceLabel}/bu`}
        />
        <StatCard
          eyebrow="Avg Relief per Priority County"
          badge={<Icon name="payments" className="text-[16px] text-accent-neon" />}
          value={s.avg_aid_per_county > 0 ? usdShort(s.avg_aid_per_county) : '$0'}
          valueClass="text-accent-neon"
          caption={s.avg_aid_per_county > 0 ? usd(s.avg_aid_per_county) : null}
          footer={`$${ctx.budgetM}M fund ÷ ${s.tier1_count} Tier 1 counties, weighted by ${
            s.allocation_basis === 'dollar_loss' ? 'dollar loss' : 'urgency × acres (no losses this year)'
          }`}
        />
      </div>
    </div>
  );
}

export function EstimatorBanner({ onOpen, summary, ctx }) {
  return (
    <div className="w-full px-gutter pb-space-xs">
      <div className="w-full bg-gradient-to-r from-surface-container-high via-surface-container-low to-surface-container-high border border-primary-container/30 rounded-xl p-space-md flex flex-col md:flex-row items-center justify-between gap-space-md shadow-lg">
        <div className="flex items-center gap-space-md">
          <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(167,245,90,0.2)]">
            <Icon name="calculate" className="text-accent-neon text-[22px]" />
          </div>
          <div>
            <h4 className="font-headline-sm text-headline-sm text-primary tracking-tight">Relief Allocation Ledger</h4>
            <p className="font-body-sm text-body-sm text-text-muted mt-0.5">
              See how the ${ctx.budgetM}M fund splits across the {summary.tier1_count} Tier 1 counties, and how Tier 1 size,
              check sizes and coverage change with the quota.
            </p>
          </div>
        </div>
        <button
          className="shrink-0 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-body-sm font-bold hover:bg-accent-hover transition-all flex items-center gap-2 shadow-md"
          onClick={onOpen}
        >
          <Icon name="arrow_forward" className="text-[18px]" />
          <span>Open Relief Allocation</span>
        </button>
      </div>
    </div>
  );
}
