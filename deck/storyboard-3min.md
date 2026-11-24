# Gravity: 3-minute live pitch storyboard

HackwithBay 4.0 · "AI GTM Engine" · final presentations 4:00 PM
Live demo: https://gravity-gtm.onrender.com · Code: https://github.com/vnmoorthy/gravity-gtm
Deck: `Gravity-Pitch.pptx` (or `Gravity-Pitch-motion.html`, arrow keys + F). Total run time: **3:00**. Spoken words: **431** (about 144 wpm, which leaves room for the live clicks).

The spine: **"Every claim cited, every send approved, every credit metered."** The close: **"Self-driving, but you hold the brakes and the wallet."**

---

## Stage setup (two app tabs + deck)

| Tab / screen | What it is | Used at |
|---|---|---|
| Main screen, tab 1 | The deck (HTML deck in a browser tab makes switching a single Ctrl+Tab) | All slides |
| Main screen, tab 2, **LIVE** | Local instance (`npm start`, http://localhost:8787) with the same `.env`, sitting on **Mission Control** with the Ledgerly sample loaded. Nothing launched yet. | S4 |
| Main screen, tab 3, **SEEDED** | The Render deployment (https://gravity-gtm.onrender.com), with a full Ledgerly mission completed before the talk | S5, S6, S8 |
| Second screen | The Band room in app.band.ai (the same room as `BAND_CHAT_ID`), plus the Flexprice dashboard events page | S7, S8 |

## Pre-flight checklist (T-30 min to T-2 min)

- [ ] **Seed run (SEEDED tab).** On Mission Control, click **"Ledgerly · AP automation"**, open **"+ Add reference wins, pricing, constraints & team network"** (Maya Patel, ex-Flexport and Brex, Stanford), then click **Launch Autopilot**. Wait for the Planner's "Mission loop complete" message. Check:
  - Mission Control shows Accounts > 0, Buyers > 0 and In review ≥ 3.
  - In Knowledge Graph, **"Warm intro paths"** returns at least 1 result. If it returns none, re-run the mission with the team network filled in.
  - In HITL Review, **"Approve all passing (n)"** shows n ≥ 3.
- [ ] **Do not click Launch Autopilot on SEEDED again.** Launching resets that workspace.
- [ ] **LIVE tab.** Click **"Ledgerly · AP automation"**, expand the team network, and tick **"Pause for my ICP approval before spending credits"**. This makes the Strategist @mention you in Band, which you use at S7.
- [ ] **Band.** Set `BAND_CHAT_ID` on the LIVE instance to the room on the second screen. In the War Room, the header chip must read "Mirrored to Band room …". Keep the room scrolled to the bottom.
- [ ] **Credit gate.** In the SEEDED tab, open **Spend Governor** and click **"Simulate low balance"** (the wallet drops to 4 credits). The header pill **"Credits · Flexprice"** turns red. Do this last, after every other check.
- [ ] **Sandbox.** Set `DISPATCH_MODE=sandbox` and point `TEST_INBOX` at your own inbox. No real prospect is ever emailed.
- [ ] **Backup.** Have the exported demo video (`demo-video-script.md`) open in QuickTime, paused at 0:10. Slides 5 to 8 carry screenshots, so every live cut can fall back to the slide.
- [ ] **Display.** The app and deck use the light "paper" theme (warm paper, white cards, black ink, cobalt accent), which reads well on projectors. The Knowledge Graph is the one dark 3D panel and the visual pop, so give it the full screen at S5. Set the app tabs to 110–125% browser zoom, turn on Do Not Disturb, close everything else, and check that the presenter clicker advances the deck.

---

## S1 · Title / hook · 0:00–0:15 (15s)

**On screen:** Slide 1. Paper canvas with the wordmark "Gravity · the self-driving GTM engine" and the two-tone headline "The Revenue Engine / from one sentence to booked meetings." The Blender hero sits in a large dark rounded media panel.
**Live cut:** none.

> Every founder in this room has one sentence that describes their product. Gravity turns that sentence into booked meetings. It's a self-driving GTM engine, and unlike every other AI SDR, it shows its work.

Words: 34 · running total: 34

---

## S2 · Problem · 0:15–0:35 (20s)

**On screen:** Slide 2, "AI SDRs turned outbound / into a black box." Four Reddit pain cards (TRUST, DATA, TIMING, COST), then the autopilot-fear strip and the punchline.
**Live cut:** none. Point at each card as you name it.

> We mined r/sales, r/coldemail and r/startups. Same four complaints, over and over. AI copy is, quote, "sooo generic." Contact data bounces. A static ICP tells you who could buy, not who cares now. And credits burn with no receipt. Buyers don't want more AI. They want AI they can verify.

Words: 50 · running total: 84

---

## S3 · Insight / solution · 0:35–0:50 (15s)

**On screen:** Slide 3, "Don't build a smarter black box. / Build a glass box." Black box vs power tool vs **glass box**, then the three pillars.
**Live cut:** none.

> So we didn't build a smarter black box. We built a glass box. Every claim is cited. Every send is approved by a human. Every credit is metered. Self-driving, but you hold the brakes and the wallet.

Words: 37 · running total: 121

---

## S4 · Live demo: one sentence in · 0:50–1:20 (30s)

**On screen:** Slide 4, "One sentence in. / A working pipeline out." (the 7-stage loop) for 2 seconds, then cut to the **LIVE tab**.
**Live cut (exact clicks):**
1. LIVE tab, **Mission Control**, with Ledgerly already loaded. Click **Launch Autopilot**. The app jumps to the **Agent War Room** on its own.
2. Let the stream run: the Planner posts "New mission … ① ICP inference … ⑦ your approval", then the Strategist starts reading the intake.
3. Point at the header pill **"Credits · Flexprice"** as it ticks down.

> Here's Ledgerly, an AP automation startup. One sentence, one teammate's background, and I hit Launch Autopilot. Eleven agents pick it up. The Planner splits the mission into seven stages. The Strategist infers the ICP, with a confidence score on every field. Scout searches the live web, and every account must cite a page it actually retrieved, or it's dropped. Watch the credit meter: every action is a Flexprice event.

Words: 69 · running total: 190

**If the demo breaks:** "Live web search takes a minute, so here's the run we launched before this talk." Switch to the SEEDED tab, open **Agent War Room** and scroll through the Planner, Scout and Reviewer messages.

---

## S5 · Knowledge graph + warm paths · 1:20–1:45 (25s)

**On screen:** Slide 5, "A live graph / that changes decisions." for 1 second, then cut to the **SEEDED tab**, **Knowledge Graph** (the dark 3D panel inside the paper UI).
**Live cut (exact clicks):**
1. Under "Multi-hop reasoning" (top right), click **Warm intro paths**.
2. Click the top result card. The path glows gold, particles flow along it and the camera flies to it.
3. Expand **Cypher** in the result panel. Optionally click **Competitor displacement** to show "X uses Bill.com".

> While that runs, here's a finished mission. This is the live knowledge graph: companies, buyers, competitors, signals, every account backed by a source URL. I ask for warm intro paths. The top path lights up: a short path from our founder's old employer to the buyer. Here's the Cypher. The graph doesn't just look pretty, it changes who we contact first.

Words: 61 · running total: 251

**If the demo breaks** (WebGL stutters or no paths come back): go back to slide 5 and say the same line over the screenshot. "Job reqs → evaluation" is the backup query.

---

## S6 · Trust layer: the Reviewer catches a lie · 1:45–2:10 (25s)

**On screen:** Slide 6, "If it can't cite it, / it can't say it." for 1 second, then the **SEEDED tab**, **HITL Review** (Review Terminal).
**Live cut (exact clicks):**
1. Click the first lead in the left list. A touch-1 email card shows the "★ Twin's pick" badge, source chips and "Reviewer: pass".
2. On that card, click **Inject lie** (the flask button next to Rewrite).
3. The fabricated sentence is struck through in red with "✗ unsupported: …", the Reviewer verdict flips to **revise**, and Buyer Twin reply odds fall to 40% of their previous value.

The injected lie is picked at random from three: a fake "$250M Series E", a fake headcount, or a fake layoff. The script works for all three.

> Now the trust layer. Here's a drafted email, with sources on every claim. Let me red-team it: Inject lie. Gravity slips in a fabricated fact. The Reviewer can't find a source, so it strikes it in red, and the Buyer Twin's reply odds drop. Sentinel scans links, PII and prompt injection. If it can't cite it, it can't say it.

Words: 60 · running total: 311

**If the demo breaks** (the Reviewer call is slow): go back to slide 6. "Here's the same moment from our dry run: struck in red, no source, odds down."

---

## S7 · Band war room · 2:10–2:25 (15s)

**On screen:** Slide 7, "11 agents. One war room. / You hold the veto." then the **second screen**: the Band room in app.band.ai, showing mirrored agent events from the LIVE run plus the Strategist's @mention "decision needed: Approve inferred ICP before discovery spends credits".
**Live cut (exact clicks):** In Band, reply **approve** to the @mention. Within about 5 seconds the LIVE War Room shows "✅ Approved … via Band by …" and discovery continues.

> All eleven agents coordinate in a real Band room. Every handoff is mirrored there, and when an agent needs a decision, it @mentions me. I reply approve, right here in Band, and the run continues.

Words: 35 · running total: 346

**If the demo breaks:** Band unreachable or the @mention never arrived. Show slide 7. In the LIVE **Agent War Room**, point at the header chip "Mirrored to Band room …", type **approve** in the command bar and press **Send**. The approval times out on its own after 2 minutes, so the run never blocks.

---

## S8 · Flexprice spend governor · 2:25–2:40 (15s)

**On screen:** Slide 8, "Every action is metered. / The wallet is the brake." Its gate card reads "402 · Credit limit reached: Outreach sent needs 2 credits, wallet has 0. Autopilot paused." Then cut to the **SEEDED tab**, **HITL Review**. The wallet was preset to 4 credits in pre-flight with **Simulate low balance**.
**Flow (exactly):** Simulate low balance (pre-flight) → **Approve all passing** → batch stops → **Top up 200 credits**.
**Live cut (exact clicks):**
1. Click **Approve all passing (n)**. Two sends go through (2 credits each), then the Governor stops the batch. The Agent Thinking feed shows the app's version of the slide 8 message: "Credit limit reached: Outreach sent needs 2 credits, wallet has 0. Batch stopped at 2/n." The header pill **Credits · Flexprice** turns red.
2. Click the **Credits · Flexprice** pill, which opens Spend Governor, then click **Top up 200 credits**.
3. If time allows, glance at the Usage event stream (Sync column = **flexprice**) or the Flexprice dashboard on the second screen.

> Sending is metered too. I approve everything that passed. Two go out, then the Flexprice governor pulls the brake: wallet empty, autopilot paused. I top up and the gate opens. Same events, live in Flexprice.

Words: 35 · running total: 381

**If the demo breaks** (the gate doesn't fire because the balance is too high): stay on slide 8 and point at the gate card. "Here's what you'd see: a 402, the autopilot pauses, you top up."

---

## S9 · Architecture & sponsor stack · 2:40–2:50 (10s)

**On screen:** Slide 9, "Real APIs / in the critical path." (architecture and sponsor tiles). Point at the core sponsor tiles in the order you name them: Flexprice, RocketRide, HotData, Moss, Teamily.
**Live cut:** none.

> Under the hood: Flexprice meters every action, RocketRide runs our signal pipeline, HotData is the agent warehouse, Moss powers search, and Teamily approves outreach via MCP.

Words: 26 · running total: 407

---

## S10 · Why now · ask · close · 2:50–3:00 (10s)

**On screen:** Slide 10, "The edge moved / from volume to verified." The hero returns as a dark media panel behind the closing line, with the links gravity-gtm.onrender.com and github.com/vnmoorthy/gravity-gtm.
**Live cut:** none. Slow down and pause after "Gravity."

> We want ten founder-led teams piloting this quarter, and your vote today. Gravity. Self-driving, but you hold the brakes and the wallet. Thank you.

Words: 24 · running total: **431**

---

## Timing summary

| Slide | Window | Seconds | Words | Live cut |
|---|---|---|---|---|
| S1 Title | 0:00–0:15 | 15 | 34 | none |
| S2 Problem | 0:15–0:35 | 20 | 50 | none |
| S3 Insight | 0:35–0:50 | 15 | 37 | none |
| S4 Demo flow | 0:50–1:20 | 30 | 69 | LIVE: Launch Autopilot → War Room |
| S5 Graph | 1:20–1:45 | 25 | 61 | SEEDED: Warm intro paths → path lights up |
| S6 Trust | 1:45–2:10 | 25 | 60 | SEEDED: Inject lie → struck in red |
| S7 Band | 2:10–2:25 | 15 | 35 | Band: reply "approve" |
| S8 Flexprice | 2:25–2:40 | 15 | 35 | SEEDED: Approve all passing → gate → Top up |
| S9 Architecture | 2:40–2:50 | 10 | 26 | none |
| S10 Close | 2:50–3:00 | 10 | 24 | none |
| **Total** | | **180 (3:00)** | **431** | |

## Lines to keep ready for Q&A (from the red-team verdict)

- **"Is the data real?"** "Every account cites a page Claude actually retrieved, or the citation gate drops it. MX checks are real DNS lookups. The only seeded input is your own team network."
- **"Isn't a 3D graph eye candy?"** "Click a warm path and the Writer drafts the intro ask. The graph decides who we contact first."
- **"Why not Clay?"** "Clay is a power tool that needs a GTM engineer. Gravity is an autopilot you can audit, with metered credits instead of opaque markups."
- **"Moat?"** "The graph compounds. Every approve, edit, reject and reply is labeled data tied to evidence."
- **"Simulated replies?"** "Buyer Twin replies are simulations and are labelled as such in the audit log. Real replies come in through `/api/webhooks/reply`."
