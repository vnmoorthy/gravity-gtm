// End-to-end smoke test: exercises every feature of a running Gravity server.
// Usage: node scripts/smoke.js [baseUrl]   (default http://localhost:8787)
const B = process.argv[2] || process.env.BASE_URL || "http://localhost:8787";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
async function call(path, body, method) {
  const res = await fetch(B + path, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, j };
}
function check(name, ok, detail = "") { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); }
const state = async () => (await call("/api/state")).j;

(async () => {
  check("health", (await call("/healthz")).j.ok === true);
  const fresh = process.argv.includes("--fresh");
  let s = await state();
  if (fresh || !s.messages.length) {
    await call("/api/intake", { name: "Ledgerly", description: "AI accounts-payable automation for mid-market finance teams. Reads invoices, 3-way matches POs, routes approvals in Slack.", pricing: "$24k ACV", competitorHint: "Bill.com", team: [{ name: "Maya Patel", title: "Founder", prior_companies: ["Flexport"], schools: ["Stanford"] }] });
    for (let i = 0; i < 240; i++) { await sleep(2000); s = await state(); if (["done", "error"].includes(s.run.status)) break; }
  }
  check("autopilot finished", s.run.status === "done", s.run.error || s.run.mode);
  check("ICP inferred with confidence", (s.icp?.personas || []).every((p) => typeof p.confidence === "number"), `${s.icp?.industries?.length} industries`);
  check("expansion segments", s.expansions.length > 0);
  const live = s.accounts.filter((a) => a.status !== "filtered");
  check("accounts discovered + cited", live.length > 0 && live.every((a) => a.sources.length), `${live.length} kept, ${s.accounts.length - live.length} filtered`);
  check("buyers enriched", s.people.some((p) => ["verified", "likely"].includes(p.email_status)));
  check("competitors mapped", s.competitors.length > 0);
  check("outreach drafted & reviewed", s.messages.some((m) => m.status === "pending_review" && m.review && m.twin && m.security));

  const exp = s.expansions.find((e) => e.status === "suggested");
  if (exp) check("expansion accept", (await call(`/api/expansions/${exp.id}`, { status: "accepted" })).status === 200);

  const g = (await call("/api/graph")).j;
  check("graph built", g.nodes.length > 5 && g.links.length > 5, `${g.nodes.length} nodes / ${g.links.length} edges`);
  for (const q of ["warm_paths", "hiring_cycles", "displacement"]) { const r = await call("/api/graph/query", { name: q }); check(`graph query ${q}`, r.status === 200, `${r.j.rows} rows`); }

  const m1 = s.messages.find((m) => m.status === "pending_review" && m.step === 1);
  const rt = await call(`/api/messages/${m1.id}/redteam`, {});
  check("red-team lie caught", rt.j.review?.verdict === "revise" && rt.j.review.unsupported.length > 0, rt.j.review?.unsupported?.[0]);
  const ed = await call(`/api/messages/${m1.id}`, { body: m1.body.replace(/^Congrats.*?\. /m, "") }, "PATCH");
  check("rep edit + rescan", ed.status === 200 && ed.j.edited);
  const rw = await call(`/api/messages/${m1.id}/rewrite`, { instruction: "make it more casual" });
  check("AI rewrite", rw.status === 200);

  s = await state();
  const passing = s.messages.filter((m) => m.status === "pending_review" && m.security?.status !== "blocked" && (m.step !== 1 || m.variant === "A")).slice(0, 6);
  const ap = await call(`/api/messages/${passing[0].id}/approve`, {});
  check("approve & send", ap.j.status === "sent", JSON.stringify(ap.j.delivery));
  const bt = await call("/api/messages/approve-batch", { ids: passing.slice(1).map((m) => m.id) });
  check("batch approve", bt.j.sent >= 1, `${bt.j.sent} sent`);
  const rj = s.messages.find((m) => m.status === "pending_review" && !passing.includes(m));
  if (rj) check("reject", (await call(`/api/messages/${rj.id}/reject`, { reason: "tone" })).j.status === "rejected");

  const sim = await call("/api/leads/simulate-replies", {});
  check("buyer twin replies", sim.status === 200, `${sim.j.replied}/${sim.j.contacted}`);
  s = await state();
  const lead = s.leads.find((l) => ["replied", "contacted"].includes(l.stage));
  check("kanban move (rep)", (await call(`/api/leads/${lead.id}/move`, { stage: "meeting" })).j.owner === "rep");

  await call("/api/billing/set", { balance: 1 });
  const gq = await call("/api/graph/query", { name: "warm_paths" });
  const pq = s.messages.find((m) => m.status === "pending_review" && m.security?.status !== "blocked");
  const gated = pq ? await call(`/api/messages/${pq.id}/approve`, {}) : { status: 402 };
  check("credit gate blocks spend (402)", gated.status === 402, gated.j.error);
  check("cheap query still allowed", gq.status === 200);
  const tu = await call("/api/billing/topup", { credits: 300 });
  check("top up", tu.j.balance >= 300);

  const cmd = await call("/api/command", { text: "@Scout radar" });
  check("war-room command", cmd.status === 200, cmd.j.reply);
  await sleep(1500);
  const an = (await call("/api/analytics")).j;
  check("analytics", an.funnel?.length === 5 && an.variants?.length === 2, `funnel ${an.funnel.map((f) => f.count).join("→")}`);
  const csv = await fetch(B + "/api/export.csv").then((r) => r.text());
  check("csv export", csv.split("\n").length > 1);
  const nx = await call("/api/nexla/push", {});
  check("nexla push endpoint", nx.status === 200, nx.j.pushed ? `pushed ${nx.j.rows}` : nx.j.reason);
  s = await state();
  check("audit log populated", s.audit.length > 10, `${s.audit.length} entries`);
  check("billing events metered", s.billing.events.length > 5, `${s.billing.events.length} events, flexprice synced ${s.billing.flexprice.synced}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
