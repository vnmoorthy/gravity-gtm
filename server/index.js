import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import path from "node:path";
import fs from "node:fs";
import { state, load, save, bus, emit, reset, audit, uid, now } from "./store.js";
import { hasLLM, MODEL } from "./llm.js";
import { AGENTS, say, resolveApproval } from "./agents.js";
import { initBand, bandEnabled, onBandDecision } from "./band.js";
import { ensureBilling, initFlexprice, topUp, setBalance, meter, METERS, flexpriceEnabled, CreditError } from "./billing.js";
import { buildGraph, QUERIES, initNeo4j, neo4jConnected, syncNeo4j } from "./graph.js";
import { sendEmail, pushToNexla, dispatchMode, emailProvider } from "./dispatch.js";
import * as P from "./pipeline.js";

load();
ensureBilling();
const app = express();
app.use(cors());
app.use(compression({ filter: (req, res) => (req.path === "/api/stream" ? false : compression.filter(req, res)) }));
app.use(express.json({ limit: "1mb" }));

// Basic hardening headers (Sentinel also scans outbound content)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

const wrap = (fn) => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json(out ?? { ok: true });
  } catch (e) {
    const code = e instanceof CreditError ? 402 : e.status || 400;
    if (!res.headersSent) res.status(code).json({ error: e.message, code });
  }
};

function integrations() {
  return {
    mode: hasLLM() ? "live" : "demo",
    model: MODEL,
    claude: hasLLM(),
    flexprice: { enabled: flexpriceEnabled(), ...(state.billing?.flexprice || {}) },
    band: { enabled: bandEnabled(), ...(state.integrations.band || {}) },
    neo4j: neo4jConnected(),
    hunter: Boolean(process.env.HUNTER_API_KEY),
    email: { provider: emailProvider(), mode: dispatchMode(), testInbox: Boolean(process.env.TEST_INBOX) },
    nexla: Boolean(process.env.NEXLA_WEBHOOK_URL),
    snyk: true,
    render: Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID),
  };
}

app.get("/healthz", (req, res) => res.json({ ok: true, mode: hasLLM() ? "live" : "demo" }));

app.get("/api/state", (req, res) => {
  res.json({ ...state, agents: AGENTS, meters: METERS, integrations: integrations(), running: P.isRunning() });
});

app.get("/api/stream", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.write(`event: hello\ndata: {}\n\n`);
  const fn = (ev) => res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev.payload)}\n\n`);
  bus.on("event", fn);
  const ping = setInterval(() => res.write(`: ping\n\n`), 20000);
  req.on("close", () => { clearInterval(ping); bus.off("event", fn); });
});

// ─── Intake & autopilot
app.post("/api/intake", wrap(async (req) => {
  const b = req.body || {};
  if (!b.name || !b.description) throw new Error("Product name and description are required");
  const team = (b.team || []).filter((t) => t?.name);
  const product = { name: b.name, description: b.description, website: b.website || "", customers: b.customers || "", pricing: b.pricing || "", constraints: b.constraints || "", sender: b.sender || team[0]?.name?.split(" ")[0] || "", accountCount: b.accountCount || 8, competitorHint: b.competitorHint || "", team };
  if (b.fresh !== false) reset(true);
  P.autopilot(product, { waitForIcpApproval: Boolean(b.waitForIcpApproval) });
  return { started: true, mode: hasLLM() ? "live" : "demo" };
}));

app.post("/api/icp/infer", wrap(async () => { if (!state.product) throw new Error("No product intake yet"); return await P.inferICP(state.product); }));
app.patch("/api/icp", wrap(async (req) => {
  state.icp = { ...state.icp, ...req.body };
  audit("rep", "icp_edited", { fields: Object.keys(req.body) });
  say("human", `Adjusted ICP fields: ${Object.keys(req.body).join(", ")}`, { to: ["strategist"], kind: "hitl" });
  emit("icp", { icp: state.icp, expansions: state.expansions, icpStatus: state.icpStatus });
  save();
  return state.icp;
}));
app.post("/api/expansions/:id", wrap(async (req) => {
  const e = state.expansions.find((x) => x.id === req.params.id);
  if (!e) throw new Error("Not found");
  const { status, segment } = req.body;
  if (segment) { e.segment = segment; e.adjusted = true; }
  if (status) e.status = status;
  audit("rep", `expansion_${e.status}`, { segment: e.segment });
  say("human", `${e.status === "accepted" ? "Accepted" : e.status === "dismissed" ? "Dismissed" : "Adjusted"} expansion segment “${e.segment}”`, { to: ["strategist", "scout"], kind: "hitl" });
  if (e.status === "accepted") {
    state.icp.industries = [...(state.icp.industries || []), { name: e.segment, naics: "—", rationale: e.rationale, confidence: e.confidence, expansion: true }];
    say("strategist", `Merged “${e.segment}” into the ICP. @Scout it will be swept on the next discovery run.`, { to: ["scout"], kind: "handoff" });
  }
  emit("icp", { icp: state.icp, expansions: state.expansions, icpStatus: state.icpStatus });
  save();
  return e;
}));

const guardRun = () => { if (P.isRunning()) throw new Error("Autopilot is running — wait for it to finish"); };
app.post("/api/discover", wrap(async (req) => { guardRun(); return await P.discover({ count: req.body?.count || 4 }); }));
app.post("/api/enrich", wrap(async () => await P.enrichAll()));
app.post("/api/outreach", wrap(async () => await P.writeOutreach()));
app.post("/api/signals/refresh", wrap(async () => await P.refreshSignals()));

// ─── Graph
app.get("/api/graph", (req, res) => res.json(buildGraph()));
app.post("/api/graph/query", wrap(async (req) => {
  const q = QUERIES[req.body?.name];
  if (!q) throw new Error("Unknown query");
  await meter("graph_query", 1, { query: req.body.name });
  const rows = q.run();
  const entry = { id: uid("gq"), at: now(), name: req.body.name, title: q.title, cypher: q.cypher, rows: rows.length };
  state.graphQueries.unshift(entry);
  say("cartographer", `Ran “${q.title}” → ${rows.length} results.`, { kind: "result" });
  save();
  return { ...entry, results: rows };
}));
app.post("/api/graph/sync-neo4j", wrap(async () => await syncNeo4j()));

// ─── HITL outreach queue
const findMsg = (id) => { const m = state.messages.find((x) => x.id === id); if (!m) throw new Error("Message not found"); return m; };

function advanceLead(personId, stage, actor, note) {
  let lead = state.leads.find((l) => l.personId === personId);
  const p = state.people.find((x) => x.id === personId);
  if (!lead) {
    lead = { id: uid("lead"), personId, accountId: p?.accountId, stage: "matched", owner: "ai", createdAt: now(), history: [] };
    state.leads.push(lead);
  }
  const order = ["matched", "contacted", "replied", "meeting", "closed", "lost"];
  if (order.indexOf(stage) <= order.indexOf(lead.stage) && !["lost", "closed"].includes(stage) && actor === "ai") return lead;
  lead.stage = stage;
  if (actor === "rep") lead.owner = "rep";
  lead.history.push({ stage, at: now(), actor, note });
  emit("leads", state.leads);
  return lead;
}

app.patch("/api/messages/:id", wrap(async (req) => {
  const m = findMsg(req.params.id);
  m.history.push({ at: now(), subject: m.subject, body: m.body, by: "ai" });
  if (req.body.subject !== undefined) m.subject = req.body.subject;
  if (req.body.body !== undefined) m.body = req.body.body;
  m.edited = true;
  m.security = P.securityScan(m);
  m.status = m.security.status === "blocked" ? "blocked" : "pending_review";
  audit("rep", "message_edited", { id: m.id });
  emit("messages", state.messages);
  save();
  return m;
}));

app.post("/api/messages/:id/rewrite", wrap(async (req) => {
  const m = findMsg(req.params.id);
  const out = await P.rewrite(m, req.body?.instruction || "make it shorter and punchier");
  m.history.push({ at: now(), subject: m.subject, body: m.body, by: "ai" });
  m.subject = out.subject ?? m.subject; m.body = out.body ?? m.body;
  m.security = P.securityScan(m);
  m.status = m.security.status === "blocked" ? "blocked" : "pending_review";
  say("writer", `Rewrote message for ${state.people.find((p) => p.id === m.personId)?.name} per your note: “${req.body?.instruction}”.`, { kind: "result" });
  emit("messages", state.messages);
  save();
  return m;
}));

async function approveAndSend(m, note = "") {
  if (m.status === "blocked") throw new Error("Sentinel blocked this message — edit it first");
  if (m.status === "sent") return m;
  await meter("outreach_sent", 1, { channel: m.channel, variant: m.variant });
  const p = state.people.find((x) => x.id === m.personId);
  const a = state.accounts.find((x) => x.id === m.accountId);
  m.status = "approved"; m.approvedAt = now(); m.approvedBy = "rep";
  let delivery;
  if (m.channel === "email") {
    try { delivery = await sendEmail({ to: p?.email, subject: m.subject, text: m.body, tags: { lead: m.personId, variant: m.variant } }); }
    catch (e) { delivery = { delivered: false, error: e.message }; }
  } else delivery = { delivered: false, simulated: true, provider: "linkedin", note: "Queued for LinkedIn (copy-to-send; API requires partner access)" };
  m.delivery = delivery;
  m.status = "sent"; m.sentAt = now();
  // A/B: approving one step-1 variant retires its sibling
  if (m.step === 1) for (const s of state.messages) if (s.personId === m.personId && s.step === 1 && s.id !== m.id && s.status !== "sent") s.status = "not_chosen";
  advanceLead(m.personId, "contacted", "ai", `${m.channel} step ${m.step} (variant ${m.variant}) sent after rep approval${note ? ` — ${note}` : ""}`);
  audit("rep", "message_approved_sent", { id: m.id, to: p?.email, channel: m.channel, variant: m.variant, delivery: delivery.delivered ? delivery.provider : "simulated" });
  say("human", `Approved ${m.channel} → ${p?.name} (${a?.name}), variant ${m.variant}.`, { to: ["writer"], kind: "hitl" });
  pushToNexla("outreach_sent", { lead: p?.name, email: p?.email, company: a?.name, domain: a?.domain, tier: a?.tier, score: a?.score, channel: m.channel, variant: m.variant, subject: m.subject }).then((r) => { if (r.pushed) state.integrations.nexlaPushed = (state.integrations.nexlaPushed || 0) + 1; }).catch(() => {});
  return m;
}

app.post("/api/messages/:id/redteam", wrap(async (req) => {
  const m = findMsg(req.params.id);
  const a = state.accounts.find((x) => x.id === m.accountId);
  const lies = [
    `Congrats on closing your $250M Series E last week.`,
    `I noticed ${a?.name || "your team"} just crossed 12,000 employees.`,
    `Saw you're replacing your entire finance team with 40% fewer people.`,
  ];
  const lie = lies[Math.floor(Math.random() * lies.length)];
  m.history.push({ at: now(), subject: m.subject, body: m.body, by: "ai" });
  for (const l of lies) m.body = m.body.replace(l + " ", "").replace(l, "");
  m.body = m.body.replace(/^(Hi [^\n]+\n\n)?/, (x) => `${x || ""}${lie} `);
  audit("system", "redteam_injection", { id: m.id, lie });
  say("sentinel", `Red-team drill: injected a fabricated claim into a draft to test the Reviewer.`, { to: ["reviewer"], kind: "security" });
  return await P.reviewOne(m);
}));

app.post("/api/command", wrap(async (req) => {
  const text = String(req.body?.text || "").trim();
  if (!text) throw new Error("Empty message");
  const t = text.toLowerCase();
  const mentions = Object.keys(AGENTS).filter((k) => t.includes("@" + AGENTS[k].name.toLowerCase().split(" ")[0]));
  say("human", text, { to: mentions, kind: "hitl" });
  const n = Number((t.match(/\b(\d{1,2})\b/) || [])[1]) || 4;
  const bg = (fn, label) => { fn().catch((e) => say("planner", `${label} failed: ${e.message}`, { kind: "error" })); };
  if (/^approve|^reject/.test(t)) {
    const ap = state.approvals.find((a) => a.status === "pending");
    if (!ap) return { reply: "No pending decisions" };
    resolveApproval(ap.id, t.startsWith("approve") ? "approve" : "reject", "via war room");
    return { reply: "Decision recorded" };
  }
  if (/radar|signal/.test(t)) { bg(() => P.refreshSignals(), "Signal radar"); say("scout", "On it. Sweeping top accounts for fresh signals.", { to: ["human"] }); return { reply: "Scout is running the signal radar" }; }
  if (/enrich/.test(t)) { bg(() => P.enrichAll(), "Enrichment"); say("enricher", "Running the enrichment waterfall on pending buyers.", { to: ["human"] }); return { reply: "Enricher started" }; }
  if (/draft|write|outreach|sequence/.test(t)) { bg(() => P.writeOutreach(), "Outreach"); say("writer", "Drafting sequences for newly enriched leads.", { to: ["human"] }); return { reply: "Writer started" }; }
  if (/find|discover|more|accounts|scout/.test(t)) {
    if (P.isRunning()) return { reply: "Autopilot is busy. Try again when it finishes" };
    bg(() => P.discover({ count: Math.min(n, 10) }), "Discovery");
    say("scout", `Copy that. Finding ${Math.min(n, 10)} more accounts with live signals.`, { to: ["human"] });
    return { reply: `Scout is finding ${Math.min(n, 10)} more accounts` };
  }
  if (/query|path|warm|graph/.test(t)) { const r = (await import("./graph.js")).warmPaths(); say("cartographer", `Found ${r.length} warm paths. Top: ${r[0] ? r[0].names.join(" → ") : "none yet"}.`, { to: ["human"], kind: "result" }); return { reply: `${r.length} warm paths` }; }
  say("planner", `Noted. I've logged your guidance for the next milestone. Try “@Scout find 4 more”, “@Enricher enrich”, “@Writer draft”, or “@Scout radar”.`, { to: ["human"], kind: "plan" });
  return { reply: "Planner acknowledged" };
}));

app.post("/api/messages/:id/approve", wrap(async (req) => { const m = await approveAndSend(findMsg(req.params.id), req.body?.note); emit("messages", state.messages); save(); return m; }));
app.post("/api/messages/:id/reject", wrap(async (req) => {
  const m = findMsg(req.params.id);
  m.status = "rejected"; m.rejectReason = req.body?.reason || "";
  audit("rep", "message_rejected", { id: m.id, reason: m.rejectReason });
  say("human", `Rejected a draft${m.rejectReason ? `: “${m.rejectReason}”` : ""}. @Writer noted for next sequences.`, { to: ["writer"], kind: "hitl" });
  emit("messages", state.messages); save();
  return m;
}));
app.post("/api/messages/approve-batch", wrap(async (req) => {
  const ids = req.body?.ids || [];
  const done = [];
  for (const id of ids) {
    try { done.push((await approveAndSend(findMsg(id))).id); }
    catch (e) { if (e instanceof CreditError) { say("governor", `⛔ ${e.message}. Batch stopped at ${done.length}/${ids.length}.`, { to: ["human"], kind: "billing" }); break; } }
  }
  emit("messages", state.messages); save();
  return { sent: done.length };
}));

// ─── Pipeline / kanban
app.post("/api/leads/:id/move", wrap(async (req) => {
  const lead = state.leads.find((l) => l.id === req.params.id);
  if (!lead) throw new Error("Lead not found");
  const { stage, note } = req.body;
  lead.stage = stage; lead.owner = "rep";
  lead.history.push({ stage, at: now(), actor: "rep", note: note || "Moved on board" });
  audit("rep", "lead_moved", { lead: lead.id, stage });
  if (stage === "meeting") pushToNexla("meeting_booked", { lead: state.people.find((p) => p.id === lead.personId)?.name }).catch(() => {});
  emit("leads", state.leads); save();
  return lead;
}));

app.post("/api/leads/simulate-replies", wrap(async () => {
  const contacted = state.leads.filter((l) => l.stage === "contacted");
  let replied = 0;
  for (const l of contacted) {
    const sent = state.messages.filter((m) => m.personId === l.personId && m.status === "sent");
    const prob = Math.max(...sent.map((m) => m.twin?.reply_probability || 0.15), 0.15);
    if (Math.random() < Math.min(0.85, prob * 2.2)) {
      const m = sent[0];
      replied++;
      l.reply = { text: m?.twin?.reply || "Thanks for reaching out — what does pricing look like?", at: now(), simulated: true, variant: m?.variant };
      advanceLead(l.personId, "replied", "ai", `Buyer Twin simulated reply: “${l.reply.text}”`);
    }
  }
  say("twin", `Simulated inbound replies for ${contacted.length} contacted leads → ${replied} replied (simulation, labelled in the audit log).`, { kind: "review" });
  save();
  return { contacted: contacted.length, replied };
}));

app.post("/api/webhooks/reply", wrap(async (req) => {
  const from = (req.body?.from || "").toLowerCase();
  const p = state.people.find((x) => (x.email || "").toLowerCase() === from) || state.people.find((x) => x.id === req.body?.personId);
  if (!p) throw new Error("No matching lead");
  const l = advanceLead(p.id, "replied", "ai", `Inbound reply via webhook`);
  l.reply = { text: req.body?.text || "", at: now(), simulated: false };
  audit("system", "reply_webhook", { from });
  save();
  return l;
}));

// ─── Analytics
app.get("/api/analytics", (req, res) => {
  const order = ["matched", "contacted", "replied", "meeting", "closed"];
  const reached = (l, s) => l.history.some((h) => h.stage === s) || order.indexOf(l.stage) >= order.indexOf(s);
  const funnel = order.map((s) => ({ stage: s, count: state.leads.filter((l) => reached(l, s)).length }));
  const seg = (keyFn) => {
    const m = new Map();
    for (const l of state.leads) {
      const k = keyFn(l) || "Unknown";
      const o = m.get(k) || { segment: k, leads: 0, contacted: 0, replied: 0, meetings: 0 };
      o.leads++; if (reached(l, "contacted")) o.contacted++; if (reached(l, "replied")) o.replied++; if (reached(l, "meeting")) o.meetings++;
      m.set(k, o);
    }
    return [...m.values()].map((o) => ({ ...o, reply_rate: o.contacted ? o.replied / o.contacted : 0 }));
  };
  const acc = (l) => state.accounts.find((a) => a.id === l.accountId);
  const variants = ["A", "B"].map((v) => {
    const sent = state.messages.filter((m) => m.variant === v && m.step === 1 && m.status === "sent");
    const replies = sent.filter((m) => state.leads.find((l) => l.personId === m.personId && reached(l, "replied"))).length;
    const all = state.messages.filter((m) => m.variant === v && m.step === 1);
    return { variant: v, angle: all[0]?.angle || (v === "A" ? "signal-led" : "pain-led"), drafted: all.length, sent: sent.length, replies, reply_rate: sent.length ? replies / sent.length : 0, predicted: all.length ? all.reduce((s, m) => s + (m.twin?.reply_probability || 0), 0) / all.length : 0 };
  });
  const channels = ["email", "linkedin"].map((c) => ({ channel: c, sent: state.messages.filter((m) => m.channel === c && m.status === "sent").length, pending: state.messages.filter((m) => m.channel === c && m.status === "pending_review").length }));
  const transitions = state.leads.flatMap((l) => l.history);
  const attribution = { ai: transitions.filter((h) => h.actor === "ai").length, rep: transitions.filter((h) => h.actor === "rep").length };
  const spend = state.telemetry.total.cost;
  const meetings = funnel[3].count;
  res.json({
    funnel, byIndustry: seg((l) => acc(l)?.industry), byTier: seg((l) => (acc(l)?.tier ? "Tier " + acc(l).tier : null)), variants, channels, attribution,
    economics: { ai_spend_usd: spend, credits_used: (state.billing?.granted || 0) - (state.billing?.balance || 0), cost_per_lead: state.leads.length ? spend / state.leads.length : 0, cost_per_meeting: meetings ? spend / meetings : null, meetings },
  });
});

// ─── Billing (Flexprice)
app.post("/api/billing/topup", wrap(async (req) => { const b = await topUp(Number(req.body?.credits) || 200); say("governor", `Wallet topped up +${req.body?.credits || 200} credits. Gated pipelines resumed.`, { kind: "billing" }); return b; }));
app.post("/api/billing/set", wrap(async (req) => setBalance(Number(req.body?.balance) || 0)));

// ─── Approvals (HITL decisions from agents)
app.post("/api/approvals/:id", wrap(async (req) => resolveApproval(req.params.id, req.body?.decision, req.body?.note)));
onBandDecision((decision, id, who) => {
  const ap = id ? state.approvals.find((a) => a.id === id) : state.approvals.find((a) => a.status === "pending");
  if (ap && ap.status === "pending") resolveApproval(ap.id, decision, `via Band by ${who}`);
});

// ─── Nexla + export
app.post("/api/nexla/push", wrap(async () => {
  const rows = state.people.filter((p) => p.email).map((p) => { const a = state.accounts.find((x) => x.id === p.accountId); return { name: p.name, title: p.title, email: p.email, email_status: p.email_status, company: a?.name, domain: a?.domain, tier: a?.tier, score: a?.score, stage: state.leads.find((l) => l.personId === p.id)?.stage }; });
  const r = await pushToNexla("lead_batch", { records: rows });
  audit("rep", "nexla_push", { rows: rows.length, ...r });
  return { rows: rows.length, ...r };
}));
app.get("/api/export.csv", (req, res) => {
  const head = ["name", "title", "company", "domain", "email", "email_status", "linkedin", "tier", "score", "stage"];
  const lines = state.people.map((p) => { const a = state.accounts.find((x) => x.id === p.accountId); const l = state.leads.find((x) => x.personId === p.id); return [p.name, p.title, a?.name, a?.domain, p.email, p.email_status, p.linkedin, a?.tier, a?.score, l?.stage].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","); });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=gravity-leads.csv");
  res.send([head.join(","), ...lines].join("\n"));
});

app.post("/api/reset", wrap(async () => { reset(true); return { ok: true }; }));

// ─── Static frontend
const dist = path.resolve("web/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));
}

const PORT = process.env.PORT || 8787;
app.listen(PORT, async () => {
  console.log(`Gravity GTM on :${PORT} · mode=${hasLLM() ? "live" : "demo"} · model=${MODEL}`);
  await Promise.allSettled([initFlexprice(), initBand(), initNeo4j()]);
});
