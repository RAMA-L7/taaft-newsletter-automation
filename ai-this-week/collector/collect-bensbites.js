// ═══════════════════════════════════════════════════════════════════════════
// COLLECTOR — Ben's Bites (hosted on Substack)
//
// Substack wraps all links in substack.com/redirect/... and the plain-text
// body carries little headline text. Strategy mirrors the TLDR collector:
//   1. pull every non-junk URL,
//   2. RESOLVE substack redirects to the real destination,
//   3. title from the final URL's slug.
// (resolveRedirect + slugTitle live in collect-tldr.js — global in Apps Script)
// ═══════════════════════════════════════════════════════════════════════════

var BB_SENDERS = ['bensbites@substack.com'];

function collectBensBites(sheet) {
  if (BB_SENDERS.length === 0) return 0;
  return collectFromSenders(sheet, loadDoneKeys(sheet), {
    name: "Ben's Bites",
    senders: BB_SENDERS,
    daysBack: ATW_DAYS_BACK,
    extractor: extractBbItems,
    withEdition: false
  });
}

function extractBbItems(body) {
  var seen = {};
  var items = [];
  var cache = {};
  var usedUrls = {};        // raw redirect URLs consumed by pass 1

  // ── Pass 1: text-based extraction from the Headlines section ──────────
  // Body format: "Headline text [ https://substack.com/redirect/xxx ]"
  var norm = body.replace(/[’‘]/g, "'");
  var hs = norm.search(/^Headlines\s*$/m);
  var he = norm.length;
  ['My feed', 'Subscribed', 'Afters'].forEach(function(marker) {
    var idx = norm.indexOf(marker, hs);
    if (idx !== -1 && idx < he) he = idx;
  });

  if (hs !== -1) {
    var section = norm.slice(hs + 'Headlines'.length, he);

    // Remember every redirect URL that appears inside this section so
    // pass 2 doesn't double-count them.
    var secUrls = section.match(/https?:\/\/[^\s)\]>]+/g) || [];
    secUrls.forEach(function(u){ usedUrls[cleanUrl(u)] = true; });

    section.split('\n').forEach(function(rawLine) {
      var line = stripBasic(rawLine).trim();

      // Pull the inline link out of the sentence first
      var url = '';
      var um = line.match(/\[\s*(https?:\/\/[^\s)\]]+)/);
      if (!um) um = line.match(/https?:\/\/[^\s)\]>]+/);
      if (um) {
        url = cleanUrl(um[1] || um[0]);
        if (/substack\.com\/redirect/.test(url)) {
          url = cache[url] !== undefined ? cache[url] : resolveRedirect(url, cache);
        }
        if (url && (isJunkHost(url) || /bensbites\.com\/p\//.test(url))) url = '';
      }

      // Title = sentence with the bracketed link removed
      var clean = line.replace(/\[\s*https?:\/\/[^\]]*\]\s*/i, '')
                      .replace(/https?:\/\/[^\s)\]>]+/g, '')
                      .replace(/\[\s*\]\s*/, '')
                      .replace(/\s+\./g, '.')          // " ." left by stripped links
                      .replace(/\s+/g, ' ')
                      .trim();
      if (clean.length < 12 || isJunkTitle(clean)) return;
      var title = firstSentence(clean);
      if (title.length < 12 || isJunkTitle(title)) return;

      var key = title.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      items.push({ title: title, url: url });
    });
  }

  // ── Pass 2: remaining bare URLs elsewhere in the email ────────────────
  lines2(body, usedUrls).forEach(function(pair) {
    if (seen[pair.title.toLowerCase()]) return;
    seen[pair.title.toLowerCase()] = true;
    items.push(pair);
  });

  return items;
}

// "You can connect ChatGPT to Apple Messages. It can search..." → first sentence
function firstSentence(s) {
  s = String(s).replace(/\s+/g, ' ').trim();
  var m = s.match(/^(.{12,100}?[.!?])(\s|$)/);
  return m ? m[1] : s.slice(0, 100).replace(/\s+\S*$/, '');
}

// helper: iterate bare URLs NOT already consumed by pass 1
var bbLinkCache = {};
function lines2(body, usedUrls) {
  var out = [];
  var seenUrl = {};
  var lines = body.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
  lines.forEach(function(line) {
    var um = line.match(/https?:\/\/[^\s)\]>]+/);
    if (!um) return;
    var url = cleanUrl(um[0]);
    if (!url || seenUrl[url] || isNoise(url, line)) return;
    if (usedUrls[url]) return;                       // consumed by pass 1

    var finalUrl = url;
    if (/substack\.com\/redirect/.test(url)) {
      finalUrl = bbLinkCache[url] !== undefined ? bbLinkCache[url] : resolveRedirect(url, bbLinkCache);
    }
    if (!finalUrl || seenUrl[finalUrl]) return;
    if (/substack\.com|open\.substack\.com/i.test(finalUrl) &&
        !/\.substack\.com\/p\//.test(finalUrl)) { seenUrl[url] = true; return; }
    if (/bensbites\.com\/p\//.test(finalUrl)) { seenUrl[url] = true; return; }
    if (isJunkHost(finalUrl)) { seenUrl[url] = true; return; }

    seenUrl[url] = true; seenUrl[finalUrl] = true;
    var t2 = slugTitle(finalUrl);
    if (!t2 || t2.length < 12) return;              // skip blank/ID-only titles
    out.push({ title: t2, url: finalUrl });
  });
  return out;
}
