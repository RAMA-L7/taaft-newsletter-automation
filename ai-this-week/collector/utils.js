// ═══════════════════════════════════════════════════════════════════════════
// UTILS — shared collection engine used by every per-company collector page
// ═══════════════════════════════════════════════════════════════════════════

// Core engine: search one company's senders, parse items, append to its tab.
// Dedupe keys are scoped to this sheet (MsgID|Title|URL).
// Returns number of new rows.
function collectFromSenders(sheet, doneKeys, opts) {
  const query = '(' + opts.senders.map(s => 'from:' + s).join(' OR ') +
                ') newer_than:' + (opts.daysBack || 3) + 'd';
  const threads = GmailApp.search(query, 0, 30);
  let added = 0;

  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const subject = msg.getSubject();

      if (/confirm|verify your (email|subscription)|welcome to/i.test(subject)) return;

      if (opts.subjectFilters && opts.subjectFilters.length > 0) {
        if (!opts.subjectFilters.some(f => subject.indexOf(f) !== -1)) return;
      }

      const items = (opts.extractor || extractItems)(msg.getPlainBody() || '');
      const dateStr = Utilities.formatDate(
        msg.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd'
      );

      // Optional Edition column (used by TLDR)
      var edition = opts.editionExtractor
        ? opts.editionExtractor(msg.getPlainBody() || '', subject) : '';

      if (items.length === 0 && !doneKeys.has(msg.getId() + '|(no links parsed)|')) {
        sheet.appendRow(withEdition(opts,
          [msg.getId(), dateStr, subject, '(no links parsed)', '', '', ''],
          [msg.getId(), dateStr, edition, subject, '(no links parsed)', '', '', '']
        ));
        doneKeys.add(msg.getId() + '|(no links parsed)|');
        return;
      }

      items.forEach(it => {
        const key = msg.getId() + '|' + it.title + '|' + it.url;
        if (doneKeys.has(key)) return;
        doneKeys.add(key);
        sheet.appendRow(withEdition(opts,
          [msg.getId(), dateStr, subject, it.title, it.url, '', ''],
          [msg.getId(), dateStr, edition, subject, it.title, it.url, '', '']
        ));
        added++;
      });
    });
  });

  if (added > 0) Logger.log(opts.name + ': +' + added + ' items');
  return added;
}

// Build dedupe key set from a per-source tab (handles both 7-col and 8-col layouts).
function loadDoneKeys(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return new Set();
  var header = values[0].map(function(h){ return String(h).toLowerCase(); });
  var titleIdx = header.indexOf('item title');
  var urlIdx   = header.indexOf('url');
  if (titleIdx === -1) titleIdx = 3;
  if (urlIdx   === -1) urlIdx   = 4;
  // TLDR's Edition column shifts indices by +1 after Date — handled by header lookup above
  return new Set(
    values.slice(1).map(function(r){
      return r[0] + '|' + r[titleIdx] + '|' + r[urlIdx];
    }).filter(function(k){ return k.length > 2; })
  );
}

// Pick row layout: with or without Edition column (after Date)
function withEdition(opts, plainRow, editionRow) {
  return opts.withEdition ? editionRow : plainRow;
}

function extractItems(body) {
  const items = [];
  const seen = {};

  const mdRe = /\[([^\]\n]{6,140})\]\((https?:\/\/[^\s)]+)\)/g;
  let m;
  while ((m = mdRe.exec(body)) !== null) {
    const url = cleanUrl(m[2]);
    if (!url || seen[url] || isNoise(url, m[1])) continue;
    if (isJunkTitle(m[1])) continue;
    seen[url] = true;
    items.push({ title: cleanTitle(m[1]), url: url });
  }

  if (items.length < 5) {
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach((line, i) => {
      const um = line.match(/https?:\/\/[^\s)\]>]+/);
      if (!um) return;
      const url = cleanUrl(um[0]);
      if (!url || seen[url] || isNoise(url, line) || i === 0) return;

      // Bare-URL fallback: walk backwards for a real headline.
      // TLDR bodies interleave footnote URLs ("[12] https://...") between the
      // headline and article links — SKIP those lines, don't stop at them.
      let title = '';
      let skipped = 0;
      for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
        const candidate = stripBasic(lines[j]);
        if (/^\[\d+\]/.test(candidate)) { skipped++; continue; }   // footnote marker
        if (/https?:\/\//.test(candidate)) { skipped++; continue; } // URL line → step over
        if (candidate.length >= 30 && !isJunkTitle(candidate)) {
          title = candidate; break;
        }
        if (++skipped > 3) break;                                  // give up eventually
      }
      if (!title) return;
      seen[url] = true;
      items.push({ title: cleanTitle(title).slice(0, 140), url: url });
    });
  }
  return items;
}

// ── Editable blocklists ────────────────────────────────────────────────────

// Newsletter sponsor domains seen so far — append new ones as they appear
var SPONSOR_DOMAINS = [
  'dataiku.com', 'stackai.com', 'launchdarkly.com', 'openrouter.ai',
  'atlassian.com', 'granola.ai', 'lamdalabs.com', 'lambda.co',
  'allstacks.com', 'mintlify.com', 'aceternity.io', 'gravitee.io',
  'jumpcloud.com', 'figr.design', 'figr.link'
];

// Social/internal/community hosts never belong in a digest
var JUNK_HOSTS = [
  'x.com', 'twitter.com', 'linkedin.com', 'facebook.com', 'instagram.com',
  'app.therundown.ai', 'typeform.com', 'docs.google.com',
  'hub.sparklp.co', 'refer.tldr.tech', 'jobs.ashbyhq.com',
  'advertise.tldr.tech', 'figr.link', 'figr.design', 'threadreaderapp.com'
];

// One-word sentence fragments The Rundown's inline links produce
var FRAGMENT_WORDS =
  /^(claims|telling|warned|signed|launched|joined|facing|in talks|said|says|revealed|introduced|announced|reported)$/i;

// ── Filters ────────────────────────────────────────────────────────────────

function isJunkTitle(t) {
  var s = String(t).trim();
  if (s.length < 12) return true;
  if (FRAGMENT_WORDS.test(s)) return true;
  if (s.split(/\s+/).length < 2 && !/\d/.test(s)) return true;
  if (/^[0-9a-f\-]{8,}$/i.test(s.replace(/\s/g, ''))) return true;   // uuid/ID slugs
  if (!/[aeiouy]/i.test(s)) return true;                             // no vowels = garbage
  return /^(sign up|sign in|log ?in|subscribe|advertise|confirm\s?\w*|view online|read online|manage|tell us|share|track your|get started|learn more|see how|start building|start your|download|watch the|rsvp|apply here|join some|discover your|click here|for everyone else|thanks for reading|listen now|follow us|trending ai tools|everything else|highlights|release notes)\b/i.test(s);
}

// Strip tracking params + reject pure tracker hosts
function cleanUrl(raw) {
  let u = raw.replace(/[),.]+$/, '');
  // Known email click-tracker domains → cannot resolve destination, drop
  if (/track\.pstmrk\.it|click\.aweber\.com|awstrack\.me|clicks\.mlsend/i.test(u)) return '';
  try {
    u = u.replace(/([?&])(utm_[^&]*|rc|ref|ref_src|ref_url|fbclid|gclid)=[^&]*/g, '$1');
    u = u.replace(/[?&]+$/, '').replace(/\?&/, '?');
    if (u.endsWith('?')) u = u.slice(0, -1);
  } catch (e) { return ''; }
  if (/^https?:\/\/[^\/]+\.md$/i.test(u)) return '';   // DESIGN.md-style pseudo-links
  return /^https?:\/\//.test(u) ? u : '';
}

function isJunkHost(u) {
  return JUNK_HOSTS.some(function(h){ return u.indexOf(h) !== -1; })
      || SPONSOR_DOMAINS.some(function(d){ return u.indexOf(d) !== -1; });
}

// Markdown artifacts off titles
function cleanTitle(t) {
  return String(t)
    .replace(/^\*+|\*+$/g, '')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^\w"'(\[]+/, '')     // leading emoji/punct
    .trim();
}

function isNoise(url, text) {
  var t = String(text);
  return isJunkHost(url)
      || /unsubscribe|privacy|terms|policy|\.png|\.jpg|\.gif|\.webp|\.svg|cdn\.|beehiiv|mailto:|refer\.|\/subscribe$|\/signup$|\/login|\/advertise|\.md$/i.test(url)
      || /unsubscribe|view online|read online|manage preferences|advertise|tell your friends|track your referrals|sponsor|presented by|together with|partner/i.test(t);
}

function stripBasic(t) {
  return t.replace(/[*_#>`]/g, '').trim();
}
