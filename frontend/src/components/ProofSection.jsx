import Icon from './Icon.jsx';
import { Card, Section, StatusPanel } from './Status.jsx';
import { CHART, MIN_TEST_PICKS, joinAnd, num, pct } from '../lib/format.js';

const SHORT = {
  model: 'Our urgency score',
  dsci: 'Drought Monitor alone',
  rain: 'Rainfall deficit alone',
  random: 'Random picks',
};

export default function ProofSection({ ctx, validation }) {
  const d = validation.data;
  if (validation.error) return <StatusPanel tone="error" title="The blind test failed" detail={validation.error} />;
  if (!d) return <StatusPanel title="Running the 2016–2025 blind test…" />;

  const [tr0, tr1] = d.train_years;
  const [te0, te1] = d.test_years;

  if (!d.ok) {
    return (
      <Section id="proof" step="4" title="Does it work?" takeaway={`We can't test this fairly for ${ctx.stateLabel} ${ctx.crop.toLowerCase()}, and we say so.`}>
        <StatusPanel
          inline
          detail={`NASS published too few ${te0}–${te1} county yields or trend values for this state and crop to score a blind test (see data/data_dictionary.md). Switch to Iowa or Nebraska corn or soybeans for the full test.`}
          title="Not enough reported yields"
        />
      </Section>
    );
  }

  const s = d.summary;
  const model = d.strategies.find((x) => x.id === 'model').precision_pct;
  const random = d.strategies.find((x) => x.id === 'random').precision_pct;
  const max = Math.max(...d.strategies.map((x) => x.precision_pct));
  const hits = { model: s.model_hits, dsci: s.dsci_hits, rain: s.rain_hits, random: s.random_hits };
  const disasterYears = d.table.filter((r) => r.actual_severe_counties > 0);
  const missedByAll = disasterYears.filter((r) => r.model_urgency_hits + r.rain_deficit_hits + r.pure_dsci_hits === 0).map((r) => r.year);
  const beatsRain = s.model_hits > s.rain_hits;
  const tooFew = s.total_aid_allocations < MIN_TEST_PICKS;
  const takeaway = tooFew
    ? `Too little data to judge for ${ctx.stateLabel} ${ctx.crop.toLowerCase()}: only ${s.total_aid_allocations} picks across ${te0}–${te1}. The numbers below are not proof either way.`
    : `Tested blind on ${te0}–${te1}: ${pct(model)} of our picks were real disasters. That is ${(model / random).toFixed(1)}× better than chance${
        beatsRain ? ` and ${s.model_lift_vs_rain}× better than rainfall` : ', but no better than rainfall alone'
      }.`;

  return (
    <Section
      id="proof"
      step="4"
      title="Does it work?"
      takeaway={takeaway}
    >
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-start">
        <Card className="xl:col-span-5">
          <div className="font-eyebrow text-eyebrow uppercase text-primary-fixed">How often each method's picks were real disasters</div>
          <div className="mt-space-md space-y-3">
            {d.strategies.map((x) => (
              <div key={x.id}>
                <div className="flex justify-between font-body-sm text-body-sm mb-1">
                  <span className={x.id === 'model' ? 'text-primary font-bold' : 'text-on-surface-variant'}>{SHORT[x.id]}</span>
                  <span className="font-label-code text-label-code text-primary font-bold">
                    {pct(x.precision_pct)}{' '}
                    <span className="text-text-muted font-normal">({x.id === 'random' ? `${num(hits[x.id], 1)} expected` : `${hits[x.id]} hits`})</span>
                  </span>
                </div>
                <div className="w-full bg-surface-container-lowest h-3 rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(x.precision_pct / max) * 100}%`, background: x.id === 'model' ? CHART.accent : CHART.muted }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-space-md font-body-sm text-body-sm text-text-muted">
            Rules fixed on {tr0}–{tr1}, never adjusted after. Each test year, every method funds its top {ctx.quotaPct}% of counties. A pick is a hit if
            that county's harvest came in ≥ {Math.abs(d.severe_threshold_pct)}% below trend. {s.total_aid_allocations} picks across years with at least one
            disaster ({s.total_disaster_events} disaster counties in all).
          </p>
        </Card>

        <Card className="xl:col-span-7">
          <div className="font-eyebrow text-eyebrow uppercase text-primary-fixed">Season by season (never seen during design)</div>
          <div className="w-full overflow-x-auto mt-space-sm">
            <table className="w-full border-collapse font-label-code text-label-code text-right">
              <thead>
                <tr className="text-text-muted">
                  <th className="py-1.5 pr-2 text-left font-normal" />
                  {d.table.map((r) => (
                    <th key={r.year} className="py-1.5 px-1.5 font-bold text-primary">
                      {r.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label="Real disasters" cells={d.table.map((r) => r.actual_severe_counties)} cls="text-error" />
                <Row
                  label="Our score caught"
                  cells={d.table.map((r) => r.model_urgency_hits)}
                  highlight={d.table.map((r) => r.actual_severe_counties > 0 && r.model_urgency_hits >= Math.max(r.rain_deficit_hits, r.pure_dsci_hits) && r.model_urgency_hits > 0)}
                  cls="text-on-surface"
                />
                <Row label="Rainfall caught" cells={d.table.map((r) => r.rain_deficit_hits)} cls="text-text-muted" />
                <Row label="Drought Monitor caught" cells={d.table.map((r) => r.pure_dsci_hits)} cls="text-text-muted" />
                <Row label="Counties funded" cells={d.table.map((r) => r.tier1_quota_k)} cls="text-text-muted" />
              </tbody>
            </table>
          </div>
          <p className="mt-1 font-micro text-micro text-text-muted">Green = our score caught the most (or tied) that season.</p>
          {missedByAll.length > 0 && (
            <div className="mt-space-sm flex gap-2 rounded-lg p-3 bg-risk-moderate/10 border border-risk-moderate/30 font-body-sm text-body-sm text-on-surface">
              <Icon name="info" className="text-[18px] text-risk-moderate shrink-0" />
              <span>
                <b>An honest miss:</b> in {joinAnd(missedByAll)} none of the three methods caught any of the losses. The counties that lost
                harvest were not among the most drought-stressed that year, so the losses likely had other causes (wet fields, wind, disease). A drought signal can't
                see those, and a drought fund isn't meant to cover them.
              </span>
            </div>
          )}
        </Card>
      </div>
    </Section>
  );
}

function Row({ label, cells, cls, highlight }) {
  return (
    <tr className="border-t border-surface-container-highest/60">
      <td className="py-1.5 pr-2 text-left text-on-surface-variant whitespace-nowrap font-body-sm text-body-sm">{label}</td>
      {cells.map((v, i) => (
        <td key={i} className={`py-1.5 px-1.5 ${highlight?.[i] ? 'text-accent-neon font-bold' : cls}`}>
          {v}
        </td>
      ))}
    </tr>
  );
}
