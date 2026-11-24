import { CreditCard, Zap, Plus, AlertOctagon, CheckCircle2, CloudOff, Cloud, RotateCcw } from "lucide-react";
import { api, fmt } from "../api";
import { Card, Button, Badge, SectionTitle, useAction, cx } from "../ui";

export default function Billing({ state }) {
  const [busy, run] = useAction();
  const b = state.billing;
  const meters = state.meters || {};
  if (!b) return null;
  const used = b.granted - b.balance;
  const fp = b.flexprice || {};
  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <SectionTitle eyebrow="Flexprice · usage-based billing" title="Spend Governor" right={<>
        <Button icon={AlertOctagon} variant="danger" loading={busy === "low"} onClick={() => run("low", () => api("/api/billing/set", { body: { balance: 4 } }), "Balance set to 4 credits. Try enriching or sending to see the gate")}>Simulate low balance</Button>
        <Button icon={Plus} variant="primary" loading={busy === "top"} onClick={() => run("top", () => api("/api/billing/topup", { body: { credits: 200 } }), "+200 credits")}>Top up 200 credits</Button>
      </>}>
        Every billable action (enrichment, sends, graph queries, discovery) is checked against the wallet, debited, and streamed to Flexprice as a metered usage event. High-cost pipelines are gated automatically when credits run out.
      </SectionTitle>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className={cx("p-6", b.balance < 20 && "border-rose-500/40")}>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500"><Zap className="size-3.5 text-lime-300" />Wallet balance</div>
          <div className={cx("text-6xl font-semibold tabular-nums mt-2", b.balance < 20 ? "text-rose-300" : "text-white")}>{fmt.num(b.balance)}</div>
          <div className="text-sm text-zinc-500">credits · {fmt.num(used)} used of {fmt.num(b.granted)} granted · ≈ {fmt.usd(b.balance * b.creditPriceUsd)}</div>
          <div className="h-2 rounded-full bg-white/10 mt-4 overflow-hidden"><div className={cx("h-full rounded-full", b.balance < 20 ? "bg-rose-400" : "bg-gradient-to-r from-lime-400 to-emerald-400")} style={{ width: `${Math.max(1, (b.balance / b.granted) * 100)}%`, transition: "width .6s" }} /></div>
          <div className="flex items-center justify-between mt-4 text-xs text-zinc-400"><span>Plan: {b.plan}</span><span className={b.blocked ? "text-rose-300" : ""}>{b.blocked} actions gated</span></div>
        </Card>
        <Card className="p-6">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3">Flexprice connection</div>
          <div className={cx("flex items-center gap-2 text-sm", fp.enabled ? "text-emerald-300" : "text-zinc-400")}>{fp.enabled ? <Cloud className="size-4" /> : <CloudOff className="size-4" />}{fp.enabled ? "Streaming usage events to Flexprice" : "Local ledger (add FLEXPRICE_API_KEY to stream)"}</div>
          <div className="text-xs text-zinc-500 mt-3 space-y-1 font-mono">
            <div>external_customer_id: {b.customer}</div>
            <div>customer: {fp.customerId || "—"}</div>
            <div>wallet: {fp.walletId || "—"}</div>
            <div className="text-emerald-300/80">synced events: {fp.synced || 0}</div>
            <div className={fp.failed ? "text-rose-300" : ""}>failed: {fp.failed || 0}</div>
            {fp.lastError && <div className="text-rose-300/80 whitespace-normal break-words">last error: {fp.lastError}</div>}
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3">Meters · credits per unit</div>
          <div className="space-y-2">
            {Object.entries(meters).map(([k, m]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <div><div>{m.label}</div><div className="text-[11px] font-mono text-zinc-500">{k}</div></div>
                <div className="text-right"><div className="tabular-nums font-semibold">{fmt.num(b.usage?.[k] || 0)}</div><div className="text-[11px] text-zinc-500">{m.credits} cr / {m.unit}</div></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="px-5 py-3 text-sm font-medium flex items-center justify-between border-b border-white/5"><span className="flex items-center gap-2"><CreditCard className="size-4 text-zinc-400" />Usage event stream</span><span className="text-xs text-zinc-500">{b.events.length} events</span></div>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="tbl w-full"><thead><tr><th>Time</th><th>event_name</th><th>Qty</th><th>Credits</th><th>Properties</th><th>Sync</th></tr></thead>
            <tbody>{b.events.map((e) => (
              <tr key={e.id}><td className="text-xs text-zinc-500">{new Date(e.at).toLocaleTimeString()}</td><td className="font-mono text-xs">{e.event_name}</td><td>{e.qty}</td><td className="tabular-nums">−{e.credits}</td><td className="text-xs text-zinc-400 font-mono truncate max-w-[360px]">{JSON.stringify(e.properties)}</td>
                <td>{e.synced === "flexprice" ? <Badge color="emerald"><CheckCircle2 className="size-3" />flexprice</Badge> : e.synced === "failed" ? <Badge color="rose">failed</Badge> : e.synced === "pending" ? <Badge color="amber">pending</Badge> : <Badge>local</Badge>}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      <div className="mt-4 text-xs text-zinc-500 flex items-center gap-2"><RotateCcw className="size-3.5" />Credit gate demo: click “Simulate low balance”, then run Enrich, Approve & send, or a graph query. The Governor blocks the action with a 402 and posts to the war room.</div>
    </div>
  );
}
