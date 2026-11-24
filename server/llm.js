// LLM layer — Claude (Anthropic SDK) with server-side web search for grounded, cited discovery.
// Every call is metered into per-agent telemetry (tokens + $ cost) for the Band war-room.
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.GRAVITY_MODEL || "claude-opus-5-5";
// $ per 1M tokens (Opus 5.5) + $10 / 1k web searches
const PRICE = { in: 4, out: 20, search: 0.01 };

let client = null;
export const hasLLM = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
function getClient() {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 240_000 });
  return client;
}

async function create(params) {
  const c = getClient();
  try {
    // Server-side refusal fallback: if the model declines, the API reroutes inside the same call.
    return await c.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  } catch (e) {
    if (e?.status === 400 && /fallback|beta/i.test(String(e?.message))) return await c.messages.create(params);
    throw e;
  }
}

/**
 * ask(): one grounded reasoning call.
 * Returns { text, json, sources:[{url,title}], usage:{in,out,searches}, cost }
 */
export async function ask({ system, prompt, effort = "low", web = false, maxUses = 6, maxTokens = 16000 }) {
  const messages = [{ role: "user", content: prompt }];
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
    output_config: { effort },
  };
  if (web) params.tools = [{ type: "web_search_20260209", name: "web_search", max_uses: maxUses }];

  let resp;
  try {
    resp = await create(params);
  } catch (e) {
    // Web search not enabled for this org / tool rejected → degrade to model knowledge (flagged unverified upstream)
    if (web && e?.status === 400 && /web_search|tool|server_tool/i.test(String(e?.message))) {
      delete params.tools;
      resp = await create(params);
      resp._noWeb = true;
    } else throw e;
  }
  let guard = 0;
  const all = [resp];
  while (resp.stop_reason === "pause_turn" && guard++ < 4) {
    messages.push({ role: "assistant", content: resp.content });
    resp = await create({ ...params, messages });
    all.push(resp);
  }
  if (resp.stop_reason === "refusal") throw new Error("Model declined this request");

  const sources = new Map();
  let text = "";
  let usage = { in: 0, out: 0, searches: 0 };
  for (const r of all) {
    usage.in += r.usage?.input_tokens || 0;
    usage.out += r.usage?.output_tokens || 0;
    usage.searches += r.usage?.server_tool_use?.web_search_requests || 0;
    for (const b of r.content || []) {
      if (b.type === "text") {
        text += b.text;
        for (const c of b.citations || []) if (c.url) sources.set(c.url, { url: c.url, title: c.title || c.url });
      } else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const s of b.content) if (s.url) sources.set(s.url, { url: s.url, title: s.title || s.url, page_age: s.page_age });
      }
    }
  }
  const cost = (usage.in * PRICE.in + usage.out * PRICE.out) / 1e6 + usage.searches * PRICE.search;
  return { text, json: extractJSON(text), sources: [...sources.values()], usage, cost, noWeb: Boolean(all[0]?._noWeb) };
}

export function extractJSON(text) {
  if (!text) return null;
  const fence = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const candidates = [...fence.reverse()];
  const first = text.indexOf("{"), last = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));
  const fa = text.indexOf("["), la = text.lastIndexOf("]");
  if (fa !== -1 && la > fa) candidates.push(text.slice(fa, la + 1));
  for (const c of candidates) {
    try { return JSON.parse(c); } catch { /* try next */ }
    try { return JSON.parse(c.replace(/,\s*([}\]])/g, "$1")); } catch { /* next */ }
  }
  return null;
}

export const priceTable = PRICE;
