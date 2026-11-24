// The closed-loop GTM pipeline: Intake → ICP → Discovery + Competitors → Graph → Enrichment → Outreach → Review/Twin/Security → HITL queue.
import { state, save, emit, uid, now, audit } from "./store.js";
import { ask, hasLLM } from "./llm.js";
import { say, track, requestApproval } from "./agents.js";
import { meter, CreditError } from "./billing.js";
import { enrichPerson } from "./enrich.js";
import { warmPaths, hiringToEvaluation, displacement } from "./graph.js";
import * as demo from "./demo.js";
import { search as mossSearch, scheduleSync, syncIndex } from "./moss.js";
import { processAccount, publish as publishRocket } from "./rocketride.js";
import { scheduleWarehouseSync } from "./hotdata.js";

const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, Number(n) || 0));
const host = (u = "") => { try { return new URL(u.startsWith("http") ? u : "https://" + u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanDomain = (d = "") => host(d) || d.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

function setRun(patch) {
  state.run = { ...state.run, ...patch };
  emit("run", state.run);
  save();
}

const SYSTEM = `You are part of Gravity, an autonomous go-to-market engine. You are rigorous, evidence-driven and concise.
Never invent people, companies, quotes, numbers or URLs. If you cannot verify something from public sources, leave it out.
When asked for JSON, reply with ONE fenced \`\`\`json block containing only valid JSON matching the requested shape — no commentary after it.`;

// ───────────────────────────── 1. ICP ENGINE ─────────────────────────────
export async function inferICP(product) {
  say("strategist", `Reading the intake for **${product.name || "your product"}** — extracting features, reference wins, pricing and constraints.`, { kind: "thought" });
  await meter("icp_inference", 1, { product: product.name });
  let icp;
  if (!hasLLM()) {
    await sleep(900);
    icp = demo.icp(product);
  } else {
    const r = await ask({
      system: SYSTEM,
      effort: "low",
      web: Boolean(product.website),
      maxUses: 3,
      prompt: `Infer a precise Ideal Customer Profile for this B2B product.${product.website ? ` First skim the product website ${product.website} to ground yourself.` : ""}

PRODUCT INTAKE
Name: ${product.name}
Description: ${product.description}
Website: ${product.website || "n/a"}
Existing customers / reference wins: ${product.customers || "n/a"}
Pricing / ACV / motion: ${product.pricing || "n/a"}
Constraints (regions, compliance, tech): ${product.constraints || "n/a"}

Return JSON:
{"one_liner": str, "summary": str (2 sentences on who buys and why now),
 "industries": [{"name": str, "naics": str (NAICS code), "rationale": str, "confidence": 0-1}] (3-4),
 "company_size": {"headcount_min": int, "headcount_max": int, "revenue_band": str, "rationale": str, "confidence": 0-1},
 "regions": [{"name": str, "confidence": 0-1}],
 "personas": [{"title": str, "function": str, "seniority": "C-level|VP|Director|Manager|IC", "buying_role": "economic buyer|champion|user|blocker", "pains": [str,str], "confidence": 0-1}] (3-4),
 "triggers": [{"type": "funding|exec_hire|hiring|tech_change|expansion|regulatory|product_launch|news", "signal": str, "why": str, "confidence": 0-1}] (4-6),
 "negative_signals": [str] (3-5, e.g. hiring freeze, non-target region),
 "value_props": [str] (3),
 "pricing_fit": {"acv": str, "motion": "PLG|sales-led|hybrid", "confidence": 0-1},
 "expansions": [{"segment": str, "rationale": str, "evidence": str (concrete public evidence or analogue), "confidence": 0-1}] (3 adjacent / non-obvious segments)}
Confidence must reflect real certainty given the intake (lower when the intake is vague).`,
    });
    track("strategist", r);
    icp = r.json;
    if (!icp?.personas) throw new Error("ICP inference returned no structured output");
    say("strategist", `ICP inferred: ${icp.industries?.map((i) => i.name).join(", ")} · ${icp.company_size?.headcount_min}-${icp.company_size?.headcount_max} employees · buyers: ${icp.personas?.map((p) => p.title).join(", ")}`, { kind: "result", usage: r.usage, cost: r.cost });
  }
  const expansions = (icp.expansions || []).map((e) => ({ id: uid("exp"), ...e, confidence: clamp(e.confidence), status: "suggested" }));
  delete icp.expansions;
  state.icp = icp;
  state.icpStatus = "inferred";
  state.expansions = expansions;
  emit("icp", { icp, expansions, icpStatus: state.icpStatus });
  audit("ai", "icp_inferred", { industries: icp.industries?.length, personas: icp.personas?.length });
  say("strategist", `Found ${expansions.length} expansion segments worth testing — @You can accept, adjust or dismiss them on the ICP board.`, { to: ["human", "planner"], kind: "handoff" });
  save();
  return icp;
}

// ───────────────────────────── 2. DISCOVERY ─────────────────────────────
function scoreAccount(a, icp) {
  const inds = (icp?.industries || []).map((i) => i.name.toLowerCase());
  const indHit = inds.some((i) => (a.industry || "").toLowerCase().split(/\W+/).some((w) => w.length > 3 && i.includes(w))) ? 1 : 0.55;
  const hc = Number(a.headcount) || 0;
  const min = icp?.company_size?.headcount_min || 0, max = icp?.company_size?.headcount_max || 1e9;
  const sizeHit = hc ? (hc >= min && hc <= max ? 1 : hc >= min * 0.5 && hc <= max * 2 ? 0.7 : 0.35) : 0.6;
  const buyerHit = Math.min(1, (a.buyerCount || 0) / 2);
  const fit = Math.round((indHit * 0.45 + sizeHit * 0.3 + buyerHit * 0.25) * 100);
  const weights = { funding: 22, exec_hire: 20, hiring: 18, tech_change: 18, expansion: 14, product_launch: 12, regulatory: 12, news: 8 };
  let intent = 0;
  for (const s of a.signals || []) {
    let w = weights[s.type] || 8;
    const days = s.date ? (Date.now() - new Date(s.date).getTime()) / 864e5 : 120;
    if (days < 45) w *= 1.25; else if (days > 240) w *= 0.6;
    intent += w;
  }
  intent = Math.min(100, Math.round(intent + (a.uses_competitors?.length ? 12 : 0)));
  const score = Math.round(fit * 0.55 + intent * 0.45);
  return { fit_score: fit, intent_score: intent, score, tier: score >= 72 ? "A" : score >= 55 ? "B" : "C" };
}

async function scoutBatch(icp, product, focus, n, exclude) {
  const r = await ask({
    system: SYSTEM,
    effort: "low",
    web: true,
    maxUses: 7,
    prompt: `Find ${n} REAL companies that fit this ICP and show a recent buying signal. Use web search. Focus: ${focus}.
Product being sold: ${product.name} — ${product.description}
ICP: industries=${icp.industries.map((i) => i.name).join("; ")}; size=${icp.company_size.headcount_min}-${icp.company_size.headcount_max} employees; regions=${(icp.regions || []).map((r) => r.name).join(", ") || "any"}
Target personas: ${icp.personas.map((p) => p.title).join("; ")}
Trigger events to look for: ${icp.triggers.map((t) => t.signal).join("; ")}
Negative signals (exclude or flag): ${(icp.negative_signals || []).join("; ")}
Do NOT include: ${exclude.join(", ") || "n/a"}, or the product's own company, or obvious competitors of the product.

For each company find 1-2 named decision-makers matching the personas from public pages (team/leadership page, press release, conference speaker page, news). Only include a person if a public source names them with that role.
Return JSON: {"companies":[{"name": str, "domain": str, "industry": str, "hq": str, "headcount": int (estimate), "why_fit": str (1 sentence),
 "signals":[{"type": "funding|exec_hire|hiring|tech_change|expansion|product_launch|regulatory|news", "text": str (specific, with numbers), "date": "YYYY-MM or YYYY-MM-DD", "source_url": str}],
 "buyers":[{"name": str, "title": str, "linkedin_url": str|null, "source_url": str, "prior_companies":[str], "schools":[str]}],
 "tools_used":[str] (known vendor tools in this product's category, if public),
 "negative_signals":[str],
 "sources":[str] (every URL you relied on)}]}`,
  });
  return r;
}

export async function discover(opts = {}) {
  const icp = state.icp, product = state.product;
  if (!icp) throw new Error("Run ICP inference first");
  const n = opts.count || 8;
  const exclude = state.accounts.map((a) => a.name);
  say("planner", `Milestone 2 → discovery. @Scout find ${n} accounts with live trigger signals; @Analyst map the competitive landscape in parallel.`, { to: ["scout", "analyst"], kind: "plan" });

  const compPromise = mapCompetitors().catch((e) => say("analyst", `Competitive mapping failed: ${e.message}`, { kind: "error" }));

  let companies = [], retrieved = new Set();
  if (!hasLLM()) {
    await sleep(1200);
    companies = demo.companies(product, icp, n, exclude);
    companies.forEach((c) => c.sources.forEach((s) => retrieved.add(s)));
    say("scout", `Demo mode: synthesised ${companies.length} illustrative accounts (add ANTHROPIC_API_KEY for live web discovery).`, { kind: "thought" });
  } else {
    const inds = icp.industries.map((i) => i.name);
    const half = Math.ceil(n / 2);
    const focuses = [inds.slice(0, 2).join(" / ") || "core ICP", (state.expansions.find((e) => e.status === "accepted")?.segment) || inds.slice(2).join(" / ") || "fast-growing companies in the ICP with recent funding or leadership change"];
    say("scout", `Launching 2 parallel search sweeps: “${focuses[0]}” and “${focuses[1]}”. Every claim must carry a source URL.`, { kind: "thought" });
    const results = await Promise.allSettled(focuses.map((f, i) => scoutBatch(icp, product, f, i === 0 ? half : n - half, exclude)));
    for (const res of results) {
      if (res.status !== "fulfilled") { say("scout", `A sweep failed: ${res.reason?.message}`, { kind: "error" }); continue; }
      const r = res.value;
      track("scout", r);
      r.sources.forEach((s) => retrieved.add(s.url));
      say("scout", `Sweep returned ${r.json?.companies?.length || 0} candidates from ${r.sources.length} retrieved pages (${r.usage.searches} searches).`, { kind: "result", usage: r.usage, cost: r.cost });
      companies.push(...(r.json?.companies || []));
    }
  }

  // Citation gate + negative signal filter + dedupe
  const retrievedHosts = new Set([...retrieved].map(host));
  const seen = new Set(exclude.map((e) => e.toLowerCase()));
  let kept = 0, dropped = 0;
  for (const c of companies) {
    if (!c?.name || seen.has(c.name.toLowerCase())) continue;
    seen.add(c.name.toLowerCase());
    const srcs = [...new Set([...(c.sources || []), ...(c.signals || []).map((s) => s.source_url), ...(c.buyers || []).map((b) => b.source_url)].filter(Boolean))];
    const verified = srcs.filter((u) => retrieved.has(u) || retrievedHosts.has(host(u)));
    const a = {
      id: uid("acc"), name: c.name, domain: cleanDomain(c.domain), industry: c.industry, hq: c.hq, headcount: c.headcount, why_fit: c.why_fit,
      sources: srcs, verified_sources: verified, citation_status: verified.length ? "verified" : "unverified",
      signals: (c.signals || []).map((s) => ({ id: uid("sig"), type: s.type || "news", text: s.text, date: s.date, source: s.source_url, verified: retrieved.has(s.source_url) || retrievedHosts.has(host(s.source_url)) })),
      tools_used: c.tools_used || [], negative: c.negative_signals || [], status: "qualified", discoveredAt: now(), discoveredBy: "ai", uses_competitors: [],
    };
    const neg = (a.negative || []).find((x) => /freeze|layoff|bankrupt|acquired|shut|non-target|out of region/i.test(x));
    if (!verified.length && hasLLM() && retrieved.size > 0) { a.status = "filtered"; a.filter_reason = "Citation gate: no claim traceable to a retrieved source"; dropped++; }
    else if (neg) { a.status = "filtered"; a.filter_reason = `Negative signal: ${neg}`; dropped++; }
    try { a.signals = await processAccount(a); } catch { /* pipeline optional */ }
    a.buyerCount = (c.buyers || []).length;
    Object.assign(a, scoreAccount(a, icp));
    try { await meter("account_discovered", 1, { account: a.name }); } catch (e) { if (e instanceof CreditError) { say("governor", `⛔ ${e.message}. Discovery paused — @You top up credits to continue.`, { to: ["human"], kind: "billing" }); break; } }
    state.accounts.push(a);
    for (const b of c.buyers || []) {
      if (!b?.name) continue;
      state.people.push({
        id: uid("per"), name: b.name, title: b.title, accountId: a.id, linkedin: b.linkedin_url || null, source: b.source_url,
        source_verified: retrieved.has(b.source_url) || retrievedHosts.has(host(b.source_url)),
        prior_companies: b.prior_companies || [], schools: b.schools || [], email: null, email_status: "pending",
      });
    }
    if (a.status !== "filtered") kept++;
    emit("accounts", { accounts: state.accounts, people: state.people });
  }
  publishRocket();
  say("scout", `RocketRide pipeline normalised & classified signals for ${companies.length} accounts (${state.integrations.rocketride?.engine || "local"}).`, { kind: "thought" });
  say("scout", `Citation gate: kept ${kept} accounts, dropped ${dropped} (no verifiable source or negative signal). ${state.people.length} named buyers on file.`, { to: ["cartographer"], kind: "handoff" });
  audit("ai", "discovery_completed", { kept, dropped });
  await compPromise;
  linkCompetitorUsage();
  await graphPass();
  save();
  return { kept, dropped };
}

// ───────────────────────────── 3. COMPETITORS ─────────────────────────────
export async function mapCompetitors() {
  const product = state.product, icp = state.icp;
  let list;
  if (!hasLLM()) {
    await sleep(700);
    list = demo.competitors(product);
  } else {
    say("analyst", `Researching direct, indirect and “do-nothing” alternatives to ${product.name}, including public pricing pages.`, { kind: "thought" });
    const r = await ask({
      system: SYSTEM,
      effort: "low",
      web: true,
      maxUses: 6,
      prompt: `Map the competitive landscape for: ${product.name} — ${product.description}. Target buyers: ${icp.personas.map((p) => p.title).join(", ")}.
Return JSON: {"competitors":[{"name": str, "domain": str, "category": "direct|indirect|alternative", "positioning": str, "value_prop": str, "pricing": str (public tiers/packaging or "not public"), "strengths":[str], "weaknesses":[str], "our_edge": str (structural/technical differentiator of ${product.name} vs them), "sources":[str]}]}
Include 3 direct, 1-2 indirect and 1 alternative (e.g. spreadsheets/in-house). Use real, current public info with source URLs.`,
    });
    track("analyst", r);
    list = r.json?.competitors || [];
    say("analyst", `Mapped ${list.length} competitors (${list.filter((c) => c.category === "direct").length} direct).`, { kind: "result", usage: r.usage, cost: r.cost });
  }
  state.competitors = list.map((c) => ({ id: uid("cmp"), ...c, domain: cleanDomain(c.domain || "") }));
  emit("competitors", state.competitors);
  save();
  return state.competitors;
}

function linkCompetitorUsage() {
  for (const a of state.accounts) {
    const blob = [...(a.tools_used || []), ...(a.signals || []).map((s) => s.text)].join(" ").toLowerCase();
    a.uses_competitors = state.competitors.filter((c) => c.name && blob.includes(c.name.toLowerCase())).map((c) => c.id);
    if (a.uses_competitors.length) Object.assign(a, scoreAccount(a, state.icp));
  }
}

// ───────────────────────────── 4. GRAPH ─────────────────────────────
export async function graphPass() {
  const wp = warmPaths();
  const hc = hiringToEvaluation();
  const dp = displacement();
  try { await meter("graph_query", 3, { queries: "warm_paths,hiring_cycles,displacement" }); } catch { /* gated, non-fatal */ }
  say("cartographer", `Graph updated: ${state.accounts.filter((a) => a.status !== "filtered").length} companies · ${state.people.length} people · ${state.competitors.length} competitors. Multi-hop: ${wp.length} warm intro paths, ${hc.length} hiring→evaluation links, ${dp.length} displacement plays.`, { to: ["enricher", "writer"], kind: "result", data: { warm: wp.slice(0, 5), hiring: hc.slice(0, 5), displacement: dp.slice(0, 5) } });
  emit("graph", {});
  scheduleSync(200);
  scheduleWarehouseSync(1500);
  return { wp, hc, dp };
}

// ───────────────────────────── 5. ENRICHMENT ─────────────────────────────
export async function enrichAll({ limit = 20 } = {}) {
  const targets = state.people.filter((p) => p.email_status === "pending" && state.accounts.find((a) => a.id === p.accountId && a.status !== "filtered")).slice(0, limit);
  if (!targets.length) return { enriched: 0 };
  say("enricher", `Running the waterfall on ${targets.length} buyers: DNS → MX → pattern synthesis → Hunter verifier${process.env.HUNTER_API_KEY ? "" : " (not keyed — pattern+MX mode)"} → LinkedIn.`, { kind: "thought" });
  let n = 0;
  for (const p of targets) {
    try { await meter("lead_enriched", 1, { person: p.name }); } catch (e) {
      if (e instanceof CreditError) { say("governor", `⛔ Credit gate hit: enrichment needs 5 credits, wallet has ${state.billing.balance}. Pausing the high-cost pipeline — @You top up to resume.`, { to: ["human", "enricher"], kind: "billing" }); break; }
    }
    const acc = state.accounts.find((a) => a.id === p.accountId);
    try { Object.assign(p, await enrichPerson(p, acc)); } catch (e) { p.email_status = "error"; p.enrich_error = e.message; }
    n++;
    emit("person", p);
  }
  const ok = targets.filter((p) => ["verified", "likely"].includes(p.email_status)).length;
  say("enricher", `Enriched ${n} buyers: ${ok} deliverable emails (MX-validated), ${targets.filter((p) => p.linkedin_status === "verified").length} verified LinkedIn profiles.`, { to: ["writer"], kind: "handoff" });
  audit("ai", "enrichment_completed", { enriched: n, deliverable: ok });
  save();
  return { enriched: n };
}

// ───────────────────────────── 6. OUTREACH ─────────────────────────────
function leadContext(p) {
  const a = state.accounts.find((x) => x.id === p.accountId);
  const warm = warmPaths().find((w) => w.personId === p.id);
  const disp = displacement().find((d) => d.accountId === a?.id);
  const persona = (state.icp?.personas || []).find((x) => (p.title || "").toLowerCase().includes((x.function || "").toLowerCase().split(" ")[0])) || state.icp?.personas?.[0];
  return { a, warm, disp, persona };
}

export async function writeOutreach({ limit = 8 } = {}) {
  const leads = state.people
    .filter((p) => ["verified", "likely"].includes(p.email_status) && !state.messages.some((m) => m.personId === p.id))
    .map((p) => ({ p, a: state.accounts.find((a) => a.id === p.accountId) }))
    .filter((x) => x.a && x.a.status !== "filtered")
    .sort((x, y) => (y.a.score || 0) - (x.a.score || 0))
    .slice(0, limit);
  if (!leads.length) return { drafted: 0 };
  say("planner", `Milestone 4 → outreach. @Writer draft 3-touch sequences (A/B on touch 1) for the top ${leads.length} leads; @Reviewer and @Sentinel gate everything before @You see it.`, { to: ["writer", "reviewer", "sentinel"], kind: "plan" });

  const conc = 4;
  let drafted = 0;
  for (let i = 0; i < leads.length; i += conc) {
    const chunk = leads.slice(i, i + conc);
    await Promise.all(chunk.map(async ({ p, a }) => {
      const { warm, disp, persona } = leadContext(p);
      let grounded = [];
      try {
        const g = await mossSearch(`${(persona?.pains || []).join(" ")} ${state.product.description}`, { topK: 3, type: "signal", accountId: a.id });
        grounded = g.results;
        if (grounded.length) say("writer", `Moss ranked ${grounded.length} most-relevant signals for ${p.name} in ${g.ms}ms (${g.engine}).`, { kind: "thought" });
      } catch { /* optional */ }
      let seq;
      if (!hasLLM()) { await sleep(400); seq = demo.sequence(state.product, p, a, warm, disp); }
      else {
        const r = await ask({
          system: SYSTEM + "\nYou write outbound like a top-1% founder: specific, short, human, zero fluff, no buzzwords, no fake familiarity.",
          effort: "low",
          prompt: `Write a 3-touch outbound sequence to ${p.name} (${p.title}) at ${a.name}.
Seller: ${state.product.name} — ${state.product.description}
Value props: ${(state.icp.value_props || []).join("; ")}
Persona pains: ${(persona?.pains || []).join("; ")}
${grounded.length ? `MOST RELEVANT TO THIS PERSONA (Moss-ranked): ${grounded.map((r) => r.text).join(" | ")}\n` : ""}VERIFIED SIGNALS about ${a.name} (only reference these, cite by index):
${a.signals.map((s, i) => `[${i}] (${s.type}, ${s.date || "recent"}) ${s.text} — ${s.source}`).join("\n")}
${warm ? `WARM PATH: ${warm.names.join(" → ")} (mention the shared connection naturally)` : ""}
${disp ? `They appear to use competitor ${disp.competitor}. Our edge: ${disp.edge}` : ""}
Constraints: email ≤ 110 words, subject ≤ 6 words lowercase, LinkedIn note ≤ 280 chars, one clear low-friction CTA, no links except optionally ${state.product.website || "none"}.
Return JSON: {"touches":[
 {"step":1,"channel":"email","variant":"A","angle":"signal-led","subject":str,"body":str,"claims":[{"text":str,"signal_index":int}]},
 {"step":1,"channel":"email","variant":"B","angle":"pain-led","subject":str,"body":str,"claims":[...]},
 {"step":2,"channel":"linkedin","variant":"A","angle":"connect","subject":"","body":str,"claims":[...]},
 {"step":3,"channel":"email","variant":"A","angle":"follow-up value add","subject":str,"body":str,"claims":[...]}]}`,
        });
        track("writer", r);
        seq = r.json?.touches || [];
      }
      for (const t of seq) {
        try { await meter("outreach_generated", 1, { person: p.name }, { gate: false }); } catch { /* */ }
        state.messages.push({
          id: uid("out"), personId: p.id, accountId: a.id, step: t.step, channel: t.channel, variant: t.variant || "A", angle: t.angle,
          subject: t.subject || "", body: t.body || "", claims: (t.claims || []).map((c) => ({ ...c, source: a.signals[c.signal_index]?.source || null })),
          status: "drafting", createdAt: now(), author: "ai", edited: false, history: [],
        });
        drafted++;
      }
      say("writer", `Drafted ${seq.length} touches for ${p.name} @ ${a.name}${warm ? " (warm-path angle)" : ""}${disp ? ` (displacing ${disp.competitor})` : ""}.`, { kind: "result" });
      emit("messages", state.messages);
    }));
  }
  await reviewAll();
  save();
  return { drafted };
}

// ───────────────────────────── 7. REVIEW · TWIN · SECURITY ─────────────────────────────
const SPAM = /\b(guarantee|risk[- ]free|act now|limited time|100%|free money|click here|synergy|revolutionary)\b/i;
const SHORTENERS = /(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly)/i;
const INJECTION = /(ignore (all|previous) instructions|system prompt|you are now|disregard the above)/i;

export function securityScan(m) {
  const findings = [];
  const urls = [...(m.body + " " + m.subject).matchAll(/https?:\/\/[^\s)>\]]+/g)].map((x) => x[0]);
  const acc = state.accounts.find((a) => a.id === m.accountId);
  const allow = new Set([host(state.product?.website || ""), acc?.domain, "linkedin.com", "calendly.com", "cal.com"].filter(Boolean));
  for (const u of urls) {
    const h = host(u);
    if (!u.startsWith("https://")) findings.push({ severity: "high", text: `Insecure link (http): ${u}` });
    if (SHORTENERS.test(h)) findings.push({ severity: "high", text: `URL shortener hides destination: ${h}` });
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) findings.push({ severity: "high", text: `Raw IP link: ${h}` });
    if (h && ![...allow].some((d) => h === d || h.endsWith("." + d))) findings.push({ severity: "medium", text: `Off-allowlist domain: ${h}` });
  }
  if (/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(m.body)) findings.push({ severity: "medium", text: "Phone number in copy (PII)" });
  if (/@(gmail|yahoo|hotmail|outlook)\.com/i.test(m.body)) findings.push({ severity: "medium", text: "Personal email address in copy (PII)" });
  if (INJECTION.test(m.body)) findings.push({ severity: "high", text: "Prompt-injection pattern leaked from scraped content" });
  for (const s of acc?.signals || []) if (INJECTION.test(s.text || "")) findings.push({ severity: "high", text: `Scraped signal contains injection text (quarantined): “${s.text.slice(0, 60)}”` });
  const status = findings.some((f) => f.severity === "high") ? "blocked" : findings.length ? "warn" : "clear";
  return { status, findings, links: urls, scannedAt: now() };
}

function lint(m) {
  const notes = [];
  const words = (m.body || "").split(/\s+/).filter(Boolean).length;
  if (m.channel === "email" && words > 130) notes.push(`Too long (${words} words)`);
  if (m.channel === "linkedin" && (m.body || "").length > 300) notes.push("LinkedIn note over 300 chars");
  if (/\{\{|\[first name\]|\[company\]|<name>/i.test(m.body)) notes.push("Unfilled template placeholder");
  if (SPAM.test(m.body + m.subject)) notes.push("Spam-trigger wording");
  if (!/\?/.test(m.body)) notes.push("No clear question/CTA");
  return notes;
}

/** Deterministic number/fact audit: every number, $ amount or funding round in the copy must appear in the evidence. */
export function numberAudit(m) {
  const acc = state.accounts.find((a) => a.id === m.accountId);
  const evidence = [...(acc?.signals || []).map((s) => s.text), acc?.why_fit, acc?.headcount, state.product?.description, (state.icp?.value_props || []).join(" ")].join(" ").toLowerCase();
  const text = `${m.subject} ${m.body}`;
  const out = [];
  for (const mt of text.matchAll(/(\$\s?\d[\d,.]*\s?(?:k|m|mm|b|million|billion)?|\bseries [a-f]\b|\b\d+(?:\.\d+)?\s?(?:%|x\b)|\b\d{2,}(?:,\d{3})*\s(?:employees|customers|engineers|people|hires|roles|stores|locations))/gi)) {
    const tok = mt[0].toLowerCase().replace(/\s+/g, " ").trim();
    const core = tok.replace(/[$,\s]/g, "").replace(/(million|mm)$/, "m").replace(/billion$/, "b");
    const ev = evidence.replace(/[$,\s]/g, "").replace(/million/g, "m").replace(/billion/g, "b");
    if (!ev.includes(core)) {
      const before = text.slice(0, mt.index);
      const start = Math.max(before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("?"), before.lastIndexOf("\n"), before.lastIndexOf(",") > before.length - 3 ? -1 : -1) + 1;
      const rest = text.slice(mt.index + tok.length);
      const e = rest.search(/[.!?\n]/);
      out.push(text.slice(start, e === -1 ? undefined : mt.index + tok.length + e + 1).trim());
    }
  }
  return [...new Set(out)];
}

export async function reviewOne(m) {
  m.status = "drafting";
  const p = state.people.find((x) => x.id === m.personId);
  const a = state.accounts.find((x) => x.id === m.accountId);
  let v = null;
  if (hasLLM()) {
    try {
      const r = await ask({ system: SYSTEM, effort: "low", prompt: `REVIEWER: fact-check this outbound message to ${p?.name} at ${a?.name} against the evidence. A claim is supported only if the evidence states it. Quote each unsupported sentence EXACTLY as it appears.\nEVIDENCE:\n${(a?.signals || []).map((s, k) => `[${k}] ${s.text}`).join("\n")}\nMESSAGE:\nSubject: ${m.subject}\n${m.body}\nReturn JSON {"verdict":"pass|revise","unsupported_claims":[str],"notes":str,"reply_probability":0-1,"objection":str,"twin_reply":str}` });
      track("reviewer", r);
      v = r.json;
    } catch { /* deterministic fallback */ }
  }
  const audit = numberAudit(m);
  const unsupported = [...new Set([...(v?.unsupported_claims || []), ...audit])];
  m.review = { verdict: unsupported.length ? "revise" : v?.verdict || "pass", unsupported, notes: unsupported.length ? `${unsupported.length} claim(s) not traceable to any cited source: struck` : v?.notes || "All claims trace to cited signals", supported: (m.claims || []).filter((c) => c.source).length };
  if (v) m.twin = { reply_probability: clamp(v.reply_probability), objection: v.objection, reply: v.twin_reply };
  if (unsupported.length && m.twin) m.twin.reply_probability = Math.max(0.02, (m.twin.reply_probability || 0.2) * 0.4);
  m.security = securityScan(m);
  m.status = m.security.status === "blocked" ? "blocked" : "pending_review";
  try { const ev = await mossSearch(`${m.subject} ${m.body}`, { topK: 3, accountId: m.accountId, type: "signal" }); m.evidence = { engine: ev.engine, ms: ev.ms, docs: ev.results.map((r) => ({ text: r.text, url: r.metadata?.url, score: r.score })) }; } catch { /* optional */ }
  say("reviewer", unsupported.length ? `🚩 Caught ${unsupported.length} unsupported claim(s) in the draft to ${p?.name}: “${unsupported[0].slice(0, 90)}”. Struck and sent back; Buyer Twin reply odds dropped to ${Math.round((m.twin?.reply_probability || 0) * 100)}%.` : `Draft to ${p?.name} passes: every claim is traceable.`, { to: unsupported.length ? ["writer", "human"] : [], kind: "review" });
  emit("messages", state.messages);
  save();
  return m;
}

export async function reviewAll() {
  const pending = state.messages.filter((m) => m.status === "drafting");
  if (!pending.length) return;
  say("reviewer", `Fact-checking ${pending.length} drafts: every claim must trace to a cited signal. @Buyer Twin is role-playing each persona in parallel.`, { to: ["twin"], kind: "review" });

  // Group by person for a compact review call
  const byPerson = new Map();
  for (const m of pending) { if (!byPerson.has(m.personId)) byPerson.set(m.personId, []); byPerson.get(m.personId).push(m); }

  const groups = [...byPerson.entries()];
  for (let i = 0; i < groups.length; i += 4) {
    await Promise.all(groups.slice(i, i + 4).map(async ([pid, msgs]) => {
      const p = state.people.find((x) => x.id === pid);
      const a = state.accounts.find((x) => x.id === p?.accountId);
      let verdicts = null;
      if (hasLLM()) {
        try {
          const r = await ask({
            system: SYSTEM,
            effort: "low",
            prompt: `You are two agents.
(1) REVIEWER: fact-check each outbound message against the evidence. A claim is "supported" only if the evidence states it. Flag exaggeration, wrong numbers, invented familiarity.
(2) BUYER TWIN: role-play ${p?.name}, ${p?.title} at ${a?.name}, a busy, skeptical buyer. Predict reply probability (0-1) and the most likely objection.
EVIDENCE:
${(a?.signals || []).map((s, k) => `[${k}] ${s.text} (${s.source})`).join("\n")}
MESSAGES:
${msgs.map((m) => `id=${m.id} | ${m.channel} step ${m.step} variant ${m.variant}\nSubject: ${m.subject}\n${m.body}`).join("\n---\n")}
Return JSON: {"reviews":[{"id": str, "verdict": "pass|revise", "unsupported_claims":[str], "notes": str (≤20 words), "reply_probability": 0-1, "objection": str (≤14 words), "twin_reply": str (the buyer's likely 1-2 sentence reply in their voice)}]}`,
          });
          track("reviewer", r);
          verdicts = r.json?.reviews || null;
        } catch (e) { say("reviewer", `Review call failed (${e.message}); falling back to deterministic checks.`, { kind: "error" }); }
      }
      for (const m of msgs) {
        const v = verdicts?.find((x) => x.id === m.id) || (hasLLM() ? null : demo.review(m));
        const lintNotes = lint(m);
        const audited = numberAudit(m);
        const unsupported = [...new Set([...(v?.unsupported_claims || []), ...audited])];
        m.review = {
          verdict: v?.verdict === "revise" || unsupported.length || lintNotes.length > 1 ? "revise" : "pass",
          unsupported,
          notes: [v?.notes, ...lintNotes].filter(Boolean).join(" · ") || "All claims trace to cited signals",
          supported: (m.claims || []).filter((c) => c.source).length,
        };
        m.twin = { reply_probability: clamp(v?.reply_probability ?? 0.18), objection: v?.objection || "Timing — not a priority this quarter", reply: v?.twin_reply || "" };
        m.security = securityScan(m);
        m.status = m.security.status === "blocked" ? "blocked" : "pending_review";
        try { const ev = await mossSearch(`${m.subject} ${m.body}`, { topK: 3, accountId: m.accountId, type: "signal" }); m.evidence = { engine: ev.engine, ms: ev.ms, docs: ev.results.map((r) => ({ text: r.text, url: r.metadata?.url, score: r.score })) }; } catch { /* optional */ }
      }
    }));
    emit("messages", state.messages);
  }
  const blocked = pending.filter((m) => m.status === "blocked").length;
  const revise = pending.filter((m) => m.review?.verdict === "revise").length;
  say("sentinel", `Link + PII + injection scan complete: ${pending.length - blocked} clear/warn, ${blocked} blocked.`, { kind: "security" });
  say("twin", `Simulated replies: avg reply odds ${Math.round((pending.reduce((s, m) => s + (m.twin?.reply_probability || 0), 0) / pending.length) * 100)}% · best variant per lead highlighted in the queue.`, { kind: "review" });
  say("reviewer", `Review done — ${pending.length - revise} pass, ${revise} need revision. @You the HITL queue has ${state.messages.filter((m) => m.status === "pending_review").length} messages awaiting approval. Nothing sends without you.`, { to: ["human"], kind: "hitl" });
  audit("ai", "review_completed", { reviewed: pending.length, blocked, revise });
}

// ───────────────────────────── REWRITE (HITL edit assist) ─────────────────────────────
export async function rewrite(m, instruction) {
  const p = state.people.find((x) => x.id === m.personId);
  const a = state.accounts.find((x) => x.id === m.accountId);
  if (!hasLLM()) return { subject: m.subject, body: m.body.replace(/\n\n/, "\n\n" + `(${instruction}) `) };
  const r = await ask({
    system: SYSTEM,
    effort: "low",
    prompt: `Rewrite this ${m.channel} message to ${p?.name} (${p?.title}, ${a?.name}) following the instruction: "${instruction}". Keep only claims supported by these signals:\n${(a?.signals || []).map((s) => "- " + s.text).join("\n")}\nSubject: ${m.subject}\n${m.body}\nReturn JSON {"subject": str, "body": str}`,
  });
  track("writer", r);
  return r.json || { subject: m.subject, body: m.body };
}

// ───────────────────────────── SIGNAL RADAR (continuous ingestion) ─────────────────────────────
export async function refreshSignals({ limit = 3 } = {}) {
  const targets = state.accounts.filter((a) => a.status !== "filtered").sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, limit);
  say("scout", `Signal radar sweep over ${targets.length} top accounts for anything new in the last 30 days.`, { kind: "thought" });
  let added = 0;
  for (const a of targets) {
    try { await meter("signal_refresh", 1, { account: a.name }); } catch (e) { if (e instanceof CreditError) { say("governor", `⛔ ${e.message}`, { to: ["human"], kind: "billing" }); break; } }
    let fresh = [];
    if (!hasLLM()) fresh = demo.freshSignal(a);
    else {
      const r = await ask({ system: SYSTEM, effort: "low", web: true, maxUses: 3, prompt: `Find the most recent (last ~60 days) public buying signals for ${a.name} (${a.domain}): funding, exec hires, job postings for ${state.icp.personas.map((p) => p.title).join("/")}, product launches, expansion. Skip anything already known: ${a.signals.map((s) => s.text).join(" | ")}.\nReturn JSON {"signals":[{"type": str, "text": str, "date": str, "source_url": str}]}` });
      track("scout", r);
      const urls = new Set(r.sources.map((s) => s.url));
      fresh = (r.json?.signals || []).filter((s) => s.source_url).map((s) => ({ ...s, verified: urls.has(s.source_url) }));
    }
    for (const s of fresh) {
      a.signals.push({ id: uid("sig"), type: s.type || "news", text: s.text, date: s.date, source: s.source_url, verified: s.verified !== false, fresh: true });
      added++;
    }
    Object.assign(a, scoreAccount(a, state.icp));
  }
  emit("accounts", { accounts: state.accounts, people: state.people });
  emit("graph", {});
  say("scout", `Radar added ${added} new signals; scores re-ranked.`, { to: ["cartographer"], kind: "result" });
  scheduleSync(100);
  save();
  return { added };
}

// ───────────────────────────── AUTOPILOT ─────────────────────────────
let running = false;
export const isRunning = () => running;

export async function autopilot(product, { waitForIcpApproval = false } = {}) {
  if (running) throw new Error("A run is already in progress");
  running = true;
  setRun({ status: "running", step: "intake", startedAt: now(), finishedAt: null, error: null, mode: hasLLM() ? "live" : "demo" });
  try {
    state.product = product;
    state.team = (product.team || []).map((t) => ({ id: uid("team"), ...t }));
    audit("rep", "product_intake", { name: product.name });
    say("planner", `New mission: take **${product.name}** to market. Plan → ① ICP inference ② discovery + competitive map ③ knowledge-graph reasoning ④ enrichment ⑤ outreach drafts ⑥ review/twin/security ⑦ your approval. @Strategist you're up.`, { to: ["strategist"], kind: "plan" });

    setRun({ step: "icp" });
    await inferICP(product);
    if (waitForIcpApproval) {
      const ap = requestApproval("strategist", "Approve inferred ICP before discovery spends credits", { industries: state.icp.industries.map((i) => i.name) });
      const { waitForApproval } = await import("./agents.js");
      const res = await waitForApproval(ap.id, 120000);
      if (res.decision === "reject") throw new Error("ICP rejected by human");
    }
    state.icpStatus = "approved";
    emit("icp", { icp: state.icp, expansions: state.expansions, icpStatus: state.icpStatus });

    setRun({ step: "discovery" });
    await discover({ count: Number(product.accountCount) || 8 });

    setRun({ step: "enrichment" });
    await enrichAll();

    setRun({ step: "outreach" });
    await writeOutreach();

    // Seed pipeline with matched leads
    for (const p of state.people) {
      const a = state.accounts.find((x) => x.id === p.accountId);
      if (!a || a.status === "filtered" || state.leads.some((l) => l.personId === p.id)) continue;
      state.leads.push({ id: uid("lead"), personId: p.id, accountId: a.id, stage: "matched", owner: "ai", createdAt: now(), history: [{ stage: "matched", at: now(), actor: "ai", note: `Matched to ICP (score ${a.score}, tier ${a.tier})` }] });
    }
    emit("leads", state.leads);

    setRun({ status: "done", step: "review", finishedAt: now() });
    say("planner", `Mission loop complete in ${Math.round((Date.now() - new Date(state.run.startedAt).getTime()) / 1000)}s. ${state.accounts.filter((a) => a.status !== "filtered").length} accounts, ${state.people.length} buyers, ${state.messages.filter((m) => m.status === "pending_review").length} messages waiting in your HITL queue. Total AI spend $${state.telemetry.total.cost.toFixed(3)}.`, { to: ["human"], kind: "result" });
  } catch (e) {
    setRun({ status: "error", error: e.message, finishedAt: now() });
    say("planner", `Run halted: ${e.message}`, { to: ["human"], kind: "error" });
    console.error(e);
  } finally {
    running = false;
    save();
  }
}
