# Gravity: Red-Team Verdict (HackwithBay 4.0, "AI GTM Engine")

Prepared 2026-11-24. Covers: (A) real user pain from Reddit, (B) three candidate concepts, (C) a 4-judge red team with scoring, the winning feature set ranked for a ~90-minute build, and the 3 jaw-drop demo moments.

**TL;DR:** Build **Concept A, "Gravity: The Glass-Box GTM Engine"**: a live knowledge graph that grows as Band agents work, a citation gate that blocks any claim without a source, an enrichment waterfall that checks MX records so emails don't bounce, and a Flexprice spend governor that pauses the autopilot when credits run out. Add two cheap features from the other concepts: a **warm-path finder** from B and a **one-shot persona pre-flight** from C. Pitch line: *"Every other AI SDR is a black box. Gravity shows its work: every claim is cited, every credit is accounted for, and every send is approved by a human."*

---

## A) Voice of the customer: Reddit pain points

**Method:** reddit.com blocks automated crawlers, so I searched thread titles in r/sales, r/coldemail, r/startups, r/SaaS, r/salesdevelopment, r/b2bmarketing and r/Entrepreneur through the Arctic Shift Reddit archive API (2024 to Nov 2026), then pulled the full post text. The URLs below are canonical reddit permalinks.

**Caveats:**
- Items marked *(title only)* were later removed by moderators. Only the title survives, and it is still a useful signal of demand.
- Many threads have low upvote counts.
- Some authors are vendors (noted where relevant). Treat these as directional, not statistical.

| # | Pain point (paraphrase; quotes ≤15 words) | Source thread | What Gravity does about it |
|---|---|---|---|
| 1 | **AI SDR output is generic and repels buyers.** A rep says the AI outreach sounds "sooo generic". Openers like "very impressive..." get only unsubscribes, and the promised 3x reply rates never show up. | r/sales: https://www.reddit.com/r/sales/comments/1t63m4o/any_good_result_with_ai_sdr_im_thinking_about/ | Signal-first copy plus the **citation gate**: no claim without a source |
| 2 | **Heavy AI personalization lost to simple segmentation** across 40+ campaigns. It took longer (reviewing weird or creepy lines) and performed worse than a tight ICP with one clear pain. | r/coldemail: https://www.reddit.com/r/coldemail/comments/1s6olxi/we_tested_ai_personalization_vs_simple/ | ICP segment pain plus *one* verified signal. The Reviewer flags "creepy or trying-too-hard" lines |
| 3 | **Filters and buyers now "smell" AI patterns.** At 1M+ emails a month, hyper-personalized "loved your post" emails get fewer opens, while relevance-based copy still reaches the inbox. | r/coldemail: https://www.reddit.com/r/coldemail/comments/1rpx8j7/is_anyone_else_seeing_ai_personalization_actually/ | **Deliverability guard**: an AI-tell linter and a spam-word check in the Reviewer |
| 4 | **AI artifacts leak into the inbox**: em-dashes, smart quotes and zero-width spaces from LLM steps make emails look machine-written. | r/coldemail: https://www.reddit.com/r/coldemail/comments/1tkg13q/ai_personalization/ | Sanitizer pass before the HITL gate |
| 5 | **Fear of full autopilot.** Letting agents run outbound end to end leads to climbing bounces, spam placement and dried-up replies. AI is fine for research, but a human should own outreach. | r/salesdevelopment: https://www.reddit.com/r/salesdevelopment/comments/1xnen78/does_anyone_else_think_let_ai_agents_run_your/ | **Strict HITL gate** and a glass-box audit log. Autopilot does the research, a human approves the send |
| 6 | **Contact data bounces.** Seamless and Apollo either find no email or find ones that bounce (24-comment thread). A separate post claims an audit of 100k Apollo contacts found "absolute garbage data" *(title only)*. | r/sales: https://www.reddit.com/r/sales/comments/1394w6r/is_it_me_or_lately_contact_data_from_tools_like/ and https://www.reddit.com/r/sales/comments/1x8ejig/we_audited_100000_apollo_contacts_here_is_the/ | **Bounce-proof waterfall**: MX check, catch-all detection, risk score, auto-drop |
| 7 | **ICP ≠ urgency.** "An ICP tells you who could buy," not who cares now. Signals like hiring for the role, competitor-launch comments and asking for tool recommendations drove 38 meetings in 7 days. | r/startups: https://www.reddit.com/r/startups/comments/1ws7nhf/i_will_not_promote_38_meetings_in_7_days_and_200k/ | **Signal radar**: rank by evidence of pain right now, not just firmographics |
| 8 | **ICP thrash.** One founder was on his fourth ICP in 14 months. Lost-deal notes and usage data showed the real buyer pattern, but nobody had connected them. | r/SaaS: https://www.reddit.com/r/SaaS/comments/1xgvzfi/at_what_point_does_changing_your_icp_become_an/ | ICP inference with **confidence plus evidence**, and expansion from the best-converting nodes |
| 9 | **Founder-led outbound is a hidden tax.** One founder wrote cold emails from 10pm to 1am for a year, and automating saved 6 to 8 hours a week. Another says pipeline depended on the founder's energy that day. | r/startups: https://www.reddit.com/r/startups/comments/1sdriw3/i_finally_stopped_doing_founderled_outbound_at/ and https://www.reddit.com/r/startups/comments/1sklbzp/founderled_outbound_taught_me_a_lot_but_i_also/ | An autopilot loop with a weekly approval queue, built for founders without a GTM engineer |
| 10 | **Tool sprawl and glue work.** "Messaging is solved." The grind is tab-hopping, chaining scrapers and fixing broken Zapier automations. Another title reads "we have clay, apollo, zoominfo, sales nav - and the pipeline is still dry" *(title only)*. | r/SaaS: https://www.reddit.com/r/SaaS/comments/1xgmvl3/the_messaging_part_of_outbound_is_solved/ and https://www.reddit.com/r/sales/comments/1tfml8v/we_have_clay_apollo_zoominfo_sales_nav_and_the/ | One engine from intake to kanban, with no Zapier glue |
| 11 | **Clay cost and credit burn.** "Tired of paying $180/month for Clay, so I built my own" *(title only)*, and another founder "eliminated Apollo and Clay subscription costs" *(title only)*. A G2 review claims Clay credits cost about 10x the raw API price (not from Reddit). | r/sales: https://www.reddit.com/r/sales/comments/1uzz2sx/i_got_tired_of_paying_180month_for_clay_so_i/ and r/SaaS: https://www.reddit.com/r/SaaS/comments/1xye18t/how_i_eliminated_apollo_and_clay_subscription/ | **Transparent per-action metering (Flexprice)**, a spend governor, and cost per qualified lead |
| 12 | **The AI SDR category is in backlash.** Titles include "Artisan hired a human BDR... 'The End of AI SDRs'" and "AI SDR is a bullshit category, $45M later" (both *title only*). Reps also ask what to verify first in AI-generated account briefs. | https://www.reddit.com/r/sales/comments/1y4o494/artisan_hired_a_human_bdr_alta_wrote_the_end_of/ , https://www.reddit.com/r/sales/comments/1v56gr1/ai_sdr_is_a_bullshit_category_45m_later_still/ , https://www.reddit.com/r/salesdevelopment/comments/1xz0erc/when_you_review_an_aigenerated_account_brief_what/ | Position Gravity as the **glass-box** alternative: cited, governed, human-approved |
| 13 | **Meta-analysis of 177 founder outbound threads** (the author is building a tool). It found five recurring failures: product-centric copy, volume on a cold domain, lists that are too wide, asking for a meeting in email one, and too many tools. | r/SaaS: https://www.reddit.com/r/SaaS/comments/1xla3re/i_read_177_reddit_threads_from_founders_doing/ | Reviewer rules: reader-first opener, yes/no CTA (no meeting ask in touch 1), per-inbox send caps |
| 14 | **Warm and referral channels win in relationship-driven markets** (legal is referral-driven). There is demand to *pay* for warm intros *(title only)*. | r/startups: https://www.reddit.com/r/startups/comments/1r9933o/more_important_to_network_in_techvc_or_in_your/ and r/sales: https://www.reddit.com/r/sales/comments/1cic49u/would_you_pay_for_a_warm_intro_to_a_prospect/ | **Warm-path finder**: multi-hop `KNOWS` paths in the graph |

**Takeaways for the pitch:**
- Buyers don't want *more* AI. They want **AI they can verify** (citations, MX-checked contacts, human approval).
- They want spend they can predict (metered credits, not opaque markups).
- They want to aim at **signals of urgency**, not static firmographic lists.

This maps directly onto the winning concept below.

---

## B) Three wow-factor concepts

All three cover the required spec end to end: product intake, ICP inference with confidence scores plus expansion, buyer and competitor discovery with citations, a dynamic knowledge graph, enrichment with MX validation, signal-personalized multi-touch sequences, a strict human-in-the-loop (HITL) gate, a kanban with AI vs rep attribution, an audit log, and conversion and A/B analytics. What separates them is the differentiating layer.

### Concept A: "Gravity: The Glass-Box GTM Engine" (evidence graph + war room + spend governor)
*Positioning:* Clay is a power tool that needs a GTM engineer to run it. 11x and Artisan are black boxes. Gravity is an autopilot you can audit.

1. **Live-growing knowledge graph (3D):** Company, Person, Product, Competitor and Signal nodes appear in real time as agents discover them. Each node carries the source URL it came from. Edges include `WORKS_AT`, `USES`, `COMPETES_WITH`, `SIGNALED` and `KNOWS`.
2. **Agent War Room (Band):** a visible channel where the Planner, Scout, Enricher, Writer, Reviewer and Security agents hand work to each other, argue, and reject drafts. The audience watches the team think.
3. **"Evidence-or-it-didn't-happen" citation gate:** every personalization claim in a draft must link to a source node in the graph. The Reviewer strikes uncited or contradicted claims in red and forces a rewrite. Emails show footnote chips like `[1] techcrunch.com/...`.
4. **Bounce-proof enrichment waterfall:** guess the email pattern, then do a real DNS MX lookup, catch-all detection and a disposable-domain check. Each contact gets a bounce-risk score. Risky contacts are dropped automatically before they cost a send.
5. **Spend governor (Flexprice):** every agent action is a metered event (search, enrich, LLM draft, MX check). The run pauses at the credit cap and shows "Approve +50 credits?". The cost per qualified lead is shown live.
6. **Signal radar:** funding, hiring posts, leadership changes, tech-stack changes and competitor complaints are each scored for recency and relevance. The strongest signal drives the opening line of the sequence.
7. **Self-critiquing Reviewer agent:** scores tone, length, spam-trigger words, claim accuracy and CTA clarity, and gives a pass or fail with reasons stored in the audit log.
8. **Strict HITL gate plus glass-box audit log:** nothing sends without approval. Every approve, edit or reject is logged with the actor (AI or rep). Rep edits are diffed to learn from.
9. **Kanban with attribution:** columns Matched, Contacted, Replied, Meeting, Closed/Lost. Each card is tagged AI-sourced, AI-drafted or rep-edited. A/B variant conversion is shown per column.
10. **ICP expansion with confidence:** the graph suggests adjacent segments ("companies like your 3 best matches also include..."), each with a confidence bar and evidence.

### Concept B: "Warm Path: Six Degrees to Revenue" (relationship-first GTM)
*Positioning:* cold email is dying, and warm intros convert many times better. Warm Path finds the shortest human path to every buyer.

1. **Network ingestion:** upload a LinkedIn connections CSV or Gmail contacts. The founder's own graph becomes the base layer.
2. **Multi-hop warm-path finder:** You → ex-colleague → VP Sales at the target, ranked by path strength (tenure overlap, recency, mutual company).
3. **Double opt-in intro drafts:** writes a forwardable blurb for the connector, not a cold email to the buyer.
4. **Competitor displacement radar:** finds companies using a competitor, flags churn signals (negative G2 reviews, migration job posts, contract-renewal timing) and draws `DISPLACEABLE` edges.
5. **Champion tracker:** alerts when a past champion changes jobs, because the warmest account is wherever they land next.
6. **Connector reciprocity ledger:** tracks who has made intros and suggests ways to give back.
7. **Cold fallback lane:** when no warm path exists, it falls back to the standard enrichment and outreach pipeline with HITL.
8. **Path-strength analytics:** compares conversion of warm vs cold paths on the kanban.

### Concept C: "Pre-Flight: The Outbound Flight Simulator" (persona-simulation arena)
*Positioning:* stop testing on real prospects. Every email has to survive a simulated buyer before a human sees it.

1. **Buyer digital twin:** builds a persona from the prospect's public footprint (role, posts, company stage, stack).
2. **Reply simulator / roleplay:** the twin "reads" the draft and returns a predicted reply, an objection, and a reply-likelihood score.
3. **Variant arena:** 3 to 5 variants compete against the twin plus a skeptic-buyer panel, and the winners go to the HITL gate.
4. **Objection pre-loader:** the follow-up touches are pre-written against the twin's top objections.
5. **Deliverability guard:** a spam-word linter, link and image ratio checks, and a domain-warmup status.
6. **Live call prep:** if the prospect replies, the twin generates a discovery-call brief.
7. **Sim-to-real calibration:** compares predicted against actual reply rates to keep the simulator honest.
8. **Persona roleplay mode:** a rep can practice the call against the twin.

---

## C) Red team: 4 judges vs 3 concepts

### The panel
| Judge | Persona | What they hunt for |
|---|---|---|
| **Dana (GTM VC)** | 15 years in B2B SaaS GTM, seen 60+ "AI SDR" pitches this year | Wedge, why now, defensibility against Clay, Apollo AI, 11x, Artisan and Unify, retention, whether it burns domains |
| **Raj (technical, hates vaporware)** | Staff engineer who opens DevTools during demos | Hard-coded data, fake "agents" that are a for-loop with labels, citations that 404, MX checks that are mocked |
| **Band sponsor judge** | DevRel for Band | Real multi-agent orchestration on Band: distinct roles, agent-to-agent handoffs, shared context, a Reviewer that actually rejects, a Security agent with teeth |
| **Flexprice sponsor judge** | Flexprice solutions engineer | Real metered events, credit balance and entitlement gating that blocks actions, a plausible pricing model, a usage view |

**Scoring:** each criterion is scored 1 to 10. Weighted base is ICP & discovery ×2 + enrichment & outreach ×2 + dashboard ×1.5 + startup viability ×1.5 + technical execution & demo ×1, out of a maximum of 80. Bonus is Band ×2 + Flexprice ×2, out of a maximum of 40. **Total maximum: 120.**

### Concept A: Gravity (Glass-Box)
**Dana (VC):** "Glass box is a real wedge. Buyers got burned by 11x-style black boxes and burned domains, and 'cited or blocked' is a trust story a VP Sales will pay for. My worry is that a 3D graph is eye candy. Show me it *changes a decision*, like picking the account with the warm path or the hot signal." *Fix:* make clicking a node drive the next action (draft, path, deprioritize).

**Raj (tech):** "If the graph nodes are seeded JSON I'll find out. Show me a live fetch with a real URL on each node, and run `dig MX` on stage. A 3D graph in 90 minutes is a time sink, and if the camera jitters the demo dies." *Fix:* use `react-force-graph-3d` as a drop-in with a 2D fallback flag, stream nodes over SSE, and keep one real search API call visible in the network tab.

**Band judge:** "This is the most natural Band showcase. The War Room is Band. I want to see the Reviewer reject the Writer at least once, and the Security agent block something (PII, an unsubscribe-less email, a prompt-injection in a scraped page)." *Fix:* script a guaranteed rejection by feeding one stale signal.

**Flexprice judge:** "A spend governor that pauses mid-run is exactly our pitch. Meter per action type, not just per LLM token, and show the balance dropping in our dashboard in sync with yours." *Fix:* use event types `discovery.search`, `enrich.mx_check`, `llm.draft` and `review.pass`, with a credit-gate check before each.

| Judge | ICP (×2) | Enrich/Outreach (×2) | Dashboard (×1.5) | Viability (×1.5) | Tech/Demo (×1) | Band (×2) | Flexprice (×2) | **Total /120** |
|---|---|---|---|---|---|---|---|---|
| Dana | 7 | 7 | 9 | 6 | 7 | 8 | 8 | **89.5** |
| Raj | 7 | 7 | 8 | 6 | 6 | 7 | 7 | **83.0** |
| Band | 7 | 7 | 8 | 6 | 7 | 9 | 7 | **88.0** |
| Flexprice | 7 | 7 | 8 | 7 | 7 | 7 | 9 | **89.5** |
| **Panel avg** | | | | | | | | **87.5** |

### Concept B: Warm Path
**Dana:** "Best business. Warm intros are the founder-led-sales unlock and nobody does it well. Can you get the data, though? LinkedIn CSV exports have no 2nd-degree connections. Without the 2nd degree, multi-hop is mostly fiction."
**Raj:** "Your demo network will be fake, and I'll call it seeded. Multi-hop paths across a synthetic network prove nothing about the hard part, which is resolving identities across sources."
**Band judge:** "Mostly a graph query plus a writer. There's not much for agents to *negotiate*, so it feels like one agent with extra steps."
**Flexprice judge:** "Per-intro pricing is interesting, but there are few metered events. It's thin for us."

| Judge | ICP | E/O | Dash | Viab | Tech | Band | Flex | **Total** |
|---|---|---|---|---|---|---|---|---|
| Dana | 7 | 6 | 7 | 8 | 6 | 5 | 5 | **74.5** |
| Raj | 6 | 5 | 7 | 7 | 5 | 5 | 5 | **68.0** |
| Band | 6 | 6 | 7 | 7 | 6 | 5 | 5 | **71.0** |
| Flexprice | 6 | 6 | 7 | 7 | 6 | 5 | 5 | **71.0** |
| **Panel avg** | | | | | | | | **71.1** |

### Concept C: Pre-Flight Simulator
**Dana:** "Clever, but a simulated reply isn't a reply. An LLM grading an LLM's email is circular, and sales leaders won't trust a 'predicted reply rate' until there's calibration data you don't have. It also neglects ICP and discovery, which is 20% of the score."
**Raj:** "Unfalsifiable on stage. Any score you show could be random and I can't tell. Interesting tech, weak proof."
**Band judge:** "Great agent theater. Twin vs writer vs skeptic panel is a real multi-agent debate. I'd score the orchestration highly."
**Flexprice judge:** "Simulation runs are a nice metered unit, and 'pay per pre-flight' is a clean SKU."

| Judge | ICP | E/O | Dash | Viab | Tech | Band | Flex | **Total** |
|---|---|---|---|---|---|---|---|---|
| Dana | 5 | 8 | 7 | 5 | 7 | 8 | 7 | **81.0** |
| Raj | 5 | 7 | 6 | 5 | 6 | 8 | 6 | **74.5** |
| Band | 5 | 7 | 6 | 5 | 7 | 9 | 7 | **79.5** |
| Flexprice | 5 | 7 | 6 | 6 | 7 | 7 | 8 | **79.0** |
| **Panel avg** | | | | | | | | **78.5** |

### Panel verdict
**Winner: Concept A, Gravity (87.5/120),** with two grafts:
- **From B:** the *warm-path finder* as a graph query over the existing graph, using a seeded "my network" CSV (around 30 people). It's cheap because the graph already exists, and it lifts Viability, which was A's weakest criterion. Be upfront in the pitch that the network is user-uploaded.
- **From C:** a *one-shot persona pre-flight* inside the Reviewer agent. It returns the predicted top objection and does one rewrite. It gives the Band judge a real debate, and because it's a reviewer step rather than a fake metric, Raj's objection doesn't apply.

**Projected score with grafts:** about 93/120, driven by Viability (6 to 7.5) and Band (8 to 9).

**Unanimous red-team conditions** (failing these costs points):
1. **Nothing fake in the critical path:** at least one live web search, real source URLs on nodes, a real DNS MX lookup, and real Flexprice events. Seeding is fine for the network CSV only, and say so.
2. **The Reviewer must visibly reject something.** Make that happen with a stale signal planted in the demo account.
3. **The credit gate must visibly block something.** Set a low demo balance so the pause happens on stage.
4. **Never send real cold email in the demo.** Send to your own inbox or Mailpit, or leave it queued after approval.
5. **The graph must drive decisions:** clicking a node opens a draft, a path or evidence.

---

## Final winning feature set (ranked by demo wow ÷ build risk, for a ~90-minute build)

Wow and Risk are scored 1 to 5 (5 = most wow or most risk). Ratio = wow ÷ risk. Build in this order and stop at the cut line if time runs out.

| # | Feature | Wow | Risk | Ratio | Build note (fastest credible path) | Spec coverage |
|---|---|---|---|---|---|---|
| 1 | **Citation gate ("evidence or it didn't happen")** | 5 | 2 | 2.5 | Writer returns JSON `{line, source_node_id}`. Reviewer drops any line without a valid source and shows it struck through in red. Footnote chips link to URLs. | Outreach, citations |
| 2 | **Live-growing knowledge graph** | 5 | 2 | 2.5 | `react-force-graph-3d` (2D fallback flag). Stream nodes from the backend over SSE. Node types are color-coded, and clicking opens an evidence drawer. | Graph, dashboard |
| 3 | **Spend governor / credit gate (Flexprice)** | 4 | 2 | 2.0 | Check entitlement or balance before each action and ingest an event after. A low demo balance triggers a pause modal with "Approve +50". The header shows a live meter and cost per lead. | Flexprice bonus |
| 4 | **ICP inference with confidence + expansion** | 3 | 1 | 3.0 (but low wow) | One LLM call over the scraped product URL returns 3 segments with confidence, rationale and evidence URLs, plus one "adjacent ICP" suggestion. | ICP 20% |
| 5 | **Bounce-proof enrichment (MX waterfall)** | 3 | 1 | 3.0 | Node `dns.resolveMx`, a catch-all heuristic, and a disposable-domain list. Each contact gets a bounce-risk badge, and risky ones are auto-dropped and logged. | Enrichment 20% |
| 6 | **Agent War Room (Band)** | 5 | 3 | 1.7 | Band agents Planner, Scout, Enricher, Writer, Reviewer and Security, with the message stream mirrored into a side panel. Each handoff also writes to the audit log. | Band bonus |
| 7 | **HITL approval gate + kanban with AI/rep attribution + audit log** | 3 | 2 | 1.5 | Approve, edit or reject on each draft. Approving moves the card Matched to Contacted. Each card shows an AI-drafted or rep-edited badge. The audit log is an append-only table. | Required, dashboard |
| 8 | **Warm-path finder** | 5 | 3 | 1.7 | Upload a seeded `my_network.csv`, add `KNOWS` edges, and run BFS for 2 to 3 hops. The path glows in the graph, and the agent drafts a forwardable intro ask. | ICP, graph |
| **CUT LINE** (1–8 is a complete, winning demo) | | | | | | |
| 9 | **Competitor displacement edges + signal radar** | 4 | 3 | 1.3 | Scout finds competitor customers or complaints and adds `USES` and `DISPLACEABLE` edges. The strongest signal picks the email angle. | Discovery, personalization |
| 10 | **Persona pre-flight in the Reviewer** | 4 | 3 | 1.3 | One extra LLM call returns the prospect persona's top objection and does one rewrite. Show it in the War Room as a Reviewer and Persona exchange. | Outreach, Band |
| Stretch | A/B analytics tile + Snyk badge in the Security agent | 2 | 1 | – | Two variants per sequence with a reply-rate bar (seeded outcomes, labeled). Run `snyk test` in CI and show the badge. | Analytics, security |

**Suggested 90-minute timeline:**
- 0–15: scaffold, SSE stream, graph component.
- 15–30: intake, ICP, discovery with real search.
- 30–45: enrichment, MX checks, Flexprice metering and gate.
- 45–60: Writer and Reviewer with the citation gate, Band wiring.
- 60–75: HITL gate, kanban, audit log.
- 75–85: warm path.
- 85–90: demo rehearsal, with the demo account seeded to force a Reviewer rejection and a credit pause.

---

## The 3 jaw-drop moments (3-minute demo)

1. **"Watch the universe form" (0:00–1:00).** Paste a real product URL. Within about 20 seconds, ICP cards with confidence bars appear. The 3D graph comes alive as Scout and Enricher drop Company, Person, Competitor and Signal nodes, each with a source chip. The War Room shows the agents handing off in real time, and the credit meter ticks down with each action. *Line:* "Every node you see has a URL behind it. Click any one."

2. **"The Reviewer catches a lie" (1:00–2:00).** The Writer drafts an opener: "Congrats on the Series B." The Reviewer cross-checks the graph, finds the source says Series A from 2023, and strikes the line in red ("contradicted by [2]"). It rewrites using the fresh hiring signal with a citation chip. In the same beat, the Enricher drops one contact as catch-all MX, high bounce risk. The human clicks **Approve**, the card moves Matched to Contacted, and it's tagged *AI-drafted, rep-approved* in the audit log. *Line:* "If it can't cite it, it can't say it."

3. **"The brake and the shortcut" (2:00–3:00).** Mid-run the autopilot hits the Flexprice credit cap. Everything pauses with "12 enrichments need 36 credits; 20 left. Approve?" The presenter approves, and the run resumes with the Flexprice dashboard showing the same events. Then click the hottest account: a **2-hop warm path** lights up in the graph (You → former teammate → VP Sales), and Gravity drafts the intro ask. Close on analytics: cost per qualified lead and AI vs rep attribution. *Line:* "Self-driving, but you hold the brakes and the wallet."

---

## Pitch one-liners for the viability judge
- **Wedge:** seed to Series A founders doing founder-led sales, who don't have a GTM engineer to run Clay and don't trust a black-box AI SDR with their domain.
- **Why now:** AI-written cold email has flooded inboxes, so reply rates and deliverability are collapsing, and the edge has moved to *verified* signals and warm paths.
- **Moat:** the graph compounds. Every approved, edited or rejected draft and every reply outcome is labeled training data tied to evidence.
- **Pricing:** credit packs metered per action through Flexprice (search, enrich, draft, verify), with a "cost per qualified lead" guarantee view. Free tier: 100 credits.
