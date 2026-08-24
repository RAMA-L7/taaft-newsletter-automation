# TAAFT Newsletter Automation

[![Platform](https://img.shields.io/badge/platform-Google%20Apps%20Script-blue)](https://script.google.com)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

> Turn **There's An AI For That** newsletter emails into a structured Google Sheet + a beautiful weekly HTML report — fully automated, zero manual work.

---

## 📖 About

**TAAFT Newsletter Automation** is a self-contained Google Apps Script project (one file, ~900 lines) that:

1. **Reads** every email from `hi@mail.theresanaiforthat.com` in your Gmail
2. **Parses** all content sections using text-marker heuristics — handles *both* the daily issues and the weekly digest format
3. **Saves** each item as a clean row in a Google Sheet (title, description, link, type, category, country)
4. **Emails you a styled weekly report** every Sunday with counts, clickable highlights, and a button straight to your spreadsheet

No servers, no API keys, no billing. Everything runs free inside Google's infrastructure using GmailApp + SpreadsheetApp.

### Why I built it

There's An AI For That sends a firehose of AI tools, news, and prompts every week. Skimming emails is lossy — you can't search, filter, or track what you saw. This script turns that firehose into a **queryable database** and a **5-second weekly summary**.

---

## ✨ Features

- 📥 **Dual-format parsing** — daily emails *and* weekly digests, auto-detected per section
- 🏷️ **Auto-classification** — AI Finds tagged as Learning / Research / Hardware / Business / Policy / Product / Industry
- 🌍 **Country & category guessing** for featured products (India / USA / EU / ...)
- 🔁 **Duplicate protection** — processed email IDs stored in a `Processed` tab; re-runs are safe
- 🧹 **Markdown stripping** — bold links like `_[**Name**](url)_` become proper Title / Summary / Link columns
- ✂️ **Smart title splitting** — `GoAI assists you with which stocks...` → Title: `GoAI`, Summary: `assists you with...`
- 📊 **Styled HTML report** — emojis render correctly (numeric entities), top items are clickable links, truncation for long headlines
- 🔗 **One-click "Open Google Sheet" button** in every report
- 🧪 **Preview mode** — send yourself a `[TEST]` report without writing to the sheet
- ⏪ **Backfill** — one command imports up to 100 old newsletters

---

## 📋 What gets extracted

| Section in email | Saved to | Type label |
|---|---|---|
| Prompt of the Day / Week | `Prompts` | — |
| Best of Beyond the Feed | `AI Finds` | *(auto-classified)* |
| This Week's Top AI Developments | `AI Finds` | `Breaking News` |
| AI Tools of the Week | `AI Finds` | `Tool of the Week` |
| Notable AI Tools | `AI Finds` | `Notable AI` |
| Open Source Finds | `AI Finds` | `Open Source` |
| Interesting AI (featured product) | `Interesting AI` | — |

---

## 🗄️ Sheet structure

Create these 5 tabs (or just run `setupSheetHeaders`):

| Tab | Columns |
|---|---|
| `Prompts` | Date · Prompt Title · Prompt Description · Prompt URL · Email Subject · Source |
| `Interesting AI` | Date · Product Name · Description · Website · Category · Indian Startup · Company · Founder · Country · Notes |
| `AI Finds` | Date · Title · Type · Summary · Link · Notes |
| `Processed` | Email ID · Date Processed · Subject |
| `Weekly Reports` | Week Start · Week End · Counts ×3 · Top items ×3 · Summary · Report Sent |

---

## 📬 Sample report

```
📊 Weekly AI Intelligence Report
2026-08-17 → 2026-08-24

📌 Prompts          9 new this week   Top prompt: Find the Money
🤖 Interesting AI   9 new this week   Top product: SecondBrain Note  ← clickable
🔍 AI Finds        39 new this week   Top find: Agentic RAG for Dummies ← clickable

All-time totals: Prompts 137 · Products 123 · AI Finds 407

[ Open Google Sheet → ]

Keep building. 🚀
```

(Received as styled HTML cards; plain-text fallback included.)

---

## 🚀 Setup (5 minutes)

1. **Create the Google Sheet** with the 5 tabs listed above
2. **Open** [script.google.com](https://script.google.com) → **New project**
3. **Paste** [`COMPLETE_v5.js`](COMPLETE_v5.js) into the editor
4. **Set your spreadsheet ID** at the top:
   ```javascript
   const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // from your sheet URL
   ```
5. The report recipient defaults to your Google account (`Session.getActiveUser()`); change it via:
   ```javascript
   const WEEKLY_REPORT_EMAIL = 'you@example.com';
   ```
6. Run **once**: `setupSheetHeaders` → fills column headers
7. Run **once**: `createTriggers` → registers schedules (approve Gmail/Sheets permissions when prompted)

Done. First real report arrives Sunday at 9:00.

### Schedules

| Trigger | Function | Behavior |
|---|---|---|
| Daily 8:00 | `processLatestTAAFT` | Silent — parses new emails into the sheet |
| Sunday 9:00 | `sendWeeklyReport` | Sends the HTML report |

Want everything in one Sunday run instead? See [Single-run variant](#single-run-weekly-only-variant).

---

## 🛠️ Functions reference

| Function | Purpose |
|---|---|
| `processLatestTAAFT` | Daily run: parse last 2 days of TAAFT emails |
| `backfillAllTAAFT` | One-time import of up to 100 old newsletters (duplicate-safe) |
| `sendWeeklyReport` | Build + email the weekly HTML report, log to sheet |
| `previewReportEmail` | Send a `[TEST]` report — no sheet writes |
| `createTriggers` | (Re-)register time-based triggers |
| `setupSheetHeaders` | Write column headers to all tabs |
| `cleanMarkdownInSheet` | One-time cleanup of legacy rows (markdown blobs → clean columns) |
| `extractAllFromEmail` | Dispatcher — runs every parser; each finds its own section or skips |

### Re-parse one email

Delete its row from the `Processed` tab → run `processLatestTAAFT`.

---

## 🔧 How the parsing works

```
Gmail thread ──► getPlainBody()
                    │
                    ├─ find heading marker ("AI Tools of the Week", "Prompt of the Day", …)
                    ├─ cut section at next major heading (findMarker)
                    ├─ grab emoji-prefixed lines (items)
                    ├─ split name vs description:
                    │    • markdown bold-link pattern, OR
                    • verb heuristic ("X assists/runs/builds…" → SECTION_VERBS)
                    └─ appendRow to sheet
```

Key design choices:

- **Curly-apostrophe normalization** (`’` → `'`) so markers always match regardless of what TAAFT's mailer emits that week
- **Emoji detection** uses `\p{Emoji_Presentation}` regex to identify list items
- **HTML entities for emojis in the email body** (`&#128202;`) so nothing breaks during copy-paste between editors; the subject stays plain text because Gmail mangles emoji in subjects sent via Apps Script

### Customizing

- **New verbs / phrasing changes by TAAFT?** Add words to the `SECTION_VERBS` array
- **Different sections?** Copy any `extract*` wrapper and point it at a new `startMarker`
- **Report styling** lives entirely in `buildReportHtml` — inline CSS, easy to theme

---

## 💡 Single-run (weekly only) variant

Prefer zero weekday activity? Replace `createTriggers` body with:

```javascript
ScriptApp.newTrigger('weeklyCollectAndReport')
  .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(9).create();
```

and add:

```javascript
function weeklyCollectAndReport() {
  processLatestTAAFT();  // change 'newer_than:2d' to 'newer_than:8d' first
  backfillAllTAAFT();    // safety net for anything missed
  sendWeeklyReport();
}
```

Trade-off: daily runs double as retries — if parsing fails once during the week, the next day catches it. Single-run loses that safety net.

---

## 🐞 Troubleshooting

| Symptom | Fix |
|---|---|
| Emojis show as `������` | You're on an old version — current code uses HTML entities in the body; re-copy `COMPLETE_v5.js` |
| Sections missing after a format change | Check Execution log for `⚠️ ... not found`; update the marker strings in the relevant `extract*` function |
| Duplicate rows | Never delete the `Processed` tab — it powers dedupe. Remove specific rows only to force re-parsing |
| Report shows stale titles | Titles are read from the sheet; run `cleanMarkdownInSheet` once for legacy rows |
| Trigger didn't fire | Apps Script → Triggers (clock icon) — confirm both triggers exist and are authorized |

---

## 📄 License

MIT — use it, fork it, ship it.
