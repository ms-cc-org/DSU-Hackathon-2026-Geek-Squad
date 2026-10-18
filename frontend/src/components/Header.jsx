import { useState } from 'react';
import Icon from './Icon.jsx';

const ACTIVE_TAB =
  'px-space-md py-1.5 rounded-lg bg-primary-container text-on-primary-container font-bold whitespace-nowrap font-body-sm text-body-sm transition-all flex items-center gap-1.5 shadow-sm';
const IDLE_TAB =
  'px-space-md py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors whitespace-nowrap font-body-sm text-body-sm flex items-center gap-1.5';
const SELECT =
  'bg-transparent border-0 py-0 pl-0 pr-6 font-label-code text-label-code focus:outline-none focus:ring-0 cursor-pointer';

export default function Header({
  view,
  onNavigate,
  options,
  stateCode,
  onStateChange,
  crop,
  onCropChange,
  year,
  onYearChange,
  budgetM,
  csvUrl,
  rows,
  onFindCounty,
}) {
  const [query, setQuery] = useState('');
  const crops = options?.states.find((s) => s.code === stateCode)?.crops ?? [];
  const years = options ? [...options.years].reverse() : [];

  const findCounty = (e) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q || !rows) return;
    const hit = rows.find((r) => r.fips === q || r.county_name.toLowerCase().startsWith(q))
      ?? rows.find((r) => r.county_name.toLowerCase().includes(q));
    if (hit) {
      onFindCounty(hit.fips);
      setQuery('');
    }
  };

  const tab = (id, icon, label, extra) => (
    <button className={view === id ? ACTIVE_TAB : IDLE_TAB} onClick={() => onNavigate(id)}>
      <Icon name={icon} className="text-[16px]" />
      <span>{label}</span>
      {extra}
    </button>
  );

  return (
    <header className="fixed top-0 left-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-28 w-full px-gutter flex flex-col justify-between py-space-sm">
        <div className="flex items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-lg">
            <div className="flex items-center gap-space-sm">
              <span className="text-[22px] leading-none select-none" aria-label="Corn">
                🌽
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-secondary-container text-primary-fixed font-eyebrow text-[11px] tracking-wide uppercase font-bold">
                    Data to Harvest
                  </span>
                  <span className="font-headline-sm text-body-sm font-bold text-primary tracking-tight">
                    State Drought Assistance &amp; Priority Targeting
                  </span>
                </div>
                <span className="hidden xl:inline-block font-label-code text-[10px] text-text-muted leading-tight">
                  DSU Hackathon 2026 • Team Geek Squad • One row = one county, one crop, one year
                </span>
              </div>
            </div>
            {options && (
              <div className="hidden lg:flex items-center gap-space-xs px-space-sm py-1 rounded-full bg-surface-container-high">
                <span className="w-2 h-2 rounded-full bg-risk-low" />
                <span className="font-label-code text-label-code text-on-surface-variant">
                  {options.dataset.rows.toLocaleString()} county-crop-years loaded • {options.dataset.year_min}–{options.dataset.year_max}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-space-md">
            <form className="relative hidden md:flex items-center" onSubmit={findCounty}>
              <Icon name="search" className="absolute left-3 text-text-muted text-[18px]" />
              <input
                className="bg-surface-container-low border-0 pl-9 pr-space-md py-1.5 rounded-lg text-on-surface placeholder:text-text-muted font-body-sm text-body-sm focus:outline-none focus:ring-0 focus:bg-surface-container-high transition-colors w-60 lg:w-72"
                placeholder="Find county name or FIPS, then Enter"
                type="text"
                list="county-search-list"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <datalist id="county-search-list">
                {rows?.map((r) => (
                  <option key={r.fips} value={r.county_name} />
                ))}
              </datalist>
            </form>
            <a
              href={csvUrl}
              download
              title="Same CSV as the Streamlit 'Export Relief Action Ledger' button"
              className="flex items-center gap-space-xs px-space-md py-2 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-body-sm hover:bg-accent-hover transition-all"
            >
              <Icon name="file_download" className="text-[18px]" />
              <span>Export Ledger (CSV)</span>
            </a>
          </div>
        </div>

        <div className="flex items-center justify-between gap-space-md pt-space-xs">
          <nav className="flex items-center gap-space-xs overflow-x-auto">
            {tab('geospatial', 'map', 'Priority Ranking & Map')}
            {tab(
              'assistance',
              'calculate',
              'Relief Allocation',
              <span className="px-1.5 rounded bg-risk-elevated/20 text-risk-elevated font-micro text-micro font-bold">${budgetM}M</span>,
            )}
            {tab('validation', 'verified', 'Model Validation')}
            {tab('report', 'analytics', 'County Report Card')}
          </nav>

          {options && (
            <div className="hidden sm:flex items-center gap-space-sm">
              <div className="flex items-center gap-1.5 px-space-sm py-1 rounded bg-surface-container-low">
                <span className="font-micro text-micro uppercase text-text-muted">State:</span>
                <select className={`${SELECT} text-on-surface`} value={stateCode} onChange={(e) => onStateChange(e.target.value)}>
                  {options.states.map((s) => (
                    <option key={s.code} value={s.code} className="bg-surface-container-high text-on-surface">
                      {s.code} - {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 px-space-sm py-1 rounded bg-surface-container-low">
                <span className="font-micro text-micro uppercase text-text-muted">Crop:</span>
                <select className={`${SELECT} text-accent-neon font-bold`} value={crop} onChange={(e) => onCropChange(e.target.value)}>
                  {crops.map((c) => (
                    <option key={c} value={c} className="bg-surface-container-high text-on-surface">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 px-space-sm py-1 rounded bg-surface-container-low">
                <span className="font-micro text-micro uppercase text-text-muted">Year:</span>
                <select className={`${SELECT} text-on-surface`} value={year} onChange={(e) => onYearChange(Number(e.target.value))}>
                  {years.map((y) => (
                    <option key={y} value={y} className="bg-surface-container-high text-on-surface">
                      {y}
                      {y >= options.test_years[0] ? ' (test)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
