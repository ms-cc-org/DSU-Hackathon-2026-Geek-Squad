import { useState } from 'react';
import Icon from './Icon.jsx';
import { Card, Section } from './Status.jsx';
import { TIERS, num, score, signedPct, usd, usdShort } from '../lib/format.js';

export default function LimitsSection({ ctx, ranking, csvUrl, onOpenCounty }) {
  const [showAll, setShowAll] = useState(false);
  const s = ranking.summary;
  const dq = s.data_quality;
  // The biggest loss the drought score chose not to fund: the clearest example of its limit.
  const unfunded = ranking.rows.filter((r) => r.tier !== 1 && r.estimated_dollar_loss > 0).sort((a, b) => b.estimated_dollar_loss - a.estimated_dollar_loss)[0];

  const limits = [
    unfunded && {
      icon: 'thunderstorm',
      text: (
        <>
          <b>It only sees drought.</b> {unfunded.county_name} lost {usdShort(unfunded.estimated_dollar_loss)} in {ctx.year} but scored only{' '}
          {score(unfunded.urgency_score)} (rank #{unfunded.rank}). Its heat and drought readings were mild, so whatever cut its harvest (wind, flooding, hail) is a
          job for crop insurance, not this fund.
        </>
      ),
    },
    { icon: 'grid_view', text: <><b>County averages only.</b> Nothing is at the field level, and nothing comes after 2025.</> },
    {
      icon: 'water_drop',
      text: (
        <>
          <b>Irrigation isn't modeled.</b> Irrigated fields shrug off drought, so scores are less reliable where irrigation is common (much of Nebraska, nearly all of
          California).
        </>
      ),
    },
    {
      icon: 'payments',
      text: (
        <>
          <b>Dollar losses are estimates:</b> bushels below the county's trend × harvested acres × a fixed USDA average price (${ranking.price_per_bushel.toFixed(2)}/bu
          for {ctx.crop.toLowerCase()}).
        </>
      ),
    },
    {
      icon: 'event',
      text: (
        <>
          <b>Validated after the fact.</b> The test uses each season's final weather. Running it live on August 15 would see only part of the season.
        </>
      ),
    },
  ].filter(Boolean);

  const handling = [
    `Only counties with a reported yield are ranked: ${dq.reported} of ${dq.county_rows} for ${ctx.stateLabel} ${ctx.crop.toLowerCase()} ${ctx.year}. Excluded: ${dq.not_reported} not published by NASS, ${dq.suppressed} suppressed (planted but not harvested).`,
    dq.no_trend_anomaly > 0
      ? `${dq.no_trend_anomaly} ranked counties have no trend value, so the model counts no dollar loss for them rather than guessing.`
      : 'Every ranked county has a trend value, so every dollar loss is measured, not guessed.',
    `Missing heat readings count as 0 heat days (${dq.missing_heat} this year). Missing soil data gets a typical 150 mm (${dq.missing_soil} this year).`,
    'County IDs (FIPS) are kept as text, so codes like 06001 never lose their leading zero and joins never silently fail.',
    "Weather and drought are measured over the crop's growing season (corn: May–September), not the calendar year.",
  ];

  return (
    <Section
      id="limits"
      step="6"
      title="Limits & data"
      takeaway="What this tool can't tell you, and how we handled gaps in the data."
      right={
        <a
          href={csvUrl}
          download
          className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-body-sm font-bold hover:bg-accent-hover flex items-center gap-1.5"
        >
          <Icon name="file_download" className="text-[18px]" />
          Download full ranking (CSV)
        </a>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
        <Card>
          <div className="font-eyebrow text-eyebrow uppercase text-risk-moderate mb-2">What it can't do</div>
          <ul className="space-y-2.5 font-body-sm text-body-sm text-on-surface">
            {limits.map((l, i) => (
              <li key={i} className="flex gap-2">
                <Icon name={l.icon} className="text-[18px] text-risk-moderate shrink-0" />
                <span>{l.text}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="font-eyebrow text-eyebrow uppercase text-primary-fixed mb-2">How we handled the data</div>
          <ul className="space-y-2.5 font-body-sm text-body-sm text-on-surface">
            {handling.map((t, i) => (
              <li key={i} className="flex gap-2">
                <Icon name="check_circle" className="text-[18px] text-risk-low shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-space-md">
        <button onClick={() => setShowAll((v) => !v)} className="w-full flex items-center justify-between font-headline-sm text-title-md text-primary">
          <span>
            All {ranking.rows.length} counties, ranked{' '}
            <span className="font-body-sm text-body-sm text-text-muted font-normal">
              ({s.tier1_count} get relief · {s.tier2_count} watch list · {s.tier3_count} lower risk)
            </span>
          </span>
          <Icon name={showAll ? 'expand_less' : 'expand_more'} className="text-[22px] text-accent-neon" />
        </button>
        {showAll && (
          <div className="w-full overflow-x-auto max-h-[480px] overflow-y-auto mt-space-sm">
            <table className="w-full border-collapse font-label-code text-label-code">
              <thead className="sticky top-0 bg-surface-container">
                <tr className="text-text-muted font-micro text-micro uppercase tracking-wider border-b border-surface-container-highest">
                  <th className="py-2 px-2 text-right">#</th>
                  <th className="py-2 px-2 text-left">County</th>
                  <th className="py-2 px-2 text-right">Score</th>
                  <th className="py-2 px-2 text-left">Decision</th>
                  <th className="py-2 px-2 text-right">Relief</th>
                  <th className="py-2 px-2 text-right">Est. loss</th>
                  <th className="py-2 px-2 text-right">Harvest vs trend</th>
                  <th className="py-2 px-2 text-right">Heat days</th>
                  <th className="py-2 px-2 text-right">D2+ weeks</th>
                  <th className="py-2 px-2 text-right">Soil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-highest/50 text-on-surface">
                {ranking.rows.map((r) => (
                  <tr key={r.fips} onClick={() => onOpenCounty(r.fips)} className="cursor-pointer hover:bg-surface-container-high/40">
                    <td className="py-1.5 px-2 text-right text-text-muted">{r.rank}</td>
                    <td className="py-1.5 px-2 font-body-sm text-body-sm text-primary">
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: TIERS[r.tier].color }} />
                      {r.county_name}
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold">{score(r.urgency_score)}</td>
                    <td className="py-1.5 px-2 text-on-surface-variant">{r.tier === 1 ? 'Gets relief' : r.tier === 2 ? 'Watch list' : 'Lower risk'}</td>
                    <td className={`py-1.5 px-2 text-right ${r.recommended_relief_usd > 0 ? 'text-accent-neon font-bold' : 'text-text-muted'}`}>
                      {usd(r.recommended_relief_usd)}
                    </td>
                    <td className="py-1.5 px-2 text-right">{usd(r.estimated_dollar_loss)}</td>
                    <td className={`py-1.5 px-2 text-right ${r.yield_anomaly_pct < 0 ? 'text-error' : 'text-risk-low'}`}>{signedPct(r.yield_anomaly_pct)}</td>
                    <td className="py-1.5 px-2 text-right">{num(r.extreme_heat_days)}</td>
                    <td className="py-1.5 px-2 text-right">{num(r.weeks_in_d2_plus)}</td>
                    <td className="py-1.5 px-2 text-right">{num(r.aws_100cm_mm)} mm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Section>
  );
}
