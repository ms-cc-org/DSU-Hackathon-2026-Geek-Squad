const SELECT =
  'bg-surface-container-low border-0 rounded-lg py-1 pl-2 pr-7 font-label-code text-label-code text-on-surface focus:outline-none focus:ring-1 focus:ring-accent-neon cursor-pointer';
import Icon from './Icon.jsx';

// Pages in pitch order; "Ask the data" is the AI assistant.
export const PAGES = [
  { id: 'decision', label: 'The decision', icon: 'gavel' },
  { id: 'answer', label: 'Who gets relief', icon: 'payments' },
  { id: 'why', label: 'Why', icon: 'insights' },
  { id: 'proof', label: 'Does it work?', icon: 'verified' },
  { id: 'county', label: 'County report card', icon: 'analytics' },
  { id: 'limits', label: 'Limits & data', icon: 'info' },
  { id: 'ask', label: 'Ask the data', icon: 'smart_toy' },
];

export default function Header({ page, onNavigate, onHome, options, stateCode, onStateChange, crop, onCropChange, year, onYearChange, budgetM, onBudgetChange, quotaPct, onQuotaChange, loading }) {
  const crops = options?.states.find((s) => s.code === stateCode)?.crops ?? [];
  const years = options ? [...options.years].reverse() : [];

  return (
    <header className="fixed top-0 left-0 w-full z-40 bg-surface/95 backdrop-blur-xl border-b border-surface-container-highest">
      <div className="max-w-7xl mx-auto px-gutter py-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-space-md flex-wrap">
          <button onClick={onHome} title="Back to the start screen" className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity">
            <span className="text-[22px] leading-none" aria-hidden="true">
              🌽
            </span>
            <span className="font-headline-sm text-title-md font-bold text-primary tracking-tight">Drought Relief Targeting</span>
            <span className="hidden md:inline font-label-code text-label-code text-text-muted">· Team Geek Squad · DSU Hackathon 2026</span>
          </button>
          <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Pages">
            {PAGES.map((p, i) => (
              <button
                key={p.id}
                onClick={() => onNavigate(p.id)}
                aria-current={page === p.id ? 'page' : undefined}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-body-sm text-body-sm whitespace-nowrap transition-colors ${
                  page === p.id
                    ? 'bg-primary-container text-on-primary-container font-bold'
                    : p.id === 'ask'
                      ? 'text-accent-neon border border-accent-neon/40 hover:bg-surface-container-high'
                      : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'
                }`}
              >
                <Icon name={p.icon} className="text-[16px]" />
                {p.id === 'ask' ? p.label : `${i + 1}. ${p.label}`}
              </button>
            ))}
          </nav>
        </div>

        {options && (
          <div className="flex items-center gap-x-space-lg gap-y-2 flex-wrap font-body-sm text-body-sm text-on-surface-variant">
            <label className="flex items-center gap-1.5">
              State
              <select className={SELECT} value={stateCode} onChange={(e) => onStateChange(e.target.value)}>
                {options.states.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              Crop
              <select className={`${SELECT} text-accent-neon font-bold`} value={crop} onChange={(e) => onCropChange(e.target.value)}>
                {crops.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              Season
              <select className={SELECT} value={year} onChange={(e) => onYearChange(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                    {y >= options.test_years[0] ? ' · blind test year' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              Relief fund
              <input
                type="range"
                min={options.budget_m.min}
                max={options.budget_m.max}
                step={options.budget_m.step}
                value={budgetM}
                onChange={(e) => onBudgetChange(Number(e.target.value))}
                className="w-28 accent-[#a7f55a] cursor-pointer"
              />
              <b className="font-label-code text-label-code text-accent-neon w-10">${budgetM}M</b>
            </label>
            <label className="flex items-center gap-2" title="Share of counties that receive relief (Tier 1)">
              Counties funded
              <input
                type="range"
                min={options.quota_pct.min}
                max={options.quota_pct.max}
                step={options.quota_pct.step}
                value={quotaPct}
                onChange={(e) => onQuotaChange(Number(e.target.value))}
                className="w-24 accent-[#a7f55a] cursor-pointer"
              />
              <b className="font-label-code text-label-code text-accent-neon w-16">top {quotaPct}%</b>
            </label>
            {loading && <span className="font-label-code text-label-code text-text-muted">updating…</span>}
          </div>
        )}
      </div>
    </header>
  );
}
