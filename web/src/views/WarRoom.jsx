import { useState, useRef, useEffect } from "react";
import { Users2, Send, Check, X, Coins, Cpu, Link2 } from "lucide-react";
import { api, fmt } from "../api";
import { Card, Button, Badge, Md, SectionTitle, useAction, cx } from "../ui";

export default function WarRoom({ state }) {
  const [busy, run] = useAction();
  const [filter, setFilter] = useState(null);
  const [text, setText] = useState("");
  const ref = useRef(null);
  const agents = state.agents || {};
  const tel = state.telemetry.byAgent || {};
  const log = state.agentLog.filter((m) => !filter || m.agent === filter || m.to?.includes(filter));
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); }, [log.length]);
  const pendingAp = state.approvals.filter((a) => a.status === "pending");
  const band = state.integrations.band || {};

  const send = () => run("cmd", async () => { const r = await api("/api/command", { body: { text } }); setText(""); return r; }, (r) => r.reply || "Sent to the room");

  return (
    <div className="h-full flex flex-col max-w-[1500px] mx-auto px-8 py-8">
      <SectionTitle eyebrow="Band · multi-agent orchestration" title="Agent War Room" right={
        <div className={cx("flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border", band.enabled && band.chatId ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/5" : "border-white/10 text-zinc-400")}>
          <Link2 className="size-3.5" />{band.enabled && band.chatId ? `Mirrored to Band room ${String(band.chatId).slice(0, 8)}… · ${band.posted || 0} events` : band.enabled ? `Band: ${band.lastError || "connecting"}` : "Band: add BAND_API_KEY to mirror this room"}
        </div>
      }>
        Specialised agents hand off through @mentions in one shared stream. Planner allocates, Builders execute, Reviewer audits, Sentinel secures, Governor meters spend, and you hold every decision.
      </SectionTitle>

      <div className="grid grid-cols-[300px_1fr] gap-4 flex-1 min-h-0">
        <div className="space-y-2 overflow-y-auto pr-1">
          <Card className="p-3">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2 flex items-center justify-between"><span>Session telemetry</span><Cpu className="size-3.5" /></div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-lg font-semibold tabular-nums">{fmt.num(state.telemetry.total.in + state.telemetry.total.out)}</div><div className="text-[10px] text-zinc-500">tokens</div></div>
              <div><div className="text-lg font-semibold tabular-nums">{state.telemetry.total.calls}</div><div className="text-[10px] text-zinc-500">LLM calls</div></div>
              <div><div className="text-lg font-semibold tabular-nums">{fmt.usd(state.telemetry.total.cost)}</div><div className="text-[10px] text-zinc-500">cost</div></div>
            </div>
          </Card>
          {Object.entries(agents).map(([id, a]) => {
            const t = tel[id];
            const n = state.agentLog.filter((m) => m.agent === id).length;
            return (
              <button key={id} onClick={() => setFilter(filter === id ? null : id)} className={cx("w-full text-left p-3 rounded-xl border transition", filter === id ? "bg-white/[0.07] border-white/20" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]")}>
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg grid place-items-center" style={{ background: a.color + "22", border: `1px solid ${a.color}55` }}>{a.emoji}</div>
                  <div className="min-w-0 flex-1"><div className="text-sm font-medium" style={{ color: a.color }}>{a.name}</div><div className="text-[11px] text-zinc-500 truncate">{a.role}</div></div>
                  <span className="text-[11px] text-zinc-500 tabular-nums">{n}</span>
                </div>
                {t && <div className="flex gap-3 mt-2 text-[10.5px] text-zinc-500 font-mono"><span>{fmt.num(t.in + t.out)} tok</span><span>{t.searches} srch</span><span className="text-lime-300/80">{fmt.usd(t.cost)}</span></div>}
              </button>
            );
          })}
        </div>

        <Card className="flex flex-col min-h-[60vh] overflow-hidden">
          {pendingAp.length > 0 && (
            <div className="p-3 border-b border-amber-500/20 bg-amber-500/[0.06] space-y-2">
              {pendingAp.map((ap) => (
                <div key={ap.id} className="flex items-center justify-between gap-3">
                  <div className="text-sm"><Badge color="amber">HITL</Badge> <span className="ml-1">{ap.title}</span></div>
                  <div className="flex gap-1.5"><Button size="sm" variant="success" icon={Check} onClick={() => run(ap.id, () => api(`/api/approvals/${ap.id}`, { body: { decision: "approve" } }))}>Approve</Button><Button size="sm" variant="danger" icon={X} onClick={() => run(ap.id, () => api(`/api/approvals/${ap.id}`, { body: { decision: "reject" } }))}>Reject</Button></div>
                </div>
              ))}
            </div>
          )}
          <div ref={ref} className="flex-1 overflow-y-auto p-5 space-y-4">
            {!log.length && <div className="text-sm text-zinc-500 text-center py-16">The room is quiet. Launch a mission and the agents will start coordinating here.</div>}
            {log.map((m) => {
              const a = agents[m.agent] || {};
              const human = m.agent === "human";
              return (
                <div key={m.id} className={cx("flex gap-3 fade-in", human && "flex-row-reverse")}>
                  <div className="size-9 rounded-xl grid place-items-center shrink-0 text-base" style={{ background: (a.color || "#888") + "22", border: `1px solid ${(a.color || "#888")}55` }}>{a.emoji}</div>
                  <div className={cx("max-w-[78%]", human && "text-right")}>
                    <div className={cx("flex items-center gap-2 text-xs mb-1", human && "justify-end")}>
                      <span className="font-semibold" style={{ color: a.color }}>{a.name}</span><span className="text-zinc-600">{a.role}</span><span className="text-zinc-600">{new Date(m.at).toLocaleTimeString()}</span>
                      {m.kind && <span className="text-[10px] uppercase tracking-wider text-zinc-600">{m.kind}</span>}
                      {m.tokens > 0 && <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1"><Coins className="size-3" />{fmt.num(m.tokens)} tok · {fmt.usd(m.cost)}</span>}
                    </div>
                    <div className={cx("inline-block text-left text-sm leading-relaxed px-3.5 py-2.5 rounded-2xl border", human ? "bg-sky-500/10 border-sky-500/20" : m.kind === "hitl" ? "bg-amber-500/[0.07] border-amber-500/25" : m.kind === "error" ? "bg-rose-500/10 border-rose-500/25" : m.kind === "billing" ? "bg-lime-500/[0.06] border-lime-500/20" : "bg-white/[0.035] border-white/5")}>
                      <Md text={m.text} />
                      {m.to?.length > 0 && <div className="mt-1.5 flex gap-1 flex-wrap">{m.to.map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">→ @{agents[t]?.name || t}</span>)}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t border-white/5 flex gap-2">
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && text && send()} placeholder="Talk to the room, e.g. “@Scout find 4 more accounts”, “@Enricher enrich”, “@Writer draft”, “@Scout radar”, “approve”" />
            <Button variant="primary" icon={Send} loading={busy === "cmd"} disabled={!text} onClick={send}>Send</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
