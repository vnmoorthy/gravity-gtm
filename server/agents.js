// Band-style multi-agent war room: specialised agents coordinate via @mentions in one shared stream,
// with per-agent token + $ telemetry and HITL decision requests. Mirrors every message to Band when configured.
import { state, save, emit, uid, now } from "./store.js";

export const AGENTS = {
  planner: { name: "Planner", role: "Planner / Architect", color: "#f59e0b", emoji: "🧭", desc: "Parses intake, sets GTM milestones, allocates tasks" },
  strategist: { name: "Strategist", role: "Builder · ICP", color: "#a78bfa", emoji: "🎯", desc: "Infers & expands the ICP with confidence scores" },
  scout: { name: "Scout", role: "Builder · Discovery", color: "#22d3ee", emoji: "🛰️", desc: "Finds accounts & buyers grounded in public evidence" },
  analyst: { name: "Analyst", role: "Builder · Competitive", color: "#fb7185", emoji: "⚔️", desc: "Maps direct / indirect / alternative competitors" },
  cartographer: { name: "Cartographer", role: "Builder · Graph", color: "#818cf8", emoji: "🕸️", desc: "Mutates the knowledge graph, runs multi-hop queries" },
  enricher: { name: "Enricher", role: "Builder · Enrichment", color: "#34d399", emoji: "🧬", desc: "Email/MX/LinkedIn waterfall with confidence" },
  writer: { name: "Writer", role: "Builder · Outreach", color: "#f472b6", emoji: "✍️", desc: "Signal-personalised multi-touch sequences, A/B variants" },
  reviewer: { name: "Reviewer", role: "Reviewer", color: "#facc15", emoji: "🔎", desc: "Fact-checks every claim against cited sources" },
  twin: { name: "Buyer Twin", role: "Reviewer · Simulation", color: "#2dd4bf", emoji: "🪞", desc: "Role-plays the persona to predict reply odds" },
  sentinel: { name: "Sentinel", role: "Security Agent", color: "#ef4444", emoji: "🛡️", desc: "Scans links, PII, prompt-injection in scraped data" },
  governor: { name: "Governor", role: "Spend Governor", color: "#84cc16", emoji: "💳", desc: "Flexprice metering & credit gating" },
  human: { name: "You", role: "Human-in-the-loop", color: "#e5e7eb", emoji: "🧑", desc: "Approves ICP, schema changes, and every send" },
};

import { mirror } from "./band.js";

export function say(agent, text, { to = [], kind = "thought", data = null, usage = null, cost = 0 } = {}) {
  const msg = { id: uid("msg"), at: now(), agent, to, text, kind, data, tokens: usage ? usage.in + usage.out : 0, cost };
  state.agentLog.push(msg);
  if (state.agentLog.length > 1500) state.agentLog.splice(0, state.agentLog.length - 1500);
  emit("agent", msg);
  mirror(msg, AGENTS[agent]);
  save();
  return msg;
}

export function track(agent, r) {
  if (!r?.usage) return;
  const t = state.telemetry;
  const a = (t.byAgent[agent] ||= { in: 0, out: 0, searches: 0, cost: 0, calls: 0 });
  a.in += r.usage.in; a.out += r.usage.out; a.searches += r.usage.searches; a.cost += r.cost; a.calls += 1;
  t.total.in += r.usage.in; t.total.out += r.usage.out; t.total.searches += r.usage.searches; t.total.cost += r.cost; t.total.calls += 1;
  emit("telemetry", t);
}

/** HITL: an agent asks the human for a decision; pipeline can await it. */
const waiters = new Map();
export function requestApproval(agent, title, detail, options = ["approve", "reject"]) {
  const ap = { id: uid("hitl"), at: now(), agent, title, detail, options, status: "pending", decision: null };
  state.approvals.unshift(ap);
  say(agent, `@You decision needed — ${title}`, { to: ["human"], kind: "hitl", data: { approvalId: ap.id } });
  emit("approval", ap);
  save();
  return ap;
}
export function waitForApproval(id, timeoutMs = 0) {
  return new Promise((resolve) => {
    waiters.set(id, resolve);
    if (timeoutMs) setTimeout(() => { if (waiters.has(id)) { waiters.delete(id); resolve({ decision: "timeout" }); } }, timeoutMs);
  });
}
export function resolveApproval(id, decision, note = "") {
  const ap = state.approvals.find((a) => a.id === id);
  if (!ap) return null;
  ap.status = "resolved"; ap.decision = decision; ap.note = note; ap.resolvedAt = now();
  say("human", `${decision === "approve" ? "✅ Approved" : decision === "reject" ? "⛔ Rejected" : decision}: ${ap.title}${note ? ` — “${note}”` : ""}`, { to: [ap.agent], kind: "hitl" });
  emit("approval", ap);
  const w = waiters.get(id);
  if (w) { waiters.delete(id); w(ap); }
  save();
  return ap;
}
