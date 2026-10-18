import { useState } from 'react';
import KpiBar, { EstimatorBanner } from './KpiBar.jsx';
import CountyMap from './CountyMap.jsx';
import DiagnosticCard from './DiagnosticCard.jsx';
import PriorityTable from './PriorityTable.jsx';
import RationaleModal from './RationaleModal.jsx';
import { StatusPanel } from './Status.jsx';

export default function GeospatialView({ ctx, ranking, geo, activeFips, onSelect, onOpenAssistance, onOpenReport, csvUrl, showToast }) {
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const data = ranking.data;

  if (ranking.error) return <StatusPanel tone="error" title="Ranking failed" detail={ranking.error} />;
  if (!data) return <StatusPanel title="Running priority model…" />;
  if (data.empty) {
    return (
      <StatusPanel
        tone="warning"
        title={`No reported crop yield data available for ${ctx.stateLabel} ${ctx.crop} in ${ctx.year}.`}
        detail="Pick another year or crop. NASS does not publish county yields for every state, crop and season."
      />
    );
  }

  const fullCtx = { ...ctx, priceLabel: data.price_per_bushel.toFixed(2) };
  const active = data.rows.find((r) => r.fips === activeFips) ?? data.rows[0];

  const inspectFromTable = (fips) => {
    onSelect(fips);
    document.getElementById('diagnostic-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="flex flex-col w-full relative">
      <div className="absolute top-12 left-1/4 w-[480px] h-[320px] rounded-full bg-secondary-container opacity-20 blur-[110px] pointer-events-none -z-10" />
      <div className="absolute top-96 right-10 w-[540px] h-[380px] rounded-full bg-surface-panel-start opacity-30 blur-[130px] pointer-events-none -z-10" />

      <KpiBar summary={data.summary} ctx={fullCtx} />
      <EstimatorBanner onOpen={onOpenAssistance} summary={data.summary} ctx={fullCtx} />

      <div className="w-full px-gutter py-space-sm">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-start">
          <CountyMap ctx={fullCtx} rows={data.rows} geo={geo} activeFips={active.fips} onSelect={onSelect} />
          <DiagnosticCard
            row={active}
            total={data.rows.length}
            ctx={fullCtx}
            onOpenRationale={() => setRationaleOpen(true)}
            onOpenReport={() => onOpenReport(active.fips)}
          />
        </div>
      </div>

      <PriorityTable ctx={fullCtx} rows={data.rows} activeFips={active.fips} onInspect={inspectFromTable} csvUrl={csvUrl} showToast={showToast} />
      <RationaleModal open={rationaleOpen} row={active} ranking={data} onClose={() => setRationaleOpen(false)} />
    </div>
  );
}
