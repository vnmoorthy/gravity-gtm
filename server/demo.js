// DEMO MODE — used only when no ANTHROPIC_API_KEY is configured. Clearly fictional companies on .example domains,
// so the full loop (graph, enrichment UI, HITL, kanban, billing) can be exercised offline. Live mode uses real web evidence.
const pick = (arr, i) => arr[i % arr.length];

export function icp(product) {
  const d = (product.description || "").toLowerCase();
  const fin = /financ|invoice|payable|accounting|spend|cfo/.test(d);
  const dev = /developer|code|engineer|devops|api|security|observab/.test(d);
  const industries = fin
    ? [["Logistics & Freight", "4885"], ["Wholesale Distribution", "4239"], ["Healthcare Services", "6211"], ["Manufacturing", "3329"]]
    : dev
      ? [["B2B SaaS", "5112"], ["Fintech", "5223"], ["Digital Health", "5182"], ["E-commerce Platforms", "4541"]]
      : [["B2B SaaS", "5112"], ["Professional Services", "5416"], ["Logistics & Freight", "4885"], ["Healthcare Services", "6211"]];
  const personas = fin
    ? [["CFO", "Finance", "C-level", "economic buyer"], ["VP Finance", "Finance", "VP", "champion"], ["AP Manager", "Accounts Payable", "Manager", "user"]]
    : dev
      ? [["VP Engineering", "Engineering", "VP", "economic buyer"], ["Head of Platform", "Engineering", "Director", "champion"], ["Staff Engineer", "Engineering", "IC", "user"]]
      : [["VP Revenue Operations", "RevOps", "VP", "economic buyer"], ["Head of Growth", "Growth", "Director", "champion"], ["Sales Ops Manager", "Sales Ops", "Manager", "user"]];
  return {
    one_liner: `${product.name}: ${product.description?.slice(0, 90)}`,
    summary: `Mid-market teams feeling acute pain after a scale event are the fastest buyers. They buy when a new leader arrives or headcount outgrows manual process.`,
    industries: industries.map(([name, naics], i) => ({ name, naics, rationale: "Strong fit with stated reference wins and workflow intensity", confidence: [0.91, 0.84, 0.72, 0.63][i] })),
    company_size: { headcount_min: 150, headcount_max: 2000, revenue_band: "$20M–$500M", rationale: "Complex enough to feel pain, small enough to move fast", confidence: 0.82 },
    regions: [{ name: "North America", confidence: 0.9 }, { name: "UK & Ireland", confidence: 0.61 }],
    personas: personas.map(([title, fn, seniority, buying_role], i) => ({ title, function: fn, seniority, buying_role, pains: ["Manual work that doesn't scale with headcount", "No visibility until month-end"], confidence: [0.9, 0.82, 0.7][i] })),
    triggers: [
      { type: "funding", signal: "Raised Series B+ in the last 6 months", why: "Fresh budget + board pressure to scale efficiently", confidence: 0.86 },
      { type: "exec_hire", signal: "New CFO / VP hired in last 90 days", why: "New leaders re-evaluate tooling in their first 100 days", confidence: 0.83 },
      { type: "hiring", signal: "Open roles for the persona's team", why: "Hiring for the function signals the pain we remove", confidence: 0.77 },
      { type: "tech_change", signal: "Migrating ERP / core system", why: "Replatforming opens the stack", confidence: 0.7 },
      { type: "expansion", signal: "New region or entity launched", why: "Complexity jumps overnight", confidence: 0.66 },
    ],
    negative_signals: ["Hiring freeze or layoffs announced", "Recently acquired / integration underway", "HQ outside target regions"],
    value_props: ["Cut cycle time by 70%", "Real-time visibility instead of month-end surprises", "Live in 2 weeks, no rip-and-replace"],
    pricing_fit: { acv: product.pricing || "$18k–$60k ACV", motion: "hybrid", confidence: 0.74 },
    expansions: [
      { segment: "Private-equity roll-ups (multi-entity)", rationale: "Each acquisition multiplies the workflow pain", evidence: "PE-backed platforms acquire 3-6 companies/yr", confidence: 0.71 },
      { segment: "Climate-tech hardware scale-ups", rationale: "Rapid supplier growth, thin back-office teams", evidence: "Analogous to manufacturing reference wins", confidence: 0.58 },
      { segment: "Public-sector contractors", rationale: "Compliance-heavy with audit trails required", evidence: "Audit-log features map to FedRAMP-style needs", confidence: 0.44 },
    ],
  };
}

const COS = [
  ["Northwind Freight", "Logistics & Freight", "Chicago, IL", 640], ["Bluepeak Health", "Healthcare Services", "Austin, TX", 1200],
  ["Lumen Distribution", "Wholesale Distribution", "Columbus, OH", 380], ["Cobalt Ridge Manufacturing", "Manufacturing", "Pittsburgh, PA", 900],
  ["Tessellate Labs", "B2B SaaS", "San Francisco, CA", 260], ["Harbor & Finch", "Professional Services", "Boston, MA", 450],
  ["Quillstone Fintech", "Fintech", "New York, NY", 520], ["Verdant Grid", "Climate tech", "Denver, CO", 310],
  ["Orchid Clinics", "Healthcare Services", "Nashville, TN", 1700], ["Pinewood Supply Co", "Wholesale Distribution", "Atlanta, GA", 820],
  ["Sable Systems", "B2B SaaS", "Seattle, WA", 410], ["Meridian Parcel", "Logistics & Freight", "Dallas, TX", 1500],
];
const FIRST = ["Priya", "Marcus", "Elena", "Jordan", "Aisha", "Daniel", "Sofia", "Kenji", "Hannah", "Mateo", "Grace", "Omar", "Lena", "Victor"];
const LAST = ["Raman", "Okafor", "Vasquez", "Lee", "Bello", "Fischer", "Moreau", "Tanaka", "Brooks", "Silva", "Kim", "Haddad", "Novak", "Price"];
const SIG = [
  ["funding", "Announced a $42M Series C led by growth investors to expand operations"],
  ["exec_hire", "Appointed a new CFO from a public-company finance team (started 6 weeks ago)"],
  ["hiring", "Hiring 4 roles: Head of RevOps, 2× Sales Ops Analysts, AP Manager"],
  ["tech_change", "Job posts mention migrating from legacy ERP to NetSuite this year"],
  ["expansion", "Opened a second distribution hub and entered the Canadian market"],
  ["product_launch", "Launched a self-serve tier, doubling inbound volume"],
];

export function companies(product, icp, n, exclude) {
  const team = product.team || [];
  const alumni = team.flatMap((t) => t.prior_companies || []);
  const schools = team.flatMap((t) => t.schools || []);
  const out = [];
  let k = 0;
  for (const [name, industry, hq, headcount] of COS) {
    if (out.length >= n) break;
    if (exclude.includes(name)) continue;
    const slug = name.toLowerCase().replace(/[^a-z]/g, "");
    const domain = `${slug}.example`;
    const sigs = [pick(SIG, k), pick(SIG, k + 2), ...(k % 3 === 0 ? [pick(SIG, k + 4)] : [])].map(([type, text], j) => ({
      type, text, date: `2026-${String(((k + j) % 10) + 1).padStart(2, "0")}-1${j}`, source_url: `https://${domain}/newsroom/${type}`,
    }));
    if (k % 4 === 1 && product.competitorHint) sigs.push({ type: "tech_change", text: `Evaluating alternatives to ${product.competitorHint} ahead of renewal`, date: "2026-10-02", source_url: `https://${domain}/careers` });
    const buyers = [0, 1].slice(0, k % 2 ? 1 : 2).map((j) => ({
      name: `${pick(FIRST, k * 2 + j)} ${pick(LAST, k * 3 + j)}`,
      title: icp.personas[j % icp.personas.length].title,
      linkedin_url: null,
      source_url: `https://${domain}/about/leadership`,
      prior_companies: j === 0 && alumni.length && k % 2 === 0 ? [pick(alumni, k)] : [pick(["Deloitte", "Oracle", "Flexport", "Stripe", "Salesforce"], k + j)],
      schools: j === 1 && schools.length && k % 3 === 0 ? [pick(schools, k)] : [],
    }));
    out.push({ name, domain, industry, hq, headcount, why_fit: `${industry} at ${headcount} employees with a recent ${sigs[0].type.replace("_", " ")} signal`, signals: sigs, buyers, tools_used: k % 3 === 1 ? ["Spreadsheets"] : [], negative_signals: k === 5 ? ["Hiring freeze announced in Q3"] : [], sources: [`https://${domain}/newsroom`, `https://${domain}/about/leadership`] });
    k++;
  }
  return out;
}

export function competitors(product) {
  const hint = product.competitorHint;
  return [
    ...(hint ? [{ name: hint, domain: hint.toLowerCase().replace(/[^a-z0-9.]/g, "") + (hint.includes(".") ? "" : ".com"), category: "direct", positioning: `Established incumbent: ${hint}`, value_prop: "Category default with broad adoption", pricing: "Per-user + transaction fees (see public pricing page)", strengths: ["Brand recognition", "Large install base"], weaknesses: ["Manual exception handling", "Renewal price hikes"], our_edge: `Agentic automation end-to-end, priced on outcomes, migrates off ${hint} in days`, sources: [] }] : []),
    { name: "IncumbentOne", domain: "incumbentone.example", category: "direct", positioning: "Enterprise suite, broad but heavy", value_prop: "One platform for everything", pricing: "Quote-based, ~$80k+ ACV", strengths: ["Brand", "Breadth"], weaknesses: ["6-month implementations", "Rigid workflows"], our_edge: "Live in days, agentic automation instead of configuration", sources: ["https://incumbentone.example/pricing"] },
    { name: "FastLane AI", domain: "fastlane.example", category: "direct", positioning: "AI-first point solution", value_prop: "Automate the first step", pricing: "$499/mo starter, usage tiers", strengths: ["Modern UX"], weaknesses: ["No end-to-end loop", "Black-box outputs"], our_edge: "Every output carries citations + human approval", sources: ["https://fastlane.example/pricing"] },
    { name: "Stackwise", domain: "stackwise.example", category: "direct", positioning: "Mid-market workflow tool", value_prop: "Templates for common flows", pricing: "$35/seat/mo", strengths: ["Cheap"], weaknesses: ["Seat pricing punishes growth"], our_edge: "Usage-based pricing aligned to outcomes", sources: ["https://stackwise.example/pricing"] },
    { name: "Generic CRM add-ons", domain: "", category: "indirect", positioning: "Bolt-ons inside the CRM", value_prop: "Already in your stack", pricing: "Bundled", strengths: ["Distribution"], weaknesses: ["Shallow data"], our_edge: "Knowledge graph reasoning across sources", sources: [] },
    { name: "Spreadsheets + agencies", domain: "", category: "alternative", positioning: "Do-it-yourself", value_prop: "Flexible and familiar", pricing: "Hidden labour cost", strengths: ["No procurement"], weaknesses: ["Doesn't scale", "No audit trail"], our_edge: "Autonomous loop with full audit log", sources: [] },
  ];
}

export function sequence(product, p, a, warm, disp) {
  const first = p.name.split(" ")[0];
  const s0 = a.signals[0]?.text || "your recent growth";
  const warmLine = warm ? `We both have ${warm.via[0]} in common, so I figured I'd reach out directly. ` : "";
  return [
    { step: 1, channel: "email", variant: "A", angle: "signal-led", subject: `re: ${a.signals[0]?.type?.replace("_", " ") || "growth"} at ${a.name.split(" ")[0].toLowerCase()}`, body: `Hi ${first},\n\n${warmLine}Saw that ${a.name} ${s0.charAt(0).toLowerCase() + s0.slice(1)}. Teams at that stage usually find the manual process breaks first.\n\n${product.name} ${product.description?.split(".")[0].toLowerCase()}. Teams like yours go live in about two weeks.\n\nWorth a 15-minute look next week?\n\n— ${product.sender || "Alex"}`, claims: [{ text: s0, signal_index: 0 }] },
    { step: 1, channel: "email", variant: "B", angle: "pain-led", subject: `month-end at ${a.name.split(" ")[0].toLowerCase()}`, body: `Hi ${first},\n\nMost ${p.title}s we talk to at ${a.headcount}-person companies lose days every month to work that doesn't scale with headcount.\n\n${product.name} automates it end-to-end with a full audit trail${disp ? `, without the heavy implementation that ${disp.competitor} needs` : ""}.\n\nOpen to comparing notes for 15 minutes?\n\n— ${product.sender || "Alex"}`, claims: [] },
    { step: 2, channel: "linkedin", variant: "A", angle: "connect", subject: "", body: `Hi ${first}, congrats on the momentum at ${a.name}. ${warm ? `Fellow ${warm.via[0]} alum here. ` : ""}I'm building ${product.name} for teams scaling past manual workflows. Would love to connect.`, claims: [] },
    { step: 3, channel: "email", variant: "A", angle: "follow-up value add", subject: `quick benchmark for ${a.name.split(" ")[0].toLowerCase()}`, body: `Hi ${first},\n\nA quick follow-up. We put together a 1-page benchmark of how ${a.industry} teams at your size handle this, including where the hours go.\n\nWant me to send it over?\n\n— ${product.sender || "Alex"}`, claims: [] },
  ];
}

export function review(m) {
  const base = m.variant === "A" ? 0.24 : 0.17;
  return { verdict: "pass", unsupported_claims: [], notes: m.claims?.length ? "Signal claim matches cited newsroom source" : "No factual claims to verify", reply_probability: base + (m.body.includes("in common") ? 0.12 : 0) + Math.random() * 0.05, objection: pick(["Timing — mid-migration right now", "Already have a vendor", "Need to see ROI numbers first"], m.body.length), twin_reply: pick(["Interesting timing, we're actually scoping this now. Send over the benchmark?", "We're locked in until renewal in Q2, but happy to chat then.", "Who else at our size is using this?"], m.body.length) };
}

export function freshSignal(a) {
  return [{ type: "hiring", text: `New job post: Director of Operations Excellence at ${a.name} (posted this week)`, date: new Date().toISOString().slice(0, 10), source_url: `https://${a.domain}/careers/ops-excellence`, verified: true }];
}
