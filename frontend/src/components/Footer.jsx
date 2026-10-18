import Icon from './Icon.jsx';

export default function Footer({ onReturnToIntro, dataset }) {
  return (
    <>
      <div className="w-full flex justify-center items-center py-space-md mb-2">
        <button
          type="button"
          onClick={onReturnToIntro}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-surface-container-high/80 hover:bg-secondary-container text-primary-fixed border border-accent-neon/40 hover:border-accent-neon font-headline-sm text-body-sm font-bold shadow-[0_0_20px_rgba(167,245,90,0.15)] hover:shadow-[0_0_25px_rgba(167,245,90,0.35)] transition-all duration-300 backdrop-blur-xl group cursor-pointer"
        >
          <Icon name="restart_alt" className="text-accent-neon text-[20px] transition-transform duration-200 group-hover:-translate-y-0.5" />
          <span>↺ Return to Opening</span>
        </button>
      </div>
      <footer className="w-full bg-surface-container-low py-space-xl mt-space-xl">
        <div className="w-full px-gutter flex flex-col md:flex-row items-center justify-between gap-space-md text-text-muted">
          <div className="flex items-center gap-2">
            <span className="text-[18px]">🌽</span>
            <span className="font-eyebrow text-eyebrow text-primary-fixed">DATA TO HARVEST</span>
            <span className="font-micro text-micro uppercase text-on-surface-variant">Team Geek Squad • DSU Hackathon 2026</span>
          </div>
          <div className="flex items-center gap-space-lg font-body-sm text-body-sm text-on-surface-variant flex-wrap justify-center">
            <span>Yields &amp; acres: USDA NASS Quick Stats</span>
            <span>Weather: NOAA ACIS</span>
            <span>Drought: U.S. Drought Monitor</span>
            <span>Soils: USDA NRCS SSURGO</span>
            <span>Prices: USDA marketing-year averages</span>
          </div>
          {dataset && (
            <div className="font-micro text-micro text-on-surface-variant">
              {dataset.rows.toLocaleString()} rows • {dataset.year_min}–{dataset.year_max}
            </div>
          )}
        </div>
      </footer>
    </>
  );
}
