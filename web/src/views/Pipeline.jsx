import { useState } from "react";
import { KanbanSquare, Bot, User, Sparkles, X, History } from "lucide-react";
import { api, fmt } from "../api";
import { Card, Button, Tier, Empty, SectionTitle, useAction, cx, Badge } from "../ui";

const STAGES = [
  ["matched", "Matched", "#8b5cf6"], ["contacted", "Contacted", "#22d3ee"], ["replied", "Replied", "#f59e0b"],
  ["meeting", "Meeting Booked", "#34d399"], ["closed", "Closed Won", "#a3e635"], ["lost", "Lost", "#71717a"],
];

export default function Pipeline({ state, go }) {
  const [busy, run] = useAction();
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [open, setOpen] = useState(null);
  if (!state.leads.length) return <Empty icon={KanbanSquare} title="No leads in the pipeline" action={<Button variant="primary" onClick={() => go("mission")}>Launch a mission</Button>}>Matched buyers flow in automatically. Approved sends move them to Contacted. Drag cards to log rep actions.</Empty>;

  const move = (id, stage) => run("mv", () => api(`/api/leads/${id}/move`, { body: { stage } }));
  const lead = open && state.leads.find((l) => l.id === open);

  return (
    <div className="px-8 py-8">
      <SectionTitle eyebrow="Module 5 · Lead management" title="Pipeline" right={<>
        <Button icon={Sparkles} loading={busy === "sim"} onClick={() => run("sim", () => api("/api/leads/simulate-replies", { body: {} }), (r) => `Buyer Twin: ${r.replied}/${r.contacted} replied (simulated)`)}>Simulate replies (Buyer Twin)</Button>
      </>}>
        <span className="inline-flex items-center gap-1"><Bot className="size-3.5 text-amber-300" />AI-driven</span> vs <span className="inline-flex items-center gap-1"><User className="size-3.5 text-sky-300" />rep-driven</span> progression is tracked on every card, with a timestamped audit trail.
      </SectionTitle>
      <div className="grid grid-cols-6 gap-3 min-w-[1200px]">
        {STAGES.map(([k, label, color]) => {
          const items = state.leads.filter((l) => l.stage === k);
          return (
            <div key={k} onDragOver={(e) => { e.preventDefault(); setOver(k); }} onDragLeave={() => setOver(null)} onDrop={() => { if (drag) move(drag, k); setDrag(null); setOver(null); }}
              className={cx("rounded-2xl p-2 min-h-[60vh] transition border", over === k ? "border-amber-500/50 bg-amber-500/5" : "border-white/5 bg-white/[0.015]")}>
              <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                <div className="flex items-center gap-2 text-sm font-medium"><span className="size-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />{label}</div>
                <span className="text-xs text-zinc-500 tabular-nums">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((l) => {
                  const p = state.people.find((x) => x.id === l.personId);
                  const a = state.accounts.find((x) => x.id === l.accountId);
                  const last = l.history[l.history.length - 1];
                  return (
                    <div key={l.id} draggable onDragStart={() => setDrag(l.id)} onClick={() => setOpen(l.id)} className="glass rounded-xl p-3 cursor-grab active:cursor-grabbing hover:bg-white/[0.06] transition fade-in">
                      <div className="flex items-center justify-between gap-2"><div className="text-sm font-medium truncate">{p?.name}</div>{a && <Tier tier={a.tier} />}</div>
                      <div className="text-xs text-zinc-500 truncate">{p?.title}</div>
                      <div className="text-xs text-zinc-400 truncate">{a?.name}</div>
                      {l.reply && <div className="text-[11px] text-amber-100/80 italic mt-1.5 line-clamp-2">“{l.reply.text}”</div>}
                      <div className="flex items-center justify-between mt-2">
                        <span className={cx("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md", last?.actor === "rep" ? "bg-sky-500/15 text-sky-300" : "bg-amber-500/15 text-amber-300")}>{last?.actor === "rep" ? <User className="size-3" /> : <Bot className="size-3" />}{last?.actor === "rep" ? "Rep" : "AI"}</span>
                        <span className="text-[10px] text-zinc-500">{fmt.ago(last?.at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Card className="mt-6 p-4">
        <div className="text-sm font-medium flex items-center gap-2 mb-3"><History className="size-4 text-zinc-400" />Audit log</div>
        <div className="max-h-72 overflow-y-auto">
          <table className="tbl w-full"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead>
            <tbody>{state.audit.slice(0, 120).map((e) => (
              <tr key={e.id}><td className="text-xs text-zinc-500 whitespace-nowrap">{new Date(e.at).toLocaleTimeString()}</td><td><Badge color={e.actor === "rep" ? "sky" : e.actor === "ai" ? "amber" : "zinc"}>{e.actor}</Badge></td><td className="text-xs font-mono">{e.action}</td><td className="text-xs text-zinc-400 font-mono truncate max-w-[600px]">{JSON.stringify(e.detail)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Card>

      {lead && (() => {
        const p = state.people.find((x) => x.id === lead.personId);
        const a = state.accounts.find((x) => x.id === lead.accountId);
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onClick={() => setOpen(null)}>
            <div className="w-[460px] h-full bg-ink-900 border-l border-white/10 p-6 overflow-y-auto fade-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between"><div className="text-xl font-medium">{p?.name}</div><button onClick={() => setOpen(null)}><X className="size-5 text-zinc-500" /></button></div>
              <div className="text-sm text-zinc-400">{p?.title} · {a?.name}</div>
              <div className="text-xs text-zinc-500 mt-1 font-mono">{p?.email}</div>
              <div className="flex gap-1.5 mt-4 flex-wrap">{STAGES.map(([k, l]) => <Button key={k} size="sm" variant={lead.stage === k ? "primary" : "default"} onClick={() => move(lead.id, k)}>{l}</Button>)}</div>
              <div className="label mt-6">Timeline</div>
              <div className="relative pl-5 border-l border-white/10 space-y-4">
                {lead.history.map((h, i) => (
                  <div key={i} className="relative">
                    <div className={cx("absolute -left-[26px] top-0.5 size-3 rounded-full border-2 border-ink-900", h.actor === "rep" ? "bg-sky-400" : "bg-amber-400")} />
                    <div className="text-xs text-zinc-500">{new Date(h.at).toLocaleString()} · {h.actor === "rep" ? "Rep" : "AI"}</div>
                    <div className="text-sm"><span className="capitalize font-medium">{h.stage}</span> — <span className="text-zinc-400">{h.note}</span></div>
                  </div>
                ))}
              </div>
              <div className="label mt-6">Messages</div>
              {state.messages.filter((m) => m.personId === lead.personId && m.status === "sent").map((m) => <div key={m.id} className="text-xs p-2.5 rounded-lg bg-white/[0.03] border border-white/5 mb-2"><div className="text-zinc-400">{m.channel} · step {m.step} · variant {m.variant} · {fmt.ago(m.sentAt)}</div><div className="text-zinc-300 mt-1 whitespace-pre-wrap">{m.subject && <b>{m.subject}{"\n"}</b>}{m.body}</div></div>)}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
