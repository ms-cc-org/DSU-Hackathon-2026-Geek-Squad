import CountyMap from './CountyMap.jsx';
import { BigStat, Card, Section } from './Status.jsx';
import { TIERS, pct, plural, score, signedPct, usd, usdShort } from '../lib/format.js';

export default function AnswerSection({ ctx, ranking, geo, activeFips, onOpenCounty }) {
  const s = ranking.summary;
  const dq = s.data_quality;
  const tier1 = ranking.rows.filter((r) => r.tier === 1);
  const checks = tier1.map((r) => r.recommended_relief_usd);
  const maxCheck = Math.max(...checks);
  const withAnomaly = tier1.filter((r) => r.yield_anomaly_pct != null);
  const realLosses = withAnomaly.filter((r) => r.yield_anomaly_pct <= s.severe_threshold_pct).length;

  return (
    <Section
      id="answer"
      step="2"
      title={`The answer for ${ctx.year}`}
      takeaway={
        s.total_counties < 10
          ? `Only ${plural(s.total_counties, 'county')} reported a yield, too few to rank with confidence. Treat this as illustration only.`
          : `Send the $${ctx.budgetM}M to these ${s.tier1_count} counties. Each gets a share sized to its estimated crop loss.`
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-md">
        <BigStat label="Counties funded" value={`${s.tier1_count} of ${s.total_counties}`} valueClass="text-risk-severe" sub={`the top ${ctx.quotaPct}% by urgency score`} />
        <BigStat label="Relief trigger this year" value={`Score ≥ ${score(s.tier1_min_score)}`} sub="urgency score, on a 1–10 scale" />
        <BigStat
          label="Their estimated crop loss"
          value={usdShort(s.tier1_total_loss)}
          valueClass="text-error"
          sub={
            s.tier1_coverage == null
              ? 'no losses below trend'
              : s.tier1_coverage > 1
                ? `the fund is ${s.tier1_coverage.toFixed(1)}× this: more than needed`
                : `the fund covers ${pct(s.tier1_coverage * 100)} of it`
          }
        />
        <BigStat label="Check size" value={checks.length === 1 ? usdShort(maxCheck) : `${usdShort(Math.min(...checks))}–${usdShort(maxCheck)}`} valueClass="text-accent-neon" sub={`average ${usdShort(s.avg_aid_per_county)}`} />
      </div>

      {withAnomaly.length > 0 && (
        <div className="mb-space-md rounded-xl px-space-md py-3 bg-accent-neon/10 border border-accent-neon/30 font-body-md text-body-md text-on-surface">
          <b className="text-accent-neon">Hindsight check:</b> {realLosses} of these {plural(withAnomaly.length, 'county')} really did lose ≥{' '}
          {Math.abs(s.severe_threshold_pct)}% of their harvest. Statewide, {s.severe_counties} of {s.total_counties} counties did.
          {ctx.year >= 2016 && ' This season was not used to build the model.'}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-start">
        <div className="xl:col-span-7">
          <CountyMap ctx={ctx} rows={ranking.rows} geo={geo} activeFips={activeFips} onSelect={onOpenCounty} />
          <p className="mt-2 font-body-sm text-body-sm text-text-muted">
            {dq.reported} of {dq.county_rows} {ctx.stateLabel} counties have a reported {ctx.crop.toLowerCase()} yield for {ctx.year}.
            {dq.not_reported + dq.suppressed > 0 &&
              ` The other ${dq.not_reported + dq.suppressed} (${dq.not_reported} not published by NASS${dq.suppressed ? `, ${dq.suppressed} suppressed` : ''}) are shown dark and left out.`}
            {s.total_counties < 10 && ' ⚠ Too few counties to rank reliably; Iowa and Nebraska have the fullest records.'}
          </p>
        </div>

        <Card className="xl:col-span-5">
          <div className="flex items-baseline justify-between pb-2 border-b border-surface-container-highest">
            <span className="font-eyebrow text-eyebrow uppercase text-primary-fixed">Relief checks</span>
            <span className="font-label-code text-label-code text-text-muted">click a county for its report card</span>
          </div>
          <ol className="divide-y divide-surface-container-highest/60">
            {tier1.map((r) => (
              <li key={r.fips}>
                <button
                  onClick={() => onOpenCounty(r.fips)}
                  className={`w-full grid grid-cols-[1.5rem_1fr_auto] items-center gap-x-3 py-2 text-left hover:bg-surface-container-high/50 rounded ${
                    r.fips === activeFips ? 'bg-surface-container-high/60' : ''
                  }`}
                >
                  <span className="font-label-code text-label-code text-text-muted text-right">{r.rank}</span>
                  <span>
                    <span className="font-body-md text-body-md text-primary font-bold">{r.county_name}</span>
                    <span className="block font-label-code text-[11px] text-text-muted">
                      score {score(r.urgency_score)} · harvest {signedPct(r.yield_anomaly_pct)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="font-label-code text-[13px] text-accent-neon font-bold">{usd(r.recommended_relief_usd)}</span>
                    <span className="block w-24 h-1.5 mt-1 ml-auto bg-surface-container-lowest rounded-full overflow-hidden">
                      <span className="block h-full bg-accent-neon rounded-full" style={{ width: `${(r.recommended_relief_usd / maxCheck) * 100}%` }} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="pt-2 border-t border-surface-container-highest flex justify-between font-label-code text-label-code">
            <span className="text-text-muted">Total</span>
            <span className="text-accent-neon font-bold">{usd(s.allocated_total)}</span>
          </div>
          <p className="mt-2 font-body-sm text-body-sm text-text-muted">
            Check = fund × (county's loss ÷ all {TIERS[1].name} losses).
            {s.allocation_basis !== 'dollar_loss' && ' No funded county lost money this year, so the fund is split by urgency × acres.'}
          </p>
        </Card>
      </div>
    </Section>
  );
}
