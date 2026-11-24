import { Swords, Check, X, Sparkles } from "lucide-react";
import { Card, Badge, SourceChip, Empty, SectionTitle, Button } from "../ui";

const CAT = { direct: ["Direct", "rose"], indirect: ["Indirect", "amber"], alternative: ["Alternative", "zinc"] };

export default function Competitors({ state, go }) {
  if (!state.competitors.length) return <Empty icon={Swords} title="No competitive map yet" action={<Button variant="primary" onClick={() => go("mission")}>Launch a mission</Button>}>The Analyst agent maps direct, indirect and do-nothing alternatives, including public pricing pages and your structural edge.</Empty>;
  const disp = state.accounts.filter((a) => a.uses_competitors?.length);
  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <SectionTitle eyebrow="Module 2 · Competitive Landscape" title="Competitor Map">Positioning, public pricing and structural differentiators relative to {state.product?.name}. Accounts using a competitor become displacement plays in the graph.</SectionTitle>
      {["direct", "indirect", "alternative"].map((cat) => {
        const list = state.competitors.filter((c) => c.category === cat);
        if (!list.length) return null;
        return (
          <div key={cat} className="mb-6">
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-2">{CAT[cat][0]} competitors</div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {list.map((c) => {
                const n = disp.filter((a) => a.uses_competitors.includes(c.id)).length;
                return (
                  <Card key={c.id} className="p-5 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div><div className="text-lg font-medium">{c.name}</div><div className="text-xs text-zinc-500">{c.domain}</div></div>
                      <div className="flex gap-1"><Badge color={CAT[cat][1]}>{CAT[cat][0]}</Badge>{n > 0 && <Badge color="violet">{n} displaceable</Badge>}</div>
                    </div>
                    <div className="text-sm text-zinc-300 mt-3">{c.positioning}</div>
                    <div className="text-xs text-zinc-500 mt-1 italic">“{c.value_prop}”</div>
                    <div className="mt-3 p-2.5 rounded-lg bg-black/30 border border-white/5"><div className="text-[10px] uppercase tracking-wider text-zinc-500">Public pricing</div><div className="text-sm font-mono text-zinc-200 mt-0.5">{c.pricing}</div></div>
                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                      <div><div className="text-zinc-500 mb-1">Strengths</div>{c.strengths?.map((s, i) => <div key={i} className="flex gap-1.5 text-zinc-300"><Check className="size-3.5 text-emerald-400 shrink-0" />{s}</div>)}</div>
                      <div><div className="text-zinc-500 mb-1">Weaknesses</div>{c.weaknesses?.map((s, i) => <div key={i} className="flex gap-1.5 text-zinc-300"><X className="size-3.5 text-rose-400 shrink-0" />{s}</div>)}</div>
                    </div>
                    <div className="mt-3 p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 text-sm"><div className="text-[10px] uppercase tracking-wider text-amber-300/80 flex items-center gap-1 mb-0.5"><Sparkles className="size-3" />Our edge</div>{c.our_edge}</div>
                    <div className="flex flex-wrap gap-1 mt-auto pt-3">{c.sources?.map((u) => <SourceChip key={u} url={u} />)}</div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
