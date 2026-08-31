// ═══════════════════════════════════════════════════════════════════════════
// COLLECTOR — TAAFT (There's An AI For That)
// NOTE: TAAFT arrives at YOUR_EMAIL@gmail.com, NOT this account.
//       This page stays so the same project can run on either account.
// ═══════════════════════════════════════════════════════════════════════════

var TAAFT_SENDERS = ['hi@mail.theresanaiforthat.com'];

function collectTAAFT(sheet) {
  return collectFromSenders(sheet, loadDoneKeys(sheet), {
    name: 'TAAFT',
    senders: TAAFT_SENDERS,
    daysBack: ATW_DAYS_BACK
  });
}
