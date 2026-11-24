import { useState, useEffect, useRef } from "react";
import { Rocket, Target, Network, Building2, Swords, MailCheck, KanbanSquare, BarChart3, Users2, CreditCard, PanelRightClose, PanelRightOpen, Sparkles, Zap, Radio } from "lucide-react";
import { useWorkspace, fmt } from "./api";
import { ToastProvider, cx, Md } from "./ui";
import Mission from "./views/Mission";
import ICP from "./views/ICP";
import Graph from "./views/Graph";
import Accounts from "./views/Accounts";
import Competitors from "./views/Competitors";
import Outreach from "./views/Outreach";
import Pipeline from "./views/Pipeline";
import Analytics from "./views/Analytics";
import WarRoom from "./views/WarRoom";
import Billing from "./views/Billing";

const NAV = [
  { id: "mission", label: "Mission Control", icon: Rocket },
  { id: "icp", label: "ICP Engine", icon: Target },
  { id: "graph", label: "Knowledge Graph", icon: Network },
  { id: "accounts", label: "Accounts & Buyers", icon: Building2 },
  { id: "competitors", label: "Competitors", icon: Swords },
  { id: "outreach", label: "HITL Review", icon: MailCheck },
  { id: "pipeline", label: "Pipeline", icon: KanbanSquare },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "warroom", label: "Agent War Room", icon: Users2 },
  { id: "billing", label: "Spend Governor", icon: CreditCard },
];

const STEPS = [["icp", "ICP"], ["discovery", "Discover"], ["enrichment", "Enrich"], ["outreach", "Outreach"], ["review", "Review"]];

function RunTracker({ run }) {
  if (!run || run.status === "idle") return <div className="text-xs text-zinc-500">No mission running</div>;
  const idx = STEPS.findIndex(([k]) => k === run.step);
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map(([k, label], i) => {
        const done = run.status === "done" || i < idx;
        const active = run.status === "running" && i === idx;
        return (
          <div key={k} className="flex items-center gap-1.5">
            <div className={cx("flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border transition", done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : active ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-white/5 text-zinc-500")}>
              {active && <span className="size-1.5 rounded-full bg-amber-400 pulse-dot" />}
              {label}
            </div>
            {i < STEPS.length - 1 && <div className={cx("w-3 h-px", done ? "bg-emerald-500/50" : "bg-white/10")} />}
          </div>
        );
      })}
      {run.status === "error" && <span className="text-[11px] text-rose-300 ml-2">⚠ {run.error}</span>}
    </div>
  );
}

function CreditMeter({ billing, onClick }) {
  if (!billing) return null;
  const pct = billing.granted ? billing.balance / billing.granted : 0;
  const low = billing.balance < 20;
  return (
    <button onClick={onClick} className={cx("flex items-center gap-2.5 pl-2.5 pr-3 h-9 rounded-xl border transition hover:bg-white/5", low ? "border-rose-500/40 bg-rose-500/10" : "border-white/10 bg-white/[0.03]")}>
      <Zap className={cx("size-4", low ? "text-rose-300" : "text-lime-300")} />
      <div className="text-left">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 leading-none">Credits · Flexprice</div>
        <div className="text-sm font-semibold tabular-nums leading-tight">{fmt.num(billing.balance)}<span className="text-zinc-500 font-normal"> / {fmt.num(billing.granted)}</span></div>
      </div>
      <div className="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className={cx("h-full rounded-full", low ? "bg-rose-400" : "bg-lime-400")} style={{ width: `${Math.max(2, pct * 100)}%`, transition: "width .6s" }} /></div>
    </button>
  );
}

function ThinkingFeed({ state, onOpen }) {
  const ref = useRef(null);
  const log = state?.agentLog?.slice(-80) || [];
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); }, [log.length]);
  const agents = state?.agents || {};
  return (
    <aside className="w-[340px] shrink-0 border-l border-white/5 bg-ink-900/60 flex flex-col min-h-0">
      <div className="px-4 h-14 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2"><Sparkles className="size-4 text-[#2f5bea]" /><span className="text-sm font-medium">Agent Thinking</span>{state?.running && <span className="size-1.5 rounded-full bg-amber-400 pulse-dot" />}</div>
        <button onClick={onOpen} className="text-[11px] text-zinc-400 hover:text-white">Open war room →</button>
      </div>
      <div ref={ref} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {!log.length && <div className="text-xs text-zinc-500 px-1 py-8 text-center">Agents' reasoning, graph traversals and validation logs stream here in real time.</div>}
        {log.map((m) => {
          const a = agents[m.agent] || {};
          return (
            <div key={m.id} className="fade-in flex gap-2.5">
              <div className="size-7 rounded-lg grid place-items-center text-sm shrink-0" style={{ background: (a.color || "#888") + "22", border: `1px solid ${(a.color || "#888")}44` }}>{a.emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px]"><span className="font-semibold" style={{ color: a.color }}>{a.name}</span><span className="text-zinc-600">{fmt.ago(m.at)}</span>{m.cost > 0 && <span className="text-zinc-600 font-mono">· {fmt.usd(m.cost)}</span>}</div>
                <div className={cx("text-[12.5px] leading-snug text-zinc-300 break-words", m.kind === "error" && "text-rose-300", m.kind === "hitl" && "text-amber-100")}><Md text={m.text} /></div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default function App() {
  const ws = useWorkspace();
  const { state } = ws;
  const [view, setView] = useState(() => location.hash.slice(1) || "mission");
  const [feed, setFeed] = useState(true);
  useEffect(() => { location.hash = view; }, [view]);
  useEffect(() => { const f = () => setView(location.hash.slice(1) || "mission"); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);

  const pending = state?.messages?.filter((m) => m.status === "pending_review").length || 0;
  const hitl = state?.approvals?.filter((a) => a.status === "pending").length || 0;
  const integ = state?.integrations || {};
  const props = { ...ws, go: setView };

  const V = { mission: Mission, icp: ICP, graph: Graph, accounts: Accounts, competitors: Competitors, outreach: Outreach, pipeline: Pipeline, analytics: Analytics, warroom: WarRoom, billing: Billing }[view] || Mission;

  return (
    <ToastProvider>
      <div className="h-full flex overflow-hidden">
        <nav className="w-[232px] shrink-0 border-r border-white/5 bg-ink-900/60 flex flex-col">
          <div className="h-14 px-4 flex items-center gap-2.5 border-b border-white/5">
            <img src="/favicon.svg" className="size-7" alt="" />
            <div>
              <div className="font-semibold tracking-[0.22em] text-[13px]">✦ GRAVITY</div>
              <div className="text-[10px] text-zinc-500 -mt-0.5">self-driving GTM engine</div>
            </div>
          </div>
          <div className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
            {NAV.map((n) => {
              const badge = n.id === "outreach" ? pending : n.id === "warroom" ? hitl : n.id === "accounts" ? state?.accounts?.filter((a) => a.status !== "filtered").length : 0;
              return (
                <button key={n.id} onClick={() => setView(n.id)} className={cx("w-full flex items-center gap-2.5 px-3 h-9 rounded-md text-[13px] transition", view === n.id ? "bg-[#ffffff] text-white border border-[#e6e4de] shadow-[0_1px_2px_rgba(0,0,0,.04)]" : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03] border border-transparent")}>
                  <n.icon className={cx("size-4", view === n.id && "text-[#2f5bea]")} />
                  <span className="flex-1 text-left">{n.label}</span>
                  {badge ? <span className={cx("text-[10px] px-1.5 rounded-md tabular-nums", n.id === "outreach" || n.id === "warroom" ? "bg-[#2f5bea] !text-[#ffffff]" : "bg-white/10 text-zinc-300")}>{badge}</span> : null}
                </button>
              );
            })}
          </div>
          <div className="p-3 border-t border-white/5 space-y-1.5 text-[11px]">
            {[["Claude", integ.claude], ["Flexprice", integ.flexprice?.enabled], ["Band", integ.band?.enabled], ["Neo4j", integ.neo4j], ["Hunter", integ.hunter], ["Email", Boolean(integ.email?.provider)], ["Nexla", integ.nexla], ["Snyk CI", true]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-zinc-500"><span>{k}</span><span className={cx("flex items-center gap-1.5", v ? "text-emerald-400" : "text-zinc-600")}><span className={cx("size-1.5 rounded-full", v ? "bg-emerald-400" : "bg-zinc-600")} />{v ? "live" : k === "Neo4j" ? "built-in" : "demo"}</span></div>
            ))}
          </div>
        </nav>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 shrink-0 border-b border-white/5 flex items-center justify-between px-5 gap-4 bg-ink-900/40">
            <div className="flex items-center gap-4 min-w-0">
              <span className={cx("text-[10px] font-semibold tracking-wider px-2 py-1 rounded-md border", integ.mode === "live" ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" : "border-[#e2e0da] text-zinc-400 bg-[#ffffff]")}>{integ.mode === "live" ? "● LIVE" : "◐ DEMO DATA"}</span>
              {state?.product && <span className="text-sm text-zinc-300 truncate">Mission: <span className="text-white font-medium">{state.product.name}</span></span>}
              <RunTracker run={state?.run} />
            </div>
            <div className="flex items-center gap-2.5">
              <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-zinc-500"><Radio className={cx("size-3.5", ws.connected ? "text-emerald-400" : "text-rose-400")} />{ws.connected ? "realtime" : "reconnecting"}</div>
              <div className="hidden lg:block text-right">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 leading-none">AI spend</div>
                <div className="text-sm font-semibold tabular-nums">{fmt.usd(state?.telemetry?.total?.cost)}</div>
              </div>
              <CreditMeter billing={state?.billing} onClick={() => setView("billing")} />
              <button onClick={() => setFeed((f) => !f)} className="size-9 grid place-items-center rounded-xl hover:bg-white/5 text-zinc-400">{feed ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}</button>
            </div>
          </header>
          <div className="flex-1 flex min-h-0">
            <main className={cx("flex-1 min-w-0", view === "graph" ? "overflow-hidden p-3" : "overflow-y-auto")}>
              {state ? <V {...props} /> : <div className="p-10 text-zinc-500">Connecting to Gravity…</div>}
            </main>
            {feed && <ThinkingFeed state={state} onOpen={() => setView("warroom")} />}
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
