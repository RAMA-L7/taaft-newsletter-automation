// ═══════════════════════════════════════════════════════════════════════════
//  TAAFT NEWSLETTER AUTOMATION — COMPLETE (v5)
//  Handles daily emails AND weekly digests
//  HTML weekly report (fixes broken emoji rendering)
//
//  ONE FILE. Paste this as your entire Apps Script project.
// ═══════════════════════════════════════════════════════════════════════════

const SPREADSHEET_ID      = 'YOUR_SPREADSHEET_ID';
const WEEKLY_REPORT_EMAIL = Session.getActiveUser().getEmail();


// ═══════════════════════════════════════════════════════════════════════════
// RUN ONCE — registers triggers
// ═══════════════════════════════════════════════════════════════════════════

function createTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processLatestTAAFT')
    .timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('sendWeeklyReport')
    .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(9).create();
  Logger.log('✅ Triggers created');
}


// ═══════════════════════════════════════════════════════════════════════════
// RUN ONCE — set correct headers on all sheets
// ═══════════════════════════════════════════════════════════════════════════

function setupSheetHeaders() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const headers = {
    'Prompts':        ['Date', 'Prompt Title', 'Prompt Description', 'Prompt URL', 'Email Subject', 'Source'],
    'Interesting AI': ['Date', 'Product Name', 'Description', 'Website', 'Category', 'Indian Startup', 'Company', 'Founder', 'Country', 'Notes'],
    'AI Finds':       ['Date', 'Title', 'Type', 'Summary', 'Link', 'Notes'],
    'Processed':      ['Email ID', 'Date Processed', 'Subject'],
    'Weekly Reports': ['Week Start', 'Week End', 'Prompts Count', 'Interesting AI Count', 'AI Finds Count', 'Top Prompt', 'Top Interesting AI', 'Top AI Find', 'Weekly Summary', 'Report Sent']
  };
  Object.entries(headers).forEach(([name, cols]) => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log('⚠️  Sheet not found: ' + name); return; }
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
    Logger.log('✅ Headers set: ' + name);
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN DAILY RUN
// ═══════════════════════════════════════════════════════════════════════════

function processLatestTAAFT() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const threads = GmailApp.search(
    'from:hi@mail.theresanaiforthat.com newer_than:2d', 0, 5
  );
  if (threads.length === 0) { Logger.log('No emails found'); return; }

  const processedIds = loadProcessedIds(ss);

  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      processMessage(msg, ss, processedIds);
    });
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// BACKFILL — run ONCE to process all old TAAFT emails (up to 100)
// Safe to re-run: duplicate check skips anything already processed.
// TIP: to re-parse one email, delete its row from the 'Processed' sheet.
// ═══════════════════════════════════════════════════════════════════════════

function backfillAllTAAFT() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const threads = GmailApp.search(
    'from:hi@mail.theresanaiforthat.com', 0, 100
  );
  if (threads.length === 0) { Logger.log('No emails found'); return; }
  Logger.log('Found ' + threads.length + ' threads to process');

  const processedIds = loadProcessedIds(ss);

  let processed = 0;
  let skipped   = 0;

  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const before = processedIds.size;
      const ok = processMessage(msg, ss, processedIds);
      if (!ok)                    { skipped++; }
      else if (processedIds.size > before) { processed++; }
      else                        { skipped++; }

      if (processed > 0 && processed % 10 === 0) {
        Logger.log('Processed ' + processed + ' so far, pausing...');
        Utilities.sleep(2000);
      }
    });
  });

  Logger.log('✅ Backfill complete: ' + processed + ' processed, ' + skipped + ' skipped');
}


// ── shared: dedupe ids from Processed sheet
function loadProcessedIds(ss) {
  const sheet = ss.getSheetByName('Processed');
  return new Set(
    sheet.getDataRange().getValues()
      .slice(1).map(r => r[0].toString()).filter(Boolean)
  );
}

// ── shared: parse one email, mark processed. Returns true if new.
function processMessage(msg, ss, processedIds) {
  const messageId = msg.getId();
  if (processedIds.has(messageId)) { Logger.log('Skip: ' + messageId); return false; }

  const subject = msg.getSubject();
  const date    = msg.getDate();
  const plain   = msg.getPlainBody() || '';

  Logger.log('Processing: ' + subject);

  extractAllFromEmail(plain, date, subject, {
    prompts:     ss.getSheetByName('Prompts'),
    aiFinds:     ss.getSheetByName('AI Finds'),
    interesting: ss.getSheetByName('Interesting AI')
  });

  ss.getSheetByName('Processed').appendRow([
    messageId,
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
    subject
  ]);

  processedIds.add(messageId);
  Logger.log('✅ Done: ' + subject);
  return true;
}


// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTOR DISPATCH — runs every parser; each one finds its own section
// or quietly does nothing if that section isn't in this email.
// ═══════════════════════════════════════════════════════════════════════════

function extractAllFromEmail(plain, date, subject, sheets) {
  // Prompts (handles "Prompt of the Day" AND "Prompt of the Week")
  extractPrompt(plain, date, subject, sheets.prompts);

  // AI Finds (daily: "Beyond the Feed")
  extractAIFinds(plain, date, sheets.aiFinds);

  // Weekly digest emoji sections → AI Finds sheet with a Type label
  extractBreakingNews(plain, date, sheets.aiFinds);
  extractComingInHot(plain, date, sheets.aiFinds);
  extractNotableAIs(plain, date, sheets.aiFinds);
  extractOpenSourceFinds(plain, date, sheets.aiFinds);

  // Interesting AI (single featured product)
  extractInterestingAI(plain, date, sheets.interesting);
}


// ═══════════════════════════════════════════════════════════════════════════
// 1. PROMPT OF THE DAY / WEEK
// ═══════════════════════════════════════════════════════════════════════════

function extractPrompt(plain, date, subject, sheet) {
  const notionMatch = plain.match(
    /https:\/\/taaft\.notion\.site\/([A-Za-z0-9][A-Za-z0-9\-]+?)-([0-9a-f]{32})/
  );

  // Locate section: matches "Prompt of the Day" OR "Prompt of the Week"
  const pdStart = Math.min(
    ...['Prompt of the Day', 'Prompt of the Week']
      .map(m => plain.indexOf(m))
      .filter(i => i !== -1)
      .concat([Infinity])
  );

  let promptTitle = '';
  let description = '';

  if (pdStart !== Infinity) {
    const pdSection = plain.substring(pdStart, pdStart + 1500);
    const pdLines = pdSection.split('\n')
      .map(l => stripMarkdown(l).trim()).filter(Boolean);

    const SKIP = [
      /^prompt of the (day|week)/i,
      /^important note/i,
      /^you.ll need to click/i,
      /^view (and copy|this prompt)/i,
      /^if you.d rather/i,
      /^click here/i,
      /^by taaft/i,
      /taaft\.notion\.site/,
      /taaft\.co\//,
      /^https?:\/\//,
      /^the taaft ultimate/i,
      /^one request has come/i,
      /^(today.s|this week.s) (prompt|find)/i
    ];

    const candidates = pdLines.filter(l => !SKIP.some(re => re.test(l)));

    // Weekly format: title is the FIRST short line ("Find the Money"),
    // description is the long paragraph after it.
    if (candidates.length > 0 && candidates[0].length <= 60) {
      promptTitle = candidates[0];
      description = candidates.find(l => l.length > 60 && l !== promptTitle) || '';
    } else if (candidates.length > 0) {
      description = candidates[0];
    }
  }

  if (!notionMatch && !promptTitle) {
    Logger.log('⚠️  No prompt found'); return;
  }

  const promptUrl = notionMatch ? notionMatch[0] : '';
  if (!promptTitle) {
    promptTitle = notionMatch[1].replace(/-/g, ' ');
  }

  sheet.appendRow([formatDate(date), promptTitle, description, promptUrl, subject, 'TAAFT']);
  Logger.log('📌 Prompt: ' + promptTitle);
}


// ═══════════════════════════════════════════════════════════════════════════
// 2. AI FINDS (daily — "Beyond the Feed")
// ═══════════════════════════════════════════════════════════════════════════

function extractAIFinds(plain, date, sheet) {
  let start = plain.indexOf('Best of Beyond the Feed');
  if (start === -1) start = plain.indexOf('Beyond the Feed');
  if (start === -1) { Logger.log('⚠️  AI Finds not found'); return; }

  const end = findMarker(plain,
    ['Breaking News', 'Coming in Hot', 'Interesting AI', 'Notable AIs',
     'Open Source', 'Reach out to', 'Prompt of the'],
    start + 16
  );

  const section = plain.substring(start, end !== -1 ? end : start + 3000);
  const lines = section.split('\n').map(l => l.trim()).filter(Boolean);

  const EMOJI_RE = /^\p{Emoji_Presentation}/u;
  let saved = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^best of beyond the feed$/i.test(line)) continue;
    if (!EMOJI_RE.test(line)) continue;

    let rawTitle  = line.replace(/^\p{Emoji_Presentation}\s*/u, '').trim();
    let extraSummary = '';
    let directLink = '';

    // Bold-link item: "_[**Name**](url) description..." → split into parts
    const md = rawTitle.match(/\[\*{0,2}([^\]*]+?)\*{0,2}\]\((https?:\/\/[^)]+)\)\s*(.*)/);
    if (md) {
      rawTitle    = md[1];
      directLink  = md[2];
      extraSummary = md[3];
    }

    const title = stripMarkdown(rawTitle);
    if (!title) continue;

    let summary = extraSummary;
    if (i + 1 < lines.length && !EMOJI_RE.test(lines[i + 1])) {
      summary = (summary ? summary + ' ' : '') + stripMarkdown(lines[i + 1].trim());
    }
    summary = summary.trim();

    const link = directLink || extractFirstUrl([line, summary, lines[i + 2] || '', lines[i + 3] || '']);

    sheet.appendRow([formatDate(date), title, classifyFind(title, summary), summary, link, '']);
    saved++;
  }

  Logger.log('🔍 AI Finds saved: ' + saved);
}


// ═══════════════════════════════════════════════════════════════════════════
// 3. WEEKLY EMOJI SECTIONS (generic engine)
//
// Breaking News, Coming in Hot, Notable AIs and Open Source Finds share
// this shape:
//     <Heading>
//     <subheading>
//     ⚡ Item text on one line...
//
// Items = emoji-prefixed lines. Title/description split on first lowercase
// verb after the leading capitalized name ("GoAI assists you with...").
// Curly apostrophes are normalized so markers always match.
// ═══════════════════════════════════════════════════════════════════════════

const SECTION_VERBS = [
  'shows','gives','turns','builds','breaks','clones','hands','fills','walks',
  'reads','runs','sits','sweeps','names','pulls','goes','has','won','cut',
  'announces','launches','releases','ships','acquires','buys','lands','sold',
  'worked'
];

function extractEmojiSection(plain, date, sheet, opts) {
  plain = plain.replace(/[\u2019\u2018]/g, "'");
  let start = plain.indexOf(opts.startMarker);

  if (start === -1 && opts.altMarker) start = plain.indexOf(opts.altMarker);
  if (start === -1) return 0;

  let markerLen = opts.startMarker.length;
  if (opts.altMarker && plain.indexOf(opts.altMarker) === start) {
    markerLen = opts.altMarker.length;
  }

  const end = findMarker(plain, opts.endMarkers, start + markerLen);
  const section = plain.substring(start, end !== -1 ? end : start + 3000);
  const lines = section.split('\n').map(l => l.trim()).filter(Boolean);

  const EMOJI_RE = /^\p{Emoji_Presentation}/u;
  let saved = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (!EMOJI_RE.test(line)) continue;

    const raw = line.replace(/^\p{Emoji_Presentation}\s*/u, '').trim();
    if (!raw) continue;

    const split = splitNameAndDescription(raw);
    const link = extractFirstUrl([line]) ||
                 extractFirstUrl(lines.slice(idx + 1, idx + 3));

    sheet.appendRow([
      formatDate(date),
      split.title,
      opts.type,
      split.description,
      link,
      opts.source || ''
    ]);
    saved++;
  }

  if (saved > 0) Logger.log('✅ ' + opts.type + ' saved: ' + saved);
  return saved;
}

// "GoAI assists you with which stocks..." → {title:"GoAI", description:"assists you with ..."}
// No verb match → whole line kept as the title (correct for news headlines).
function splitNameAndDescription(text) {
  for (const verb of SECTION_VERBS) {
    const re = new RegExp(
      '^((?:[A-Z][A-Za-z0-9&\'\\-]*)(?:\\s(?:of|the|for|My|[A-Z][A-Za-z0-9&\'\\-]*)){0,4})\\s+(' +
      verb + '\\b.*)$'
    );
    const m = text.match(re);
    if (m) return { title: m[1].trim(), description: m[2].trim() };
  }
  return { title: text, description: '' };
}

function extractBreakingNews(plain, date, sheet) {
  extractEmojiSection(plain, date, sheet, {
    startMarker: "This Week's Top AI Developments",
    altMarker:   'This Week\u2019s Top AI Developments',
    endMarkers:  ['AI Finds', 'Coming in Hot', "Today's Sponsor", 'Interesting AI'],
    type:        'Breaking News'
  });
}

function extractNotableAIs(plain, date, sheet) {
  extractEmojiSection(plain, date, sheet, {
    startMarker: 'Notable AI Tools',
    endMarkers:  ['Reach out to', 'Open Source', 'Prompt of the', 'Unsubscribe'],
    type:        'Notable AI'
  });
}

function extractOpenSourceFinds(plain, date, sheet) {
  extractEmojiSection(plain, date, sheet, {
    startMarker: "This Week's Top OSS",
    altMarker:   'This Week\u2019s Top OSS',
    endMarkers:  ['Prompt of the', 'Reach out to', 'Feedback', 'Unsubscribe'],
    type:        'Open Source'
  });
}

function extractComingInHot(plain, date, sheet) {
  const saved = extractEmojiSection(plain, date, sheet, {
    startMarker: 'AI Tools of the Week',
    endMarkers:  ['Launch your AI tool', 'Interesting AI', 'Reach out to', 'Notable AIs'],
    type:        'Tool of the Week'
  });
  if (saved === 0) Logger.log('⚠️  Coming in Hot not found');
}


// ═══════════════════════════════════════════════════════════════════════════
// 4. INTERESTING AI (single featured product)
// ═══════════════════════════════════════════════════════════════════════════

function extractInterestingAI(plain, date, sheet) {
  if (!plain) { Logger.log('⚠️  Plain body empty'); return; }

  const start = plain.indexOf('Interesting AI');
  if (start === -1) { Logger.log('⚠️  Interesting AI not found'); return; }

  const end = findMarker(plain,
    ['Reach out to over', 'Open Source', 'Notable AIs', 'Prompt of the', 'Unsubscribe'],
    start + 14
  );

  const section = plain.substring(start, end !== -1 ? end : start + 2500).trim();

  const SKIP = [
    /^interesting ai\s*$/i,
    /^this week.s most interesting ai\s*$/i,
    /^view image\s*:/i,
    /^follow image link\s*:/i,
    /^caption\s*:?\s*$/i,
    /^check it out here/i,
    /^reach out to/i,
    /^https?:\/\//,
    /^[\-_=*#]{2,}$/,
    /^\s*$/
  ];

  const lines = section.split('\n')
    .map(l => l.trim())
    .filter(l => l && !SKIP.some(re => re.test(l)));

  if (lines.length === 0) { Logger.log('⚠️  Interesting AI section empty'); return; }

  // ── Product name ──────────────────────────────────────────────────────
  let productName = '';

  // Strategy 1 — bold markdown link  _[**ProductName ...**](url)_
  for (const line of lines) {
    const m = line.match(/\[\*{1,2}([^*\]]+)\*{1,2}\]/);
    if (m) {
      productName = m[1]
        .replace(/\s+(does|goes|is|are|builds|reads|helps).*$/i, '')
        .split(' ').slice(0, 4).join(' ').trim();
      break;
    }
  }

  // Strategy 2 — "X <verb> ..." pattern (covers "SecondBrain Note goes in your wallet")
  if (!productName) {
    const fullText = lines.join(' ');
    const m = fullText.match(
      /\b((?:[A-Z][\w&'\-]*\s?){1,4}?)\s+(?:is\s+a|are\s+a|does\b|goes\b|sits\b|lives\b|reads\b|sweeps\b|runs\b|turns\b|builds\b|fills\b|clones\b|hands\b|walks\b|'s\s+(?:entire|job|whole))/
    );
    if (m) productName = m[1].trim();
  }

  // Strategy 3 — "Follow image link" URL slug
  if (!productName) {
    const followLine = section.split('\n').find(l => /follow image link/i.test(l));
    if (followLine) {
      const urlMatch = followLine.match(/https?:\/\/(?:www\.)?([^\/\s)]+)/);
      if (urlMatch) {
        productName = slugToName(urlMatch[1].split('.')[0]);
      }
    }
  }

  // Strategy 4 — "Check it out here ➜ (url)" domain slug
  if (!productName) {
    const checkout = section.match(/\((https?:\/\/[^)]+)\)/);
    if (checkout && !/beehiiv|cdn-cgi/i.test(checkout[1])) {
      try {
        const host = checkout[1].match('//(?:www\\.)?([^/]+)')[1];
        productName = slugToName(host.split('.')[0]);
      } catch (e) { /* ignore */ }
    }
  }

  // ── Product URL ───────────────────────────────────────────────────────
  let productUrl = '';
  const rawLines = section.split('\n');

  const checkoutLine = rawLines.find(l => /check it out here/i.test(l));
  if (checkoutLine) {
    const m = checkoutLine.match(/\((https?:\/\/[^)]+)\)/);
    if (m) productUrl = m[1];
  }
  if (!productUrl) {
    const followLine = rawLines.find(l => /follow image link/i.test(l));
    if (followLine) {
      const m = followLine.match(/\((https?:\/\/[^)]+)\)/);
      if (m) productUrl = m[1];
    }
  }
  if (!productUrl) {
    for (const l of rawLines) {
      const m = l.match(/https?:\/\/[^\s)>\]]+/);
      if (m && !m[0].match(/cdn-cgi|beehiiv|\.jpg|\.png|\.gif|\.webp/i)) {
        productUrl = m[0]; break;
      }
    }
  }

  // ── Description ───────────────────────────────────────────────────────
  const description = lines.map(stripMarkdown).join(' ').replace(/\s+/g, ' ').trim();
  const combined = (productName + ' ' + description).toLowerCase();

  sheet.appendRow([
    formatDate(date),
    productName,
    description,
    productUrl,
    guessCategory(combined),
    guessCountry(combined) === 'India' ? 'Yes' : 'No',
    '', '',
    guessCountry(combined),
    ''
  ]);

  Logger.log('🤖 Interesting AI: "' + productName + '" → ' + productUrl);
}

function slugToName(slug) {
  return String(slug).replace(/[-_]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}


// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY REPORT — HTML email (fixes broken emoji/garbled text rendering)
// ═══════════════════════════════════════════════════════════════════════════

function sendWeeklyReport() {
  const ss           = SpreadsheetApp.openById(SPREADSHEET_ID);
  const promptsSheet = ss.getSheetByName('Prompts');
  const aiFindsSheet = ss.getSheetByName('AI Finds');
  const interSheet   = ss.getSheetByName('Interesting AI');
  const weeklySheet  = ss.getSheetByName('Weekly Reports');

  const now       = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const promptRows      = getRowsThisWeek(promptsSheet, weekStart);
  const aiFindsRows     = getRowsThisWeek(aiFindsSheet, weekStart);
  const interestingRows = getRowsThisWeek(interSheet,   weekStart);

  // Latest item this week (rows are appended chronologically → last is newest)
  const topPromptRow  = promptRows.length      > 0 ? promptRows[promptRows.length - 1]      : null;
  const topFindRow    = aiFindsRows.length     > 0 ? aiFindsRows[aiFindsRows.length - 1]    : null;
  const topProductRow = interestingRows.length > 0 ? interestingRows[interestingRows.length - 1] : null;

  const topPrompt  = topPromptRow  ? topPromptRow[1]  : 'None';
  const topProduct = topProductRow ? topProductRow[1] : 'None';
  const topFind    = topFindRow    ? topFindRow[1]    : 'None';

  const weekStartStr = formatDate(weekStart);
  const weekEndStr   = formatDate(now);

  const subject = 'Weekly AI Intelligence Report \u2014 ' + weekStartStr + ' to ' + weekEndStr;

  const summary = [
    'Weekly AI Intelligence Report',
    weekStartStr + '  \u2192  ' + weekEndStr,
    '',
    'PROMPTS',
    '  New this week : ' + promptRows.length,
    '  Top Prompt    : ' + topPrompt,
    '',
    'INTERESTING AI',
    '  New this week : ' + interestingRows.length,
    '  Top Product   : ' + topProduct,
    '',
    'AI FINDS',
    '  New this week : ' + aiFindsRows.length,
    '  Top Find      : ' + topFind,
    '',
    'ALL-TIME TOTALS',
    '  Prompts   : ' + Math.max(0, promptsSheet.getLastRow() - 1),
    '  Products  : ' + Math.max(0, interSheet.getLastRow() - 1),
    '  AI Finds  : ' + Math.max(0, aiFindsSheet.getLastRow() - 1),
    '',
    'Keep building.'
  ].join('\n');

  const htmlBody = buildReportHtml({
    weekStartStr: weekStartStr,
    weekEndStr:   weekEndStr,
    prompts:  { count: promptRows.length,      name: topPrompt,  url: topPromptRow  ? String(topPromptRow[3])  : '' },
    products: { count: interestingRows.length, name: topProduct, url: topProductRow ? String(topProductRow[3]) : '' },
    finds:    { count: aiFindsRows.length,     name: topFind,    url: topFindRow    ? String(topFindRow[4])    : '' },
    totals: {
      prompts:  Math.max(0, promptsSheet.getLastRow() - 1),
      products: Math.max(0, interSheet.getLastRow() - 1),
      finds:    Math.max(0, aiFindsSheet.getLastRow() - 1)
    }
  });

  if (weeklySheet) {
    weeklySheet.appendRow([
      weekStartStr, weekEndStr,
      promptRows.length, interestingRows.length, aiFindsRows.length,
      topPrompt, topProduct, topFind, summary, 'No'
    ]);
  }

  GmailApp.sendEmail(WEEKLY_REPORT_EMAIL, subject, summary, {
    name: 'TAAFT Automation',
    htmlBody: htmlBody
  });

  if (weeklySheet) {
    weeklySheet.getRange(weeklySheet.getLastRow(), 10).setValue('Yes');
  }

  Logger.log('📧 Weekly report sent');
}

// ── HTML email builder ────────────────────────────────────────────────────

function buildReportHtml(d) {
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function trunc(s) {
    s = String(s || '');
    return s.length > 70 ? s.slice(0, 67).trim() + '\u2026' : s;
  }

  function linked(name, url) {
    if (!name || name === 'None') return '<span style="color:#9ca3af;">None</span>';
    var clean = trunc(stripMarkdown(name));
    return url
      ? '<a href="' + esc(url) + '" style="color:#2563eb;text-decoration:none;font-weight:600;">' + esc(clean) + '</a>'
      : esc(clean);
  }

  var sectionStyle =
    'background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;' +
    'padding:16px 20px;margin-bottom:14px;';

  function row(label, value) {
    return ''
      + '<tr>'
      +   '<td style="padding:4px 0;">' + label + '</td>'
      +   '<td style="padding:4px 0;text-align:right;font-weight:600;color:#111827;">' + value + '</td>'
      + '</tr>';
  }

  function section(emoji, title, count, topLabel, topValueHtml) {
    return ''
      + '<div style="' + sectionStyle + '">'
      +   '<div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">'
      +     emoji + ' ' + title
      +   '</div>'
      +   '<div style="font-size:28px;font-weight:700;color:#111827;margin:4px 0;">'
      +     count + ' <span style="font-size:13px;font-weight:400;color:#6b7280;">new this week</span>'
      +   '</div>'
      +   '<div style="font-size:14px;color:#374151;">' + topLabel + ': ' + topValueHtml + '</div>'
      + '</div>';
  }

  return ''
    + '<div style="max-width:520px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">'
    +   '<div style="text-align:center;padding:8px 0 20px;">'
    +     '<div style="font-size:20px;font-weight:700;color:#111827;">&#128202; Weekly AI Intelligence Report</div>'
    +     '<div style="font-size:13px;color:#6b7280;margin-top:2px;">' + esc(d.weekStartStr) + ' &rarr; ' + esc(d.weekEndStr) + '</div>'
    +   '</div>'

    +   section('&#128204;', 'Prompts', d.prompts.count, 'Top prompt', linked(d.prompts.name, d.prompts.url))
    +   section('&#129302;', 'Interesting AI', d.products.count, 'Top product', linked(d.products.name, d.products.url))
    +   section('&#128269;', 'AI Finds', d.finds.count, 'Top find', linked(d.finds.name, d.finds.url))

    +   '<div style="' + sectionStyle + '">'
    +     '<div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">All-time totals</div>'
    +     '<table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">'
    +       row('Prompts',  d.totals.prompts)
    +       row('Products', d.totals.products)
    +       row('AI Finds', d.totals.finds)
    +     '</table>'
    +   '</div>'

    +   '<div style="text-align:center;padding:4px 0 12px;">'
    +     '<a href="https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit"'
    +       ' style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;'
    +       'font-weight:600;font-size:14px;padding:10px 24px;border-radius:8px;">'
    +       'Open Google Sheet &rarr;'
    +     '</a>'
    +   '</div>'

    +   '<div style="text-align:center;color:#6b7280;font-size:14px;padding:8px 0 24px;">Keep building. &#128640;</div>'
    + '</div>';
}


// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function findMarker(body, markers, fromIndex) {
  fromIndex = fromIndex || 0;
  let earliest = -1;
  markers.forEach(m => {
    const idx = body.indexOf(m, fromIndex);
    if (idx !== -1 && (earliest === -1 || idx < earliest)) earliest = idx;
  });
  return earliest;
}

function getRowsThisWeek(sheet, weekStart) {
  return sheet.getDataRange().getValues().slice(1).filter(row => {
    if (!row[0]) return false;
    const d = row[0] instanceof Date ? row[0] : new Date(row[0]);
    return d >= weekStart;
  });
}

function formatDate(d) {
  return Utilities.formatDate(
    d instanceof Date ? d : new Date(d),
    Session.getScriptTimeZone(), 'yyyy-MM-dd'
  );
}

function stripMarkdown(text) {
  return text
    .replace(/\[(\*{1,2})?(.+?)(\*{1,2})?\]\(https?:\/\/[^\)]+\)/g, '$2')
    .replace(/\*{1,2}(.+?)\*{1,2}/g, '$1')
    .replace(/_{1,2}(.+?)_{1,2}/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .replace(/`(.+?)`/g, '$1')
    .trim();
}

function extractFirstUrl(strings) {
  const re = /https?:\/\/[^\s)\]>]+/;
  for (const s of strings) {
    const m = s.match(re);
    if (m) return m[0];
  }
  return '';
}

function classifyFind(title, summary) {
  const t = (title + ' ' + summary).toLowerCase();
  if (/course|tutorial|learn|university|school|student|stanford|harvard|cs50|education|lesson|teach|free series/.test(t)) return 'Learning';
  if (/research|paper|study|arxiv|findings|scientist|lab|published|worm|cyberattack|attack/.test(t))  return 'Research';
  if (/robot|hardware|device|physical|telescope|sensor|drone|chip|wearable/.test(t))                  return 'Hardware';
  if (/fund|raise|billion|million|invest|acqui|ipo|valuation|series [abc]/.test(t))                   return 'Business';
  if (/law|regulat|ban|policy|govern|congress|eu|act|rule|legal|surveillance/.test(t))                return 'Policy';
  if (/launch|release|ship|update|version|feature|announce/.test(t))                                  return 'Product';
  return 'Industry';
}

function guessCategory(text) {
  if (/robot|drone|hardware|sensor|telescope|device|chip|wearable|recorder|compass/.test(text)) return 'Hardware';
  if (/video|image|photo|art|generat|diffusion|design|creative/.test(text)) return 'Generative AI';
  if (/code|developer|engineer|github|terminal|ide|programming/.test(text)) return 'Dev Tools';
  if (/write|copy|content|blog|essay|document|editor/.test(text))           return 'Writing';
  if (/search|browser|web|crawl|index/.test(text))                          return 'Search';
  if (/voice|audio|speech|music|sound|podcast/.test(text))                  return 'Audio';
  if (/health|medical|doctor|clinic|patient|hipaa|brain|stress/.test(text)) return 'Health';
  if (/finance|bank|invest|trading|stock|tax/.test(text))                   return 'Finance';
  if (/chat|assistant|agent|automat|workflow/.test(text))                   return 'Agent / Assistant';
  if (/data|analytic|dashboard|bi|insight/.test(text))                      return 'Analytics';
  return 'AI Tool';
}

function guessCountry(text) {
  if (/india|bengaluru|mumbai|delhi|hyderabad|indian/.test(text)) return 'India';
  if (/china|chinese|beijing|shanghai|alibaba|baidu/.test(text))  return 'China';
  if (/uk|britain|london|british/.test(text))                     return 'UK';
  if (/canada|toronto|montreal|vancouver/.test(text))             return 'Canada';
  if (/france|paris|french|mistral/.test(text))                   return 'France';
  if (/germany|berlin|german|munich/.test(text))                  return 'Germany';
  if (/israel|tel aviv/.test(text))                               return 'Israel';
  if (/japan|tokyo|japanese/.test(text))                          return 'Japan';
  if (/korea|seoul|korean/.test(text))                            return 'Korea';
  return 'USA';
}


// ═══════════════════════════════════════════════════════════════════════════
// ONE-TIME CLEANUP — run once to fix old rows in 'AI Finds':
// strips markdown, splits "_[**Name**](url) description..." rows into
// proper Title / Summary / Link columns.
// ═══════════════════════════════════════════════════════════════════════════

function cleanMarkdownInSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('AI Finds');
  const data = sheet.getDataRange().getValues();

  for (let r = 1; r < data.length; r++) {
    let title   = String(data[r][1] || '');
    let link    = String(data[r][4] || '');

    // Row saved as one markdown blob: "_[**Name**](url) description..."
    const md = title.match(/\[\*{0,2}([^\]*]+?)\*{0,2}\]\((https?:\/\/[^)]+)\)\s*(.*)/);
    let rest = '';
    if (md) {
      title = md[1];
      if (!link) link = md[2];
      rest = stripMarkdown(md[3]);
    } else if (title.length > 70 && !data[r][2]) {
      // Plain-text blob from old daily rows: "Name walks you through ..."
      const parts = splitNameAndDescription(stripMarkdown(title));
      if (parts.description) {
        const t = parts.title.trim();
        if (t.length >= 3 && t.length < title.length) {
          title = t;
          rest  = parts.description;
        }
      }
    }

    data[r][1] = stripMarkdown(title);
    if (rest) {
      const sum = stripMarkdown(String(data[r][3] || ''));
      data[r][3] = sum === rest ? rest : (rest + (sum ? '. ' + sum : '')).trim();
    } else {
      data[r][3] = stripMarkdown(String(data[r][3] || ''));
    }
    data[r][4] = link;
  }

  sheet.getRange(1, 1, data.length, Math.max(6, data[0].length)).setValues(data);
  Logger.log('Cleaned ' + (data.length - 1) + ' rows');
}


// ═══════════════════════════════════════════════════════════════════════════
// PREVIEW — sends a test report WITHOUT writing to the Weekly Reports sheet
// Run this manually to check how the email looks.
// ═══════════════════════════════════════════════════════════════════════════

function previewReportEmail() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const promptRows      = getRowsThisWeek(ss.getSheetByName('Prompts'), weekStart);
  const aiFindsRows     = getRowsThisWeek(ss.getSheetByName('AI Finds'), weekStart);
  const interestingRows = getRowsThisWeek(ss.getSheetByName('Interesting AI'), weekStart);

  const last = rows => rows.length > 0 ? rows[rows.length - 1] : null;
  const pRow = last(promptRows), iRow = last(interestingRows), fRow = last(aiFindsRows);

  GmailApp.sendEmail(
    WEEKLY_REPORT_EMAIL,
    '[TEST] Weekly AI Intelligence Report',
    'Plain text fallback',
    {
      name: 'TAAFT Automation',
      htmlBody: buildReportHtml({
        weekStartStr: formatDate(weekStart),
        weekEndStr:   formatDate(new Date()),
        prompts:  { count: promptRows.length,      name: pRow ? pRow[1] : 'None', url: pRow ? String(pRow[3]) : '' },
        products: { count: interestingRows.length, name: iRow ? iRow[1] : 'None', url: iRow ? String(iRow[3]) : '' },
        finds:    { count: aiFindsRows.length,     name: fRow ? fRow[1] : 'None', url: fRow ? String(fRow[4]) : '' },
        totals: {
          prompts:  Math.max(0, ss.getSheetByName('Prompts').getLastRow() - 1),
          products: Math.max(0, ss.getSheetByName('Interesting AI').getLastRow() - 1),
          finds:    Math.max(0, ss.getSheetByName('AI Finds').getLastRow() - 1)
        }
      })
    }
  );
  Logger.log('Preview sent');
}
