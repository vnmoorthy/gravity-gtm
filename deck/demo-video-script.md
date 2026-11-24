# Gravity: product demo video script (2:43)

Live demo: https://gravity-gtm.onrender.com · Code: https://github.com/vnmoorthy/gravity-gtm

**Goal:** a 2:43 screen-recorded demo with founder face-cam bookends. It covers every required item:

| Hackathon requirement | Where it is proven |
|---|---|
| Product intake | Shot 1 (0:10–0:22), Mission Control → Launch Autopilot |
| Automated graph matching | Shot 5 (1:00–1:20), Knowledge Graph: `matched_to` edges and the Warm intro paths / Job reqs → evaluation / Competitor displacement queries |
| Message composition | Shot 6 (1:20–1:40), HITL Review: 3-touch sequence, A/B on touch 1, cited signal |
| HITL review | Shots 6–7 (1:20–1:52): Reviewer, Buyer Twin and Sentinel, then Inject lie, Rewrite and Approve & send |
| Dashboard sync | Shot 8 (1:52–2:10): Pipeline kanban, Timeline, Audit log and Analytics update live over SSE, Nexla push. Shot 9: Flexprice events sync |

App labels below match the UI exactly. Sidebar nav: Mission Control, ICP Engine, Knowledge Graph, Accounts & Buyers, Competitors, HITL Review, Pipeline, Analytics, Agent War Room, Spend Governor.

---

## Shot list

| # | Time | Segment | Screen | Requirement |
|---|---|---|---|---|
| A | 0:00–0:10 | **FOUNDER FACE-CAM: intro** | Face-cam over the Blender hero (`assets/hero-raw.png`) | |
| 1 | 0:10–0:22 | Intake | Mission Control | Product intake |
| 2 | 0:22–0:36 | Agents spin up | Agent War Room | (Band, Flexprice) |
| 3 | 0:36–0:48 | ICP with confidence | ICP Engine | |
| 4 | 0:48–1:00 | Cited discovery + enrichment | Accounts & Buyers | |
| 5 | 1:00–1:20 | Graph matching + multi-hop | Knowledge Graph | Automated graph matching |
| 6 | 1:20–1:40 | Compose + review + red-team | HITL Review | Message composition, HITL review |
| 7 | 1:40–1:52 | Human approval | HITL Review | HITL review |
| 8 | 1:52–2:10 | Pipeline + analytics | Pipeline → Analytics | Dashboard sync |
| 9 | 2:10–2:25 | Credit gate | Spend Governor ↔ HITL Review | (Flexprice) |
| 10 | 2:25–2:33 | Sponsors b-roll | Band room, GitHub Actions, Render | (Band, Snyk, Render) |
| B | 2:33–2:43 | **FOUNDER FACE-CAM: outro** + end card | Face-cam, then hero end card | |

Voiceover total: 328 words (24 + 20 + 28 + 19 + 26 + 49 + 42 + 22 + 34 + 26 + 18 + 20). That averages about 120 wpm over 2:43, which leaves air for the clicks.

---

## Shot-by-shot

### A · 0:00–0:10 · FOUNDER FACE-CAM: intro (record yourself)
- **Frame:** you, chest-up, on the left two thirds against a light, plain wall to match the paper UI. Right third: `assets/hero-raw.png` (the Blender render) as a dark rounded media panel on warm paper (#f5f4f0), slowly zooming in (Ken Burns, 100% → 106%). Lower third in black ink: "Gravity · the self-driving GTM engine".
- **Say (24 words):**
  > I'm the founder of Gravity. AI SDRs are black boxes. Gravity is a glass box: one sentence in, booked meetings out, every send approved.
- **Tip:** look at the lens, not the screen. Smile on "glass box".

### 1 · 0:10–0:22 · Product intake (Mission Control)
- **Screen action:**
  1. Start on **Mission Control**, with the two-tone header "The Revenue Engine / from one sentence to booked meetings." visible.
  2. Click the sample button **"Ledgerly · AP automation"**. Name, description, wins, pricing and constraints fill in.
  3. Click **"+ Add reference wins, pricing, constraints & team network (powers warm paths)"**. Hold 1s on the teammate row: Maya Patel · Founder & CEO · Flexport, Brex · Stanford.
  4. Hover the footer line **"Live: claude-opus-5-5 + web search with citations · N credits available"**.
  5. Click **Launch Autopilot**. The toast "Mission launched — agents are spinning up" appears and the app jumps to the War Room.
- **VO (20 words):**
  > I describe the product in one plain sentence, add our founder's background to power warm paths, and hit Launch Autopilot.
- **Callout:** `1 · Product intake: plain language in, no forms to configure`

### 2 · 0:22–0:36 · Agents spin up (Agent War Room)
- **Screen action:**
  1. The **Agent War Room** opens on its own. Let the stream run: the Planner posts "New mission … ① ICP inference ② discovery + competitive map … ⑦ your approval. @Strategist you're up."
  2. Pan the cursor to the header chip **"Mirrored to Band room … · N events"**.
  3. Move to the left roster (Planner, Strategist, Scout, Analyst, Cartographer, Enricher, Writer, Reviewer, Buyer Twin, Sentinel, Governor) and the **Session telemetry** card (tokens, LLM calls, cost).
  4. Move to the top-right **Credits · Flexprice** pill as the number drops.
- **VO (28 words):**
  > Eleven agents take it from here, in one war room mirrored live into Band. The Planner sets seven stages, and every action is metered: watch the credits tick.
- **Callout:** `11 agents · @mention handoffs · mirrored to Band · metered by Flexprice`
- **Edit:** jump-cut the waits. Keep only the frames where a new message lands.

### 3 · 0:36–0:48 · ICP with confidence (ICP Engine)
- **Screen action:**
  1. Click **ICP Engine** in the sidebar.
  2. Hover an industry card (NAICS code + confidence bar), the headcount band, and a persona with its buying role, trigger events and negative signals.
  3. Scroll to the expansion segments and click **Accept** on the first one. The note "Merged into ICP; swept on next discovery" appears.
- **VO (19 words):**
  > Claude infers the ICP: industries, personas, triggers, each with a confidence score. It suggests expansion segments; I accept one.
- **Callout:** `Field-level confidence 0.00–1.00 · Accept / Adjust / Dismiss`

### 4 · 0:48–1:00 · Cited discovery + enrichment (Accounts & Buyers)
- **Screen action:**
  1. Click **Accounts & Buyers**. Hover the **Citations** column (source chips) and the **Score** / tier.
  2. Click the **Filtered** tab. Hold on a row that reads "⛔ Citation gate: no claim traceable to a retrieved source" (or "Negative signal: …").
  3. Back on **All qualified**, click an account row to expand its buyers. Hover the email status, confidence and MX provider (for example "MX → … (Google Workspace)").
- **VO (26 words):**
  > Scout searches the live web. No retrieved source, no account: the citation gate drops it. Every buyer email is checked against real DNS and MX records.
- **Callout:** `Citation gate · DNS A + MX → pattern → Hunter → LinkedIn`

### 5 · 1:00–1:20 · Automated graph matching (Knowledge Graph)
- **Screen action:**
  1. Click **Knowledge Graph**. This is the one dark panel in the paper UI and the visual pop of the video. Let the bloom-lit 3D graph settle for 1s, with the legend (Company, Person, Product, Competitor, Signal) at top left. The amber Product node sits at the centre with `matched_to` edges radiating to every matched account.
  2. Under **Multi-hop reasoning**, click **Warm intro paths**, then click the top result. The path glows gold, particles flow and the camera flies to it.
  3. Expand **Cypher** in the result panel and hold 1.5s.
  4. Click **Job reqs → evaluation** (shows "% eval likelihood"), then **Competitor displacement** ("X uses Bill.com").
  5. Click a company node. When the detail card opens, hover **Open account**.
- **VO (49 words):**
  > It all lands in a live knowledge graph. Accounts are matched to the product automatically, and Gravity reasons across hops: a warm intro path from our founder's old company to the buyer, job reqs that signal an open evaluation, and accounts we can win from the incumbent. Cypher included.
- **Callout:** `Automated graph matching · warm paths · hiring → evaluation · displacement`

### 6 · 1:20–1:40 · Message composition + review (HITL Review)
- **Screen action:**
  1. Click **HITL Review** (Review Terminal). Click the top lead in the left list.
  2. Scroll the sequence: touch 1 email **Variant A** and **Variant B** (one with "★ Twin's pick"), the LinkedIn note and the follow-up. Hover a source chip under the Reviewer.
  3. Hover the three verdict columns: **Reviewer: pass**, **Buyer Twin: NN% reply odds** with the objection and simulated reply, and the Sentinel result.
  4. Click **Inject lie** (flask button). The fabricated sentence is struck through in red, "✗ unsupported: …" appears, the verdict becomes **revise** and the reply odds drop.
  5. In **"AI rewrite: e.g. more casual"**, type `more casual` and click **Rewrite**.
- **VO (42 words):**
  > The Writer drafts a three-touch sequence per buyer, A/B on the first email, built on a cited signal. The Reviewer fact-checks every sentence, the Buyer Twin predicts reply odds, Sentinel scans links and PII. Now I inject a lie. Struck in red.
- **Callout:** `If it can't cite it, it can't say it`
- **Note:** the lie is random: a fake "$250M Series E", a fake headcount, or a fake layoff. The VO works for all three. If you want the Series E on camera, re-click until it appears, then cut.

### 7 · 1:40–1:52 · Human approval (HITL Review)
- **Screen action:**
  1. On a clean "★ Twin's pick" email, click **Approve & send**. The toast reads "Sent via resend", or "Approved · dispatched (simulated)" without a mail key.
  2. Hover the card footer **"Delivery: ✓ resend → you@… (sandbox)"**. Also hover **Edit** and **Reject** to show the options.
- **VO (22 words):**
  > Nothing sends without me. I approve the Twin's pick. Sandbox mode routes it to my own inbox, never to a real prospect.
- **Callout:** `Approve & send · Edit · AI rewrite · Reject · sandbox dispatch by default`

### 8 · 1:52–2:10 · Dashboard sync (Pipeline → Analytics)
- **Screen action:**
  1. Click **Pipeline**. The lead you just approved is in **Contacted** with the orange AI badge (rep moves show a blue badge).
  2. Click **Simulate replies (Buyer Twin)**. The toast reads "Buyer Twin: x/y replied (simulated)" and cards slide into **Replied** with the quoted reply.
  3. Drag a Replied card onto **Meeting Booked**. Its badge flips to rep (blue). This also pushes `meeting_booked` to Nexla.
  4. Click that card. The **Timeline** drawer shows matched → contacted → replied → meeting with AI/Rep markers. Close it.
  5. Scroll to the **Audit log** for 1s.
  6. Click **Analytics** and hover the Funnel, Conversion by industry, A/B split test · touch 1 (predicted vs observed) and Attribution: AI vs rep actions.
- **VO (34 words):**
  > Approved sends land on the pipeline. Replies here are simulated by the Buyer Twin, and labelled. I move one to Meeting Booked, which streams to Nexla. Analytics, attribution and the audit log update live.
- **Callout:** `Dashboard sync: kanban · timeline · audit log · analytics · Nexla → CRM`
- **Optional 1s insert:** Accounts & Buyers, click **Push to Nexla**, toast "Streamed N leads to Nexla".

### 9 · 2:10–2:25 · Credit gate (Spend Governor)
- **Screen action:**
  1. Click **Spend Governor**. Hover Wallet balance, the **Flexprice connection** card (customer, wallet, "synced events: N") and **Meters · credits per unit**.
  2. Click **Simulate low balance**. The wallet shows 4 credits in red.
  3. Click **HITL Review**, then **Approve all passing (n)**. Two sends go out, then the batch stops and the Agent Thinking feed shows the Governor: "Credit limit reached: Outreach sent needs 2 credits, wallet has 0. Batch stopped at 2/n." (Slide 8 shows the same moment as "402 · Credit limit reached: Outreach sent needs 2 credits, wallet has 0. Autopilot paused.")
  4. Click the red **Credits · Flexprice** pill, then **Top up 200 credits**.
  5. Hold on the **Usage event stream** with the Sync column reading **flexprice**.
  6. 2s insert: the Flexprice dashboard showing the same `outreach_sent` events.
- **VO (26 words):**
  > Every billable action is a Flexprice usage event. When the wallet runs dry, the governor stops the batch mid-send. I top up, and we're moving again.
- **Callout:** `7 meters · credit gate (402) · wallet top-up · synced to Flexprice`

### 10 · 2:25–2:33 · Sponsors b-roll (Band, Snyk, Render)
- **Screen action** (three quick inserts, about 2.5s each):
  1. Band room in app.band.ai: Gravity's mirrored agent events and a Strategist @mention "decision needed".
  2. GitHub, https://github.com/vnmoorthy/gravity-gtm/actions → the **snyk** workflow run: "Snyk SCA (open-source dependencies)" and "Snyk Code (SAST)" steps green.
  3. Render dashboard: service **gravity-gtm**, deploy status "Live", blueprint `render.yaml` from https://github.com/vnmoorthy/gravity-gtm. The browser URL bar shows https://gravity-gtm.onrender.com.
- **VO (18 words):**
  > Every agent step is in our Band room. Snyk scans every push, and it all runs on Render.
- **Callout:** `Band · Snyk SCA + SAST · Render blueprint deploy`

### B · 2:33–2:43 · FOUNDER FACE-CAM: outro (record yourself)
- **Frame:** same setup as the intro. On the last 3s, cut to the end card: paper background, the hero as a dark rounded media panel, with the live URL, the repo URL and "HackwithBay 4.0" in black ink.
- **Say (20 words):**
  > That's Gravity. Every claim cited, every send approved, every credit metered. Self-driving, but you hold the brakes and the wallet.
- **End card text:** "Gravity · The Revenue Engine, from one sentence to booked meetings" · https://gravity-gtm.onrender.com · https://github.com/vnmoorthy/gravity-gtm · "Built with Claude · Band · Flexprice · Render · Snyk · Nexla"

---

## How sponsors appear on screen

| Sponsor | Timestamp(s) | What is visible |
|---|---|---|
| **Claude** (claude-opus-5-5) | 0:18, 0:36–0:48, 0:48–1:00, 1:20–1:40 | Mission Control footer "Live: claude-opus-5-5 + web search with citations". ICP Engine confidence scores. Citation chips in Accounts & Buyers. War Room Session telemetry (tokens, cost per agent). Writer, Reviewer and Buyer Twin output in HITL Review. Green "Claude" dot in the sidebar status list throughout. |
| **Band** | 0:22–0:36, 2:25–2:28 | War Room header chip "Mirrored to Band room … · N events" and the 11-agent roster with @mention handoffs. Then the real Band room in app.band.ai showing the mirrored events and the @mention approval request. |
| **Flexprice** | 0:30–0:36, 2:10–2:25 | Header pill **Credits · Flexprice** ticking down. Spend Governor: Flexprice connection card (customer, wallet, synced events), meters, the credit gate stopping a batch, Top up 200 credits, Usage event stream Sync = **flexprice**. Plus the Flexprice dashboard insert. |
| **Render** | whole video, plus 2:30–2:33, end card | The browser URL bar shows https://gravity-gtm.onrender.com in every app shot. b-roll of the Render dashboard (service `gravity-gtm`, status Live, blueprint from `render.yaml` in https://github.com/vnmoorthy/gravity-gtm). The URL is also on the end card. |
| **Snyk** | whole video (sidebar), 2:28–2:30 | "Snyk CI" dot in the sidebar status list. b-roll of the GitHub Actions **snyk** workflow at https://github.com/vnmoorthy/gravity-gtm/actions (SCA + Code SAST, SARIF upload). |
| **Nexla** | 1:52–2:10 | Dragging a card to Meeting Booked pushes `meeting_booked` to the Nexla webhook. Optional insert: **Push to Nexla** toast "Streamed N leads to Nexla". "Nexla" dot in the sidebar status list. |
| **Blender** | 0:00–0:10, 2:40–2:43 | The dark media panel beside the face-cam and on the end card is the Blender-rendered hero (`assets/hero-raw.png`, `assets/hero.png`, rendered by `assets/blender/gravity_hero.py`). |

---

## Recording tips

- **Theme:** the app uses a light "paper" theme (warm paper, white cards, black ink, cobalt accent). It reads well on projectors and compresses cleanly, so expose for white and avoid crushing it to grey. The dark 3D Knowledge Graph is the visual pop. Linger there and zoom in.
- **Capture:** 1920×1080, browser at 100% zoom, Chrome in a clean profile (no extensions bar). Hide bookmarks with Cmd+Shift+B. Full-screen the window with Ctrl+Cmd+F. Record at 60 fps with OBS or Screen Studio.
- **Distractions:** turn on macOS Do Not Disturb and quit Slack, Mail and Messages. Hide the menu-bar clock if you plan to cut aggressively.
- **Warm-up run first:** run one full Ledgerly mission before recording. It warms DNS and MX caches and lets you rehearse the clicks. For the real take, launch a fresh mission (Launch Autopilot resets the workspace) and keep the warm-up as a fallback source of footage.
- **Dead air:** agents thinking and web search can take tens of seconds. Record continuously and jump-cut in the edit, holding only the frames where a new message, node or card appears. Never speed up the cursor visibly. Cut instead.
- **Voice:** record the VO separately (quiet room, USB or lav mic, 48 kHz) and lay it over the edited picture. Read each shot's VO against its timestamp budget.
- **Face-cam:** eye-level camera, window light in front of you, plain background, 1080p. Record 3 takes of each 10s segment.
- **Cursor:** turn on cursor highlight and click rings (Screen Studio does this automatically, or use the macOS accessibility cursor size 1.5). Move deliberately and pause on each element for about 0.5s before clicking.
- **Safety:** keep `DISPATCH_MODE=sandbox` with `TEST_INBOX` set to your own inbox. Never open `.env`, the Render environment tab, the Flexprice API keys page, or the Band agent key screen while recording. Blur any email address that isn't yours.
- **Credit gate:** click **Simulate low balance** only in shot 9, and only after the shot 7 approval, so the earlier sends succeed.
- **Band:** keep the Band room open in a second window during the take, so the shot 10 insert shows events from the same run.

## Editing checklist

- [ ] The total runs 2:40–2:45, with face-cam intro and outro at about 10s each.
- [ ] All five required items are labelled with a callout: Product intake, Automated graph matching, Message composition, HITL review, Dashboard sync.
- [ ] Every sponsor appears on screen at least once (see the table above), and Band and Flexprice each get at least 10s.
- [ ] The Inject lie strike-through is legible. Zoom to 130% on the struck sentence for 1.5s.
- [ ] The simulated replies are visibly labelled "(simulated)" in the toast. Do not cut that out.
- [ ] No API keys, `.env`, or real prospect emails appear in any frame.
- [ ] Captions are burned in (many judges watch muted), in Inter, black ink on a white pill with a hairline border (matching the paper UI), bottom-centre. Over the dark graph panel, switch to white on a 60% black pill.
- [ ] Music bed at -24 LUFS under the VO, ducked during face-cam. Fade out over the end card.
- [ ] The end card holds for 3s with both URLs (live demo and repo) readable.
- [ ] No personal full names appear in VO, captions or lower thirds. Use "the founder" or the handle vnmoorthy. The app's fictional sample personas are fine.

## Export settings

- H.264 (High profile) MP4, 1920×1080, 30 fps (or 60 if recorded at 60), VBR 12–16 Mbps, AAC 320 kbps 48 kHz stereo. Loudness: -14 LUFS integrated, -1 dBTP.
- File name: `Gravity-demo-HackwithBay4.mp4`. Also export a 1080×1080 cut of shots 5–6 for social.
- Upload unlisted to YouTube or Loom as well, and keep a local copy on the presenting laptop as the stage backup.
