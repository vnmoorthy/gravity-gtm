import { useState, useMemo } from "react";
import { MailCheck, Check, X, Pencil, Wand2, ShieldCheck, ShieldAlert, ShieldX, SquareUser as Linkedin, Mail, Bot, FlaskConical, Send, Quote, Sparkles } from "lucide-react";
import { api, fmt } from "../api";
import { Card, Button, Badge, Tier, SourceChip, EmailStatus, Empty, SectionTitle, useAction, cx } from "../ui";

function Security({ s }) {
  if (!s) return null;
  const I = s.status === "clear" ? ShieldCheck : s.status === "warn" ? ShieldAlert : ShieldX;
  const c = s.status === "clear" ? "text-emerald-300" : s.status === "warn" ? "text-amber-300" : "text-rose-300";
  return (
    <div className="text-xs">
      <div className={cx("flex items-center gap-1.5 font-medium", c)}><I className="size-3.5" />Sentinel: {s.status} · {s.links.length} links scanned</div>
      {s.findings.map((f, i) => <div key={i} className={cx("ml-5 mt-0.5", f.severity === "high" ? "text-rose-300" : "text-amber-200/80")}>• {f.text}</div>)}
    </div>
  );
}

function Message({ m, busy, run, best }) {
  const [edit, setEdit] = useState(false);
  const [subject, setSubject] = useState(m.subject);
  const [body, setBody] = useState(m.body);
  const [instr, setInstr] = useState("");
  const locked = ["sent", "rejected", "not_chosen"].includes(m.status);

  const save = () => run("save" + m.id, async () => { await api(`/api/messages/${m.id}`, { method: "PATCH", body: { subject, body } }); setEdit(false); }, "Edit saved · re-scanned by Sentinel");
  const unsupported = m.review?.unsupported || [];
  const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9$]/g, "");
  const renderBody = () => {
    if (!unsupported.length) return m.body;
    const bad = unsupported.map(norm).filter(Boolean);
    return m.body.split(/((?<=[.!?])\s+|\n)/).map((seg, i) => {
      const n = norm(seg);
      const hit = n.length > 8 && bad.some((u) => u.includes(n) || n.includes(u.slice(0, 40)));
      return hit ? <span key={i} className="line-through decoration-rose-500 decoration-2 text-rose-300 bg-rose-500/10 rounded px-0.5">{seg}</span> : seg;
    });
  };

  return (
    <Card className={cx("p-4 transition", m.status === "sent" && "opacity-70", m.status === "not_chosen" && "opacity-35", m.status === "blocked" && "border-rose-500/40", best && m.status === "pending_review" && "ring-1 ring-amber-500/40")}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          {m.channel === "email" ? <Mail className="size-4 text-pink-300" /> : <Linkedin className="size-4 text-sky-300" />}
          <span className="text-xs text-zinc-400">Touch {m.step} · {m.channel}</span>
          <Badge color={m.variant === "A" ? "violet" : "cyan"}>Variant {m.variant} · {m.angle}</Badge>
          {best && m.status === "pending_review" && <Badge color="amber">★ Twin's pick</Badge>}
          {m.edited && <Badge>rep-edited</Badge>}
        </div>
        <Badge color={{ pending_review: "amber", sent: "emerald", rejected: "rose", blocked: "rose", not_chosen: "zinc", approved: "emerald" }[m.status]}>{m.status.replace("_", " ")}</Badge>
      </div>

      {edit ? (
        <div className="space-y-2">
          {m.channel === "email" && <input className="input !text-sm" value={subject} onChange={(e) => setSubject(e.target.value)} />}
          <textarea className="input !text-sm min-h-[180px] font-mono !leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex gap-2"><Button size="sm" variant="primary" loading={busy === "save" + m.id} onClick={save}>Save edit</Button><Button size="sm" variant="ghost" onClick={() => setEdit(false)}>Cancel</Button></div>
        </div>
      ) : (
        <>
          {m.subject && <div className="text-sm font-medium mb-1.5">Subject: <span className="text-zinc-200">{m.subject}</span></div>}
          <div className="text-[13.5px] text-zinc-300 whitespace-pre-wrap leading-relaxed">{renderBody()}</div>
        </>
      )}

      <div className="grid md:grid-cols-3 gap-3 mt-3.5 pt-3 border-t border-white/5">
        <div className="text-xs">
          <div className={cx("flex items-center gap-1.5 font-medium", m.review?.verdict === "pass" ? "text-emerald-300" : "text-amber-300")}><Bot className="size-3.5" />Reviewer: {m.review?.verdict || "…"}</div>
          <div className="text-zinc-500 mt-0.5">{m.review?.notes}</div>
          {unsupported.map((u, i) => <div key={i} className="text-rose-300 mt-0.5">✗ unsupported: “{u}”</div>)}
          <div className="flex flex-wrap gap-1 mt-1.5">{m.claims?.filter((c) => c.source).map((c, i) => <SourceChip key={i} url={c.source} />)}</div>
        </div>
        <div className="text-xs">
          <div className="flex items-center gap-1.5 font-medium text-teal-300"><Sparkles className="size-3.5" />Buyer Twin: {fmt.pct(m.twin?.reply_probability)} reply odds</div>
          <div className="text-zinc-500 mt-0.5">Objection: {m.twin?.objection}</div>
          {m.twin?.reply && <div className="mt-1 text-zinc-400 italic flex gap-1"><Quote className="size-3 shrink-0 mt-0.5" />{m.twin.reply}</div>}
        </div>
        <Security s={m.security} />
      </div>

      {m.delivery && <div className="text-[11px] mt-2 text-zinc-500">Delivery: {m.delivery.delivered ? `✓ ${m.delivery.provider} → ${m.delivery.to} (${m.delivery.mode})` : m.delivery.note || m.delivery.error || "simulated"}</div>}

      {!locked && !edit && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3.5">
          <Button size="sm" variant="success" icon={Check} disabled={m.status === "blocked"} loading={busy === "ap" + m.id} onClick={() => run("ap" + m.id, () => api(`/api/messages/${m.id}/approve`, { body: {} }), (r) => (r.delivery?.delivered ? `Sent via ${r.delivery.provider}` : "Approved · dispatched (sandbox)"))}>Approve & send</Button>
          <Button size="sm" icon={Pencil} onClick={() => setEdit(true)}>Edit</Button>
          <Button size="sm" variant="danger" icon={X} loading={busy === "rj" + m.id} onClick={() => run("rj" + m.id, () => api(`/api/messages/${m.id}/reject`, { body: { reason: "Off-tone" } }))}>Reject</Button>
          <div className="flex items-center gap-1 ml-auto">
            <input className="input !h-7 !py-0 !text-xs !w-52" placeholder="AI rewrite: e.g. more casual" value={instr} onChange={(e) => setInstr(e.target.value)} />
            <Button size="sm" icon={Wand2} loading={busy === "rw" + m.id} disabled={!instr} onClick={() => run("rw" + m.id, async () => { const r = await api(`/api/messages/${m.id}/rewrite`, { body: { instruction: instr } }); setBody(r.body); setSubject(r.subject); setInstr(""); }, "Rewritten by Writer")}>Rewrite</Button>
            <Button size="sm" variant="ghost" icon={FlaskConical} title="Red-team: inject a false claim and watch the Reviewer catch it" loading={busy === "rt" + m.id} onClick={() => run("rt" + m.id, () => api(`/api/messages/${m.id}/redteam`, { body: {} }), (r) => `Reviewer verdict: ${r.review?.verdict} · ${r.review?.unsupported?.length || 0} unsupported claims struck`)}>Inject lie</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function Outreach({ state, go }) {
  const [busy, run] = useAction();
  const [filter, setFilter] = useState("pending_review");
  const [sel, setSel] = useState(null);

  const byPerson = useMemo(() => {
    const m = new Map();
    for (const msg of state.messages) { if (!m.has(msg.personId)) m.set(msg.personId, []); m.get(msg.personId).push(msg); }
    return m;
  }, [state.messages]);

  if (!state.messages.length) return <Empty icon={MailCheck} title="The review queue is empty" action={<Button variant="primary" onClick={() => go("mission")}>Launch a mission</Button>}>Writer drafts signal-personalised sequences; Reviewer fact-checks, Buyer Twin predicts replies and Sentinel scans links. Then it waits here for you.</Empty>;

  const leads = [...byPerson.entries()].map(([pid, msgs]) => ({ p: state.people.find((x) => x.id === pid), msgs, a: state.accounts.find((x) => x.id === msgs[0].accountId) }))
    .filter((x) => x.p && (filter === "all" || x.msgs.some((m) => m.status === filter)))
    .sort((x, y) => (y.a?.score || 0) - (x.a?.score || 0));
  const current = leads.find((l) => l.p.id === sel) || leads[0];
  const pending = state.messages.filter((m) => m.status === "pending_review");
  const passing = pending.filter((m) => m.review?.verdict === "pass" && m.security?.status === "clear" && (m.step !== 1 || m.variant === "A"));

  const bestId = (msgs) => { const s1 = msgs.filter((m) => m.step === 1 && m.status === "pending_review"); return s1.sort((a, b) => (b.twin?.reply_probability || 0) - (a.twin?.reply_probability || 0))[0]?.id; };

  return (
    <div className="max-w-[1500px] mx-auto px-8 py-8">
      <SectionTitle eyebrow="Module 4 · Human-in-the-loop gateway" title="Review Terminal" right={<>
        <Button icon={Send} variant="primary" disabled={!passing.length} loading={busy === "batch"} onClick={() => run("batch", () => api("/api/messages/approve-batch", { body: { ids: passing.map((m) => m.id) } }), (r) => `Approved & dispatched ${r.sent} messages`)}>Approve all passing ({passing.length})</Button>
      </>}>
        Nothing transmits without your approval. Every claim is traced to a source, every link is scanned, and every variant is pre-flighted against a simulated buyer.
      </SectionTitle>

      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/5 w-fit mb-4">
        {[["pending_review", "Awaiting approval"], ["sent", "Sent"], ["blocked", "Blocked"], ["rejected", "Rejected"], ["all", "All"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cx("px-3 h-7 rounded-lg text-xs", filter === k ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white")}>{l} <span className="text-zinc-500">{k === "all" ? state.messages.length : state.messages.filter((m) => m.status === k).length}</span></button>
        ))}
      </div>

      <div className="grid grid-cols-[320px_1fr] gap-4">
        <div className="space-y-1.5 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
          {leads.map(({ p, a, msgs }) => (
            <button key={p.id} onClick={() => setSel(p.id)} className={cx("w-full text-left p-3 rounded-xl border transition", current?.p.id === p.id ? "bg-white/[0.07] border-amber-500/30" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]")}>
              <div className="flex items-center justify-between"><span className="text-sm font-medium">{p.name}</span>{a && <Tier tier={a.tier} />}</div>
              <div className="text-xs text-zinc-500 truncate">{p.title} · {a?.name}</div>
              <div className="flex items-center justify-between mt-1.5"><EmailStatus person={p} /><span className="text-[11px] text-zinc-500">{msgs.filter((m) => m.status === "pending_review").length} pending</span></div>
            </button>
          ))}
          {!leads.length && <div className="text-sm text-zinc-500 p-4">Nothing here.</div>}
        </div>
        {current && (
          <div className="space-y-3 min-w-0">
            <Card className="p-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-medium">{current.p.name} <span className="text-zinc-500 font-normal">· {current.p.title}</span></div>
                <div className="text-sm text-zinc-400">{current.a?.name} · {current.p.email || "no email"} · score {current.a?.score}</div>
              </div>
              <div className="flex flex-wrap gap-1 max-w-md justify-end">{current.a?.signals?.slice(0, 3).map((s) => <SourceChip key={s.id} url={s.source} verified={s.verified} />)}</div>
            </Card>
            {current.msgs.sort((a, b) => a.step - b.step || a.variant.localeCompare(b.variant)).map((m) => <Message key={m.id + m.body.length} m={m} busy={busy} run={run} best={m.id === bestId(current.msgs)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
