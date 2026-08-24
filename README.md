# TAAFT Newsletter Automation

Google Apps Script that parses **There's An AI For That** newsletter emails (daily issues + weekly digests), extracts every section into a Google Sheet, and sends a styled HTML weekly report.

## What it does

| Trigger | Function | What happens |
|---|---|---|
| Daily 8:00 | `processLatestTAAFT` | Parses new TAAFT emails into the sheet (silent) |
| Sunday 9:00 | `sendWeeklyReport` | Emails a styled HTML report |

### Sections extracted

- **Prompts** — Prompt of the Day / Prompt of the Week
- **AI Finds** — "Best of Beyond the Feed"
- **Breaking News** — "This Week's Top AI Developments"
- **Coming in Hot** — "AI Tools of the Week" (title auto-split from description)
- **Notable AIs**
- **Open Source Finds**
- **Interesting AI** — featured product with URL, category and country guess

All finds land in an `AI Finds` sheet with a `Type` column (`Learning`, `Research`, `Hardware`, `Tool of the Week`, ...).

### Weekly report

- Clean HTML email: emojis render correctly, top items are clickable links
- All-time totals table
- One-click "Open Google Sheet" button

## Setup

1. Create a Google Sheet with these tabs: `Prompts`, `Interesting AI`, `AI Finds`, `Processed`, `Weekly Reports`
2. Go to [script.google.com](https://script.google.com) → New project
3. Paste `COMPLETE_v5.js`
4. Set your spreadsheet ID:
   ```javascript
   const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';
   ```
   (The report recipient defaults to your Google account email.)
5. Run once: `setupSheetHeaders` → creates column headers
6. Run once: `createTriggers` → registers the schedules
7. Approve the Gmail/Sheets permissions when prompted

## Handy extras

| Function | Purpose |
|---|---|
| `backfillAllTAAFT` | One-time import of up to 100 old newsletters (duplicate-safe) |
| `previewReportEmail` | Sends a `[TEST]` report without touching the sheet |
| `cleanMarkdownInSheet` | One-time cleanup of legacy rows (strips markdown, splits titles) |

To re-parse a single email, delete its row from the `Processed` sheet and run `processLatestTAAFT`.

## Notes

- Parsing is heuristic: section headings are matched as text, item names are split from descriptions using a verb list (`SECTION_VERBS`). Add verbs there if TAAFT changes phrasing.
- Emoji in the HTML body uses numeric entities so nothing breaks during copy-paste; the subject line is plain text because Gmail mangles emoji in subjects sent from Apps Script.
