import Icon from './Icon.jsx';

// Loading / empty / error states, mirroring the st.warning / st.info messages in app.py.
export function StatusPanel({ title, detail, tone = 'info', inline = false }) {
  const toneClass = tone === 'error' ? 'text-error' : tone === 'warning' ? 'text-risk-moderate' : 'text-primary-fixed';
  const icon = tone === 'error' ? 'error' : tone === 'warning' ? 'warning' : 'info';
  const box = (
    <div className="w-full bg-surface-container-low rounded-xl p-space-md flex items-start gap-space-md border border-surface-container-highest">
      <Icon name={icon} className={`text-[22px] ${toneClass}`} />
      <div>
        <div className={`font-headline-sm text-title-md ${toneClass}`}>{title}</div>
        {detail && <p className="font-body-sm text-body-sm text-text-muted mt-1 max-w-3xl">{detail}</p>}
      </div>
    </div>
  );
  return inline ? box : <div className="w-full max-w-7xl mx-auto px-gutter py-space-md">{box}</div>;
}

// One numbered step of the story. `takeaway` is the sentence a judge should leave with.
export function Section({ id, step, title, takeaway, children, right }) {
  return (
    <section id={id} className="w-full max-w-7xl mx-auto px-gutter py-space-lg scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-space-md pb-space-md">
        <div>
          <div className="font-eyebrow text-eyebrow text-accent-neon uppercase tracking-widest">
            {step} · {title}
          </div>
          <h2 className="font-headline-lg text-[26px] leading-[32px] text-primary tracking-tight mt-1 max-w-4xl">{takeaway}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`bg-surface-container/90 rounded-xl p-space-md lg:p-space-lg shadow-xl ${className}`}>{children}</div>;
}

// A big number with a short label: the unit of "get it in one glance".
export function BigStat({ label, value, sub, valueClass = 'text-primary' }) {
  return (
    <div className="bg-surface-container-high/70 rounded-xl p-space-md">
      <div className="font-micro text-micro uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`font-headline-lg text-headline-lg tracking-tight mt-1 ${valueClass}`}>{value}</div>
      {sub && <div className="font-body-sm text-body-sm text-text-secondary mt-0.5">{sub}</div>}
    </div>
  );
}
