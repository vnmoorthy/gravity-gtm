import { useState, createContext, useContext, useCallback } from "react";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, ExternalLink } from "lucide-react";
import { fmt } from "./api";

export const cx = (...a) => a.filter(Boolean).join(" ");

export function Card({ className = "", children, ...p }) {
  return <div className={cx("glass rounded-2xl", className)} {...p}>{children}</div>;
}

export function Button({ children, variant = "default", size = "md", loading, className = "", icon: Icon, ...p }) {
  const v = {
    primary: "bg-[#0d0d0e] !text-[#ffffff] font-medium hover:bg-[#26262a] shadow-[0_1px_0_rgba(0,0,0,.04)]",
    default: "bg-[#ffffff] hover:bg-[#f7f6f3] text-zinc-100 border border-[#e2e0da]",
    ghost: "hover:bg-white/[0.06] text-zinc-300",
    danger: "bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30",
    success: "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30",
  }[variant];
  const s = { sm: "h-7 px-2.5 text-xs rounded-md gap-1.5", md: "h-9 px-3.5 text-sm rounded-md gap-2", lg: "h-12 px-7 text-[15px] rounded-md gap-2.5" }[size];
  return (
    <button className={cx("inline-flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap", v, s, className)} disabled={loading || p.disabled} {...p}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className={size === "sm" ? "size-3.5" : "size-4"} /> : null}
      {children}
    </button>
  );
}

export function Badge({ children, color = "zinc", className = "" }) {
  const c = {
    zinc: "bg-white/[0.06] text-zinc-300 border-white/10",
    amber: "bg-amber-500/12 text-amber-300 border-amber-500/30",
    violet: "bg-violet-500/12 text-violet-300 border-violet-500/30",
    cyan: "bg-cyan-500/12 text-cyan-300 border-cyan-500/30",
    rose: "bg-rose-500/12 text-rose-300 border-rose-500/30",
    emerald: "bg-emerald-500/12 text-emerald-300 border-emerald-500/30",
    lime: "bg-lime-500/12 text-lime-300 border-lime-500/30",
    sky: "bg-sky-500/12 text-sky-300 border-sky-500/30",
  }[color];
  return <span className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap", c, className)}>{children}</span>;
}

export function Tier({ tier }) {
  const c = { A: "emerald", B: "amber", C: "zinc" }[tier] || "zinc";
  return <Badge color={c}>Tier {tier}</Badge>;
}

export function Score({ value = 0, size = 34 }) {
  const r = size / 2 - 3, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  const col = v >= 72 ? "#34d399" : v >= 55 ? "#f59e0b" : "#71717a";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(0,0,0,.08)" strokeWidth="3" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth="3" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} strokeLinecap="round" style={{ transition: "stroke-dashoffset .8s" }} />
      </svg>
      <span className="absolute text-[11px] font-semibold tabular-nums">{Math.round(v)}</span>
    </div>
  );
}

export function Confidence({ value = 0, label = true }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const col = v >= 0.8 ? "from-emerald-400 to-emerald-500" : v >= 0.6 ? "from-amber-400 to-amber-500" : "from-rose-400 to-rose-500";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="h-1.5 flex-1 rounded-full bg-white/[0.07] overflow-hidden"><div className={cx("h-full rounded-full bg-gradient-to-r", col)} style={{ width: `${v * 100}%`, transition: "width .8s" }} /></div>
      {label && <span className="text-[11px] tabular-nums text-zinc-400 font-mono">{v.toFixed(2)}</span>}
    </div>
  );
}

export function EmailStatus({ person }) {
  const s = person?.email_status;
  if (s === "verified") return <span className="inline-flex items-center gap-1 text-emerald-300 text-xs"><CheckCircle2 className="size-3.5" />verified</span>;
  if (s === "likely") return <span className="inline-flex items-center gap-1 text-amber-300 text-xs"><CheckCircle2 className="size-3.5" />MX-valid · {Math.round((person.email_confidence || 0) * 100)}%</span>;
  if (s === "invalid") return <span className="inline-flex items-center gap-1 text-rose-300 text-xs"><XCircle className="size-3.5" />no MX</span>;
  if (s === "pending") return <span className="inline-flex items-center gap-1 text-zinc-500 text-xs"><Loader2 className="size-3.5 animate-spin" />queued</span>;
  return <span className="inline-flex items-center gap-1 text-zinc-500 text-xs"><AlertTriangle className="size-3.5" />{s || "—"}</span>;
}

export function SourceChip({ url, verified = true }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className={cx("inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border hover:brightness-125 max-w-[220px] truncate", verified ? "border-cyan-500/30 text-cyan-300 bg-cyan-500/10" : "border-zinc-600/40 text-zinc-400 bg-white/5")}>
      <ExternalLink className="size-3 shrink-0" /><span className="truncate">{fmt.host(url)}</span>
    </a>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      {Icon && <div className="size-14 rounded-2xl grid place-items-center bg-white/[0.04] border border-white/10 mb-4"><Icon className="size-6 text-zinc-400" /></div>}
      <div className="text-lg font-medium">{title}</div>
      <div className="text-sm text-zinc-400 mt-1 max-w-md">{children}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, children, right }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        {eyebrow && <div className="text-[11px] uppercase tracking-[0.18em] text-[#2f5bea] mb-2">{eyebrow}</div>}
        <h1 className="font-serif text-[40px] leading-none">{title}</h1>
        {children && <p className="text-sm text-zinc-400 mt-2 max-w-2xl">{children}</p>}
      </div>
      {right && <div className="flex items-center gap-2 flex-wrap justify-end">{right}</div>}
    </div>
  );
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, kind = "ok") => {
    const id = Math.random();
    setItems((x) => [...x, { id, text, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
        {items.map((t) => (
          <div key={t.id} className={cx("fade-in px-4 py-2.5 rounded-xl text-sm border shadow-2xl backdrop-blur-xl", t.kind === "error" ? "bg-[#fff1f2] border-rose-500/40 text-rose-300" : "bg-[#0d0d0e] border-[#0d0d0e] !text-[#ffffff]")}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** run an async action with a toast on error */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const run = useCallback(async (key, fn, okMsg) => {
    setBusy(key);
    try { const r = await fn(); if (okMsg) toast(typeof okMsg === "function" ? okMsg(r) : okMsg); return r; }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(null); }
  }, [toast]);
  return [busy, run];
}

export function Md({ text }) {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*|@[A-Za-z][\w ]*?(?=[\s,.:;!?]|$))/g);
  return (
    <span className="md">
      {parts.map((p, i) => p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith("@") ? <span key={i} className="text-[#2f5bea] font-medium">{p}</span> : p)}
    </span>
  );
}
