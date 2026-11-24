import { useState } from "react";
import { Target, Check, X, Pencil, RefreshCw, Factory, Users, Zap, Ban, Gem, Globe2, Building } from "lucide-react";
import { api } from "../api";
import { Card, Button, Badge, Confidence, Empty, SectionTitle, useAction } from "../ui";

function Block({ icon: Icon, title, children, color = "#f59e0b" }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-400 mb-3"><Icon className="size-3.5" style={{ color }} />{title}</div>
      {children}
    </Card>
  );
}

export default function ICP({ state, go }) {
  const [busy, run] = useAction();
  const [edit, setEdit] = useState(null);
  const icp = state.icp;
  if (!icp) return <Empty icon={Target} title="No ICP yet" action={<Button variant="primary" onClick={() => go("mission")}>Start a mission</Button>}>Describe your product in Mission Control and the Strategist agent infers a structured ICP with field-level confidence.</Empty>;

  const patch = (body) => run("patch", () => api("/api/icp", { method: "PATCH", body }), "ICP updated");
  const exp = (id, body) => run(id, () => api(`/api/expansions/${id}`, { body }));

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <SectionTitle eyebrow="Module 1 · ICP Engine" title="Ideal Customer Profile" right={<>
        <Badge color={state.icpStatus === "approved" ? "emerald" : "amber"}>{state.icpStatus === "approved" ? "✓ Approved" : "Awaiting approval"}</Badge>
        <Button icon={RefreshCw} loading={busy === "re"} onClick={() => run("re", () => api("/api/icp/infer", { body: {} }), "ICP re-inferred")}>Re-infer</Button>
        <Button variant="primary" icon={Check} onClick={() => patch({})}>Approve ICP</Button>
      </>}>
        {icp.summary}
      </SectionTitle>

      <div className="grid lg:grid-cols-3 gap-4">
        <Block icon={Factory} title="Target industries · NAICS" color="#8b5cf6">
          <div className="space-y-3">
            {icp.industries?.map((i, k) => (
              <div key={k}>
                <div className="flex items-center justify-between gap-2"><div className="text-sm font-medium">{i.name} {i.expansion && <Badge color="violet">expansion</Badge>}</div><span className="text-[11px] font-mono text-zinc-500">{i.naics}</span></div>
                <div className="text-xs text-zinc-500 mb-1">{i.rationale}</div>
                <Confidence value={i.confidence} />
              </div>
            ))}
          </div>
        </Block>
        <Block icon={Building} title="Company size" color="#22d3ee">
          {edit === "size" ? (
            <div className="space-y-2">
              <div className="flex gap-2"><input id="hmin" className="input" defaultValue={icp.company_size?.headcount_min} /><input id="hmax" className="input" defaultValue={icp.company_size?.headcount_max} /></div>
              <Button size="sm" variant="primary" onClick={() => { patch({ company_size: { ...icp.company_size, headcount_min: +document.getElementById("hmin").value, headcount_max: +document.getElementById("hmax").value, confidence: 1 } }); setEdit(null); }}>Save</Button>
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between"><div className="text-3xl font-semibold tabular-nums">{icp.company_size?.headcount_min?.toLocaleString()}–{icp.company_size?.headcount_max?.toLocaleString()}</div><button onClick={() => setEdit("size")} className="text-zinc-500 hover:text-white"><Pencil className="size-3.5" /></button></div>
              <div className="text-xs text-zinc-500">employees · {icp.company_size?.revenue_band}</div>
              <div className="text-xs text-zinc-400 mt-2">{icp.company_size?.rationale}</div>
              <div className="mt-2"><Confidence value={icp.company_size?.confidence} /></div>
            </>
          )}
          <div className="mt-5 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-400 mb-2"><Globe2 className="size-3.5 text-sky-300" />Regions</div>
            {icp.regions?.map((r, k) => <div key={k} className="flex items-center justify-between gap-3 text-sm mb-1.5"><span>{r.name}</span><div className="w-28"><Confidence value={r.confidence} /></div></div>)}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">Pricing fit</div>
            <div className="text-sm">{icp.pricing_fit?.acv} · <Badge color="amber">{icp.pricing_fit?.motion}</Badge></div>
            <div className="mt-1.5"><Confidence value={icp.pricing_fit?.confidence} /></div>
          </div>
        </Block>
        <Block icon={Users} title="Buyer personas" color="#22d3ee">
          <div className="space-y-3">
            {icp.personas?.map((p, k) => (
              <div key={k} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center justify-between gap-2"><div className="text-sm font-medium">{p.title}</div><Badge color={p.buying_role === "economic buyer" ? "emerald" : p.buying_role === "champion" ? "amber" : "zinc"}>{p.buying_role}</Badge></div>
                <div className="text-xs text-zinc-500">{p.function} · {p.seniority}</div>
                <ul className="text-xs text-zinc-400 mt-1.5 list-disc pl-4 space-y-0.5">{p.pains?.map((x, j) => <li key={j}>{x}</li>)}</ul>
                <div className="mt-2"><Confidence value={p.confidence} /></div>
              </div>
            ))}
          </div>
        </Block>
        <Block icon={Zap} title="High-value trigger events" color="#a3e635">
          <div className="space-y-3">
            {icp.triggers?.map((t, k) => (
              <div key={k}>
                <div className="flex items-center gap-2"><Badge color="lime">{t.type?.replace("_", " ")}</Badge><span className="text-sm">{t.signal}</span></div>
                <div className="text-xs text-zinc-500 mt-1">{t.why}</div>
                <div className="mt-1"><Confidence value={t.confidence} /></div>
              </div>
            ))}
          </div>
        </Block>
        <Block icon={Ban} title="Negative signals (auto-filtered)" color="#f43f5e">
          <ul className="space-y-2">{icp.negative_signals?.map((n, k) => <li key={k} className="text-sm flex gap-2"><X className="size-4 text-rose-400 shrink-0 mt-0.5" />{n}</li>)}</ul>
          <div className="mt-5 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-400 mb-2"><Gem className="size-3.5 text-amber-300" />Value props</div>
            <ul className="space-y-1.5">{icp.value_props?.map((n, k) => <li key={k} className="text-sm text-zinc-300">— {n}</li>)}</ul>
          </div>
        </Block>
        <Block icon={Target} title="Intelligent ICP expansion" color="#f59e0b">
          <div className="text-xs text-zinc-500 mb-3">Adjacent and non-obvious segments, with evidence. You decide.</div>
          <div className="space-y-3">
            {state.expansions.map((e) => (
              <div key={e.id} className={`p-3 rounded-xl border ${e.status === "accepted" ? "border-emerald-500/30 bg-emerald-500/5" : e.status === "dismissed" ? "border-white/5 opacity-40" : "border-amber-500/20 bg-amber-500/[0.04]"}`}>
                {edit === e.id ? (
                  <div className="flex gap-2"><input id={`seg-${e.id}`} className="input" defaultValue={e.segment} /><Button size="sm" variant="primary" onClick={() => { exp(e.id, { segment: document.getElementById(`seg-${e.id}`).value }); setEdit(null); }}>Save</Button></div>
                ) : <div className="text-sm font-medium">{e.segment} {e.adjusted && <Badge>adjusted</Badge>}</div>}
                <div className="text-xs text-zinc-400 mt-1">{e.rationale}</div>
                <div className="text-xs text-zinc-500 mt-1 italic">Evidence: {e.evidence}</div>
                <div className="mt-2"><Confidence value={e.confidence} /></div>
                {e.status === "suggested" ? (
                  <div className="flex gap-1.5 mt-2.5">
                    <Button size="sm" variant="success" icon={Check} loading={busy === e.id} onClick={() => exp(e.id, { status: "accepted" })}>Accept</Button>
                    <Button size="sm" icon={Pencil} onClick={() => setEdit(e.id)}>Adjust</Button>
                    <Button size="sm" variant="ghost" icon={X} onClick={() => exp(e.id, { status: "dismissed" })}>Dismiss</Button>
                  </div>
                ) : <div className="text-[11px] mt-2 text-zinc-500">{e.status === "accepted" ? "✓ Merged into ICP; swept on next discovery" : "Dismissed"}</div>}
              </div>
            ))}
          </div>
        </Block>
      </div>
    </div>
  );
}
