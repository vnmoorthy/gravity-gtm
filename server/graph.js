// Dynamic Knowledge Graph — native property-graph engine (labels + directed edges) with multi-hop reasoning.
// Mirrors to Neo4j automatically when NEO4J_URI is configured (Cypher shown for every query).
import { state } from "./store.js";

let neo = null;
export async function initNeo4j() {
  if (!process.env.NEO4J_URI || !process.env.NEO4J_PASSWORD) return false;
  try {
    const neo4j = (await import("neo4j-driver")).default;
    neo = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER || "neo4j", process.env.NEO4J_PASSWORD));
    await neo.verifyConnectivity();
    return true;
  } catch (e) {
    console.warn("Neo4j unavailable, using built-in graph engine:", e.message);
    neo = null;
    return false;
  }
}
export const neo4jConnected = () => Boolean(neo);

const norm = (s = "") => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Build the graph view from entities (single source of truth = state). */
export function buildGraph() {
  const nodes = new Map();
  const links = [];
  const add = (id, label, name, props = {}) => {
    if (!nodes.has(id)) nodes.set(id, { id, label, name, ...props });
    return id;
  };
  const edge = (source, target, type, props = {}) => links.push({ source, target, type, ...props });

  const p = state.product;
  if (p) add("product", "Product", p.name || "Your product", { val: 18 });

  // Your team (for warm paths)
  for (const t of state.team) {
    add(t.id, "Person", t.name, { team: true, title: t.title, val: 6 });
    for (const c of t.prior_companies || []) {
      const cid = "co_" + norm(c);
      add(cid, "Company", c, { alumni: true, val: 3 });
      edge(t.id, cid, "previously_employed_at");
    }
    for (const s of t.schools || []) {
      const sid = "edu_" + norm(s);
      add(sid, "Company", s, { school: true, val: 3 });
      edge(t.id, sid, "studied_at");
    }
  }

  for (const a of state.accounts) {
    if (a.status === "filtered") continue;
    const id = a.id;
    add(id, "Company", a.name, { tier: a.tier, score: a.score, domain: a.domain, val: 6 + (a.score || 0) / 12, account: true });
    // alias for alumni matching
    const alias = "co_" + norm(a.name);
    if (nodes.has(alias) && alias !== id) edge(alias, id, "same_as");
    if (p) edge(id, "product", "matched_to", { score: a.score });
    for (const s of a.signals || []) {
      add(s.id, "Signal", s.text?.slice(0, 60) || s.type, { signalType: s.type, val: 2.5 });
      edge(id, s.id, "has_signal");
    }
    for (const cid of a.uses_competitors || []) edge(id, cid, "uses", { displacement: true });
  }

  for (const person of state.people) {
    add(person.id, "Person", person.name, { title: person.title, val: 4, email_status: person.email_status });
    edge(person.id, person.accountId, "works_at");
    for (const c of person.prior_companies || []) {
      const cid = "co_" + norm(c);
      add(cid, "Company", c, { alumni: true, val: 3 });
      edge(person.id, cid, "previously_employed_at");
    }
    for (const s of person.schools || []) {
      const sid = "edu_" + norm(s);
      add(sid, "Company", s, { school: true, val: 3 });
      edge(person.id, sid, "studied_at");
    }
  }

  for (const c of state.competitors) {
    add(c.id, "Competitor", c.name, { category: c.category, val: 7 });
    if (p) edge(c.id, "product", "competes_with", { category: c.category });
  }

  for (const m of state.messages) {
    if (m.status === "sent") edge(m.personId, "product", "contacted_via", { channel: m.channel });
  }
  for (const l of state.leads) {
    if (["replied", "meeting", "closed"].includes(l.stage)) edge(l.personId, "product", "replied_to");
  }

  // drop links whose ends don't exist
  const valid = links.filter((l) => nodes.has(l.source) && nodes.has(l.target));
  return { nodes: [...nodes.values()], links: valid };
}

function adjacency(g) {
  const adj = new Map();
  for (const n of g.nodes) adj.set(n.id, []);
  for (const l of g.links) {
    adj.get(l.source)?.push({ to: l.target, type: l.type, dir: "out" });
    adj.get(l.target)?.push({ to: l.source, type: l.type, dir: "in" });
  }
  return adj;
}

/** Warm intro paths: team member → (alumni company/school) → buyer → account. Multi-hop BFS. */
export function warmPaths(maxDepth = 4) {
  const g = buildGraph();
  const adj = adjacency(g);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const buyers = new Set(state.people.map((p) => p.id));
  const allowed = new Set(["previously_employed_at", "studied_at", "works_at", "same_as"]);
  const results = [];
  for (const t of state.team) {
    const q = [[t.id]];
    const seen = new Set([t.id]);
    while (q.length) {
      const path = q.shift();
      const last = path[path.length - 1];
      if (path.length > 1 && buyers.has(last)) {
        const person = state.people.find((p) => p.id === last);
        const via = path.slice(1, -1).map((id) => byId.get(id)?.name).filter(Boolean);
        results.push({
          from: t.name,
          to: person?.name,
          personId: last,
          accountId: person?.accountId,
          account: state.accounts.find((a) => a.id === person?.accountId)?.name,
          path,
          names: path.map((id) => byId.get(id)?.name),
          via,
          hops: path.length - 1,
          strength: Math.max(0.35, 1 - (path.length - 2) * 0.2),
        });
        continue;
      }
      if (path.length > maxDepth) continue;
      for (const e of adj.get(last) || []) {
        if (!allowed.has(e.type) || seen.has(e.to)) continue;
        seen.add(e.to);
        q.push([...path, e.to]);
      }
    }
  }
  return results.sort((a, b) => a.hops - b.hops);
}

/** Link hiring signals (job reqs) to active buyer evaluation cycles. */
export function hiringToEvaluation() {
  const personaWords = (state.icp?.personas || []).flatMap((p) => (p.title + " " + (p.function || "")).toLowerCase().split(/\W+/)).filter((w) => w.length > 3);
  const out = [];
  for (const a of state.accounts) {
    if (a.status === "filtered") continue;
    for (const s of a.signals || []) {
      if (s.type !== "hiring") continue;
      const t = (s.text || "").toLowerCase();
      const hits = personaWords.filter((w) => t.includes(w));
      out.push({ accountId: a.id, account: a.name, signal: s.text, source: s.source, overlap: [...new Set(hits)].slice(0, 5), likelihood: Math.min(0.95, 0.55 + hits.length * 0.1) });
    }
  }
  return out.sort((a, b) => b.likelihood - a.likelihood);
}

/** Competitor displacement: accounts using a competitor + renewal/churn/pain signals. */
export function displacement() {
  const out = [];
  for (const a of state.accounts) {
    if (a.status === "filtered") continue;
    for (const cid of a.uses_competitors || []) {
      const c = state.competitors.find((x) => x.id === cid);
      if (!c) continue;
      const pain = (a.signals || []).filter((s) => /renew|churn|migrat|replac|frustrat|switch|cost|price|outage|layoff|consolidat/i.test(s.text || ""));
      out.push({ accountId: a.id, account: a.name, competitor: c.name, competitorId: c.id, pain: pain.map((p) => p.text), edge: c.our_edge, confidence: Math.min(0.92, 0.5 + pain.length * 0.15) });
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

export const QUERIES = {
  warm_paths: {
    title: "Warm introduction paths",
    cypher: "MATCH p=(me:Person {team:true})-[:PREVIOUSLY_EMPLOYED_AT|STUDIED_AT*1..2]-(x)-[:PREVIOUSLY_EMPLOYED_AT|STUDIED_AT|WORKS_AT]-(buyer:Person)-[:WORKS_AT]->(c:Company)\nWHERE (c)-[:MATCHED_TO]->(:Product)\nRETURN p ORDER BY length(p) LIMIT 25",
    run: warmPaths,
  },
  hiring_cycles: {
    title: "Job reqs → active evaluation cycles",
    cypher: "MATCH (c:Company)-[:HAS_SIGNAL]->(s:Signal {type:'hiring'})\nMATCH (c)-[:MATCHED_TO]->(:Product)\nWITH c, s, [w IN $personaKeywords WHERE toLower(s.text) CONTAINS w] AS hits\nRETURN c.name, s.text, size(hits) AS overlap ORDER BY overlap DESC",
    run: hiringToEvaluation,
  },
  displacement: {
    title: "Competitor displacement opportunities",
    cypher: "MATCH (c:Company)-[:USES]->(k:Competitor)-[:COMPETES_WITH]->(:Product)\nOPTIONAL MATCH (c)-[:HAS_SIGNAL]->(s:Signal)\nWHERE s.text =~ '(?i).*(renew|churn|migrat|switch|cost|frustrat).*'\nRETURN c.name, k.name, collect(s.text) AS pain ORDER BY size(pain) DESC",
    run: displacement,
  },
};

export async function syncNeo4j() {
  if (!neo) return { synced: false };
  const g = buildGraph();
  const session = neo.session();
  try {
    await session.run("MATCH (n:Gravity) DETACH DELETE n");
    for (const n of g.nodes) {
      await session.run(`MERGE (n:Gravity:${n.label} {id:$id}) SET n.name=$name, n.team=$team`, { id: n.id, name: n.name || "", team: Boolean(n.team) });
    }
    for (const l of g.links) {
      await session.run(`MATCH (a:Gravity {id:$s}),(b:Gravity {id:$t}) MERGE (a)-[:${l.type.toUpperCase()}]->(b)`, { s: l.source, t: l.target });
    }
    return { synced: true, nodes: g.nodes.length, links: g.links.length };
  } finally {
    await session.close();
  }
}
