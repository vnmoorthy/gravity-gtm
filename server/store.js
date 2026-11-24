// In-process state store + realtime event bus (SSE). Snapshots to disk so restarts keep the workspace.
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";

const DATA_DIR = process.env.DATA_DIR || path.resolve("data");
const FILE = path.join(DATA_DIR, "state.json");

export const bus = new EventEmitter();
bus.setMaxListeners(200);

let seq = 1;
export const uid = (p = "id") => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const now = () => new Date().toISOString();

export function freshState() {
  return {
    version: 1,
    product: null,
    icp: null,
    icpStatus: "none", // none | inferred | approved
    expansions: [],
    accounts: [],
    people: [],
    team: [],
    competitors: [],
    messages: [],
    leads: [],
    audit: [],
    agentLog: [],
    approvals: [], // HITL decisions requested by agents
    telemetry: { byAgent: {}, total: { in: 0, out: 0, searches: 0, cost: 0, calls: 0 } },
    billing: null,
    run: { status: "idle", step: null, startedAt: null, finishedAt: null, error: null, mode: null },
    graphQueries: [],
    integrations: {},
  };
}

export let state = freshState();

export function load() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
      state = { ...freshState(), ...raw };
      if (state.run?.status === "running") state.run.status = "interrupted";
    }
  } catch (e) {
    console.warn("state load failed", e.message);
  }
  return state;
}

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(state));
    } catch (e) {
      console.warn("save failed", e.message);
    }
  }, 300);
}

export function reset(keepBilling = true) {
  const billing = state.billing;
  state = freshState();
  if (keepBilling) state.billing = billing;
  save();
  emit("reset", {});
}

export function emit(type, payload) {
  bus.emit("event", { type, payload, at: now() });
}

export function audit(actor, action, detail = {}) {
  const entry = { id: uid("aud"), at: now(), actor, action, detail };
  state.audit.unshift(entry);
  if (state.audit.length > 2000) state.audit.length = 2000;
  emit("audit", entry);
  save();
  return entry;
}
