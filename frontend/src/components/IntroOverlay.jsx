import Icon from './Icon.jsx';

const globeNodes = [
  { cx: 165, cy: 160, r: 4.5, fill: '#a7f55a', label: 'NE', lx: 175, ly: 156, ping: 9 },
  { cx: 240, cy: 145, r: 4, fill: '#b1f45b', label: 'IA', lx: 248, ly: 142, ping: 8 },
  { cx: 300, cy: 170, r: 3.5, fill: '#51ad70', label: 'DE', lx: 308, ly: 168 },
  { cx: 120, cy: 190, r: 3, fill: '#ef9250', label: 'CA', lx: 100, ly: 186 },
];

const globeEllipses = [
  { cy: 220, rx: 200, ry: 65, o: 0.3 },
  { cy: 220, rx: 200, ry: 135, o: 0.22 },
  { cy: 150, rx: 180, ry: 40, o: 0.2 },
  { cy: 290, rx: 180, ry: 40, o: 0.2 },
  { cy: 90, rx: 130, ry: 26, o: 0.2 },
  { cy: 350, rx: 130, ry: 26, o: 0.2 },
  { cy: 220, rx: 65, ry: 200, o: 0.3, stroke: '#8bd875' },
  { cy: 220, rx: 135, ry: 200, o: 0.22, stroke: '#8bd875' },
];

function Globe() {
  return (
    <svg className="w-full h-full drop-shadow-[0_0_35px_rgba(167,245,90,0.25)]" viewBox="0 0 440 440" fill="none">
      <defs>
        <radialGradient id="globe-surface-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#153d30" stopOpacity="0.75" />
          <stop offset="70%" stopColor="#0a231b" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#041710" stopOpacity="0.95" />
        </radialGradient>
        <radialGradient id="atmosphere-glow" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#a7f55a" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#51ad70" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#041710" stopOpacity="0" />
        </radialGradient>
        <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#a7f55a" floodOpacity="0.9" />
        </filter>
      </defs>
      <circle cx="220" cy="220" r="200" fill="url(#globe-surface-grad)" stroke="#a7f55a" strokeWidth="1.5" strokeOpacity="0.4" />
      <circle cx="220" cy="220" r="200" fill="url(#atmosphere-glow)" />
      <line x1="220" y1="10" x2="220" y2="430" stroke="#a7f55a" strokeWidth="1" strokeOpacity="0.35" strokeDasharray="3 3" transform="rotate(23.5 220 220)" />
      <g className="anim-globe-spin" style={{ transformOrigin: '220px 220px' }}>
        <circle cx="220" cy="220" r="198" stroke="#a7f55a" strokeOpacity="0.15" strokeWidth="1" />
        <line x1="20" y1="220" x2="420" y2="220" stroke="#a7f55a" strokeOpacity="0.35" strokeWidth="1" />
        {globeEllipses.map((e, i) => (
          <ellipse key={i} cx="220" cy={e.cy} rx={e.rx} ry={e.ry} stroke={e.stroke || '#a7f55a'} strokeOpacity={e.o} strokeWidth="1" />
        ))}
        <g filter="url(#node-glow)">
          {globeNodes.map((n) => (
            <g key={n.label}>
              <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.fill} />
              {n.ping && (
                <circle
                  cx={n.cx}
                  cy={n.cy}
                  r={n.ping}
                  stroke={n.fill}
                  strokeWidth="1"
                  strokeOpacity="0.6"
                  className="animate-ping"
                  style={{ transformOrigin: `${n.cx}px ${n.cy}px` }}
                />
              )}
              <text x={n.lx} y={n.ly} fill="#fbffed" fontFamily="monospace" fontSize="8" fontWeight="bold">
                {n.label}
              </text>
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}

export default function IntroOverlay({ open, onEnter, dataset }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="absolute w-[520px] h-[520px] rounded-full bg-accent-neon/10 blur-[90px] anim-globe-pulse" />
        <div className="absolute w-[680px] h-[680px] rounded-full bg-[#338565]/20 blur-[120px]" />
        <div className="relative w-[440px] h-[440px] flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-accent-neon/20 shadow-[0_0_50px_rgba(167,245,90,0.18)]" />
          <div className="absolute inset-1 rounded-full border border-border-glass" />
          <div className="absolute w-[560px] h-[560px] rounded-full border border-accent-neon/25 anim-orbit-1 flex items-center justify-start">
            <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_15px_#a7f55a] -ml-1.5 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-neon animate-ping" />
            </div>
          </div>
          <div className="absolute w-[620px] h-[620px] rounded-full border border-dashed border-primary-fixed/20 anim-orbit-2 flex items-center justify-end">
            <div className="w-2.5 h-2.5 rounded-full bg-accent-neon shadow-[0_0_12px_#a7f55a] -mr-1" />
          </div>
          <Globe />
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-xl anim-reveal-hero">
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute w-64 h-64 rounded-full bg-accent-neon/15 blur-3xl animate-pulse" />
          <div className="w-28 h-28 rounded-full border border-border-glass flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full border-t-2 border-accent-neon animate-spin" />
            <div className="w-16 h-16 rounded-full bg-surface-container-high/90 border border-primary-container/30 flex items-center justify-center shadow-[0_0_25px_rgba(167,245,90,0.3)]">
              <Icon name="water_drop" className="text-[32px] text-accent-neon" />
            </div>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-border-glass mb-3">
          <span className="w-2 h-2 rounded-full bg-accent-neon animate-ping" />
          <span className="font-label-code text-label-code text-primary-fixed uppercase tracking-widest">
            USDA NASS • NOAA ACIS • U.S. DROUGHT MONITOR • NRCS SSURGO
          </span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight max-w-xl">
          STATE DROUGHT ASSISTANCE &amp; PRIORITY TARGETING
        </h1>
        <p className="font-body-md text-body-md text-text-muted mt-2 max-w-lg">
          Which counties should get emergency drought relief first, and how much? Every county is scored on heat, drought
          duration and soil water storage, then the state fund goes to the hardest-hit counties before harvest surveys are
          published.
          {dataset && (
            <span className="block mt-2 font-label-code text-label-code text-primary-fixed">
              {dataset.rows.toLocaleString()} county-crop-years • {dataset.counties} counties • {dataset.year_min}–{dataset.year_max}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <button
            className="px-5 py-2.5 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-body-sm font-bold hover:bg-accent-hover transition-all flex items-center gap-2 shadow-xl cursor-pointer"
            onClick={() => onEnter('geospatial')}
          >
            <Icon name="map" className="text-[18px]" />
            <span>Open Priority Ranking</span>
          </button>
          <button
            className="px-5 py-2.5 rounded-lg bg-secondary-container text-primary-fixed border border-border-glass font-headline-sm text-body-sm font-bold hover:bg-surface-container-high transition-all flex items-center gap-2 shadow-xl cursor-pointer"
            onClick={() => onEnter('assistance')}
          >
            <Icon name="calculate" className="text-[18px] text-accent-neon" />
            <span>Open Relief Allocation</span>
          </button>
        </div>
      </div>
    </div>
  );
}
