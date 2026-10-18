// Formatting matches the Streamlit app (app.py) so both show identical figures.

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export const usd = (v) => (isNum(v) ? `$${Math.round(v).toLocaleString('en-US')}` : '—');

export const usdShort = (v) => {
  if (!isNum(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export const signedPct = (v, digits = 1) => (isNum(v) ? `${v > 0 ? '+' : ''}${v.toFixed(digits)}%` : '—');
export const pct = (v, digits = 1) => (isNum(v) ? `${v.toFixed(digits)}%` : '—');
export const num = (v, digits = 0) =>
  isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
export const score = (v) => (isNum(v) ? v.toFixed(1) : '—');
export const plural = (n, word) => `${n} ${n === 1 ? word : word.endsWith('y') ? `${word.slice(0, -1)}ies` : `${word}s`}`;
// ['2018', '2021', '2024'] -> '2018, 2021 and 2024'
export const joinAnd = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// Below this many relief slots across the test years, precision is too noisy to claim a win.
export const MIN_TEST_PICKS = 30;

// Action tiers from priority_model.allocate_relief_budget. Always shown with a label, never color alone.
export const TIERS = {
  1: { name: 'Tier 1', label: 'Immediate Relief', color: '#d96c48', badge: 'bg-risk-severe/20 text-risk-severe', dot: 'bg-risk-severe' },
  2: { name: 'Tier 2', label: 'Monitoring / Buffer', color: '#edc45c', badge: 'bg-risk-moderate/20 text-risk-moderate', dot: 'bg-risk-moderate' },
  3: { name: 'Tier 3', label: 'Resilient / Low Risk', color: '#51ad70', badge: 'bg-risk-low/20 text-risk-low', dot: 'bg-risk-low' },
};

// ── Color scale for the harvest map ─────────────────────────────────────────
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const [x, y] = [hex(a), hex(b)];
  return `rgb(${x.map((c, i) => Math.round(c + (y[i] - c) * t)).join(',')})`;
};
const ramp = (stops, t) => {
  const c = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(c));
  return mix(stops[i], stops[i + 1], c - i);
};

// Diverging: loss (orange-red) <- neutral gray -> gain (green).
export const DIV = ['#d96c48', '#8a5643', '#3d4842', '#3e7a55', '#51ad70'];
export const diverging = (t) => ramp(DIV, (t + 1) / 2);

export const CHART = {
  grid: '#263930',
  axis: '#9bb9a8',
  ink: '#d1e8dc',
  muted: '#5f7a6c',
  accent: '#a7f55a',
  surface: '#10231c',
};
