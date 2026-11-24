// HotData (hotdata.dev): Gravity's agent data warehouse. Leads, accounts, outreach, pipeline transitions and usage
// events are synced into HotData tables, and the Data Warehouse SQL console + agents run SQL through POST /v1/query.
// Fallback: an in-process SQL engine (alasql) over the same tables, so the console works without keys.
import alasql from "alasql";
import { state, save, emit } from "./store.js";

const BASE = () => (process.env.HOTDATA_BASE_URL || "https://api.hotdata.dev").replace(/\/$/, "");
export const hotdataEnabled = () => Boolean(process.env.HOTDATA_API_KEY && process.env.HOTDATA_WORKSPACE_ID);
let dbId = process.env.HOTDATA_DATABASE_ID || null;
const st = { enabled: false, databaseId: null, synced: 0, lastSync: null, lastError: null, remoteQueries: 0, localQueries: 0 };

async function hd(method, path, body, extra = {}) {
  const headers = { Authorization: `Bearer ${process.env.HOTDATA_API_KEY}`, "X-Workspace-Id": process.env.HOTDATA_WORKSPACE_ID, ...extra };
  let payload = body;
  if (body && typeof body === "object" && !(body instanceof Uint8Array)) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(BASE() + path, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  if (!res.ok) throw new Error(`HotData ${method} ${path} → ${res.status} ${text.slice(0, 160)}`);
  return json ?? text;
}

/** Current workspace as warehouse tables. */
export function tables() {
  const acc = (id) => state.accounts.find((a) => a.id === id) || {};
  return {
    accounts: state.accounts.map((a) => ({ id: a.id, name: a.name, domain: a.domain, industry: a.industry, hq: a.hq, headcount: Number(a.headcount) || 0, fit: a.fit_score || 0, intent: a.intent_score || 0, score: a.score || 0, tier: a.tier || "", status: a.status, signals: (a.signals || []).length, citation_status: a.citation_status || "" })),
    people: state.people.map((p) => ({ id: p.id, name: p.name, title: p.title, account: acc(p.accountId).name, email_status: p.email_status, email_confidence: p.email_confidence || 0, linkedin_status: p.linkedin_status || "" })),
    leads: state.leads.map((l) => ({ id: l.id, person: state.people.find((p) => p.id === l.personId)?.name, account: acc(l.accountId).name, industry: acc(l.accountId).industry, tier: acc(l.accountId).tier, stage: l.stage, owner: l.owner, transitions: l.history.length, replied: l.history.some((h) => ["replied", "meeting", "closed"].includes(h.stage)) ? 1 : 0, meeting: l.history.some((h) => ["meeting", "closed"].includes(h.stage)) ? 1 : 0 })),
    messages: state.messages.map((m) => ({ id: m.id, account: acc(m.accountId).name, channel: m.channel, step: m.step, variant: m.variant, angle: m.angle, status: m.status, verdict: m.review?.verdict || "", reply_probability: m.twin?.reply_probability || 0, security: m.security?.status || "" })),
    usage_events: (state.billing?.events || []).map((e) => ({ id: e.id, event_name: e.event_name, qty: e.qty, credits: e.credits, at: e.at, synced: e.synced })),
  };
}

function localQuery(sql) {
  const t = tables();
  const db = new alasql.Database();
  for (const [name, rows] of Object.entries(t)) {
    db.exec(`CREATE TABLE ${name}`);
    db.tables[name].data = rows;
  }
  st.localQueries++;
  return db.exec(sql);
}

function toCSV(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export async function syncWarehouse() {
  st.enabled = hotdataEnabled();
  if (!st.enabled) { st.lastSync = new Date().toISOString(); emit("hotdata", st); return status(); }
  try {
    if (!dbId) {
      const db = await hd("POST", "/v1/databases", { name: "gravity_gtm" });
      dbId = db?.id || db?.database_id || db?.data?.id || null;
    }
    st.databaseId = dbId;
    let n = 0;
    for (const [name, rows] of Object.entries(tables())) {
      if (!rows.length) continue;
      const up = await hd("POST", "/v1/uploads", new TextEncoder().encode(toCSV(rows)), { "Content-Type": "text/csv" });
      const uploadId = up?.id || up?.upload_id || up?.data?.id;
      if (uploadId) {
        try { await hd("POST", `/v1/uploads/${uploadId}/finalize`, {}); } catch { /* some deployments auto-finalize */ }
        await hd("POST", `/v1/databases/${dbId}/schemas/public/tables/${name}/loads`, { upload_id: uploadId, mode: "replace", format: "csv" });
        n++;
      }
    }
    st.synced = n; st.lastSync = new Date().toISOString(); st.lastError = null;
  } catch (e) { st.lastError = e.message; }
  state.integrations.hotdata = status();
  emit("hotdata", st);
  save();
  return status();
}

let timer = null;
export function scheduleWarehouseSync(ms = 3000) { clearTimeout(timer); timer = setTimeout(() => syncWarehouse().catch(() => {}), ms); }

export function status() { return { ...st, enabled: hotdataEnabled(), engine: hotdataEnabled() && !st.lastError ? "hotdata" : "local" }; }

/** Run SQL: HotData when configured (falls back to the local engine on error). Read-only guard. */
export async function query(sql) {
  const clean = String(sql || "").trim().replace(/;+\s*$/, "");
  if (!/^(select|with)\b/i.test(clean)) throw new Error("Read-only console: only SELECT / WITH queries are allowed");
  const t0 = performance.now();
  if (hotdataEnabled() && dbId && !st.lastError) {
    try {
      const r = await hd("POST", "/v1/query", { sql: clean }, { "X-Database-Id": dbId });
      st.remoteQueries++;
      const rows = r?.rows || r?.data || r?.results || [];
      const columns = r?.columns?.map((c) => c.name || c) || (rows[0] && !Array.isArray(rows[0]) ? Object.keys(rows[0]) : []);
      const objRows = Array.isArray(rows[0]) ? rows.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]]))) : rows;
      return { engine: "hotdata", ms: Math.round(performance.now() - t0), columns, rows: objRows };
    } catch (e) { st.lastError = e.message; }
  }
  const rows = localQuery(clean);
  return { engine: "local", ms: Math.round((performance.now() - t0) * 10) / 10, columns: rows[0] ? Object.keys(rows[0]) : [], rows };
}

export const PRESETS = [
  { name: "Conversion by tier", sql: "SELECT tier, COUNT(*) AS leads, SUM(replied) AS replied, SUM(meeting) AS meetings, ROUND(100.0 * SUM(replied) / COUNT(*), 1) AS reply_rate_pct FROM leads GROUP BY tier ORDER BY tier" },
  { name: "A/B variant performance", sql: "SELECT variant, angle, COUNT(*) AS drafted, SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent, ROUND(AVG(reply_probability) * 100, 1) AS twin_predicted_pct FROM messages WHERE step = 1 GROUP BY variant, angle" },
  { name: "Top accounts by intent", sql: "SELECT name, industry, tier, score, intent, signals FROM accounts WHERE status <> 'filtered' ORDER BY intent DESC LIMIT 10" },
  { name: "Spend by meter", sql: "SELECT event_name, COUNT(*) AS events, SUM(credits) AS credits FROM usage_events GROUP BY event_name ORDER BY credits DESC" },
  { name: "AI vs rep ownership", sql: "SELECT owner, stage, COUNT(*) AS leads FROM leads GROUP BY owner, stage ORDER BY owner, stage" },
  { name: "Deliverability", sql: "SELECT email_status, COUNT(*) AS buyers, ROUND(AVG(email_confidence), 2) AS avg_confidence FROM people GROUP BY email_status" },
];
