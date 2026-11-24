import { useState, Fragment } from "react";
import { Building2, Search, Sparkles, Radar, Download, Send, ChevronDown, ChevronRight, ShieldCheck, ShieldAlert, SquareUser as Linkedin, Mail, Server, Filter } from "lucide-react";
import { api } from "../api";
import { Copy as CopyIcon } from "lucide-react";
import { Card, Button, Badge, Tier, Score, SourceChip, EmailStatus, Empty, SectionTitle, useAction, cx } from "../ui";

export default function Accounts({ state, go }) {
  const [busy, run] = useAction();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState({});
  const [look, setLook] = useState({});
  const accs = state.accounts
    .filter((a) => (tab === "filtered" ? a.status === "filtered" : a.status !== "filtered" && (tab === "all" || a.tier === tab)))
    .filter((a) => !q || (a.name + a.industry + a.hq).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  if (!state.accounts.length) return <Empty icon={Building2} title="No accounts yet" action={<Button variant="primary" onClick={() => go("mission")}>Launch a mission</Button>}>The Scout agent discovers accounts and decision-makers from public evidence. Every row carries its source citations.</Empty>;

  const people = (id) => state.people.filter((p) => p.accountId === id);
  const counts = { all: state.accounts.filter((a) => a.status !== "filtered").length, A: 0, B: 0, C: 0, filtered: state.accounts.filter((a) => a.status === "filtered").length };
  state.accounts.forEach((a) => { if (a.status !== "filtered") counts[a.tier] = (counts[a.tier] || 0) + 1; });

  return (
    <div className="max-w-[1500px] mx-auto px-8 py-8">
      <SectionTitle eyebrow="Module 2 · Discovery & Enrichment" title="Accounts & Buyers" right={<>
        <Button icon={Search} loading={busy === "disc"} onClick={() => run("disc", () => api("/api/discover", { body: { count: 4 } }), (r) => `Discovered ${r.kept} more accounts`)}>Discover +4</Button>
        <Button icon={Sparkles} loading={busy === "enr"} onClick={() => run("enr", () => api("/api/enrich", { body: {} }), (r) => `Enriched ${r.enriched} buyers`)}>Enrich pending</Button>
        <Button icon={Radar} loading={busy === "radar"} onClick={() => run("radar", () => api("/api/signals/refresh", { body: {} }), (r) => `Signal radar: +${r.added} signals`)}>Signal radar</Button>
        <Button icon={Mail} loading={busy === "out"} onClick={() => run("out", () => api("/api/outreach", { body: {} }), (r) => `Drafted ${r.drafted} messages`)}>Draft outreach</Button>
        <Button icon={Send} loading={busy === "nexla"} onClick={() => run("nexla", () => api("/api/nexla/push", { body: {} }), (r) => (r.pushed ? `Streamed ${r.rows} leads to Nexla` : `Nexla: ${r.reason || "not configured"}`))}>Push to Nexla</Button>
        <a href="/api/export.csv"><Button icon={Download}>CSV</Button></a>
      </>}>
        Composite 0–100 fit + intent score. Hallucination-proof: claims that can't be traced to a retrieved source are dropped by the citation gate.
      </SectionTitle>

      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/5">
          {[["all", "All qualified"], ["A", "Tier A"], ["B", "Tier B"], ["C", "Tier C"], ["filtered", "Filtered"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cx("px-3 h-7 rounded-lg text-xs transition", tab === k ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white")}>{k === "filtered" && <Filter className="size-3 inline mr-1" />}{l} <span className="text-zinc-500 ml-1">{counts[k] || 0}</span></button>
          ))}
        </div>
        <input className="input !w-64 !py-1.5" placeholder="Search accounts…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tbl w-full">
            <thead><tr><th className="w-8" /><th>Account</th><th>Industry · HQ</th><th>Size</th><th>Fit</th><th>Intent</th><th>Score</th><th>Signals</th><th>Citations</th><th>Buyers · enrichment</th></tr></thead>
            <tbody>
              {accs.map((a) => {
                const ppl = people(a.id);
                const isOpen = open[a.id];
                return (
                  <Fragment key={a.id}>
                    <tr className="cursor-pointer" onClick={() => setOpen({ ...open, [a.id]: !isOpen })}>
                      <td>{isOpen ? <ChevronDown className="size-4 text-zinc-500" /> : <ChevronRight className="size-4 text-zinc-500" />}</td>
                      <td>
                        <div className="font-medium flex items-center gap-2">{a.name} {a.uses_competitors?.length ? <Badge color="rose">displacement</Badge> : null}</div>
                        <div className="text-xs text-zinc-500">{a.domain}</div>
                        {a.status === "filtered" && <div className="text-xs text-rose-300 mt-1">⛔ {a.filter_reason}</div>}
                      </td>
                      <td><div className="text-sm">{a.industry}</div><div className="text-xs text-zinc-500">{a.hq}</div></td>
                      <td className="tabular-nums text-sm">{a.headcount ? a.headcount.toLocaleString() : "—"}</td>
                      <td className="tabular-nums">{a.fit_score}</td>
                      <td className="tabular-nums">{a.intent_score}</td>
                      <td><div className="flex items-center gap-2"><Score value={a.score} /><Tier tier={a.tier} /></div></td>
                      <td><div className="flex flex-wrap gap-1 max-w-[220px]">{a.signals.slice(0, 3).map((s) => <Badge key={s.id} color={s.fresh ? "amber" : "lime"}>{s.fresh && "new · "}{s.type?.replace("_", " ")}</Badge>)}</div></td>
                      <td>{a.citation_status === "verified" ? <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><ShieldCheck className="size-3.5" />{a.verified_sources?.length} verified</span> : <span className="inline-flex items-center gap-1 text-xs text-rose-300"><ShieldAlert className="size-3.5" />unverified</span>}</td>
                      <td>
                        <div className="space-y-1">
                          {ppl.map((p) => (
                            <div key={p.id} className="flex items-center gap-2 text-xs">
                              <span className="text-zinc-200">{p.name}</span><span className="text-zinc-500 truncate max-w-[140px]">{p.title}</span>
                              <EmailStatus person={p} />
                              {p.linkedin_status === "verified" && <Linkedin className="size-3.5 text-sky-400" />}
                            </div>
                          ))}
                          {!ppl.length && <span className="text-xs text-zinc-500">—</span>}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr><td colSpan={10} className="!bg-black/20">
                        <div className="grid lg:grid-cols-3 gap-4 p-3">
                          <div>
                            <div className="label">Why it fits</div>
                            <div className="text-sm text-zinc-300">{a.why_fit}</div>
                            <div className="label mt-4">Buying signals</div>
                            <div className="space-y-2">
                              {a.signals.map((s) => (
                                <div key={s.id} className="text-sm">
                                  <div className="flex items-center gap-2"><Badge color={s.fresh ? "amber" : "lime"}>{s.type?.replace("_", " ")}</Badge><span className="text-xs text-zinc-500">{s.date}</span></div>
                                  <div className="text-zinc-300 mt-1">{s.text}</div>
                                  <div className="mt-1"><SourceChip url={s.source} verified={s.verified} /></div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="label">Decision-makers & enrichment waterfall</div>
                            {ppl.map((p) => (
                              <div key={p.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-2">
                                <div className="flex items-center justify-between"><div className="font-medium text-sm">{p.name}</div><EmailStatus person={p} /></div>
                                <div className="text-xs text-zinc-500">{p.title}{p.prior_companies?.length ? ` · ex-${p.prior_companies.join(", ")}` : ""}{p.schools?.length ? ` · ${p.schools.join(", ")}` : ""}</div>
                                {p.email && <div className="text-xs font-mono text-zinc-300 mt-1.5 flex items-center gap-1.5"><Mail className="size-3" />{p.email}</div>}
                                {p.mail_provider && <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5"><Server className="size-3" />{p.mail_provider} · {p.mx?.[0]}</div>}
                                <div className="mt-2 space-y-0.5">{p.steps?.map((s, i) => <div key={i} className="text-[11px] flex gap-1.5"><span className={s.ok ? "text-emerald-400" : "text-zinc-600"}>{s.ok ? "✓" : "·"}</span><span className="text-zinc-500 w-14">{s.step}</span><span className="text-zinc-400">{s.detail}</span></div>)}</div>
                                <div className="flex gap-2 mt-2">{p.source && <SourceChip url={p.source} verified={p.source_verified} />}{p.linkedin && <a href={p.linkedin} target="_blank" rel="noreferrer" className="text-[11px] text-sky-300 hover:underline flex items-center gap-1"><Linkedin className="size-3" />{p.linkedin_status === "verified" ? "profile" : "search"}</a>}</div>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="label">All sources ({a.sources.length})</div>
                            <div className="flex flex-wrap gap-1.5">{a.sources.map((u) => <SourceChip key={u} url={u} verified={a.verified_sources?.includes(u)} />)}</div>
                            <div className="label mt-4">Score breakdown</div>
                            <div className="text-sm text-zinc-400">Fit {a.fit_score} × 0.55 + Intent {a.intent_score} × 0.45 = <span className="text-white font-semibold">{a.score}</span></div>
                            {a.tools_used?.length > 0 && <><div className="label mt-4">Known tools</div><div className="flex gap-1 flex-wrap">{a.tools_used.map((t) => <Badge key={t}>{t}</Badge>)}</div></>}
                            <div className="label mt-4">Lookalike accounts · Moss</div>
                            <Button size="sm" icon={CopyIcon} loading={busy === "look" + a.id} onClick={(e) => { e.stopPropagation(); run("look" + a.id, async () => { const r = await api(`/api/accounts/${a.id}/lookalikes`); setLook({ ...look, [a.id]: r }); }); }}>Find lookalikes</Button>
                            {look[a.id] && (
                              <div className="mt-2 space-y-1">
                                <div className="text-[10px] uppercase tracking-wider text-zinc-500">{look[a.id].engine === "moss" ? "Moss" : "Moss · local fallback"} · {look[a.id].ms}ms</div>
                                {look[a.id].results.map((r) => <div key={r.id} className="text-xs flex items-center justify-between gap-2"><span className="text-zinc-300">{r.metadata?.name}</span><span className="font-mono text-zinc-500">{r.score.toFixed(2)}</span></div>)}
                                {!look[a.id].results.length && <div className="text-xs text-zinc-500">No close matches yet.</div>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {!accs.length && <div className="p-10 text-center text-sm text-zinc-500">Nothing in this view.</div>}
      </Card>
    </div>
  );
}
