// Run: node test/spending.test.mjs — parsers, dedupe and roll-up against synthetic statements.
import assert from 'node:assert/strict';
import { parseStatement, ingest, summarize, emptySpend, merchantKey, categorize, parseDate, parseAmount } from '../spending.js';

// Chase-style: purchases negative, payment row present
const chase = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
09/03/2026,09/04/2026,SAFEWAY #1234 TEMPE AZ,Groceries,Sale,-84.12,
09/05/2026,09/06/2026,STARBUCKS STORE 5521,Food & Drink,Sale,-6.45,
09/07/2026,09/08/2026,Payment Thank You - Web,,Payment,1500.00,
08/03/2026,08/04/2026,SAFEWAY #1234 TEMPE AZ,Groceries,Sale,-90.00,
08/15/2026,08/16/2026,DELTA AIR LINES 0062345,Travel,Sale,-6400.00,
07/03/2026,07/04/2026,SAFEWAY #1234 TEMPE AZ,Groceries,Sale,-70.00,
09/09/2026,09/10/2026,AMAZON RETURN,Shopping,Return,25.00,
`;
const a = parseStatement('chase.csv', chase);
assert.equal(a.format, 'CSV');
assert.equal(a.flip, true, 'negative-for-spend file should flip');
assert.equal(a.rows.length, 6, 'payment row skipped');

// Amex-style: purchases positive
const amex = `Date,Description,Amount
09/03/2026,UBER EATS HELP.UBER.COM,32.10
09/04/2026,NETFLIX.COM,15.49
08/04/2026,NETFLIX.COM,15.49
07/04/2026,NETFLIX.COM,15.49
09/10/2026,AUTOPAY PAYMENT - THANK YOU,-500.00
`;
const b = parseStatement('amex.csv', amex);
assert.equal(b.flip, false);
assert.equal(b.rows.length, 4);

// Debit / credit column style
const cap = `Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2026-09-01,2026-09-02,1234,SHELL OIL 574441,Gas/Automotive,41.20,
2026-09-03,2026-09-04,1234,PAYMENT RECEIVED,Payment,,300.00
`;
const c = parseStatement('cap.csv', cap);
assert.equal(c.rows.length, 1);
assert.equal(c.rows[0].cents, 4120);

// OFX
const ofx = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260905120000<TRNAMT>-23.50<NAME>CHIPOTLE 1234</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260906<TRNAMT>200.00<NAME>PAYMENT THANK YOU</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
const d = parseStatement('x.qfx', ofx);
assert.equal(d.rows.length, 1);
assert.equal(d.rows[0].cents, 2350, 'OFX debit becomes positive spend');

// helpers
assert.equal(parseDate('9/3/26'), 20260903);
assert.equal(parseDate('Sep 3, 2026'), 20260903);
assert.equal(parseAmount('($12.30)'), -1230);
assert.equal(merchantKey('SAFEWAY #1234 TEMPE AZ'), 'SAFEWAY TEMPE');
assert.equal(categorize('SAFEWAY TEMPE'), 'Groceries');
assert.equal(categorize('UBER EATS HELP'), 'Dining');
assert.equal(categorize('DELTA AIR LINES'), 'Travel');
assert.equal(categorize('SOME RANDOM SHOP'), 'Other');

// ingest + dedupe: importing the same file twice adds nothing the second time
const sp = emptySpend();
const r1 = ingest(sp, 'Card A', a.rows, a.flip);
const r2 = ingest(sp, 'Card A', a.rows, a.flip);
assert.equal(r1.added, 6);
assert.equal(r2.added, 0);
assert.equal(r2.dupes, 6);
ingest(sp, 'Card B', b.rows, b.flip);

// roll-up: one-offs above $5,000 leave the average; refund nets against spend
sp.oneOff = 5000;
const s = summarize(sp);
assert.equal(s.oneOffs.length, 1);
assert.equal(s.oneOffs[0].merchant.startsWith('DELTA'), true);
assert.ok(s.recurring.some(r => r.merchant.startsWith('NETFLIX')), 'netflix detected as recurring');
assert.ok(s.typical > 0);
const groceries = s.categories.find(x => x.name === 'Groceries');
assert.ok(groceries, 'groceries category present');
console.log('typical monthly', Math.round(s.typical), '| months', s.months, '| cats', s.categories.map(x => x.name + ':' + Math.round(x.monthly)).join(', '));
console.log('ok');
