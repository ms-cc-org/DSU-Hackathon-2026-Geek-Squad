import { useMemo, useRef, useState } from 'react';
import { DIV, TIERS, diverging, score, signedPct, usd } from '../lib/format.js';

const W = 760;
const H = 440;
const PAD = 14;

// Two views of the same counties: what we decide in August vs what the harvest showed.
const VIEWS = [
  { id: 'pick', label: 'Our August pick' },
  { id: 'actual', label: 'What the harvest showed' },
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
  const [view, setView] = useState('pick');
  const [hover, setHover] = useState(null);
  const shapes = useProjection(geo.data?.features);
  const byFips = useMemo(() => Object.fromEntries(rows.map((r) => [r.fips, r])), [rows]);

  const fill = (row) => {
    if (!row) return '#0c1f18';
    if (view === 'pick') return TIERS[row.tier].color;
    return row.yield_anomaly_pct == null ? '#3d4842' : diverging(Math.max(-1, Math.min(1, row.yield_anomaly_pct / 40)));
  };

  const track = (shape, e) => {
    const rect = containerRef.current.getBoundingClientRect();
    setHover({ shape, x: Math.min(e.clientX - rect.left + 14, rect.width - 220), y: e.clientY - rect.top - 10 });
  };
  const hoveredRow = hover && byFips[hover.shape.fips];
  const ordered = shapes ? [...shapes.filter((s) => s.fips !== activeFips), ...shapes.filter((s) => s.fips === activeFips)] : [];

  return (
    <div className="bg-surface-container/90 rounded-xl p-space-md shadow-xl">
      <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-lg w-fit mb-space-sm">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-3 py-1 rounded font-label-code text-label-code transition-all ${
              view === v.id ? 'bg-secondary-container text-primary-fixed' : 'text-text-muted hover:text-on-surface'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="relative w-full bg-surface-container-lowest/90 rounded-lg overflow-hidden">
        {!shapes ? (
          <div className="h-[360px] flex items-center justify-center font-label-code text-label-code text-text-muted">
            {geo.error ? `County boundaries failed to load: ${geo.error}` : 'Loading county boundaries…'}
          </div>
        ) : (
          <svg className="w-full h-auto block" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ctx.stateLabel} county map: ${VIEWS.find((v) => v.id === view).label}`}>
            {ordered.map((shape) => {
              const row = byFips[shape.fips];
              const isActive = shape.fips === activeFips;
              return (
                <path
                  key={shape.fips}
                  d={shape.d}
                  fill={fill(row)}
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
            className="absolute pointer-events-none bg-surface-container-highest/95 px-3 py-2 rounded-lg shadow-2xl z-20 min-w-[190px]"
            style={{ left: hover.x, top: hover.y }}
          >
            <span className="font-headline-sm text-[13px] text-primary block font-bold">{hover.shape.name}</span>
            {hoveredRow ? (
              <div className="font-label-code text-[11px] text-on-surface-variant mt-1 space-y-0.5">
                <div>
                  #{hoveredRow.rank} · score {score(hoveredRow.urgency_score)} · {TIERS[hoveredRow.tier].name}
                </div>
                <div>Harvest vs trend {signedPct(hoveredRow.yield_anomaly_pct)}</div>
                <div>Relief {usd(hoveredRow.recommended_relief_usd)}</div>
              </div>
            ) : (
              <div className="font-label-code text-[11px] text-text-muted mt-1">No reported yield: left out</div>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-micro text-micro text-on-surface-variant">
        {view === 'pick' ? (
          [1, 2, 3].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded inline-block" style={{ background: TIERS[t].color }} />
              {t === 1 ? 'Gets relief' : t === 2 ? 'Watch list' : 'Lower risk'}
            </span>
          ))
        ) : (
          <span className="flex items-center gap-2">
            Harvest vs trend: −40% or worse
            <span className="w-32 h-2.5 rounded-full inline-block" style={{ background: `linear-gradient(to right, ${DIV.join(',')})` }} />
            +40% or better
          </span>
        )}
        <span className="flex items-center gap-1.5 text-text-muted">
          <span className="w-3 h-3 rounded inline-block bg-[#0c1f18] border border-surface-container-highest" />
          no reported yield
        </span>
      </div>
    </div>
  );
}
