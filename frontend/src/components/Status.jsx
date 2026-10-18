import Icon from './Icon.jsx';

// Loading / empty / error states, mirroring the st.warning / st.info messages in app.py.
export function StatusPanel({ title, detail, tone = 'info' }) {
  const toneClass = tone === 'error' ? 'text-error' : tone === 'warning' ? 'text-risk-moderate' : 'text-primary-fixed';
  const icon = tone === 'error' ? 'error' : tone === 'warning' ? 'warning' : 'info';
  return (
    <div className="w-full px-gutter py-space-md">
      <div className="w-full bg-surface-container-low rounded-xl p-space-lg flex items-start gap-space-md border border-surface-container-highest">
        <Icon name={icon} className={`text-[22px] ${toneClass}`} />
        <div>
          <div className={`font-headline-sm text-title-md ${toneClass}`}>{title}</div>
          {detail && <p className="font-body-sm text-body-sm text-text-muted mt-1 max-w-3xl">{detail}</p>}
        </div>
      </div>
    </div>
  );
}

export function Panel({ title, subtitle, right, children, id, className = '' }) {
  return (
    <div className={`w-full px-gutter py-space-sm ${className}`} id={id}>
      <div className="w-full bg-surface-container/90 backdrop-blur-xl rounded-xl p-space-md lg:p-space-lg shadow-2xl">
        {(title || right) && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md pb-space-md">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-primary tracking-tight">{title}</h3>
              {subtitle && <p className="font-body-sm text-body-sm text-text-muted mt-0.5 max-w-3xl">{subtitle}</p>}
            </div>
            {right}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function StatCard({ eyebrow, badge, value, valueClass = 'text-primary', note, noteClass = 'text-text-muted', caption, footer, bar }) {
  return (
    <div className="bg-surface-container-high/70 backdrop-blur-md rounded-xl p-space-md shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between text-text-muted font-micro text-micro uppercase tracking-wider mb-2 gap-2">
        <span>{eyebrow}</span>
        {badge}
      </div>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className={`font-headline-lg text-headline-lg tracking-tight ${valueClass}`}>{value}</div>
        {note && <div className={`font-label-code text-label-code font-bold ${noteClass}`}>{note}</div>}
      </div>
      {caption && <div className="mt-2 text-text-secondary font-body-sm text-body-sm">{caption}</div>}
      {bar !== undefined && (
        <div className="mt-3 w-full bg-surface-container-lowest h-1.5 rounded-full overflow-hidden">
          <div className="bg-primary-container h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
        </div>
      )}
      {footer && <div className="mt-2 text-text-muted font-label-code text-[11px]">{footer}</div>}
    </div>
  );
}

export function TierBadge({ tier, TIERS }) {
  const t = TIERS[tier];
  return (
    <span className={`px-2 py-0.5 rounded font-label-code text-label-code font-bold whitespace-nowrap ${t.badge}`}>
      {t.name} · {t.label}
    </span>
  );
}
