import { useEffect, useState } from 'react';

// Thin client for api_server.py. Every number on the page comes from these endpoints.

export const apiUrl = (path, params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null));
  return `/api/${path}${qs.toString() ? `?${qs}` : ''}`;
};

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
