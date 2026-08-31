// ═══════════════════════════════════════════════════════════════════════════
// COMPOSER — AI This Week Issue #1 draft generator
//
// HOW TO USE:
//   Just run composeIssue — no ranking needed.
//   • If Rank column is empty → auto-picks 10 most recent items + dashboard.
//   • If you DO put values in Rank (x, ✓, or 1..10) → those are used instead.
//   Draft is sent only to you as [DRAFT]. Forward when happy.
// ═══════════════════════════════════════════════════════════════════════════

const COMPOSER_SHEET_ID = ATW_SPREADSHEET_ID;  // same spreadsheet
const COMPOSER_RECIPIENT = Session.getActiveUser().getEmail();
const COMPOSER_SUBJECT_PREFIX = '[DRAFT] AI This Week — Issue #1';
const COMPOSER_FINAL_PREFIX   = 'AI This Week';

// ── AUTO-SEND TRIGGERS ───────────────────────────────────────────────────
// Run ONE of these once to schedule automatic digests.
// They do NOT delete your daily collector trigger.

function createWeeklyAutoTrigger() {
  ScriptApp.newTrigger('sendAutoDigest')
    .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(9).create();
  Logger.log('✅ Weekly auto-digest scheduled: every Sunday 9am');
}

function create3DayAutoTrigger() {
  ScriptApp.newTrigger('sendAutoDigest')
    .timeBased().everyDays(3).atHour(9).create();
  Logger.log('✅ Auto-digest scheduled: every 3 days at 9am');
}

function removeAutoDigestTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'sendAutoDigest') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Removed auto-digest triggers');
}

// Called by the trigger — sends FINAL digest (no [DRAFT] prefix)
function sendAutoDigest() {
  composeIssueInternal(false);
}

function composeIssue() {
  composeIssueInternal(true);
}

function composeIssueInternal(isDraft) {
  const ss = SpreadsheetApp.openById(COMPOSER_SHEET_ID);

  // ── 1. Weekly dashboard counts (last 7 days, per source + TLDR edition) ──
  var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  var dashboard = buildDashboard(ss, cutoff);

  // ── 2. Collect picked items (any non-empty Rank cell = selected) ────────
  //     Put 1..10, x, or ✓ — numeric ranks sort first, then the rest by date.
  var ranked = [];
  var dated = [];
  ['TLDR', 'The Rundown AI', "Ben's Bites"].forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return;
    var header = values[0].map(function(h){ return String(h).toLowerCase(); });
    var titleIdx = header.indexOf('item title');
    var urlIdx   = header.indexOf('url');
    var rankIdx  = header.indexOf('rank');
    var editionIdx = header.indexOf('edition');
    var dateIdx  = header.indexOf('date');

    values.slice(1).forEach(function(r) {
      var rawRank = String(r[rankIdx] || '').trim();
      if (!rawRank) return;                          // not picked
      var numRank = parseInt(rawRank, 10);
      var entry = {
        rank: isNaN(numRank) ? 999 : numRank,        // x/✓ → 999 (sorted after numbered)
        rawRank: rawRank,
        date: r[dateIdx] || '',
        source: tabName,
        edition: editionIdx !== -1 ? String(r[editionIdx] || '') : '',
        title: String(r[titleIdx] || ''),
        url: String(r[urlIdx] || '')
      };
      if (!isNaN(numRank)) ranked.push(entry);
      else dated.push(entry);
    });
  });

  // Sort dated picks by date descending (newest first) after ranked ones
  dated.sort(function(a,b){
    var da = a.date instanceof Date ? a.date : new Date(a.date);
    var db = b.date instanceof Date ? b.date : new Date(b.date);
    return db - da;
  });
  var picks = ranked.sort(function(a,b){return a.rank-b.rank;}).concat(dated);

  if (picks.length === 0) {
    Logger.log('No manual picks — auto-picking 10 most recent items from last 7 days.');
    picks = autoPick(ss, cutoff, 10);
    if (picks.length === 0) {
      Logger.log('No items found in last 7 days.');
      return;
    }
  }

  // Top picks first, rest after dashboard
  var subjectPrefix = isDraft ? COMPOSER_SUBJECT_PREFIX : COMPOSER_FINAL_PREFIX;
  var senderName = isDraft ? 'AI This Week (Draft)' : 'AI This Week';
  var html = buildIssueHtml(picks, dashboard, isDraft);
  var plain = picks.map(function(it, i){
    return (i+1) + '. ' + it.title + (it.url ? ' — ' + it.url : '') + ' [' + it.source + (it.edition ? '/' + it.edition : '') + ']';
  }).join('\n') + '\n\n--- Dashboard (last 7 days) ---\n' + dashboard.plain;

  GmailApp.sendEmail(COMPOSER_RECIPIENT,
    subjectPrefix + ' (' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d') + ')',
    plain,
    { name: senderName, htmlBody: html }
  );

  Logger.log((isDraft ? 'Draft' : 'Auto-digest') + ' sent: ' + picks.length + ' picks + dashboard to ' + COMPOSER_RECIPIENT);
}

function autoPick(ss, cutoff, n) {
  var all = [];
  ['TLDR', 'The Rundown AI', "Ben's Bites"].forEach(function(tabName){
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return;
    var header = values[0].map(function(h){ return String(h).toLowerCase(); });
    var titleIdx = header.indexOf('item title');
    var urlIdx   = header.indexOf('url');
    var dateIdx  = header.indexOf('date');
    var editionIdx = header.indexOf('edition');
    values.slice(1).forEach(function(r){
      var d = r[dateIdx] instanceof Date ? r[dateIdx] : new Date(r[dateIdx]);
      if (isNaN(d) || d < cutoff) return;
      var title = String(r[titleIdx] || '').trim();
      if (!title || title === '(no links parsed)') return;
      all.push({
        rank: 999,
        date: d,
        source: tabName,
        edition: editionIdx !== -1 ? String(r[editionIdx] || '') : '',
        title: title,
        url: String(r[urlIdx] || '')
      });
    });
  });
  all.sort(function(a,b){ return b.date - a.date; });
  return all.slice(0, n);
}

function buildDashboard(ss, cutoff) {
  var perSource = {};
  var perEdition = {};
  var total = 0;

  ['TLDR', 'The Rundown AI', "Ben's Bites"].forEach(function(tabName){
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return;
    var header = values[0].map(function(h){ return String(h).toLowerCase(); });
    var dateIdx = header.indexOf('date');
    var editionIdx = header.indexOf('edition');
    values.slice(1).forEach(function(r){
      var d = r[dateIdx] instanceof Date ? r[dateIdx] : new Date(r[dateIdx]);
      if (isNaN(d) || d < cutoff) return;
      total++;
      perSource[tabName] = (perSource[tabName] || 0) + 1;
      if (tabName === 'TLDR' && editionIdx !== -1) {
        var ed = String(r[editionIdx] || '—');
        perEdition[ed] = (perEdition[ed] || 0) + 1;
      }
    });
  });

  // Plain-text version for fallback
  var plain = 'Total: ' + total + '\n'
    + Object.keys(perSource).sort().map(function(k){ return '  ' + k + ': ' + perSource[k]; }).join('\n')
    + (Object.keys(perEdition).length ? '\nTLDR by edition:\n' + Object.keys(perEdition).sort().map(function(k){ return '  ' + k + ': ' + perEdition[k]; }).join('\n') : '');

  // HTML tables
  function rows(obj){
    return Object.keys(obj).sort().map(function(k){
      return '<tr><td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;">' + k + '</td>'
           + '<td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;">' + obj[k] + '</td></tr>';
    }).join('');
  }

  var html =
    '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:0 12px 14px;">'
    + '<div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Dashboard — last 7 days</div>'
    + '<table style="width:100%;font-size:13px;border-collapse:collapse;"><tr style="background:#f9fafb;"><td style="padding:5px 10px;font-weight:700;">Source</td><td style="padding:5px 10px;text-align:right;font-weight:700;">Items</td></tr>'
    + rows(perSource)
    + '<tr style="background:#f9fafb;font-weight:700;"><td style="padding:5px 10px;">Total</td><td style="padding:5px 10px;text-align:right;">' + total + '</td></tr>'
    + '</table>'
    + (Object.keys(perEdition).length
        ? '<table style="width:100%;font-size:13px;border-collapse:collapse;margin-top:10px;"><tr style="background:#f9fafb;"><td style="padding:5px 10px;font-weight:700;">TLDR Edition</td><td style="padding:5px 10px;text-align:right;font-weight:700;">Items</td></tr>'
          + rows(perEdition) + '</table>'
        : '')
    + '</div>';

  return { html: html, plain: plain, perSource: perSource, perEdition: perEdition, total: total };
}

function buildIssueHtml(items, dashboard, isDraft) {
  if (isDraft === undefined) isDraft = true;
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  var rows = items.map(function(it, i){
    var n = i + 1;
    var badge = n <= 3 ? 'background:#fef3c7;color:#92400e;' : 'background:#f3f4f6;color:#374151;';
    var link = it.url
      ? '<a href="' + esc(it.url) + '" style="color:#2563eb;text-decoration:none;font-weight:600;">' + esc(it.title) + '</a>'
      : esc(it.title);
    var meta = [it.source, it.edition].filter(Boolean).join(' · ');
    return ''
      + '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f3f4f6;">'
      + '<div style="min-width:28px;height:28px;border-radius:50%;' + badge + 'display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;">' + n + '</div>'
      + '<div style="flex:1;">'
      + '<div style="font-size:15px;line-height:1.4;">' + link + '</div>'
      + '<div style="font-size:12px;color:#9ca3af;margin-top:4px;">' + esc(meta) + '</div>'
      + '</div></div>';
  }).join('');

  return ''
    + '<div style="max-width:560px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#fafafa;padding:0;">'
    + '<div style="text-align:center;padding:28px 0 18px;">'
    + '<div style="font-size:22px;font-weight:800;letter-spacing:-0.8px;color:#111827;">AI This Week <span style="color:#2563eb;">#1</span></div>'
    + '<div style="font-size:13px;color:#6b7280;margin-top:6px;">' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy') + ' &middot; ' + items.length + ' stories &middot; 4 min read</div>'
    + '</div>'
    + (dashboard ? dashboard.html : '')
    + '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;margin:0 12px;">'
    + rows
    + '</div>'
    + '<div style="text-align:center;padding:16px 0 6px;">'
    + '<a href="https://docs.google.com/spreadsheets/d/' + COMPOSER_SHEET_ID + '/edit"'
    + ' style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:10px 22px;border-radius:8px;">Open Google Sheet &rarr;</a>'
    + '</div>'
    + '<div style="text-align:center;color:#9ca3af;font-size:12px;padding:8px 0 28px;">' + (isDraft ? 'Draft — auto-picked from last 7 days. Put values in Rank to override.' : 'AI This Week — auto-sent weekly.') + '</div>'
    + '</div>';
}
