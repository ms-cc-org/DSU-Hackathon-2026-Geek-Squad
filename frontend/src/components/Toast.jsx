import Icon from './Icon.jsx';

export default function Toast({ toast }) {
  const visible = Boolean(toast);
  return (
    <div
      className={`fixed bottom-24 right-6 bg-surface-container-highest text-primary px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-300 z-50 pointer-events-none ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'
      }`}
    >
      <Icon name="check_circle" className="text-accent-neon text-[22px]" />
      <div>
        <div className="font-headline-sm text-[13px] font-bold">{toast?.title}</div>
        <div className="font-body-sm text-[12px] text-text-muted">{toast?.msg}</div>
      </div>
    </div>
  );
}
