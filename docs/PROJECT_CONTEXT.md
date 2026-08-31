# PROJECT CONTEXT — AI Handoff Document

> **Purpose of this file:** Any AI model (or human) opening this folder should be able to
> understand our project history, current status, chosen ideas, and exactly how to proceed —
> without asking us anything. Update this file whenever status changes.
>
> **Last updated:** 2026-08-24

---

## 1. WHO WE ARE & WHAT WE'RE DOING

We are building **SaaS products** that generate revenue. Our proven core engine is:

```
SOURCE (email/RSS/web) → PARSE (heuristics) → STRUCTURED STORE (sheet/DB) → DIGEST (HTML email/report)
```

This pattern was built and battle-tested as a working automation (see §2).
Our strategy: reuse/extend this engine into monetizable products, starting at ZERO cost.

---

## 2. CURRENT STATUS — What exists TODAY ✅

### Project: TAAFT Newsletter Automation (COMPLETE, live, working)

| Item | Detail |
|---|---|
| What it does | Parses "There's An AI For That" newsletter emails (daily + weekly digest formats), saves every section to Google Sheets, emails a styled HTML weekly report every Sunday |
| Where it runs | Google Apps Script (single file, ~900 lines), triggers: daily 8am parse + Sunday 9am report |
| Local code | `../../COMPLETE_v5.js` (the only file needed — v5 supersedes older versions) |
| GitHub | https://github.com/RAMA-L7/taaft-newsletter-automation (public, sanitized: spreadsheet ID replaced with `YOUR_SPREADSHEET_ID` placeholder) |
| Docs | Full README in the repo (setup, parsing internals, troubleshooting) |
| Status | **LIVE & TESTED.** User receives weekly reports correctly. No pending work. |

### Technical lessons already learned (DO NOT re-learn these)

1. **Emoji corruption:** Emojis pasted into Apps Script from Windows clipboard get mangled (`������`).
   → Solution used: HTML entities (`&#128202;`) for HTML bodies, `\u{...}` escapes for strings,
   plain-text subject lines (Gmail mangles emoji in subjects sent via Apps Script regardless).
2. **Curly vs straight apostrophes:** TAAFT's mailer alternates `’` and `'`. Always normalize
   (`plain.replace(/[\u2019\u2018]/g, "'")`) before matching heading markers.
3. **Parsing approach:** Find heading text marker → cut section at next major heading
   (`findMarker`) → grab `\p{Emoji_Presentation}`-prefixed lines → split name/description via
   markdown-bold-link pattern OR verb heuristic (`SECTION_VERBS` array: "X assists/runs/builds…").
4. **Dedupe:** Store processed Gmail message IDs in a `Processed` sheet tab; check before parsing.
   Deleting a row = safe forced re-parse.
5. **"Top item" selection:** Last row of the week = most recent (rows append chronologically).

### Environment / accounts we have

| Account | Status |
|---|---|
| GitHub (`RAMA-L7`) | Active, authenticated via `gh` CLI |
| Google account + Apps Script + Sheets | Active (TAAFT lives here) |
| Gmail | TAAFT newsletters arrive at `YOUR_EMAIL@gmail.com` |
| Payments / domain / cloud hosting | ❌ Not yet created — see roadmap |

---

## 3. THE IDEA POOL (ranked by our priority)

Full analysis with cost breakdowns: see `SaaS_IDEAS.md` (same folder).

### 🎯 PRIORITY 1 — Digest-as-a-Service (idea #6) — START HERE
- **What:** Rebrand the existing TAAFT engine per niche: "Legal AI Weekly", "HealthTech Radar", etc.
  Sell subscriptions to the curated digest itself.
- **Why first:** Literally zero new tech. The product IS the weekly report we already generate.
  Validate demand before writing more code.
- **Revenue:** $9–29/mo per subscriber, near-zero marginal cost per niche.
- **Zero-cost path:** Run script on one niche manually for a month → sell founding subscriptions
  via Gumroad/Lemon Squeezy (no monthly fee, ~5% per sale) → automate after validation.

### 🎯 PRIORITY 2 — Competitor Watch Service (idea #2)
- **What:** Track competitors' newsletters/changelogs/product updates → weekly "what your rivals
  shipped" briefing for PMs/founders.
- **Why second:** Same engine, B2B pricing ($99–499/mo). Demo-able with any prospect's real competitors.
- **Tech delta:** Add RSS + web-fetch sources (UrlFetchApp), multi-source merging, per-client configs.

### LATER (need revenue or paid infra first)
- Newsletter-to-CRM (#1) — needs OAuth app verification; big B2B prize ($49–299/mo/seat)
- Subscription spend tracker (#4) — Gmail restricted-scope review takes weeks
- Investor signals (#3) — needs paid data APIs
- Invoice pipeline (#5) — needs paid OCR at production volume
- Job matcher (#7) — LLM API costs grow with users
- Order unifier (#8) — weak first business (consumer freemium)

---

## 4. ROADMAP — How to proceed

### Phase 0 — Pick the niche ✅ DONE (2026-08-24)
- [x] Niche chosen: **AI/DevTools weekly digest** (user knows this space via TAAFT)
- [x] Working name: **"AI This Week" (ATW)** — placeholder, finalize before launch
- [x] Source list: see `01-SOURCES.md` → **USER ACTION: subscribe to TLDR AI, Ben's Bites, The Rundown**
- [x] Product definition + pricing + landing copy: `02-PRODUCT.md`
- [x] Landing page draft: `landing/index.html` (deploy free to Vercel/Netlify later)

### Phase 1 — Manual validation (weeks 1–4) ← WE ARE HERE
- [x] **USER:** Subscribed TLDR AI (+other TLDR editions), The Rundown AI at
      `YOUR_SECONDARY@gmail.com` (Ben's Bites pending)
- [x] **Deployed & VALIDATED:** modular collector in `../ai-this-week/collector/`
      (one .gs page per company: CONFIG / collect-taaft / collect-tldr /
      collect-rundown / collect-bensbites / utils / main). Daily 7am trigger.
      First real run: 5 clean items from Rundown after junk-filter tuning.
- [x] Junk filtering tuned: fragment titles, social links, sponsor domains
      (editable SPONSOR_DOMAINS list), tracking URLs, confirmation emails
- [ ] Wait for a full week of collection (~40–80 items expected by Sunday)
- [ ] Compose Issue #1 manually from Raw Feed (format template in `02-PRODUCT.md`)
- [ ] Send Issue #1 FREE to friends/communities → collect replies/testimonials
- [ ] Payments setup: follow `03-PAYMENTS-SETUP.md` (Gumroad or Lemon Squeezy, ₹0/month)
- [ ] Wire landing page CTA button to payment link
- 🚦 **Gate: 10 paying subscribers** before any infrastructure spend

### Phase 2 — Automate onboarding (month 2)
- [ ] Subscriber list + automated sending (still Apps Script OK up to ~100/day email quota)
- [ ] Payment webhook → subscriber sheet
- [ ] Success gate: 10+ paying subscribers before ANY infrastructure spend

### Phase 3 — Productize (month 3+, funded by revenue)
- [ ] Buy domain (~₹800–1000/yr — first and only planned spend)
- [ ] Migrate to Vercel (hosting) + Supabase (DB/auth) if Apps Script quotas bite
- [ ] Begin Priority 2 (Competitor Watch) as upsell to existing subscribers

---

## 5. RULES WE'VE SET FOR OURSELVES

1. **₹0 until first paying customer.** Free tiers only. Revenue buys infrastructure.
2. **Never rebuild what works** — TAAFT engine sections are copy-paste reusable.
3. **Validate manually before automating** — sell the output before perfecting the pipeline.
4. **One niche at a time** until it pays.

---

## 6. HOW TO USE THIS FILE (for AI assistants)

- Treat §2 as ground truth about what already works; don't propose rebuilding it.
- When writing code for Phases 0–2, target **Google Apps Script (V8 runtime)** unless the task
  explicitly says otherwise — same constraints as TAAFT: no npm, 6-min executions, emoji-safe
  strings only (see lessons in §2).
- When suggesting architecture beyond Phase 3, default to: Vercel + Supabase + Resend + Stripe/LemonSqueezy.
- After completing any milestone, update §2 (status) and tick boxes in §4.
