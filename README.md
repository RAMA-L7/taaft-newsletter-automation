# TAAFT Newsletter Empire

> A collection of Google Apps Script automations that turn messy newsletter inboxes into structured data and beautiful weekly digests — all running free inside Google's infrastructure.

[![Platform](https://img.shields.io/badge/platform-Google%20Apps%20Script-blue)](https://script.google.com)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)
[![Projects](https://img.shields.io/badge/projects-3_—_TAAFT_+_AI_This_Week_+_Competitor_Watch-informational)](#projects)

---

## 📖 What this repo is

This isn't one script — it's a **reusable engine**:

```
SOURCE (email / RSS / web) → PARSE (heuristics) → STRUCTURED STORE (sheet/DB) → DIGEST (HTML email)
```

Built once for TAAFT, then cloned and adapted for new products at zero cost. Each project lives in its own folder with one-click deploy instructions.

---

## 📁 Folder structure

```
.
├── taaft/                           # Project 1 — TAAFT Newsletter Automation (LIVE)
│   └── COMPLETE_v5.js               # Single-file: parse TAAFT daily+weekly → sheets → HTML report
│
├── ai-this-week/                    # Project 2 — AI This Week Digest (LIVE, validating)
│   ├── collector/                   # 7-file modular collector (one page per source)
│   │   ├── CONFIG.js                #   Spreadsheet ID + window (ATW_DAYS_BACK)
│   │   ├── collect-taaft.js         #   TAAFT
│   │   ├── collect-tldr.js          #   TLDR (all 8 editions) — redirect resolver + Edition column
│   │   ├── collect-rundown.js       #   The Rundown AI + Tech
│   │   ├── collect-bensbites.js     #   Ben's Bites (Substack) — text-section parser
│   │   ├── utils.js                 #   Shared engine (dedupe, junk filters, URL cleaning)
│   │   └── main.js                  #   Dispatcher + setup + daily trigger
│   ├── composer/
│   │   └── composeIssue.js          #   Draft generator: auto-picks 10 recent + dashboard
│   │                                #   Supports manual Rank overrides + auto-send triggers
│   ├── landing/
│   │   └── index.html               #   Deploy-ready landing page
│   └── docs/
│       ├── 01-SOURCES.md            #   Which newsletters to subscribe
│       ├── 02-PRODUCT.md            #   Product definition, pricing, launch plan
│       └── 03-PAYMENTS-SETUP.md     #   Gumroad / Lemon Squeezy setup (₹0/mo)
│
├── competitor-watch/                # Project 3 — Competitor Watch / RivalRadar (scaffolded)
│   ├── cwCollector.js               #   Multi-client collector + weekly briefing sender
│   └── 04-OUTREACH.md               #   Design-partner outreach pitches
│
└── docs/
    ├── PROJECT_CONTEXT.md           #   Master handoff — history, decisions, roadmap
    └── SaaS_IDEAS.md                #   8 SaaS ideas ranked + zero-cost build analysis
```

---

## 🚀 Projects

### 1. TAAFT Newsletter Automation — `taaft/COMPLETE_v5.js`

Parses **There's An AI For That** emails (daily issues + weekly digests), extracts every section into a Google Sheet, and emails a styled HTML weekly report every Sunday.

| Trigger | Function | Behavior |
|---|---|---|
| Daily 8am | `processLatestTAAFT` | Silent — parses new emails into sheets |
| Sunday 9am | `sendWeeklyReport` | Sends HTML report (emojis via entities, clickable top items, sheet button) |

**Helpers:** `backfillAllTAAFT` (import 100 old emails), `previewReportEmail` (test without sheet writes), `cleanMarkdownInSheet` (legacy cleanup).

→ **Setup:** paste `taaft/COMPLETE_v5.js` into a new Apps Script project → set `SPREADSHEET_ID` → run `setupSheetHeaders` → `createTriggers`.

<details>
<summary>What gets extracted</summary>

- Prompts (Day / Week), AI Finds, Breaking News, Coming in Hot, Notable AIs, Open Source Finds, Interesting AI (featured product + category/country guess)

</details>

---

### 2. AI This Week — `ai-this-week/`

A weekly digest that **cross-references 5 AI newsletters** (TLDR, The Rundown, Ben's Bites, TAAFT) and ranks what mattered. Built as a modular, per-source collector (one Apps Script page per company) so each source is tuned independently.

**Key design decisions:**

- **One tab per source** (`TLDR`, `The Rundown AI`, `Ben's Bites`, `TAAFT`) + `Edition` column for TLDR (AI/Tech/Dev/IT/InfoSec/...)
- **TLDR plain bodies contain no headlines** — resolver follows `links.tldrnewsletter.com` redirects and derives titles from destination URL slugs
- **Ben's Bites (Substack)** wraps links in `substack.com/redirect` and strips headlines from plain text — text-section parser + redirect resolver recovers them
- **Junk filtering** is host + title based (`SPONSOR_DOMAINS`, `JUNK_HOSTS`, `FRAGMENT_WORDS`, sponsor text, tracking URLs, social links)
- **Dedupe** is per-tab via `MsgID|Title|URL` with header-aware column lookup

**Collector — 30-day backfill tested: 413 items (TLDR 331 + Rundown 57 + Ben's Bites 24)**

```
Daily 7am: collectAllSources  →  8-day window, deduped, per-tab
On demand: composeIssue        →  auto-picks 10 most recent + dashboard
                                Put any value in Rank (x/✓/1) to override picks
Auto:      createWeeklyAutoTrigger (Sun 9am) or create3DayAutoTrigger (every 3d)
```

→ **Setup:** new Google Sheet → Extensions → Apps Script → create 7 pages (`CONFIG`, `collect-taaft`, `collect-tldr`, `collect-rundown`, `collect-bensbites`, `utils`, `main`) → paste → set `ATW_SPREADSHEET_ID` + `ATW_DAYS_BACK = 8` → `setupATWSheet` → `createTriggersATW`.

**Composer — `composer/composeIssue.js`:**

- Dashboard (last 7 days): per-source counts + TLDR per-edition breakdown
- 10 stories, numbered, linked, with source/edition meta
- `Open Google Sheet →` button
- Draft mode (`[DRAFT]`) vs auto-send mode (final) — `sendAutoDigest` is trigger-called

---

### 3. Competitor Watch (RivalRadar) — `competitor-watch/`

B2B SaaS: track competitors' newsletters/changelogs for clients, deliver a weekly **"what your rivals shipped"** briefing. Reuses the same collector engine in multi-client mode (`Clients` config tab → per-sender routing → per-client branded briefings on Fridays).

- **Status:** scaffolded (`cwCollector.js` + outreach kit `04-OUTREACH.md`), awaiting first design partner
- **Pricing target:** $99–499/mo
- **Outreach:** 3 copy-paste pitches (warm LinkedIn, cold, community post) + onboarding checklist

→ **Setup:** same pattern — new sheet → paste `cwCollector.js` → `setupCW` → fill `Clients` tab → `createTriggersCW`.

---

## 🛠️ General setup

All projects need only:

- A Google account + Google Sheet (5 tabs, created by `setup*` functions)
- [script.google.com](https://script.google.com) → New project → paste → set `SPREADSHEET_ID` → run setup → create triggers → approve Gmail/Sheets permissions

No servers, API keys, or billing. Everything runs free on Google's quota (Apps Script: 6 min/exec, 90 min/day, 100 emails/day via Gmail).

---

## 📚 Docs

| File | What |
|---|---|
| `docs/PROJECT_CONTEXT.md` | Full history, technical lessons (emoji-safe strings, curly-apostrophe normalization, heading-marker parsing, dedupe), environment, roadmap — the handoff doc for any AI/human |
| `docs/SaaS_IDEAS.md` | 8 SaaS ideas ranked by revenue potential + realistic starting cost (🟢 zero / 🟡 near-zero / 🔴 funded) |

---

## 🐞 Troubleshooting

| Symptom | Fix |
|---|---|
| Emojis as `������` | Old file — current code uses HTML entities in body + plain-text subjects |
| `TypeError: Cannot read properties of undefined (reading 'has')` | Collector pages are stale — repaste all 7 `ai-this-week/collector/` pages |
| TLDR tab empty after clear | `ATW_DAYS_BACK` was `3`; TLDR sends weekly verticals — set to `8` for backfill |
| Ben's Bites empty | Check `BB_SENDERS = ['bensbites@substack.com']` is set; widen window to `8` |
| Sections missing after TAAFT format change | Check Execution log for `⚠️ ... not found`; update marker strings in relevant `extract*` |

---

## 📄 License

MIT — use it, fork it, ship it.
