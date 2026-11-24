// Moss (moss.dev) — real-time semantic search runtime. Gravity indexes every account, buyer, signal and competitor
// into a Moss index and uses sub-10ms hybrid (semantic + keyword) retrieval for:
//   • "Ask Gravity" natural-language search across the workspace
//   • Reviewer evidence retrieval (claim → most relevant cited evidence)
//   • Writer grounding (persona pains → most relevant signals)
//   • Lookalike accounts (won account profile → similar accounts)
// Fallback: an in-process hybrid engine (BM25 keyword + character-trigram cosine) so every feature works without keys.
import { state, emit, save } from "./store.js";

const INDEX = process.env.MOSS_INDEX || "gravity-workspace";
export const mossEnabled = () => Boolean(process.env.MOSS_PROJECT_ID && process.env.MOSS_PROJECT_KEY);
let client = null, loaded = false, lastError = null, indexed = 0, lastSyncMs = null, syncing = null;

async function getClient() {
  if (!mossEnabled()) return null;
  if (client) return client;
  try {
    const { MossClient } = await import("@moss-js/moss");
    client = new MossClient(process.env.MOSS_PROJECT_ID, process.env.MOSS_PROJECT_KEY);
    return client;
  } catch (e) {
    lastError = `Moss SDK unavailable: ${e.message}`;
    return null;
  }
}

/** Flatten the workspace into searchable documents. Metadata values must be strings. */
export function buildDocs() {
  const docs = [];
  const acc = (id) => state.accounts.find((a) => a.id === id);
  for (const a of state.accounts) {
    if (a.status === "filtered") continue;
    docs.push({ id: a.id, text: `${a.name} — ${a.industry || ""} company in ${a.hq || ""}, ~${a.headcount || "?"} employees. ${a.why_fit || ""} Tools: ${(a.tools_used || []).join(", ")}`, metadata: { type: "account", accountId: a.id, name: a.name, tier: String(a.tier || ""), score: String(a.score || 0) } });
    for (const s of a.signals || []) {
      docs.push({ id: s.id, text: `${a.name}: ${s.text} (${s.type}, ${s.date || "recent"})`, metadata: { type: "signal", accountId: a.id, name: a.name, url: s.source || "", signalType: s.type || "" } });
    }
  }
  for (const p of state.people) {
    const a = acc(p.accountId);
    if (!a || a.status === "filtered") continue;
    docs.push({ id: p.id, text: `${p.name}, ${p.title} at ${a.name}. Previously ${(p.prior_companies || []).join(", ") || "—"}. ${(p.schools || []).join(", ")}`, metadata: { type: "person", accountId: a.id, personId: p.id, name: p.name } });
  }
  for (const c of state.competitors) {
    docs.push({ id: c.id, text: `${c.name} (${c.category} competitor): ${c.positioning || ""}. ${c.value_prop || ""}. Pricing: ${c.pricing || ""}. Weaknesses: ${(c.weaknesses || []).join(", ")}`, metadata: { type: "competitor", name: c.name } });
  }
  return docs;
}

// ───────────── local hybrid fallback ─────────────
const tok = (s) => String(s || "").toLowerCase().match(/[a-z0-9$%]+/g) || [];
const STOP = new Set("the a an of and or to in for on with at by is are was be as from that this it its our your their".split(" "));
function trigrams(s) {
  const m = new Map();
  const t = " " + String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ") + " ";
  for (let i = 0; i < t.length - 2; i++) { const g = t.slice(i, i + 3); m.set(g, (m.get(g) || 0) + 1); }
  return m;
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [, v] of a) na += v * v;
  for (const [k, v] of b) { nb += v * v; if (a.has(k)) dot += v * a.get(k); }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
function localSearch(docs, q, topK = 8, alpha = 0.6) {
  const qt = tok(q).filter((w) => !STOP.has(w));
  const N = docs.length || 1;
  const df = new Map();
  const dt = docs.map((d) => { const t = tok(d.text); new Set(t).forEach((w) => df.set(w, (df.get(w) || 0) + 1)); return t; });
  const avg = dt.reduce((s, t) => s + t.length, 0) / N || 1;
  const qg = trigrams(q);
  const scored = docs.map((d, i) => {
    const t = dt[i];
    let bm = 0;
    for (const w of qt) {
      const f = t.filter((x) => x === w).length;
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(w) || 0) + 0.5) / ((df.get(w) || 0) + 0.5));
      bm += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (t.length / avg))));
    }
    return { d, bm, sem: cosine(qg, trigrams(d.text)) };
  });
  const maxBm = Math.max(...scored.map((s) => s.bm), 1e-9);
  return scored
    .map((s) => ({ ...s.d, score: Math.round(((1 - alpha) * (s.bm / maxBm) + alpha * s.sem) * 1000) / 1000 }))
    .filter((r) => r.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ───────────── index sync ─────────────
export function syncIndex() {
  if (syncing) return syncing;
  syncing = (async () => {
    const docs = buildDocs();
    const t0 = Date.now();
    const c = await getClient();
    if (c && docs.length) {
      try {
        let exists = false;
        try { await c.getIndex(INDEX); exists = true; } catch { exists = false; }
        if (exists) await c.addDocs(INDEX, docs, { upsert: true });
        else await c.createIndex(INDEX, docs, { modelId: process.env.MOSS_MODEL || "moss-minilm" });
        await c.loadIndex(INDEX);
        loaded = true; lastError = null;
      } catch (e) { lastError = e.message; loaded = false; }
    }
    indexed = docs.length;
    lastSyncMs = Date.now() - t0;
    state.integrations.moss = status();
    emit("moss", state.integrations.moss);
    save();
    return { indexed, ms: lastSyncMs, engine: loaded ? "moss" : "local" };
  })().finally(() => { syncing = null; });
  return syncing;
}

let syncTimer = null;
export function scheduleSync(ms = 1200) { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncIndex().catch(() => {}), ms); }

export function status() {
  return { enabled: mossEnabled(), loaded, index: INDEX, indexed, lastSyncMs, lastError, engine: mossEnabled() && loaded ? "moss" : "local" };
}

/** Hybrid search. opts: { topK, alpha (0 keyword … 1 semantic), type, accountId } */
export async function search(q, opts = {}) {
  const topK = opts.topK || 8, alpha = opts.alpha ?? 0.6;
  const t0 = performance.now();
  let results = null, engine = "local";
  const c = mossEnabled() && loaded ? await getClient() : null;
  if (c) {
    try {
      const r = await c.query(INDEX, q, { topK: opts.type || opts.accountId ? topK * 4 : topK, alpha });
      results = r.docs.map((d) => ({ id: d.id, text: d.text, metadata: d.metadata || {}, score: d.score }));
      engine = "moss";
    } catch (e) { lastError = e.message; }
  }
  if (!results) results = localSearch(buildDocs(), q, opts.type || opts.accountId ? topK * 4 : topK, alpha);
  if (opts.type) results = results.filter((r) => r.metadata?.type === opts.type);
  if (opts.accountId) results = results.filter((r) => r.metadata?.accountId === opts.accountId);
  if (opts.excludeId) results = results.filter((r) => r.id !== opts.excludeId && r.metadata?.accountId !== opts.excludeId);
  const ms = Math.round((performance.now() - t0) * 10) / 10;
  return { q, engine, ms, results: results.slice(0, topK) };
}

export async function lookalikes(accountId, topK = 5) {
  const a = state.accounts.find((x) => x.id === accountId);
  if (!a) throw new Error("Account not found");
  const profile = `${a.industry} company ${a.hq} ~${a.headcount} employees. ${a.why_fit} ${(a.signals || []).map((s) => s.type).join(" ")}`;
  return { seed: a.name, ...(await search(profile, { topK, type: "account", excludeId: a.id, alpha: 0.8 })) };
}
