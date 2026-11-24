import { useEffect, useState } from "react";
import { Database, Play, Workflow, Plug, Copy, RefreshCw, CheckCircle2 } from "lucide-react";
import { api } from "../api";
import { Card, Button, Badge, SectionTitle, useAction, useToast, cx } from "../ui";

export default function Data({ state }) {
  const [busy, run] = useAction();
  const toast = useToast();
  const [presets, setPresets] = useState([]);
  const [sql, setSql] = useState("");
  const [res, setRes] = useState(null);
  const integ = state.integrations || {};
  const hd = integ.hotdata || {}, rr = integ.rocketride || {}, mcp = integ.mcp || {};
  const mcpUrl = `${location.origin}/mcp`;

  useEffect(() => { api("/api/warehouse/presets").then((p) => { setPresets(p); if (p[0]) setSql(p[0].sql); }); }, []);
  const exec = (q = sql) => run("sql", async () => setRes(await api("/api/warehouse/query", { body: { sql: q } })));
  const copy = (t) => { navigator.clipboard?.writeText(t); toast("Copied"); };
  const mcpConfig = JSON.stringify({ mcpServers: { gravity: { type: "http", url: mcpUrl } } }, null, 2);

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-8">
      <SectionTitle eyebrow="Core sponsors · HotData · RocketRide · Teamily.ai" title="Data & Connectors">
        Every lead, message, pipeline transition and usage event lands in the HotData warehouse. Raw signals flow through a RocketRide pipeline before scoring. Gravity's MCP server lets Teamily agents work your pipeline from group chat.
      </SectionTitle>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-5">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 font-medium"><Database className="size-4 text-[#2f5bea]" />HotData warehouse</div><Badge color={hd.engine === "hotdata" ? "emerald" : "zinc"}>{hd.engine === "hotdata" ? "live" : "local engine"}</Badge></div>
          <div className="text-xs text-zinc-500 mt-2 space-y-1 font-mono">
            <div>tables: accounts · people · leads · messages · usage_events</div>
            <div>database: {hd.databaseId || "—"} · synced tables: {hd.synced || 0}</div>
            <div>queries: {hd.remoteQueries || 0} remote · {hd.localQueries || 0} local</div>
            {hd.lastError && <div className="text-rose-300 whitespace-normal">{hd.lastError}</div>}
            {!hd.enabled && <div className="whitespace-normal">Set HOTDATA_API_KEY + HOTDATA_WORKSPACE_ID to sync to hotdata.dev</div>}
          </div>
          <Button size="sm" className="mt-3" icon={RefreshCw} loading={busy === "sync"} onClick={() => run("sync", () => api("/api/warehouse/sync", { body: {} }), "Warehouse synced")}>Sync now</Button>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 font-medium"><Workflow className="size-4 text-[#2f5bea]" />RocketRide pipeline</div><Badge color={rr.engine === "rocketride" ? "emerald" : "zinc"}>{rr.engine === "rocketride" ? "live" : "local runtime"}</Badge></div>
          <div className="text-xs text-zinc-500 mt-2 space-y-1 font-mono">
            <div>pipeline: pipelines/{rr.pipeline || "gravity-signals.pipe"}</div>
            <div>webhook → prompt → llm → response</div>
            <div>accounts processed: {rr.processed || 0} ({rr.remote || 0} RocketRide · {rr.local || 0} local)</div>
            <div>last run: {rr.lastRunMs ?? "—"} ms</div>
            {rr.lastError && <div className="text-rose-300 whitespace-normal">{rr.lastError}</div>}
            {!rr.enabled && <div className="whitespace-normal">Set ROCKETRIDE_APIKEY (+ ROCKETRIDE_URI) to run on RocketRide</div>}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 font-medium"><Plug className="size-4 text-[#2f5bea]" />Teamily.ai · MCP connector</div><Badge color="emerald">serving</Badge></div>
          <div className="text-xs text-zinc-500 mt-2">Add Gravity as an MCP connector in Teamily so your AI teammates can search accounts, read the pipeline and approve outreach from group chat.</div>
          <div className="mt-2 flex items-center gap-2"><code className="text-[11px] font-mono bg-white/[0.05] border border-white/10 rounded px-2 py-1 truncate flex-1">{mcpUrl}</code><Button size="sm" icon={Copy} onClick={() => copy(mcpUrl)} /></div>
          <div className="flex flex-wrap gap-1 mt-2">{(mcp.tools || []).map((t) => <Badge key={t}>{t}</Badge>)}</div>
          <div className="text-[11px] text-zinc-500 mt-2">{mcp.calls || 0} tool calls{mcp.clients?.length ? ` · clients: ${mcp.clients.join(", ")}` : ""}</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium flex items-center gap-2"><Database className="size-4 text-zinc-400" />Warehouse SQL console <span className="text-xs text-zinc-500 font-normal">read-only · runs on {hd.engine === "hotdata" ? "HotData (POST /v1/query)" : "local engine (HotData fallback)"}</span></div>
          <Button variant="primary" icon={Play} loading={busy === "sql"} onClick={() => exec()}>Run query</Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">{presets.map((p) => <Button key={p.name} size="sm" onClick={() => { setSql(p.sql); exec(p.sql); }}>{p.name}</Button>)}</div>
        <textarea className="input font-mono !text-[12.5px] min-h-[90px]" value={sql} onChange={(e) => setSql(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") exec(); }} />
        {res && (
          <div className="mt-4">
            <div className="text-[11px] text-zinc-500 mb-2 flex items-center gap-2"><CheckCircle2 className="size-3.5 text-emerald-400" />{res.rows.length} rows · {res.ms} ms · engine: <span className={cx(res.engine === "hotdata" && "text-[#2f5bea] font-medium")}>{res.engine === "hotdata" ? "HotData" : "local"}</span></div>
            <div className="overflow-x-auto border border-white/10 rounded-lg max-h-[360px]">
              <table className="tbl w-full"><thead><tr>{res.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>{res.rows.map((r, i) => <tr key={i}>{res.columns.map((c) => <td key={c} className="font-mono text-xs">{String(r[c] ?? "")}</td>)}</tr>)}</tbody></table>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5 mt-4">
        <div className="font-medium mb-2">Connect from Teamily, Claude or any MCP client</div>
        <pre className="text-[11.5px] font-mono bg-white/[0.04] border border-white/10 rounded-lg p-3 overflow-x-auto">{mcpConfig}</pre>
        <div className="text-xs text-zinc-500 mt-2">Optional auth: set GRAVITY_MCP_TOKEN and send <code>Authorization: Bearer &lt;token&gt;</code>. Every MCP approval is written to the audit log as a human decision.</div>
      </Card>
    </div>
  );
}
