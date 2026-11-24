// Band (band.ai) integration — Gravity's agent war-room is mirrored into a real Band chat room.
// • Every agent step is posted as a Band event (thought / task / tool_call) — no mention needed.
// • HITL requests are posted as @mention messages to the room's humans.
// • Humans can reply in Band ("approve <id>" / "reject <id>") and Gravity resolves the approval — two-way HITL.
import { state, save } from "./store.js";

const BASE = () => (process.env.BAND_BASE_URL || "https://app.band.ai").replace(/\/$/, "") + "/api/v1";
const KEY = () => process.env.BAND_API_KEY || process.env.BAND_AGENT_KEY;
export const bandEnabled = () => Boolean(KEY());

let chatId = process.env.BAND_CHAT_ID || null;
let me = null;
let humans = [];
let failures = 0;
const queue = [];
let flushing = false;

async function band(method, path, body) {
  const res = await fetch(BASE() + path, {
    method,
    headers: { "X-API-Key": KEY(), "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  if (!res.ok) throw new Error(`Band ${method} ${path} → ${res.status} ${text.slice(0, 160)}`);
  return json?.data ?? json;
}

export async function initBand() {
  const info = (state.integrations.band = { enabled: bandEnabled(), chatId: null, agent: null, posted: 0, failed: 0, lastError: null });
  if (!bandEnabled()) return info;
  try {
    me = await band("GET", "/agent/me");
    info.agent = me?.name || me?.handle || me?.id;
    if (!chatId) {
      const chat = await band("POST", "/agent/chats", { chat: {} });
      chatId = chat?.id;
    }
    info.chatId = chatId;
    try {
      const parts = await band("GET", `/agent/chats/${chatId}/participants`);
      const list = Array.isArray(parts) ? parts : parts?.participants || [];
      humans = list.filter((p) => (p.type || p.participant_type || "").toLowerCase().includes("user") && p.id !== me?.id);
    } catch { /* optional */ }
    pollReplies();
  } catch (e) {
    info.lastError = e.message;
  }
  save();
  return info;
}

async function flush() {
  if (flushing || !chatId) return;
  flushing = true;
  while (queue.length && failures < 8) {
    const job = queue.shift();
    try {
      await job();
      state.integrations.band.posted++;
    } catch (e) {
      failures++;
      state.integrations.band.failed++;
      state.integrations.band.lastError = e.message;
    }
  }
  flushing = false;
}

const KIND_TO_TYPE = { plan: "task", handoff: "task", result: "tool_result", review: "thought", security: "thought", billing: "tool_call", thought: "thought", error: "error", hitl: "task" };

export function mirror(msg, agentMeta) {
  if (!bandEnabled() || !chatId) return;
  const content = `${agentMeta?.emoji || ""} ${agentMeta?.name || msg.agent} · ${agentMeta?.role || ""}\n${msg.text}`;
  if (msg.kind === "hitl" && msg.agent !== "human" && humans.length) {
    queue.push(() => band("POST", `/agent/chats/${chatId}/messages`, {
      message: {
        content: `${humans.map((h) => "@" + (h.handle || h.name)).join(" ")} ${content}\nReply “approve ${msg.data?.approvalId || ""}” or “reject ${msg.data?.approvalId || ""}”.`,
        mentions: humans.map((h) => ({ id: h.id, name: h.name, handle: h.handle })),
      },
    }));
  } else {
    queue.push(() => band("POST", `/agent/chats/${chatId}/events`, { event: { content, message_type: KIND_TO_TYPE[msg.kind] || "thought", metadata: { agent: msg.agent, tokens: msg.tokens, cost_usd: msg.cost } } }));
  }
  flush();
}

let resolver = null;
export function onBandDecision(fn) { resolver = fn; }

async function pollReplies() {
  if (!bandEnabled() || !chatId) return;
  try {
    const msgs = await band("GET", `/agent/chats/${chatId}/messages?status=pending`);
    const list = Array.isArray(msgs) ? msgs : msgs?.messages || [];
    for (const m of list) {
      const text = (m.content || "").toLowerCase();
      const match = text.match(/\b(approve|reject)\b\s*(hitl_[a-z0-9]+)?/);
      if (match && resolver) resolver(match[1], match[2], m.sender_name || m.senderName || "Band user");
      try { await band("POST", `/agent/chats/${chatId}/messages/${m.id}/processed`); } catch { /* */ }
    }
  } catch (e) { state.integrations.band.lastError = e.message; }
  setTimeout(pollReplies, 5000);
}
