// Spend Governor — Flexprice usage-based metering + credit-gated execution.
// Every billable action is (1) checked against the credit wallet, (2) debited locally, (3) streamed to Flexprice as a usage event.
import { state, save, emit, uid, now, audit } from "./store.js";

export const METERS = {
  icp_inference: { credits: 3, label: "ICP inference", unit: "run" },
  account_discovered: { credits: 2, label: "Accounts discovered", unit: "account" },
  lead_enriched: { credits: 5, label: "Leads enriched", unit: "lead" },
  outreach_generated: { credits: 1, label: "Outreach drafted", unit: "message" },
  outreach_sent: { credits: 2, label: "Outreach sent", unit: "message" },
  graph_query: { credits: 1, label: "Graph queries evaluated", unit: "query" },
  signal_refresh: { credits: 2, label: "Signal refresh", unit: "account" },
  semantic_query: { credits: 0.5, label: "Moss semantic queries", unit: "query" },
};

const FP_BASE = () => (process.env.FLEXPRICE_BASE_URL || "https://us.api.flexprice.io/v1").replace(/\/$/, "");
export const flexpriceEnabled = () => Boolean(process.env.FLEXPRICE_API_KEY);
const CUSTOMER_EXTERNAL_ID = () => process.env.FLEXPRICE_CUSTOMER_ID || "gravity-demo-workspace";

async function fp(method, path, body) {
  const res = await fetch(FP_BASE() + path, {
    method,
    headers: { "x-api-key": process.env.FLEXPRICE_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error(`Flexprice ${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
  return json;
}

export function ensureBilling() {
  if (!state.billing) {
    state.billing = {
      customer: CUSTOMER_EXTERNAL_ID(),
      plan: "Growth (usage-based)",
      balance: Number(process.env.STARTING_CREDITS || 400),
      granted: Number(process.env.STARTING_CREDITS || 400),
      usage: Object.fromEntries(Object.keys(METERS).map((k) => [k, 0])),
      events: [],
      blocked: 0,
      flexprice: { enabled: flexpriceEnabled(), synced: 0, failed: 0, lastError: null, customerId: null, walletId: null },
      creditPriceUsd: 0.1,
    };
  }
  state.billing.flexprice.enabled = flexpriceEnabled();
  return state.billing;
}

export async function initFlexprice() {
  const b = ensureBilling();
  if (!flexpriceEnabled()) return b;
  try {
    // find or create customer (external_id = this workspace)
    let cust = null;
    try { cust = await fp("POST", "/customers", { external_id: b.customer, name: "Gravity Demo Workspace", email: process.env.FLEXPRICE_CUSTOMER_EMAIL || undefined }); } catch (e) {
      try { const list = await fp("GET", `/customers?external_id=${encodeURIComponent(b.customer)}`); cust = (list?.items || list || [])[0]; } catch { /* */ }
    }
    b.flexprice.customerId = cust?.id || null;
    try {
      const wallets = await fp("GET", `/customers/wallets?id=${b.flexprice.customerId}&include_real_time_balance=true`);
      let w = Array.isArray(wallets) ? wallets[0] : wallets?.items?.[0];
      if (!w?.id && b.flexprice.customerId) w = await fp("POST", "/wallets", { currency: "USD", customer_id: b.flexprice.customerId, conversion_rate: "1", initial_credits_to_load: String(b.balance) });
      if (w?.id) { b.flexprice.walletId = w.id; b.flexprice.walletBalance = w.real_time_credit_balance ?? w.credit_balance ?? w.balance ?? null; }
    } catch (e) { b.flexprice.lastError = e.message; }
    b.flexprice.lastError = null;
  } catch (e) {
    b.flexprice.lastError = e.message;
  }
  save();
  return b;
}

/** Throws a 402-style error if the wallet can't cover the action. */
export function canAfford(meter, qty = 1) {
  const b = ensureBilling();
  const cost = (METERS[meter]?.credits || 0) * qty;
  return b.balance >= cost;
}

export class CreditError extends Error {
  constructor(meter, need, have) {
    super(`Credit limit reached: ${METERS[meter]?.label || meter} needs ${need} credits, wallet has ${have}`);
    this.code = 402;
    this.meter = meter;
  }
}

export async function meter(meterName, qty = 1, properties = {}, { gate = true } = {}) {
  const b = ensureBilling();
  const m = METERS[meterName];
  if (!m) return;
  const cost = m.credits * qty;
  if (gate && b.balance < cost) {
    b.blocked += 1;
    emit("billing", b);
    audit("governor", "credit_gate_blocked", { meter: meterName, need: cost, have: b.balance });
    throw new CreditError(meterName, cost, b.balance);
  }
  b.balance = Math.round((b.balance - cost) * 100) / 100;
  b.usage[meterName] = (b.usage[meterName] || 0) + qty;
  const ev = { id: uid("evt"), event_name: meterName, qty, credits: cost, properties, at: now(), synced: flexpriceEnabled() ? "pending" : "local" };
  b.events.unshift(ev);
  if (b.events.length > 500) b.events.length = 500;
  emit("billing", b);
  save();
  if (flexpriceEnabled()) {
    fp("POST", "/events", {
      event_name: meterName,
      external_customer_id: b.customer,
      event_id: ev.id,
      timestamp: ev.at,
      source: "gravity-gtm",
      properties: { quantity: qty, credits: cost, ...Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, String(v)])) },
    })
      .then(() => { ev.synced = "flexprice"; b.flexprice.synced += 1; emit("billing", b); })
      .catch((e) => { ev.synced = "failed"; b.flexprice.failed += 1; b.flexprice.lastError = e.message; emit("billing", b); });
  }
  return ev;
}

export async function topUp(credits = 200) {
  const b = ensureBilling();
  b.balance += credits;
  b.granted += credits;
  audit("rep", "wallet_top_up", { credits });
  if (flexpriceEnabled() && b.flexprice.walletId) {
    try {
      await fp("POST", `/wallets/${b.flexprice.walletId}/top-up`, { credits_to_add: String(credits), transaction_reason: "PURCHASED_CREDIT_DIRECT", idempotency_key: uid("topup") });
    } catch (e) { b.flexprice.lastError = e.message; }
  }
  emit("billing", b);
  save();
  return b;
}

export function setBalance(credits) {
  const b = ensureBilling();
  b.balance = credits;
  emit("billing", b);
  save();
  return b;
}
