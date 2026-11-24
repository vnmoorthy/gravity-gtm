# Gravity: 10-minute live demo runbook

**URL:** https://gravity-gtm.onrender.com (open it 2 minutes early; Render's free tier cold-starts in about 40 s)
**Local fallback:** `npm start` → http://localhost:8787
**Reset between runs:** run `curl -X POST <url>/api/reset`, or launch a new mission (it resets automatically).

> The top-left badge reads **● LIVE** when `ANTHROPIC_API_KEY` is set (real web discovery with real citations) and **◐ DEMO DATA** otherwise (fictional `.example` companies). Always demo in LIVE mode for judges if you have the key.

---

### 0:00–0:45 · Hook (Mission Control)
- **Say:** "Founders run GTM across five disconnected tools, and AI SDRs made it worse: hallucinated personalization, bounces, spam. Gravity is a *glass-box* GTM engine. Every claim is cited, every contact verified, every send approved, every credit metered."
- **Click:** the **Ledgerly · AP automation** sample chip. Expand **+ Add reference wins…** to show the team network (Maya Patel · ex-Flexport · Stanford).
- **Say:** "That one network line is going to power warm intros later."
- **Click:** **Launch Autopilot**. The app jumps to the War Room.

### 0:45–2:15 · Agent War Room (Band)
- Watch the Planner post the 7-milestone plan and @mention the Strategist. Then Scout and Analyst run in parallel, followed by Cartographer, Enricher and Writer, with Reviewer, Buyer Twin and Sentinel at the end.
- **Point at:** the per-agent telemetry on the left (tokens, searches, $), and the header chip "Mirrored to Band room…" when Band is keyed.
- **Say:** "Eleven specialised agents coordinate in a single shared stream via @mentions, mirrored into a real Band room. A human can approve or reject from Band itself."
- **Type in the command bar:** `@Scout find 3 more accounts` → Enter. The Scout acknowledges and starts a sweep.

### 2:15–3:30 · ICP Engine
- **Click:** **ICP Engine**. Show the NAICS codes, the size band, personas with buying role, trigger events and negative signals. Every field has a confidence bar.
- **Click:** **Accept** on one expansion segment, then **Adjust** on another (rename it).
- **Say:** "It infers, you decide. Accepted segments are swept on the next discovery run."

### 3:30–4:45 · Accounts & Buyers (citation gate + enrichment)
- **Click:** **Accounts & Buyers**. Show the Score ring + Tier, signal chips, "N verified" citations and the buyer enrichment status.
- **Expand the top row.** Show the signals with source chips (click one to open the real article in LIVE mode), then the enrichment waterfall: domain → MX → pattern → Hunter → LinkedIn.
- **Click the "Filtered" tab.** "These were dropped by the citation gate or a negative signal. No source, no claim."
- **Click:** **Signal radar**. Fresh "new · hiring" chips appear and scores re-rank.

### 4:45–6:00 · Knowledge Graph (wow moment #1)
- **Click:** **Knowledge Graph**. Rotate the 3D graph.
- **Click:** **Warm intro paths**, then the first result. The path lights up, particles flow along it, and the camera flies in: *Maya Patel → Flexport → Priya Raman (CFO, Northwind)*.
- **Click:** **Competitor displacement** → "Bluepeak uses Bill.com and is evaluating alternatives ahead of renewal."
- **Say:** "Multi-hop queries a relational CRM can't answer. Here's the Cypher; it mirrors to Neo4j."

### 6:00–7:45 · HITL Review Terminal (wow moment #2)
- **Click:** **HITL Review**. Show variants A and B side by side, the ★ Twin's pick, Reviewer verdict + cited sources, Buyer Twin reply odds and objection, and the Sentinel scan.
- **Click:** **Inject lie** on variant A. A fabricated "$250M Series E" sentence is **struck through in red**, the verdict flips to *revise*, and the reply odds collapse.
- **Click:** **Edit**, delete the lie, and **Save edit**. It's re-scanned and clean again.
- **Type** "more casual" in AI rewrite → **Rewrite**.
- **Click:** **Approve & send** on the best variant, then **Approve all passing**.
- **Say:** "Nothing transmits without a human. Sandbox mode routes to a test inbox, so a demo never emails a real prospect."

### 7:45–8:45 · Pipeline + Analytics
- **Click:** **Pipeline**. Contacted cards show the **AI** badge.
- **Click:** **Simulate replies (Buyer Twin)**. Cards move to Replied with the twin's reply text.
- **Drag** one card to **Meeting Booked**. It flips to the **Rep** badge. Open the card to show the timeline; scroll to the audit log.
- **Click:** **Analytics**. Show the funnel, conversion by industry/tier, A/B predicted vs observed, AI vs Rep donut and **cost per meeting**.

### 8:45–9:40 · Spend Governor (Flexprice) (wow moment #3)
- **Click:** **Spend Governor**. Show the wallet, the meters and the usage event stream (badge `flexprice` when keyed).
- **Click:** **Simulate low balance**. Then go to Accounts → **Enrich pending**, or approve a message. You get a **402 toast**, and the Governor posts "⛔ Credit gate hit… pausing the high-cost pipeline" in the feed.
- **Click:** **Top up 200 credits**. The pipelines resume.
- **Say:** "Usage-based pricing that maps cost per lead straight to the billing ledger."

### 9:40–10:00 · Close
- **Say:** "One sentence in, cited accounts and approved outreach out. Self-driving, but you hold the brakes and the wallet. Open source, deployed on Render, Snyk-scanned in CI, data streamed out through Nexla."

---

## Pre-flight checklist
- [ ] `ANTHROPIC_API_KEY` set in Render → Environment (badge shows ● LIVE)
- [ ] `FLEXPRICE_API_KEY` set (Spend Governor shows "Streaming usage events to Flexprice")
- [ ] `BAND_API_KEY` set (War Room header shows "Mirrored to Band room")
- [ ] `RESEND_API_KEY` + `TEST_INBOX` = your own email, so approved sends land in your inbox live
- [ ] Open the URL 2 minutes before you present (cold start)
- [ ] Browser zoom 90% on a 1440p screen; hide bookmarks bar
- [ ] Live-mode discovery takes ~60–120 s. Narrate the War Room while it runs, or pre-run one mission and launch a second live during the talk.
