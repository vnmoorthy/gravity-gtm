import { useEffect, useRef, useState, useCallback } from "react";

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(j.error || `HTTP ${res.status}`), { code: res.status });
  return j;
}

/** Live workspace state: full snapshot + SSE stream (agent messages applied instantly, everything else via debounced refetch). */
export function useWorkspace() {
  const [state, setState] = useState(null);
  const [graphVersion, setGraphVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    try { setState(await api("/api/state")); } catch { /* retry on next event */ }
  }, []);

  const scheduleRefresh = useCallback((ms = 250) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(refresh, ms);
  }, [refresh]);

  useEffect(() => {
    refresh();
    let es;
    let retry;
    const connect = () => {
      es = new EventSource("/api/stream");
      es.onopen = () => setConnected(true);
      es.onerror = () => { setConnected(false); es.close(); retry = setTimeout(connect, 2000); };
      es.addEventListener("agent", (e) => {
        const msg = JSON.parse(e.data);
        setState((s) => (s ? { ...s, agentLog: [...s.agentLog, msg].slice(-1500) } : s));
        scheduleRefresh(400);
      });
      es.addEventListener("billing", (e) => { const b = JSON.parse(e.data); setState((s) => (s ? { ...s, billing: b } : s)); });
      for (const t of ["accounts", "icp", "competitors", "messages", "leads", "run", "person", "approval", "audit", "telemetry", "reset"]) es.addEventListener(t, () => scheduleRefresh(t === "run" ? 50 : 300));
      for (const t of ["graph", "accounts", "competitors", "reset", "leads"]) es.addEventListener(t, () => setGraphVersion((v) => v + 1));
    };
    connect();
    const poll = setInterval(refresh, 15000);
    return () => { es?.close(); clearTimeout(retry); clearInterval(poll); };
  }, [refresh, scheduleRefresh]);

  return { state, refresh, graphVersion, connected };
}

export const fmt = {
  pct: (n) => `${Math.round((n || 0) * 100)}%`,
  usd: (n) => `$${(n || 0).toFixed(n >= 1 ? 2 : 3)}`,
  num: (n) => new Intl.NumberFormat().format(Math.round(n || 0)),
  ago: (iso) => {
    if (!iso) return "";
    const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    return `${Math.round(s / 3600)}h ago`;
  },
  host: (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } },
};
