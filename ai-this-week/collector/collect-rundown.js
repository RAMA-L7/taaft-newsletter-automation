// ═══════════════════════════════════════════════════════════════════════════
// COLLECTOR — The Rundown AI
// ═══════════════════════════════════════════════════════════════════════════

var RUNDOWN_SENDERS = [
  'news@daily.therundown.ai',      // The Rundown AI (daily)
  'crew@technews.therundown.ai'    // The Rundown Tech
];

function collectRundown(sheet) {
  return collectFromSenders(sheet, loadDoneKeys(sheet), {
    name: 'The Rundown AI',
    senders: RUNDOWN_SENDERS,
    daysBack: ATW_DAYS_BACK
  });
}
