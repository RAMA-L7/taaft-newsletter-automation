# 02 — Product Definition

## Working name: **"AI This Week"** (ATW)

*Tagline options:*
- "Everything that mattered in AI this week. One email."
- "5 newsletters in. 1 email out. Zero FOMO."
- "The only AI email you need on Sundays."

*(Name is a placeholder — pick final name before landing page goes live.
Check availability: name + .com / Gumroad product page.)*

---

## Positioning

| | |
|---|---|
| **For** | Busy professionals & builders who want AI news without inbox overload |
| **Who** | currently juggle 3–6 free AI dailies and read none of them properly |
| **ATW is** | a single ranked weekly digest, cross-referenced from the top 5 AI newsletters |
| **Unlike** | any single newsletter — we dedupe across sources and rank by actual importance |
| **So that** | readers get complete coverage in one 4-minute Sunday read |

---

## Format (the product IS this email)

```
🧠 AI THIS WEEK — Issue #1
Aug 17–23, 2026

🏆 TOP 3 THAT MATTERED
1. [Story] — why it matters (2 lines) — source link
2. ...
3. ...

🚀 TOOLS WORTH TRYING (3–5, cross-source picks)
• Tool — one-liner — link

📚 RESEARCH CORNER (1–2 papers, plain-English summary)

💰 FOLLOW THE MONEY (funding/acquisitions of the week)

📊 SOURCE TALLY
TLDR AI: 14 items · Ben's Bites: 11 · Rundown: 9 · TAAFT: 29 → deduped to N

⏱️ Read time: 4 minutes
```

---

## Pricing

| Tier | Price | What |
|---|---|---|
| **Founding** | $5/mo (first 25 subscribers) | Weekly digest + full archive access |
| **Standard** | $12/mo after founding tier fills | Same |
| **Free** | — | Monthly "best of" teaser (marketing funnel) |

*Launch strategy: first month free for anyone who subscribes during week 1 — collect testimonials.*

---

## Landing page copy (use for Carrd/Vercel page)

**Hero:** Everything that mattered in AI this week. One email.
**Sub:** We read TLDR AI, Ben's Bites, The Rundown, and more — so you don't have to. Every Sunday: the top stories, tools worth trying, and research explained plainly. 4-minute read.

**Social proof section (fill after issues 1–4):** testimonials

**FAQ:**
- *Isn't this just another AI newsletter?* No — we aggregate and rank ACROSS them. If a story matters, it appeared in multiple sources; we show you the consensus.
- *What if I already subscribe to these?* Great — ATW replaces reading them. Keep them for archive, read us weekly.
- *Can I cancel?* Anytime, one click.

**CTA button:** "Get Issue #1 free →"

---

## Sources config (fill sender addresses as they arrive)

```javascript
// Gmail filter used by the adapted script:
const SOURCE_SENDERS = [
  'hi@mail.theresanaiforthat.com', // TAAFT ✅ confirmed
  'ADD_TLDR_SENDER',               // e.g. team@tldr.tech
  'ADD_BENSBITES_SENDER',
  'ADD_RUNDOWN_SENDER'
];
```

---

## Week-by-week launch plan

| Week | Action |
|---|---|
| 1 | Subscribe sources (#1–#4). Collect sender addresses. Script parses everything into sheet automatically (daily trigger). |
| 2 | Manually compose Issue #1 from parsed data using format above. Send FREE to friends/communities. Ask for replies/testimonials. |
| 3 | Issue #2. Post issue #1 publicly. Set up Gumroad ($5/mo founding tier). Landing page live. |
| 4 | Issue #3. Ship monthly free teaser signup. Goal: **10 paying subscribers = validation gate passed.** |
