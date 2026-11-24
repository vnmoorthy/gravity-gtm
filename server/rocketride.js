// RocketRide (rocketride.ai): open-source AI pipeline runtime. Every discovered account + its raw signals are pushed
// through Gravity's signal-processing pipeline (pipelines/gravity-signals.pipe) using the `rocketride` SDK:
// client.use({ filepath }) → send(token, json) → terminate(token). The pipeline normalises & classifies signals before scoring.
// Fallback: the same normalisation runs in-process when no RocketRide engine/key is configured.
import path from "node:path";
import { state, emit, save } from "./store.js";

export const rocketEnabled = () => Boolean(process.env.ROCKETRIDE_APIKEY);
const PIPE = path.resolve("pipelines/gravity-signals.pipe");
const st = { enabled: false, connected: false, processed: 0, remote: 0, local: 0, lastError: null, lastRunMs: null, pipeline: "gravity-signals.pipe" };
let client = null, token = null;

async function ensure() {
  if (!rocketEnabled()) return null;
  if (client && token) return client;
  try {
    const { RocketRideClient } = await import("rocketride");
    client = new RocketRideClient({ uri: process.env.ROCKETRIDE_URI || "https://api.rocketride.ai", auth: process.env.ROCKETRIDE_APIKEY });
    await client.connect();
    const r = await client.use({ filepath: PIPE, name: "gravity-signals", useExisting: true, ttl: 900 });
    token = r.token;
    st.connected = true; st.lastError = null;
    return client;
  } catch (e) {
    st.lastError = e.message; st.connected = false; client = null; token = null;
    return null;
  }
}

const RULES = [
  ["funding", /\b(raised|series [a-f]|funding|seed round|investment|investors)\b/i],
  ["exec_hire", /\b(appointed|hired|joins as|named (?:new )?(?:cfo|cto|ceo|vp|head)|new (?:cfo|cto|ceo|vp))\b/i],
  ["hiring", /\b(hiring|job post|open roles?|recruiting|careers)\b/i],
  ["tech_change", /\b(migrat|replac|implement|adopt|switch(?:ing)? to|erp|netsuite|evaluating alternatives)\w*/i],
  ["expansion", /\b(expan|new (?:office|market|region|hub)|opened|launch(?:ed)? in)\w*/i],
  ["product_launch", /\b(launch(?:ed|es)?|released|unveil)\w*/i],
  ["regulatory", /\b(compliance|soc ?2|hipaa|gdpr|regulat)\w*/i],
];

/** Local implementation of the pipeline's logic: classify, de-duplicate, flag stale + injection. */
function localPipeline(account) {
  const seen = new Set();
  const out = [];
  for (const s of account.signals || []) {
    const key = (s.text || "").toLowerCase().replace(/\W+/g, " ").trim().slice(0, 80);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const cls = RULES.find(([, re]) => re.test(s.text || ""))?.[0];
    const days = s.date ? (Date.now() - new Date(s.date).getTime()) / 864e5 : null;
    out.push({ ...s, type: s.type && s.type !== "news" ? s.type : cls || "news", stale: days !== null && days > 365, processedBy: "local" });
  }
  return out;
}

/** Run one account through the RocketRide pipeline; returns normalised signals. */
export async function processAccount(account) {
  const t0 = Date.now();
  let signals = null;
  const c = await ensure();
  if (c && token) {
    try {
      const res = await c.send(token, JSON.stringify({ account: account.name, domain: account.domain, signals: account.signals }), { name: `${account.id}.json` }, "application/json");
      const body = res?.text || res?.answers?.[0] || res?.data || null;
      const parsed = typeof body === "string" ? JSON.parse(body) : body;
      if (Array.isArray(parsed?.signals)) { signals = parsed.signals.map((s) => ({ ...s, processedBy: "rocketride" })); st.remote++; }
    } catch (e) { st.lastError = e.message; }
  }
  if (!signals) { signals = localPipeline(account); st.local++; }
  st.processed++;
  st.lastRunMs = Date.now() - t0;
  st.enabled = rocketEnabled();
  state.integrations.rocketride = status();
  return signals;
}

export function status() { return { ...st, enabled: rocketEnabled(), engine: rocketEnabled() && st.connected ? "rocketride" : "local" }; }

export async function shutdown() { try { if (client && token) await client.terminate(token); } catch { /* */ } }
export function publish() { state.integrations.rocketride = status(); emit("rocketride", status()); save(); }
