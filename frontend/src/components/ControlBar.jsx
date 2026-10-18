import Icon from './Icon.jsx';
import { SORT_OPTIONS } from '../lib/format.js';

// Budget, quota and ranking strategy: the remaining Streamlit sidebar controls.
export default function ControlBar({ options, view, year, budgetM, onBudgetChange, quotaPct, onQuotaChange, sortBy, onSortChange, loading }) {
  const { budget_m: b, quota_pct: q, test_years: test, train_years: train } = options;
  const isTest = year >= test[0] && year <= test[1];
  // Validation uses only the quota; the report card uses none of these.
  const showBudget = view === 'geospatial' || view === 'assistance';
  const showQuota = view !== 'report';
  if (!showQuota) return null;

  return (
    <div className="w-full px-gutter pt-space-md">
      <div className="w-full bg-surface-container-low rounded-xl px-space-md py-2.5 flex flex-wrap items-center gap-x-space-lg gap-y-space-sm shadow-md border border-border-subtle">
        <span className="flex items-center gap-1.5 font-eyebrow text-eyebrow text-primary-fixed uppercase tracking-widest">
          <Icon name="tune" className="text-[16px] text-accent-neon" />
          Targeting
        </span>

        {showBudget && (
          <label className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <span>Emergency relief fund</span>
            <input
              type="range"
              min={b.min}
              max={b.max}
              step={b.step}
              value={budgetM}
              onChange={(e) => onBudgetChange(Number(e.target.value))}
              className="w-32 h-2 bg-surface-container-lowest rounded-lg appearance-none cursor-pointer accent-[#a7f55a]"
            />
            <span className="font-label-code text-label-code text-accent-neon font-bold w-12">${budgetM}M</span>
          </label>
        )}

        {showQuota && (
          <label className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <span>Tier 1 quota (top % counties)</span>
            <input
              type="range"
              min={q.min}
              max={q.max}
              step={q.step}
              value={quotaPct}
              onChange={(e) => onQuotaChange(Number(e.target.value))}
              className="w-28 h-2 bg-surface-container-lowest rounded-lg appearance-none cursor-pointer accent-[#a7f55a]"
            />
            <span className="font-label-code text-label-code text-accent-neon font-bold w-10">{quotaPct}%</span>
          </label>
        )}

        {showBudget && (
          <label className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <span>Rank by</span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="bg-surface-container-lowest border border-surface-container-highest rounded-lg py-1 pl-2 pr-8 text-on-surface font-label-code text-label-code focus:outline-none focus:ring-0"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {showBudget && (
          <span
            className={`ml-auto px-2 py-0.5 rounded font-label-code text-label-code ${
              isTest ? 'bg-accent-neon/10 text-accent-neon border border-accent-neon/30' : 'bg-surface-container-high text-text-muted'
            }`}
          >
            {isTest
              ? `${year} is an out-of-sample test year (evaluated blind)`
              : `${year} is in the ${train[0]}–${train[1]} training period`}
          </span>
        )}
        {loading && <span className="font-label-code text-label-code text-text-muted">updating…</span>}
      </div>
    </div>
  );
}
