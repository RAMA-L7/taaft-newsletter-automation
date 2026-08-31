// ═══════════════════════════════════════════════════════════════════════════
// MAIN — dispatcher, setup, triggers
//
// STRUCTURE: ONE SHEET TAB PER SOURCE (easier quality control + composing):
//   TAAFT · TLDR · The Rundown AI · Ben's Bites
// Each collector page writes only to its own tab.
// ═══════════════════════════════════════════════════════════════════════════

function collectAllSources() {
  const ss = SpreadsheetApp.openById(ATW_SPREADSHEET_ID);

  let total = 0;
  total += collectTAAFT(sourceTab(ss, 'TAAFT'));
  total += collectTLDR(sourceTab(ss, 'TLDR'));
  total += collectRundown(sourceTab(ss, 'The Rundown AI'));
  total += collectBensBites(sourceTab(ss, "Ben's Bites"));   // no-op until enabled

  Logger.log('✅ Total items added this run: ' + total);
}

// Per-source tab with headers; dedupe keys scoped within that tab.
function sourceTab(ss, name) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    var headers = (name === 'TLDR')
      ? ['Msg ID', 'Date', 'Edition', 'Email Subject', 'Item Title', 'URL', 'Rank', 'Notes']
      : ['Msg ID', 'Date', 'Email Subject', 'Item Title', 'URL', 'Rank', 'Notes'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function setupATWSheet() {
  const ss = SpreadsheetApp.openById(ATW_SPREADSHEET_ID);
  ['TAAFT', 'TLDR', 'The Rundown AI', "Ben's Bites"].forEach(function(n){ sourceTab(ss, n); });
  ss.getSheetByName('Sent Issues') || ss.insertSheet('Sent Issues');
  Logger.log('✅ ATW sheets ready (one tab per source)');
}

function createTriggersATW() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('collectAllSources')
    .timeBased().everyDays(1).atHour(7).create();
  Logger.log('✅ Daily trigger created (collectAllSources @ 7am)');
}
