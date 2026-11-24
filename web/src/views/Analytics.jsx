import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList } from "recharts";
import { api, fmt } from "../api";
import { Card, Empty, SectionTitle, Button, Badge } from "../ui";

const tip = { contentStyle: { background: "#ffffff", border: "1px solid #e6e4de", borderRadius: 8, fontSize: 12, color: "#0d0d0e" }, cursor: { fill: "rgba(0,0,0,.03)" } };
const FUN = ["#8b5cf6", "#22d3ee", "#f59e0b", "#34d399", "#a3e635"];

function KPI({ label, value, sub }) {
  return <Card className="p-4"><div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div><div className="text-3xl font-semibold mt-1 tabular-nums">{value}</div>{sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}</Card>;
}

export default function Analytics({ state, go }) {
  const [d, setD] = useState(null);
  useEffect(() => { api("/api/analytics").then(setD); }, [state.leads, state.messages]);
  if (!state.leads.length) return <Empty icon={BarChart3} title="No pipeline data yet" action={<Button variant="primary" onClick={() => go("mission")}>Launch a mission</Button>}>Conversion by industry and tier, A/B variant performance, AI vs rep attribution and unit economics appear once leads flow.</Empty>;
  if (!d) return null;
  const f = Object.fromEntries(d.funnel.map((x) => [x.stage, x.count]));
  const rr = f.contacted ? f.replied / f.contacted : 0;
  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <SectionTitle eyebrow="Module 5 · Performance analytics" title="Analytics">Stage conversion segmented by industry and tier, split-test analytics across variants and channels, and the cost of every meeting.</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPI label="Leads" value={f.matched} />
        <KPI label="Contacted" value={f.contacted} sub={fmt.pct(f.matched ? f.contacted / f.matched : 0) + " of matched"} />
        <KPI label="Reply rate" value={fmt.pct(rr)} sub={`${f.replied} replies`} />
        <KPI label="Meetings" value={f.meeting} sub={fmt.pct(f.replied ? f.meeting / f.replied : 0) + " of replies"} />
        <KPI label="AI spend" value={fmt.usd(d.economics.ai_spend_usd)} sub={`${d.economics.credits_used} credits`} />
        <KPI label="Cost / meeting" value={d.economics.cost_per_meeting != null ? fmt.usd(d.economics.cost_per_meeting) : "—"} sub={`${fmt.usd(d.economics.cost_per_lead)} per lead`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <Card className="p-5">
          <div className="text-sm font-medium mb-3">Funnel</div>
          <ResponsiveContainer width="100%" height={260}>
            <FunnelChart><Tooltip {...tip} /><Funnel dataKey="count" data={d.funnel.map((x, i) => ({ ...x, fill: FUN[i], name: x.stage }))} isAnimationActive><LabelList position="right" fill="#5e5e66" stroke="none" dataKey="stage" fontSize={11} /></Funnel></FunnelChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-medium mb-3">Conversion by industry</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.byIndustry} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke="rgba(0,0,0,.06)" horizontal={false} /><XAxis type="number" stroke="#52525b" fontSize={11} /><YAxis type="category" dataKey="segment" stroke="#71717a" fontSize={11} width={110} /><Tooltip {...tip} />
              <Bar dataKey="leads" fill="#8b5cf6" radius={[0, 4, 4, 0]} /><Bar dataKey="contacted" fill="#22d3ee" radius={[0, 4, 4, 0]} /><Bar dataKey="replied" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-medium mb-3">Attribution: AI vs rep actions</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart><Tooltip {...tip} /><Pie data={[{ name: "AI-driven", value: d.attribution.ai }, { name: "Rep-driven", value: d.attribution.rep }]} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none"><Cell fill="#f59e0b" /><Cell fill="#38bdf8" /></Pie></PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-xs"><span className="text-amber-300">● AI {d.attribution.ai}</span><span className="text-sky-300">● Rep {d.attribution.rep}</span></div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Card className="p-5">
          <div className="text-sm font-medium mb-1">A/B split test · touch 1</div>
          <div className="text-xs text-zinc-500 mb-3">Predicted (Buyer Twin) vs observed reply rate by variant</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.variants.map((v) => ({ ...v, name: `${v.variant} · ${v.angle}`, predicted: Math.round(v.predicted * 100), observed: Math.round(v.reply_rate * 100) }))}>
              <CartesianGrid stroke="rgba(0,0,0,.06)" vertical={false} /><XAxis dataKey="name" stroke="#71717a" fontSize={11} /><YAxis stroke="#52525b" fontSize={11} unit="%" /><Tooltip {...tip} />
              <Bar dataKey="predicted" fill="#2dd4bf" radius={[4, 4, 0, 0]} /><Bar dataKey="observed" fill="#f472b6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <table className="tbl w-full mt-2"><thead><tr><th>Variant</th><th>Drafted</th><th>Sent</th><th>Replies</th><th>Reply rate</th></tr></thead>
            <tbody>{d.variants.map((v) => <tr key={v.variant}><td><Badge color={v.variant === "A" ? "violet" : "cyan"}>{v.variant}</Badge> {v.angle}</td><td>{v.drafted}</td><td>{v.sent}</td><td>{v.replies}</td><td>{fmt.pct(v.reply_rate)}</td></tr>)}</tbody></table>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-medium mb-3">Conversion by tier</div>
          <table className="tbl w-full"><thead><tr><th>Tier</th><th>Leads</th><th>Contacted</th><th>Replied</th><th>Meetings</th><th>Reply rate</th></tr></thead>
            <tbody>{d.byTier.sort((a, b) => a.segment.localeCompare(b.segment)).map((t) => <tr key={t.segment}><td>{t.segment}</td><td>{t.leads}</td><td>{t.contacted}</td><td>{t.replied}</td><td>{t.meetings}</td><td>{fmt.pct(t.reply_rate)}</td></tr>)}</tbody></table>
          <div className="text-sm font-medium mt-6 mb-2">Channels</div>
          <table className="tbl w-full"><thead><tr><th>Channel</th><th>Sent</th><th>Awaiting approval</th></tr></thead>
            <tbody>{d.channels.map((c) => <tr key={c.channel}><td className="capitalize">{c.channel}</td><td>{c.sent}</td><td>{c.pending}</td></tr>)}</tbody></table>
        </Card>
      </div>
    </div>
  );
}
