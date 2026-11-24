import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ForceGraph3D from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import * as THREE from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Network, Route, Briefcase, Swords, Play, X, Database, Code2 } from "lucide-react";
import { api } from "../api";
import { Button, Badge, cx, useAction, Empty } from "../ui";

const COLORS = { Product: "#f59e0b", Company: "#8b5cf6", Person: "#22d3ee", Competitor: "#f43f5e", Signal: "#a3e635" };
const QUERIES = [
  { name: "warm_paths", label: "Warm intro paths", icon: Route },
  { name: "hiring_cycles", label: "Job reqs → evaluation", icon: Briefcase },
  { name: "displacement", label: "Competitor displacement", icon: Swords },
];

export default function Graph({ state, graphVersion, go }) {
  const fg = useRef();
  const wrap = useRef();
  const [data, setData] = useState({ nodes: [], links: [] });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hidden, setHidden] = useState({});
  const [sel, setSel] = useState(null);
  const [result, setResult] = useState(null);
  const [hl, setHl] = useState({ nodes: new Set(), links: new Set() });
  const [busy, run] = useAction();

  useEffect(() => {
    api("/api/graph").then((g) => {
      setData((prev) => {
        // keep positions of existing nodes so the graph "grows" instead of re-exploding
        const old = new Map(prev.nodes.map((n) => [n.id, n]));
        return { nodes: g.nodes.map((n) => (old.has(n.id) ? Object.assign(old.get(n.id), n) : n)), links: g.links };
      });
    });
  }, [graphVersion]);

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const bloomed = useRef(false);
  const fitted = useRef(false);
  useEffect(() => {
    const f = fg.current;
    if (!f) return;
    if (!bloomed.current && f.postProcessingComposer) {
      try { f.postProcessingComposer().addPass(new UnrealBloomPass(new THREE.Vector2(size.w, size.h), 1.15, 0.6, 0.08)); bloomed.current = true; } catch { /* bloom optional */ }
    }
    f.d3Force("charge")?.strength(-90);
    f.d3Force("link")?.distance((l) => (l.type === "has_signal" ? 18 : l.type === "works_at" ? 26 : 48));
  }, [data.nodes.length]);

  const view = useMemo(() => {
    const nodes = data.nodes.filter((n) => !hidden[n.label]);
    const ids = new Set(nodes.map((n) => n.id));
    const links = data.links.filter((l) => ids.has(l.source?.id ?? l.source) && ids.has(l.target?.id ?? l.target));
    return { nodes, links };
  }, [data, hidden]);

  const nodeObj = useCallback((n) => {
    const group = new THREE.Group();
    const c = n.team ? "#fde68a" : COLORS[n.label] || "#999";
    const r = Math.cbrt(n.val || 4) * 2.6;
    const lit = hl.nodes.size === 0 || hl.nodes.has(n.id);
    const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: lit ? 0.95 : 0.12 });
    group.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 20), mat));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 1.9, 16, 16), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: lit ? 0.12 : 0.02, depthWrite: false }));
    group.add(halo);
    if (n.label !== "Signal" && (lit || n.label === "Product")) {
      const t = new SpriteText(n.name?.length > 26 ? n.name.slice(0, 25) + "…" : n.name || "");
      t.color = lit ? "#e5e7eb" : "#52525b";
      t.textHeight = n.label === "Product" ? 6 : n.account ? 3.4 : 2.6;
      t.fontFace = "Inter";
      t.position.y = r + 4;
      group.add(t);
    }
    return group;
  }, [hl]);

  const linkKey = (l) => `${l.source?.id ?? l.source}->${l.target?.id ?? l.target}`;

  const runQuery = (name) => run(name, async () => {
    const r = await api("/api/graph/query", { body: { name } });
    setResult(r);
    setHl({ nodes: new Set(), links: new Set() });
    return r;
  });

  const highlight = (row) => {
    let nodes = new Set(), links = new Set();
    if (row.path) {
      nodes = new Set(row.path);
      for (let i = 0; i < row.path.length - 1; i++) { links.add(`${row.path[i]}->${row.path[i + 1]}`); links.add(`${row.path[i + 1]}->${row.path[i]}`); }
      if (row.accountId) { nodes.add(row.accountId); links.add(`${row.personId}->${row.accountId}`); }
    } else if (row.accountId) {
      nodes.add(row.accountId);
      if (row.competitorId) { nodes.add(row.competitorId); links.add(`${row.accountId}->${row.competitorId}`); }
      for (const l of data.links) { const s = l.source?.id ?? l.source, t = l.target?.id ?? l.target; if (s === row.accountId && l.type === "has_signal") { nodes.add(t); links.add(`${s}->${t}`); } }
    }
    setHl({ nodes, links });
    const focus = data.nodes.find((n) => n.id === (row.accountId || row.personId));
    if (focus && fg.current && focus.x !== undefined) {
      const d = 140, ratio = 1 + d / Math.hypot(focus.x, focus.y, focus.z || 1);
      fg.current.cameraPosition({ x: focus.x * ratio, y: focus.y * ratio, z: focus.z * ratio }, focus, 1400);
    }
  };

  if (!data.nodes.length) return <Empty icon={Network} title="The graph is empty" action={<Button variant="primary" onClick={() => go("mission")}>Launch a mission</Button>}>Run a mission and watch the knowledge graph assemble itself node by node as agents discover companies, people, competitors and signals.</Empty>;

  const counts = data.nodes.reduce((m, n) => ((m[n.label] = (m[n.label] || 0) + 1), m), {});

  return (
    <div className="relative h-full" ref={wrap}>
      <ForceGraph3D
        ref={fg}
        width={size.w}
        height={size.h}
        graphData={view}
        backgroundColor="#07070c"
        nodeThreeObject={nodeObj}
        nodeLabel={(n) => `<div style="font:12px Inter;padding:4px 6px"><b>${n.label}</b> · ${n.name}${n.title ? "<br/>" + n.title : ""}${n.score ? "<br/>score " + n.score + " · tier " + n.tier : ""}</div>`}
        linkColor={(l) => (hl.links.size ? (hl.links.has(linkKey(l)) ? "#fbbf24" : "rgba(255,255,255,0.04)") : l.type === "competes_with" ? "rgba(244,63,94,.45)" : l.type === "uses" ? "rgba(244,63,94,.9)" : l.type === "previously_employed_at" || l.type === "studied_at" ? "rgba(253,230,138,.5)" : "rgba(167,139,250,.28)")}
        linkWidth={(l) => (hl.links.has(linkKey(l)) ? 2.2 : l.type === "uses" ? 1.2 : 0.4)}
        linkDirectionalParticles={(l) => (hl.links.has(linkKey(l)) ? 4 : l.type === "matched_to" ? 1 : 0)}
        linkDirectionalParticleWidth={1.8}
        linkDirectionalParticleColor={() => "#fde68a"}
        onNodeClick={(n) => setSel(n)}
        enableNodeDrag={false}
        cooldownTicks={120}
        onEngineStop={() => { if (!hl.nodes.size && !fitted.current) { fg.current?.zoomToFit(900, 60); fitted.current = true; } }}
        warmupTicks={20}
      />

      <div className="absolute top-4 left-4 flex flex-col gap-2 w-56">
        <div className="glass rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5"><Database className="size-3.5" />{state.integrations.neo4j ? "Neo4j (synced)" : "Native graph engine"}</div>
          {Object.entries(COLORS).map(([k, c]) => (
            <button key={k} onClick={() => setHidden({ ...hidden, [k]: !hidden[k] })} className={cx("w-full flex items-center justify-between text-xs py-1", hidden[k] && "opacity-35")}>
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 10px ${c}` }} />{k}</span>
              <span className="tabular-nums text-zinc-500">{counts[k] || 0}</span>
            </button>
          ))}
          <div className="text-[10px] text-zinc-500 mt-2 pt-2 border-t border-white/5">{data.links.length} edges · works_at, competes_with, matched_to, contacted_via, replied_to, previously_employed_at</div>
        </div>
      </div>

      <div className="absolute top-4 right-4 w-[360px] max-h-[calc(100%-2rem)] flex flex-col gap-2">
        <div className="glass rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-2">Multi-hop reasoning</div>
          <div className="grid gap-1.5">
            {QUERIES.map((q) => <Button key={q.name} size="sm" icon={q.icon} loading={busy === q.name} onClick={() => runQuery(q.name)} className="justify-start">{q.label}</Button>)}
          </div>
        </div>
        {result && (
          <div className="glass rounded-xl p-3 overflow-hidden flex flex-col min-h-0 fade-in">
            <div className="flex items-center justify-between mb-2"><div className="text-sm font-medium">{result.title}</div><button onClick={() => { setResult(null); setHl({ nodes: new Set(), links: new Set() }); }}><X className="size-4 text-zinc-500" /></button></div>
            <details className="mb-2"><summary className="text-[11px] text-zinc-500 cursor-pointer flex items-center gap-1"><Code2 className="size-3" />Cypher</summary><pre className="text-[10.5px] font-mono text-violet-200/80 bg-black/40 rounded-lg p-2 mt-1 whitespace-pre-wrap">{result.cypher}</pre></details>
            <div className="overflow-y-auto space-y-1.5 max-h-[340px]">
              {!result.results.length && <div className="text-xs text-zinc-500">No results. Add team network data in Mission Control to unlock warm paths.</div>}
              {result.results.map((r, i) => (
                <button key={i} onClick={() => highlight(r)} className="w-full text-left p-2.5 rounded-lg bg-white/[0.03] hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/30 transition">
                  {r.names ? (
                    <>
                      <div className="text-xs flex flex-wrap items-center gap-1">{r.names.map((n, j) => <span key={j} className="flex items-center gap-1"><span className={j === 0 ? "text-amber-200" : j === r.names.length - 1 ? "text-cyan-300" : "text-zinc-300"}>{n}</span>{j < r.names.length - 1 && <span className="text-zinc-600">→</span>}</span>)}</div>
                      <div className="text-[11px] text-zinc-500 mt-1">{r.hops} hops · {r.account} · strength {Math.round(r.strength * 100)}%</div>
                    </>
                  ) : r.competitor ? (
                    <>
                      <div className="text-xs"><span className="text-violet-300">{r.account}</span> uses <span className="text-rose-300">{r.competitor}</span></div>
                      <div className="text-[11px] text-zinc-500 mt-1">{r.pain?.length ? r.pain.join(" · ") : "No pain signal yet"} · edge: {r.edge}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs"><span className="text-violet-300">{r.account}</span> <Badge color="lime">{Math.round(r.likelihood * 100)}% eval likelihood</Badge></div>
                      <div className="text-[11px] text-zinc-500 mt-1">{r.signal}</div>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {sel && (
        <div className="absolute bottom-4 left-4 w-[380px] glass rounded-xl p-4 fade-in">
          <div className="flex items-center justify-between"><Badge color={{ Product: "amber", Company: "violet", Person: "cyan", Competitor: "rose", Signal: "lime" }[sel.label]}>{sel.label}</Badge><button onClick={() => setSel(null)}><X className="size-4 text-zinc-500" /></button></div>
          <div className="text-lg font-medium mt-2">{sel.name}</div>
          {sel.title && <div className="text-sm text-zinc-400">{sel.title}</div>}
          {sel.score !== undefined && <div className="text-sm text-zinc-400 mt-1">Score {sel.score} · Tier {sel.tier} · {sel.domain}</div>}
          <div className="text-xs text-zinc-500 mt-2">{data.links.filter((l) => (l.source?.id ?? l.source) === sel.id || (l.target?.id ?? l.target) === sel.id).length} relationships</div>
          {sel.account && <Button size="sm" className="mt-3" icon={Play} onClick={() => go("accounts")}>Open account</Button>}
        </div>
      )}
    </div>
  );
}
