import { useState } from "react";
import { Rocket, Wand2, Plus, X, Building2, Users, MailCheck, CalendarCheck, ShieldCheck, Coins } from "lucide-react";
import { api, fmt } from "../api";
import { Card, Button, useAction, cx } from "../ui";

const SAMPLES = [
  {
    key: "ledgerly", label: "Ledgerly · AP automation",
    name: "Ledgerly",
    description: "AI accounts-payable automation for mid-market finance teams. Ledgerly reads invoices from email, 3-way matches them against POs and receipts in NetSuite/QuickBooks, flags duplicates and fraud, and routes approvals in Slack — cutting invoice processing time by 80%.",
    website: "",
    customers: "Two logistics companies (~600 employees) and one wholesale distributor; champions were VP Finance / Controller.",
    pricing: "$24k–$60k ACV, annual contract, priced per invoice volume",
    constraints: "US & Canada only; SOC 2 Type II; integrates with NetSuite, QuickBooks Online, Sage Intacct",
    competitorHint: "Bill.com",
    team: [{ name: "Maya Patel", title: "Founder & CEO", prior: "Flexport, Brex", schools: "Stanford" }],
  },
  {
    key: "shipsafe", label: "Shipsafe · AI code security",
    name: "Shipsafe",
    description: "AI code-review agent that catches security vulnerabilities and secrets in pull requests before merge, with auto-generated fixes. Built for fast-moving fintech and health-tech engineering teams that must pass SOC 2 / HIPAA audits.",
    website: "",
    customers: "3 Series B fintechs (150–400 engineers); champion: Head of Platform / AppSec lead",
    pricing: "$40/dev/month, typical ACV $30k–$120k",
    constraints: "GitHub & GitLab only; US/EU",
    competitorHint: "Snyk",
    team: [{ name: "Jordan Kim", title: "Co-founder & CTO", prior: "Stripe, Datadog", schools: "Carnegie Mellon University" }],
  },
  {
    key: "gravity", label: "Gravity · (meta) GTM engine",
    name: "Gravity",
    description: "Self-driving go-to-market engine for seed–Series B B2B startups: infers the ICP from one sentence, discovers cited accounts and buyers, maps a knowledge graph of warm paths and competitor displacement, enriches contacts with MX validation, and drafts signal-personalized outreach behind a human approval gate.",
    website: "",
    customers: "Founder-led sales teams at 10–80 person B2B SaaS startups",
    pricing: "Usage-based credits, $300–$2k/month",
    constraints: "North America & Europe",
    competitorHint: "Clay",
    team: [{ name: "Sam Rivera", title: "Founder", prior: "HubSpot, Gong", schools: "UC Berkeley" }],
  },
];

function Stat({ icon: Icon, label, value, sub, color }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500"><Icon className="size-3.5" style={{ color }} />{label}</div>
      <div className="text-3xl font-semibold mt-1.5 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
    </Card>
  );
}

export default function Mission({ state, go }) {
  const [f, setF] = useState({ name: "", description: "", website: "", customers: "", pricing: "", constraints: "", competitorHint: "", accountCount: 8, waitForIcpApproval: false, team: [{ name: "", title: "", prior: "", schools: "" }] });
  const [busy, run] = useAction();
  const [adv, setAdv] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target?.type === "checkbox" ? e.target.checked : e.target.value });
  const setTeam = (i, k, v) => setF({ ...f, team: f.team.map((t, j) => (j === i ? { ...t, [k]: v } : t)) });

  const launch = () => run("launch", async () => {
    const team = f.team.filter((t) => t.name).map((t) => ({ name: t.name, title: t.title, prior_companies: t.prior.split(",").map((s) => s.trim()).filter(Boolean), schools: t.schools.split(",").map((s) => s.trim()).filter(Boolean) }));
    await api("/api/intake", { body: { ...f, team, sender: team[0]?.name?.split(" ")[0] } });
    setTimeout(() => go("warroom"), 600);
  }, "Mission launched — agents are spinning up");

  const s = state;
  const live = s.accounts.filter((a) => a.status !== "filtered");
  const deliverable = s.people.filter((p) => ["verified", "likely"].includes(p.email_status)).length;
  const meetings = s.leads.filter((l) => ["meeting", "closed"].includes(l.stage)).length;

  return (
    <div className="relative">
      <div className="absolute inset-0 hairlines pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[520px] orb pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-8 pt-12 pb-16">
        <div className="text-center mb-12 pt-6">
          <div className="inline-flex items-center gap-2 text-[12px] text-zinc-400 border border-[#e2e0da] bg-[#ffffff] rounded-full px-3.5 py-1.5 mb-6"><span className="size-1.5 rounded-full bg-[#2f5bea]" />“Gravity is how founders grow pipeline without losing control.”</div>
          <h1 className="font-serif text-6xl md:text-[80px] leading-[0.98]">The Revenue Engine<br /><span className="sub-ink">from one sentence to booked meetings.</span></h1>
          <p className="text-zinc-400 mt-5 max-w-2xl mx-auto">Describe what you sell. Eleven agents infer your ICP, find real accounts with live buying signals, map warm paths in a knowledge graph, verify contacts, and draft outreach you approve. Credits are metered by Flexprice the whole way.</p>
        </div>

        <Card className="p-6 glow-amber">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium flex items-center gap-2"><Wand2 className="size-4 text-[#2f5bea]" />Product intake</div>
            <div className="flex gap-1.5">
              {SAMPLES.map((x) => <Button key={x.key} size="sm" variant="ghost" onClick={() => setF({ ...f, ...x, team: x.team })}>{x.label}</Button>)}
            </div>
          </div>
          <div className="grid md:grid-cols-[1fr_2fr] gap-4">
            <div><label className="label">Product name</label><input className="input" value={f.name} onChange={set("name")} placeholder="Ledgerly" /></div>
            <div><label className="label">Website (optional, grounds the ICP)</label><input className="input" value={f.website} onChange={set("website")} placeholder="https://…" /></div>
          </div>
          <div className="mt-4"><label className="label">What do you sell? (plain language)</label><textarea className="input min-h-[96px] text-[15px] leading-relaxed" value={f.description} onChange={set("description")} placeholder="AI accounts-payable automation for mid-market finance teams…" /></div>

          <button onClick={() => setAdv(!adv)} className="text-xs text-zinc-400 hover:text-white mt-3">{adv ? "− Hide" : "+ Add"} reference wins, pricing, constraints & team network (powers warm paths)</button>
          {adv && (
            <div className="mt-4 space-y-4 fade-in">
              <div className="grid md:grid-cols-3 gap-4">
                <div><label className="label">Existing customers / wins</label><textarea className="input min-h-[70px]" value={f.customers} onChange={set("customers")} /></div>
                <div><label className="label">Pricing · ACV · motion</label><textarea className="input min-h-[70px]" value={f.pricing} onChange={set("pricing")} /></div>
                <div><label className="label">Constraints (regions, compliance, stack)</label><textarea className="input min-h-[70px]" value={f.constraints} onChange={set("constraints")} /></div>
              </div>
              <div>
                <label className="label">Your team's network (past employers & schools, comma-separated). Powers the warm-intro path finder.</label>
                {f.team.map((t, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1.4fr_1.2fr_auto] gap-2 mb-2">
                    <input className="input" placeholder="Name" value={t.name} onChange={(e) => setTeam(i, "name", e.target.value)} />
                    <input className="input" placeholder="Title" value={t.title} onChange={(e) => setTeam(i, "title", e.target.value)} />
                    <input className="input" placeholder="Past employers" value={t.prior} onChange={(e) => setTeam(i, "prior", e.target.value)} />
                    <input className="input" placeholder="Schools" value={t.schools} onChange={(e) => setTeam(i, "schools", e.target.value)} />
                    <Button variant="ghost" icon={X} onClick={() => setF({ ...f, team: f.team.filter((_, j) => j !== i) })} />
                  </div>
                ))}
                <Button size="sm" variant="ghost" icon={Plus} onClick={() => setF({ ...f, team: [...f.team, { name: "", title: "", prior: "", schools: "" }] })}>Add teammate</Button>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="w-64"><label className="label">Accounts to discover: {f.accountCount}</label><input type="range" min="4" max="14" value={f.accountCount} onChange={set("accountCount")} className="w-full accent-amber-500" /></div>
                <div className="w-56"><label className="label">Known incumbent (optional)</label><input className="input" value={f.competitorHint} onChange={set("competitorHint")} placeholder="e.g. Bill.com" /></div>
                <label className="flex items-center gap-2 text-sm text-zinc-300 mt-5"><input type="checkbox" checked={f.waitForIcpApproval} onChange={set("waitForIcpApproval")} className="accent-amber-500" />Pause for my ICP approval before spending credits</label>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/5">
            <div className="text-xs text-zinc-500">{s.integrations.mode === "live" ? `Live: ${s.integrations.model} + web search with citations` : "Demo mode: add ANTHROPIC_API_KEY for live web discovery"} · {s.billing?.balance} credits available</div>
            <Button variant="primary" size="lg" icon={Rocket} loading={busy === "launch" || s.running} disabled={!f.name || !f.description} onClick={launch}>{s.running ? "Autopilot running…" : "Launch Autopilot"}</Button>
          </div>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-8">
          <Stat icon={Building2} label="Accounts" value={live.length} sub={`${s.accounts.length - live.length} filtered by gates`} color="#8b5cf6" />
          <Stat icon={Users} label="Buyers" value={s.people.length} sub={`${deliverable} deliverable`} color="#22d3ee" />
          <Stat icon={MailCheck} label="In review" value={s.messages.filter((m) => m.status === "pending_review").length} sub={`${s.messages.filter((m) => m.status === "sent").length} sent`} color="#f472b6" />
          <Stat icon={CalendarCheck} label="Meetings" value={meetings} sub={`${s.leads.length} in pipeline`} color="#34d399" />
          <Stat icon={ShieldCheck} label="Blocked" value={s.messages.filter((m) => m.status === "blocked").length} sub="by Sentinel" color="#ef4444" />
          <Stat icon={Coins} label="AI spend" value={fmt.usd(s.telemetry.total.cost)} sub={`${fmt.num(s.telemetry.total.in + s.telemetry.total.out)} tokens`} color="#84cc16" />
        </div>

        {s.product && (
          <div className="grid md:grid-cols-4 gap-3 mt-3">
            {[["icp", "Review your ICP", "Confidence-scored, with expansion segments"], ["graph", "Explore the graph", "Warm paths & displacement plays"], ["outreach", "Approve outreach", "Nothing sends without you"], ["pipeline", "Work the pipeline", "AI vs rep attribution"]].map(([id, t, d]) => (
              <button key={id} onClick={() => go(id)} className={cx("glass rounded-2xl p-4 text-left hover:bg-white/[0.06] transition group")}>
                <div className="text-sm font-medium group-hover:text-[#2f5bea]">{t} →</div>
                <div className="text-xs text-zinc-500 mt-0.5">{d}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
