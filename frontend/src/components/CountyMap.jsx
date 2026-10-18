import { useMemo, useRef, useState } from 'react';
import ScatterChart from './ScatterChart.jsx';
import { DIV, SEQ, TIERS, diverging, num, score, sequential, signedPct, usd } from '../lib/format.js';

const W = 760;
const H = 440;
const PAD = 14;

// Map layers: each colors counties by a real column from the ranking.
const LAYERS = [
  {
    id: 'urgency',
    label: 'Urgency Score',
    value: (r) => r.urgency_score,
    fmt: (v) => `${score(v)} / 10`,
    // Stretched over this year's observed range so differences stay visible.
    color: (v, [lo, hi]) => sequential(hi > lo ? (v - lo) / (hi - lo) : 0.5),
    legend: { kind: 'seq', range: true },
  },
  { id: 'tier', label: 'Action Tier', value: (r) => r.tier, fmt: (v) => `${TIERS[v].name} · ${TIERS[v].label}`, color: (v) => TIERS[v].color, legend: { kind: 'tier' } },
  {
    id: 'yield',
    label: 'Yield Anomaly',
    value: (r) => r.yield_anomaly_pct,
    fmt: (v) => signedPct(v),
    color: (v) => diverging(Math.max(-1, Math.min(1, v / 40))),
    legend: { kind: 'div', min: '≤ −40%', mid: '0%', max: '≥ +40%' },
  },
  {
    id: 'heat',
    label: 'Heat Days ≥35°C',
    value: (r) => r.extreme_heat_days,
    fmt: (v) => `${num(v)} days`,
    color: (v) => sequential(v / 15),
    legend: { kind: 'seq', min: '0', max: '15+ days (model cap)' },
  },
  {
    id: 'd2',
    label: 'D2+ Weeks',
    value: (r) => r.weeks_in_d2_plus,
    fmt: (v) => `${num(v)} weeks`,
    color: (v) => sequential(v / 20),
    legend: { kind: 'seq', min: '0', max: '20+ weeks (model cap)' },
  },
];

function useProjection(features) {
  return useMemo(() => {
    if (!features?.length) return null;
    const rings = (g) => (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat());
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    features.forEach((f) =>
      rings(f.geometry).forEach((ring) =>
        ring.forEach(([lon, lat]) => {
          x0 = Math.min(x0, lon);
          x1 = Math.max(x1, lon);
          y0 = Math.min(y0, lat);
          y1 = Math.max(y1, lat);
        }),
      ),
    );
    // Equirectangular with cos(latitude) correction: fine at single-state scale.
    const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
    const s = Math.min((W - 2 * PAD) / ((x1 - x0) * k), (H - 2 * PAD) / (y1 - y0));
    const ox = (W - (x1 - x0) * k * s) / 2;
    const oy = (H - (y1 - y0) * s) / 2;
    const pt = ([lon, lat]) => `${(ox + (lon - x0) * k * s).toFixed(1)},${(oy + (y1 - lat) * s).toFixed(1)}`;
    return features.map((f) => ({
      fips: f.id,
      name: f.properties.county_name,
      d: rings(f.geometry)
        .map((ring) => `M${ring.map(pt).join('L')}Z`)
        .join(''),
    }));
  }, [features]);
}

export default function CountyMap({ ctx, rows, geo, activeFips, onSelect }) {
  const containerRef = useRef(null);
  const [mode, setMode] = useState('map');
  const [layerId, setLayerId] = useState('urgency');
  const [hover, setHover] = useState(null);
  const layer = LAYERS.find((l) => l.id === layerId);
  const shapes = useProjection(geo.data?.features);
  const byFips = useMemo(() => Object.fromEntries(rows.map((r) => [r.fips, r])), [rows]);
  const domain = useMemo(() => {
    const vals = rows.map(layer.value).filter((v) => v != null);
    return [Math.min(...vals), Math.max(...vals)];
  }, [rows, layer]);

  const track = (shape, e) => {
    const rect = containerRef.current.getBoundingClientRect();
    setHover({ shape, x: Math.min(e.clientX - rect.left + 14, rect.width - 230), y: e.clientY - rect.top - 10 });
  };

  const hoveredRow = hover && byFips[hover.shape.fips];
  const ordered = shapes ? [...shapes.filter((s) => s.fips !== activeFips), ...shapes.filter((s) => s.fips === activeFips)] : [];
  const noData = shapes ? shapes.filter((s) => !byFips[s.fips]).length : 0;

  return (
    <div className="xl:col-span-8 bg-surface-container-low/90 backdrop-blur-xl rounded-xl p-space-md lg:p-space-lg shadow-2xl relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pb-space-md">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-headline-sm text-headline-sm text-primary tracking-tight">Spatial &amp; Agronomic Verification</span>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-primary-fixed font-label-code text-label-code">
              {ctx.stateLabel.toUpperCase()} • {ctx.crop} • {ctx.year}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-text-muted mt-0.5">
            {mode === 'map'
              ? 'Hover a county for its numbers; click to load it into the county card.'
              : 'Each dot is a county. Tier 1 (red) should sit low: high urgency scores should line up with real harvest losses.'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-surface-container-lowest p-1 rounded-lg self-start sm:self-auto">
          {[
            ['map', 'County Map'],
            ['scatter', 'Urgency vs Harvest Loss'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`px-3 py-1 rounded font-label-code text-label-code transition-all ${
                mode === id ? 'bg-secondary-container text-primary-fixed' : 'text-text-muted hover:text-on-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'scatter' ? (
        <ScatterChart rows={rows} activeFips={activeFips} onSelect={onSelect} />
      ) : (
        <>
          <div className="flex items-center gap-1.5 pb-space-sm flex-wrap">
            <span className="font-micro text-micro uppercase text-text-muted mr-1">Color by:</span>
            {LAYERS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLayerId(l.id)}
                className={`px-2.5 py-1 rounded font-label-code text-label-code transition-all ${
                  layerId === l.id ? 'bg-secondary-container text-primary-fixed' : 'bg-surface-container-lowest text-text-muted hover:text-on-surface'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div ref={containerRef} className="relative w-full bg-surface-container-lowest/90 rounded-lg overflow-hidden">
            {!shapes ? (
              <div className="h-[440px] flex items-center justify-center font-label-code text-label-code text-text-muted">
                {geo.error ? `County boundaries failed to load: ${geo.error}` : 'Loading county boundaries…'}
              </div>
            ) : (
              <svg className="w-full h-auto block" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ctx.stateLabel} counties colored by ${layer.label}`}>
                {ordered.map((shape) => {
                  const row = byFips[shape.fips];
                  const v = row ? layer.value(row) : null;
                  const isActive = shape.fips === activeFips;
                  return (
                    <path
                      key={shape.fips}
                      d={shape.d}
                      fill={v == null ? '#0c1f18' : layer.color(v, domain)}
                      stroke={isActive ? '#a7f55a' : '#041710'}
                      strokeWidth={isActive ? 3 : 1}
                      strokeLinejoin="round"
                      className={row ? 'cursor-pointer hover:brightness-125' : ''}
                      onClick={() => row && onSelect(shape.fips)}
                      onMouseEnter={(e) => track(shape, e)}
                      onMouseMove={(e) => track(shape, e)}
                      onMouseLeave={() => setHover(null)}
                    />
                  );
                })}
              </svg>
            )}

            {hover && (
              <div
                className="absolute pointer-events-none bg-surface-container-highest/95 backdrop-blur-md px-3 py-2 rounded-lg shadow-2xl z-20 min-w-[200px]"
                style={{ left: hover.x, top: hover.y }}
              >
                <span className="font-headline-sm text-[13px] text-primary block font-bold leading-tight">
                  {hover.shape.name} <span className="font-label-code text-[10px] text-text-muted">{hover.shape.fips}</span>
                </span>
                {hoveredRow ? (
                  <div className="font-label-code text-[11px] text-on-surface-variant mt-1 space-y-0.5">
                    <div>
                      {layer.label}: <b className="text-primary">{layer.fmt(layer.value(hoveredRow))}</b>
                    </div>
                    <div>Rank #{hoveredRow.rank} • Score {score(hoveredRow.urgency_score)} • {TIERS[hoveredRow.tier].name}</div>
                    <div>Yield anomaly {signedPct(hoveredRow.yield_anomaly_pct)}</div>
                    <div>Allocated relief {usd(hoveredRow.recommended_relief_usd)}</div>
                  </div>
                ) : (
                  <div className="font-label-code text-[11px] text-text-muted mt-1">No reported {ctx.crop.toLowerCase()} yield in {ctx.year}</div>
                )}
              </div>
            )}
          </div>
          <Legend layer={layer} noData={noData} domain={domain} />
        </>
      )}
    </div>
  );
}

function Legend({ layer, noData, domain }) {
  const legend = layer.legend.range
    ? { ...layer.legend, min: `${score(domain[0])} (lowest this year)`, max: `${score(domain[1])} (highest)` }
    : layer.legend;
  const grad = (stops) => ({ background: `linear-gradient(to right, ${stops.join(',')})` });
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-micro text-micro text-on-surface-variant">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-text-muted uppercase">{layer.label}:</span>
        {legend.kind === 'tier' &&
          [1, 2, 3].map((t) => (
            <span key={t} className="flex items-center gap-1.5 mr-2">
              <span className="w-3 h-3 rounded inline-block" style={{ background: TIERS[t].color }} />
              {TIERS[t].name} · {TIERS[t].label}
            </span>
          ))}
        {legend.kind !== 'tier' && (
          <>
            <span>{legend.min}</span>
            <span className="w-40 h-2.5 rounded-full inline-block" style={grad(legend.kind === 'div' ? DIV : SEQ)} />
            <span>{legend.max}</span>
            {legend.mid && <span className="text-text-muted">(gray = {legend.mid})</span>}
          </>
        )}
      </div>
      {noData > 0 && (
        <span className="flex items-center gap-1.5 text-text-muted">
          <span className="w-3 h-3 rounded inline-block bg-[#0c1f18] border border-surface-container-highest" />
          {noData} counties with no reported yield
        </span>
      )}
    </div>
  );
}
