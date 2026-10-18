import Icon from './Icon.jsx';

// Opening screen: two ways in, the guided pitch (page 1) or straight to the AI assistant.
// The globe is decoration only; every number lives on the pages behind it.
export default function Landing({ onEnter }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center overflow-hidden">
      <Globe />

      <div className="relative z-10 flex flex-col items-center w-full max-w-xl anim-reveal-hero">
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
          <span className="w-2 h-2 rounded-full bg-accent-neon animate-pulse" />
          <span className="font-label-code text-label-code text-primary-fixed uppercase tracking-widest">Team Geek Squad · DSU Hackathon 2026</span>
        </div>

        <h1 className="font-display-hero-mobile text-display-hero-mobile sm:font-display-hero sm:text-display-hero text-primary tracking-tight">
          Drought Relief Targeting
        </h1>
        <p className="font-body-lead text-body-lead text-on-surface mt-3 max-w-lg">
          Which Iowa and Nebraska counties should get emergency drought money first, decided in August, before harvest data
          exists.
        </p>
        <p className="font-body-sm text-body-sm text-text-muted mt-2 max-w-lg">
          Built on 26 seasons of USDA, NOAA, Drought Monitor and soil survey data, and tested blind on 2016–2025.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <button
            onClick={() => onEnter('decision')}
            className="px-5 py-2.5 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-body-sm font-bold hover:bg-accent-hover transition-all flex items-center gap-2 shadow-xl"
          >
            <Icon name="map" className="text-[18px]" />
            Walk through the dashboard
          </button>
          <button
            onClick={() => onEnter('ask')}
            className="px-5 py-2.5 rounded-lg bg-secondary-container text-primary-fixed border border-border-glass font-headline-sm text-body-sm font-bold hover:bg-surface-container-high transition-all flex items-center gap-2 shadow-xl"
          >
            <Icon name="smart_toy" className="text-[18px] text-accent-neon" />
            Ask the data (AI)
          </button>
        </div>
      </div>
    </div>
  );
}

// Spinning wireframe globe with two orbiting rings, behind the title.
function Globe() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden="true">
      <div className="absolute w-[520px] h-[520px] rounded-full bg-accent-neon/10 blur-[90px] anim-globe-pulse" />
      <div className="absolute w-[680px] h-[680px] rounded-full bg-[#338565]/20 blur-[120px]" />
      <div className="relative w-[440px] h-[440px] flex items-center justify-center scale-[0.7] sm:scale-100">
        <div className="absolute inset-0 rounded-full border border-accent-neon/20 shadow-[0_0_50px_rgba(167,245,90,0.18)]" />
        <div className="absolute w-[560px] h-[560px] rounded-full border border-accent-neon/25 anim-orbit-1 flex items-center justify-start">
          <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_15px_#a7f55a] -ml-1.5" />
        </div>
        <div className="absolute w-[620px] h-[620px] rounded-full border border-dashed border-primary-fixed/20 anim-orbit-2 flex items-center justify-end">
          <div className="w-2.5 h-2.5 rounded-full bg-accent-neon shadow-[0_0_12px_#a7f55a] -mr-1" />
        </div>
        <svg className="w-full h-full drop-shadow-[0_0_35px_rgba(167,245,90,0.25)]" viewBox="0 0 440 440" fill="none">
          <defs>
            <radialGradient id="globe-surface" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#153d30" stopOpacity="0.75" />
              <stop offset="70%" stopColor="#0a231b" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#041710" stopOpacity="0.95" />
            </radialGradient>
            <radialGradient id="globe-glow" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#a7f55a" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#51ad70" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#041710" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="220" cy="220" r="200" fill="url(#globe-surface)" stroke="#a7f55a" strokeWidth="1.5" strokeOpacity="0.4" />
          <circle cx="220" cy="220" r="200" fill="url(#globe-glow)" />
          <g className="anim-globe-spin" style={{ transformOrigin: '220px 220px' }} stroke="#a7f55a" strokeWidth="1">
            <line x1="20" y1="220" x2="420" y2="220" strokeOpacity="0.35" />
            <ellipse cx="220" cy="220" rx="200" ry="65" strokeOpacity="0.3" />
            <ellipse cx="220" cy="220" rx="200" ry="135" strokeOpacity="0.22" />
            <ellipse cx="220" cy="150" rx="180" ry="40" strokeOpacity="0.2" />
            <ellipse cx="220" cy="290" rx="180" ry="40" strokeOpacity="0.2" />
            <ellipse cx="220" cy="220" rx="65" ry="200" stroke="#8bd875" strokeOpacity="0.3" />
            <ellipse cx="220" cy="220" rx="135" ry="200" stroke="#8bd875" strokeOpacity="0.22" />
            <circle cx="165" cy="160" r="4.5" fill="#a7f55a" stroke="none" />
            <circle cx="240" cy="145" r="4" fill="#b1f45b" stroke="none" />
            <circle cx="300" cy="250" r="3.5" fill="#edc45c" stroke="none" />
          </g>
        </svg>
      </div>
    </div>
  );
}
