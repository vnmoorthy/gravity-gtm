// Gravity MCP server (Streamable HTTP, JSON responses). Lets Teamily.ai agents, which support MCP connectors, and any
// other MCP client (Claude, RocketRide MCP) search the workspace, read the pipeline and act on HITL approvals from chat.
import { state, audit } from "./store.js";

const TOOLS = [
  { name: "search_workspace", description: "Semantic search (Moss) across Gravity accounts, buyers, signals and competitors.", inputSchema: { type: "object", properties: { query: { type: "string" }, type: { type: "string", enum: ["account", "person", "signal", "competitor"] } }, required: ["query"] } },
  { name: "get_pipeline", description: "Pipeline summary: leads per stage with AI vs rep ownership and top accounts.", inputSchema: { type: "object", properties: {} } },
  { name: "list_pending_approvals", description: "Outreach messages waiting for human approval, with reviewer verdict and reply odds.", inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
  { name: "approve_message", description: "Approve and send one outreach message (human-in-the-loop action from chat).", inputSchema: { type: "object", properties: { id: { type: "string" }, note: { type: "string" } }, required: ["id"] } },
  { name: "run_signal_radar", description: "Ask the Scout agent to sweep top accounts for fresh buying signals.", inputSchema: { type: "object", properties: {} } },
  { name: "warehouse_query", description: "Run a read-only SQL query on the Gravity warehouse (HotData). Tables: accounts, people, leads, messages, usage_events.", inputSchema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] } },
];

export function mountMcp(app, deps) {
  const stats = (state.integrations.mcp ||= { calls: 0, clients: [] });
  const auth = (req) => !process.env.GRAVITY_MCP_TOKEN || req.headers.authorization === `Bearer ${process.env.GRAVITY_MCP_TOKEN}`;
  const text = (obj) => ({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] });

  async function callTool(name, args = {}) {
    switch (name) {
      case "search_workspace": return text(await deps.search(args.query, { topK: 8, type: args.type }));
      case "get_pipeline": {
        const by = {};
        for (const l of state.leads) by[l.stage] = (by[l.stage] || 0) + 1;
        const top = state.accounts.filter((a) => a.status !== "filtered").sort((a, b) => b.score - a.score).slice(0, 5).map((a) => `${a.name} (${a.tier}, ${a.score})`);
        return text({ product: state.product?.name, stages: by, ai_actions: state.leads.flatMap((l) => l.history).filter((h) => h.actor === "ai").length, rep_actions: state.leads.flatMap((l) => l.history).filter((h) => h.actor === "rep").length, top_accounts: top });
      }
      case "list_pending_approvals": return text(state.messages.filter((m) => m.status === "pending_review").slice(0, args.limit || 10).map((m) => ({ id: m.id, to: state.people.find((p) => p.id === m.personId)?.name, account: state.accounts.find((a) => a.id === m.accountId)?.name, channel: m.channel, variant: m.variant, subject: m.subject, verdict: m.review?.verdict, reply_odds: m.twin?.reply_probability })));
      case "approve_message": { const m = await deps.approve(args.id, args.note ? `via MCP: ${args.note}` : "via MCP (Teamily)"); return text({ id: m.id, status: m.status, delivery: m.delivery }); }
      case "run_signal_radar": deps.radar().catch(() => {}); return text("Scout started the signal radar sweep.");
      case "warehouse_query": return text(await deps.sql(args.sql));
      default: throw Object.assign(new Error(`Unknown tool ${name}`), { code: -32601 });
    }
  }

  app.post("/mcp", async (req, res) => {
    if (!auth(req)) return res.status(401).json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } });
    const handle = async (msg) => {
      const { id, method, params } = msg || {};
      try {
        if (method === "initialize") {
          const c = params?.clientInfo?.name || "client";
          if (!stats.clients.includes(c)) stats.clients.push(c);
          return { jsonrpc: "2.0", id, result: { protocolVersion: params?.protocolVersion || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "gravity-gtm", version: "1.0.0" }, instructions: "Gravity GTM engine: search accounts, read the pipeline, and approve outreach (human-in-the-loop)." } };
        }
        if (method?.startsWith("notifications/")) return null;
        if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
        if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
        if (method === "tools/call") {
          stats.calls++;
          audit("mcp", "tool_call", { tool: params?.name });
          return { jsonrpc: "2.0", id, result: await callTool(params?.name, params?.arguments) };
        }
        return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
      } catch (e) {
        return { jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: e.message }] } };
      }
    };
    const body = req.body;
    if (Array.isArray(body)) { const out = (await Promise.all(body.map(handle))).filter(Boolean); return out.length ? res.json(out) : res.status(202).end(); }
    const out = await handle(body);
    return out ? res.json(out) : res.status(202).end();
  });
  app.get("/mcp", (req, res) => res.status(405).set("Allow", "POST").json({ error: "Use POST (Streamable HTTP, JSON responses)" }));
  return TOOLS;
}
export const MCP_TOOLS = TOOLS;
