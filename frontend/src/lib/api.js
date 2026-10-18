import { useEffect, useState } from 'react';

// Thin client for api_server.py. Every number on the page comes from these endpoints.

// Where api_server.py lives. Empty = same origin (local dev / python api_server.py).
// The GitHub Pages build sets VITE_API_BASE to the hosted API, e.g. https://drought-relief-api.onrender.com
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export const apiUrl = (path, params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null));
  return `${API_BASE}/api/${path}${qs.toString() ? `?${qs}` : ''}`;
};

// POST JSON; throws an Error carrying the server's message (and body) on failure.
export async function postJson(path, payload) {
  const res = await fetch(`${API_BASE}/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.body = body;
    throw err;
  }
  return body;
}

// Fetch JSON for `url`; keeps the previous result on screen while a new one loads.
export function useApi(url) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(url) });

  useEffect(() => {
    if (!url) return undefined;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetch(url, { signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        setState({ data: body, error: null, loading: false });
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState((s) => ({ ...s, error: err.message, loading: false }));
      });
    return () => ctrl.abort();
  }, [url]);

  return state;
}
