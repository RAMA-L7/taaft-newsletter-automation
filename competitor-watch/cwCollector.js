// ═══════════════════════════════════════════════════════════════════════════
// CW COLLECTOR v1 — "Competitor Watch" pilot engine
//
// Model: WE subscribe to competitor newsletters / changelogs from OUR account.
// Clients only give us: competitor sender addresses + their briefing email.
//
// SHEETS (created by setupCW):
//   Clients   — config: ClientID | ClientName | RecipientEmails | SenderAddress | BrandColor
//               (one ROW PER COMPETITOR SENDER; same client can have many rows)
//   Raw Feed  — every parsed item: Date | ClientID | Source | Title | URL
//   Sent Log  — briefings sent: Date | ClientID | ItemsCount | Status
//
// TRIGGERS:
//   daily 6am  → collectCompetitorItems()
//   Friday 9am → sendWeeklyBriefings()   (Friday chosen so pilots differ from
//                                         ai-this-week's Sunday cadence)
//
// SETUP: run setupCW() once → fill Clients tab → createTriggersCW() once.
// ═══════════════════════════════════════════════════════════════════════════

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';
const DAYS_BACK      = 8;
const BRAND_NAME     = 'RivalRadar';          // working product name — rename anytime
const FROM_NAME      = 'RivalRadar Briefings';

// ── Run once ───────────────────────────────────────────────────────────────

function setupCW() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  let clients = ss.getSheetByName('Clients') || ss.insertSheet('Clients');
  clients.getRange(1, 1, 1, 5).setValues([[
    'ClientID', 'ClientName', 'RecipientEmails', 'SenderAddress', 'BrandColor'
  ]]);
  // Example row (delete after reading):
  // acme | Acme Inc | ceo@acme.com, pm@acme.com | newsletter@competitor.com | #2563eb

  ss.getSheetByName('Raw Feed') || ss.insertSheet('Raw Feed');
  ss.getSheetByName('Raw Feed').getRange(1, 1, 1, 5).setValues([[
    'Date', 'ClientID', 'Source', 'Title', 'URL'
  ]]);

  ss.getSheetByName('Sent Log') || ss.insertSheet('Sent Log');
  ss.getSheetByName('Sent Log').getRange(1, 1, 1, 4).setValues([[
    'Date', 'ClientID', 'ItemsCount', 'Status'
  ]]);

  Logger.log('✅ CW sheets ready');
}

function createTriggersCW() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('collectCompetitorItems')
    .timeBased().everyDays(1).atHour(6).create();
  ScriptApp.newTrigger('sendWeeklyBriefings')
    .timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(9).create();
  Logger.log('✅ CW triggers created');
}

// ── DAILY: collect items per configured competitor sender ──────────────────

function collectCompetitorItems() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const clients = ss.getSheetByName('Clients');
  const feed = ss.getSheetByName('Raw Feed');

  const done = new Set(
    feed.getDataRange().getValues().slice(1)
      .map(r => r.join('|')).filter(Boolean)
  );

  // Build map: sender address → [{clientID, brandColor}]
  const routes = {};
  clients.getDataRange().getValues().slice(1).forEach(r => {
    if (!r[3]) return;
    const key = String(r[3]).trim().toLowerCase();
    (routes[key] = routes[key] || []).push({
      id: r[0], color: r[4] || '#2563eb'
    });
  });

  const senders = Object.keys(routes);
  if (senders.length === 0) { Logger.log('No competitors configured'); return; }

  const query = '(' + senders.map(s => 'from:' + s).join(' OR ') +
                ') newer_than:' + DAYS_BACK + 'd';
  let added = 0;

  GmailApp.search(query, 0, 50).forEach(thread => {
    thread.getMessages().forEach(msg => {
      const from = extractAddress(msg.getFrom()).toLowerCase();
      const route = routes[from];
      if (!route) return;

      extractItems(msg.getPlainBody() || '').forEach(it => {
        route.forEach(r => {
          const row = [
            Utilities.formatDate(msg.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
            r.id,
            from,
            it.title,
            it.url
          ];
          if (!done.has(row.join('|'))) {
            feed.appendRow(row);
            added++;
          }
        });
      });
    });
  });

  Logger.log('Added ' + added + ' items across ' + Object.keys(routes).length + ' senders');
}

// ── WEEKLY: compose + send one briefing per client ─────────────────────────

function sendWeeklyBriefings() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const feed = ss.getSheetByName('Raw Feed').getDataRange().getValues().slice(1);
  const clients = ss.getSheetByName('Clients').getDataRange().getValues().slice(1);
  const log = ss.getSheetByName('Sent Log');

  // Group this week's items by client
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const byClient = {};

  feed.forEach(r => {
    if (!r[0] || new Date(r[0]) < cutoff) return;
    (byClient[r[1]] = byClient[r[1]] || []).push({ source: r[2], title: r[3], url: r[4] });
  });

  // One email per unique clientID+recipient set
  const sent = new Set();
  clients.forEach(c => {
    const id = c[0];
    if (!id || !byClient[id] || sent.has(id)) return;
    sent.add(id);

    const items = byClient[id].sort((a, b) => a.source < b.source ? -1 : 1);
    const html = buildBriefingHtml(String(c[1]), String(c[4] || '#2563eb'), items);

    GmailApp.sendEmail(c[2],
      BRAND_NAME + ': What your rivals shipped this week (' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d') + ')',
      'Open in HTML-capable client for the full briefing.',
      { name: FROM_NAME, htmlBody: html });

    log.appendRow([
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      id, items.length, 'Sent'
    ]);
    Logger.log('Sent briefing to ' + id + ' (' + items.length + ' items)');
  });
}

// ── HTML briefing (emoji-safe entities, inline CSS) ────────────────────────

function buildBriefingHtml(clientName, color, items) {
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  var sections = '';
  var bySource = {};
  items.forEach(it => (bySource[it.source] = bySource[it.source] || []).push(it));

  Object.keys(bySource).sort().forEach(src => {
    var lis = bySource[src].map(it =>
      '<li style="margin-bottom:8px;"><a href="' + esc(it.url) +
      '" style="color:' + esc(color) + ';text-decoration:none;font-weight:600;">' +
      esc(it.title.slice(0, 90)) + '</a></li>'
    ).join('');
    sections +=
      '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;margin-bottom:12px;">' +
      '<div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">' +
      esc(src) + '</div><ul style="margin:0;padding-left:18px;">' + lis + '</ul></div>';
  });

  return ''
    + '<div style="max-width:560px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">'
    + '<div style="text-align:center;padding:10px 0 20px;">'
    + '<div style="font-size:19px;font-weight:800;color:#111827;">' + esc(BRAND_NAME)
    + ' <span style="color:' + esc(color) + '">&#128225;</span></div>'
    + '<div style="font-size:14px;color:#374151;margin-top:4px;">Hi ' + esc(clientName)
    + ' &mdash; here\'s what your rivals shipped.</div>'
    + '<div style="font-size:12px;color:#9ca3af;margin-top:2px;">'
    + items.length + ' updates &middot; week of '
    + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d') + '</div>'
    + '</div>' + sections
    + '<div style="text-align:center;color:#9ca3af;font-size:12px;padding:14px 0 26px;">'
    + 'Curated weekly by ' + esc(BRAND_NAME) + '</div></div>';
}

// ── Shared utilities (same patterns as TAAFT/ATW) ──────────────────────────

function extractAddress(fromField) {
  const m = String(fromField).match(/<([^>]+)>/);
  return m ? m[1] : String(fromField).split(' ').pop();
}

function extractItems(body) {
  const items = [];
  const seen = {};
  const mdRe = /\[([^\]\n]{4,120})\]\((https?:\/\/[^\s)]+)\)/g;
  let m;
  while ((m = mdRe.exec(body)) !== null) {
    if (!seen[m[2]] && !isNoise(m[2], m[1])) {
      seen[m[2]] = true;
      items.push({ title: m[1].trim(), url: m[2] });
    }
  }
  if (items.length < 5) {
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach((line, i) => {
      const um = line.match(/https?:\/\/[^\s)\]>]+/);
      if (um && !seen[um[0]] && !isNoise(um[0], line) && i > 0) {
        seen[um[0]] = true;
        items.push({ title: stripBasic(lines[i - 1]).slice(0, 120), url: um[0] });
      }
    });
  }
  return items;
}

function isNoise(url, text) {
  return /unsubscribe|privacy|terms|\.png|\.jpg|\.gif|\.webp|cdn|beehiiv|mailto:/i.test(url)
      || /unsubscribe|view online|read online|manage preferences/i.test(text);
}

function stripBasic(t) {
  return t.replace(/[*_#>`]/g, '').trim();
}
