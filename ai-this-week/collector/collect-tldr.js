// ═══════════════════════════════════════════════════════════════════════════
// COLLECTOR — TLDR (all editions arrive from ONE sender)
//
// SPECIAL CASE: TLDR's plain-text body contains almost NO headline text —
// just redirect links (links.tldrnewsletter.com/xxx). So this collector:
//   1. extracts every non-junk URL from the body,
//   2. RESOLVES redirects via UrlFetchApp (follows Location headers),
//   3. builds the title from the final URL's slug.
//
// Quota: ~40 fetches/day — well under Apps Script's 20,000/day limit.
// ═══════════════════════════════════════════════════════════════════════════

var TLDR_SENDERS = ['dan@tldrnewsletter.com'];

function collectTLDR(sheet) {
  return collectFromSenders(sheet, loadDoneKeys(sheet), {
    name: 'TLDR',
    senders: TLDR_SENDERS,
    daysBack: ATW_DAYS_BACK,
    extractor: extractTldrItems,
    withEdition: true,
    editionExtractor: detectTldrEdition
  });
}

// Body masthead looks like "TLDR AI 2026-08-25" near the top.
// Detect which edition this issue is → goes in the Edition column.
function detectTldrEdition(body) {
  var head = String(body).slice(0, 800);
  var m = head.match(/TLDR\s+(Information Security|Product Management|Marketing|Design|Crypto|Tech|Dev|AI|IT|InfoSec)/i);
  if (!m) {
    // Main TLDR masthead is bare: "TLDR 2026-08-25" → that's the Tech edition
    if (/^\s*TLDR\s*\d{4}-\d{2}-\d{2}/m.test(head)) return 'Tech';
    return '';
  }
  var name = m[1].toLowerCase();
  var map = {
    'information security': 'InfoSec',
    'infosec': 'InfoSec',
    'product management': 'Product',
    'product': 'Product',
    'marketing': 'Marketing',
    'design': 'Design',
    'crypto': 'Crypto',
    'tech': 'Tech',
    'dev': 'Dev',
    'ai': 'AI',
    'it': 'IT'
  };
  return map[name] || m[1];
}

function extractTldrItems(body) {
  var seen = {};
  var items = [];
  var resolveCache = {};

  var lines = body.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
  lines.forEach(function(line) {
    var um = line.match(/https?:\/\/[^\s)\]>]+/);
    if (!um) return;
    var url = cleanUrl(um[0]);
    if (!url || seen[url] || isNoise(url, line)) return;

    var finalUrl = url;
    // Resolve TLDR redirectors to the real article URL
    if (/links\.tldrnewsletter\.com/.test(url)) {
      finalUrl = resolveCache[url] !== undefined ? resolveCache[url]
                                                 : resolveRedirect(url, resolveCache);
    }
    if (!finalUrl || seen[finalUrl]) return;
    if (isJunkHost(finalUrl)) return;
    if (/tldr\.tech\/(\w+)\/manage|web-version|advertise/i.test(finalUrl)) return;

    seen[url] = true;
    seen[finalUrl] = true;

    var slug = slugTitle(finalUrl);
    if (!slug || slug.length < 12) return;

    items.push({ title: slug, url: finalUrl });
  });
  return items;
}

// Follow 301/302 hops manually so we learn the destination.
function resolveRedirect(url, cache) {
  var current = url;
  try {
    for (var hop = 0; hop < 5; hop++) {
      var resp = UrlFetchApp.fetch(current, {
        followRedirects: false,
        muteHttpExceptions: true
      });
      var code = resp.getResponseCode();
      var loc = resp.getHeaders()['Location'] || resp.getHeaders()['location'];
      if ((code === 301 || code === 302 || code === 303 || code === 307) && loc) {
        current = loc;
      } else {
        break;
      }
    }
  } catch (e) {
    return '';   // network hiccup — skip this link
  }
  cache[url] = cleanUrl(current);
  return cache[url];
}

// "openai-regains-ground-in-the-corporate-ai-market" → "OpenAI regains ground..."
function slugTitle(u) {
  try {
    var path = u.replace(/^https?:\/\/[^\/]+/, '').split('?')[0];
    var parts = path.split('/').filter(function(p){
      return p && !/^\d{1,4}$/.test(p) && p.length > 1;
    });
    if (parts.length === 0) return '';
    var slug = parts[parts.length - 1]
      .replace(/\.(html?|php)$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (slug.length < 12) return '';
    return slug.replace(/\b\w/g, function(c){ return c.toUpperCase(); });
  } catch (e) {
    return '';
  }
}
