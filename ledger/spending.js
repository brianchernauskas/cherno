// ---------------------------------------------------------------------------
// Card statements -> "what do I typically spend". Parsing, merchant cleanup,
// categorising and the monthly roll-up all happen here, in the browser. Raw
// files are never uploaded; only the compact transaction list below is kept
// (and only inside the encrypted vault).
//
//   spend = {
//     cards: ['Card A', ...],
//     merch: ['STARBUCKS STORE TEMPE', ...],        // cleaned merchant keys
//     tx:    [[ymd, cents, cardIdx, merchIdx], ...],  // cents > 0 spend, < 0 refund
//     cat:   { merchantKey: 'Dining' },              // manual overrides
//     include: { Travel: false },                    // categories left out of "typical"
//     oneOff: 5000,                                  // single charges above this are one-offs
//     months: 12                                     // look-back window
//   }
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  'Groceries', 'Dining', 'Gas & Auto', 'Travel', 'Shopping', 'Home', 'Utilities & Bills',
  'Subscriptions', 'Health', 'Entertainment', 'Insurance', 'Fees & Interest', 'Other',
];

export const emptySpend = () => ({ cards: [], merch: [], tx: [], cat: {}, include: {}, oneOff: 5000, months: 12 });

// --- CSV -------------------------------------------------------------------

export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export function parseDate(s) {
  s = String(s || '').trim();
  let m;
  const ymd = (y, mo, d) => {
    if (y < 100) y += 2000;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return y * 10000 + mo * 100 + d;
  };
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) return ymd(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) return ymd(+m[3], +m[1], +m[2]);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return ymd(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})/))) return MONTHS[m[1].toLowerCase()] ? ymd(+m[3], MONTHS[m[1].toLowerCase()], +m[2]) : null;
  if ((m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ,]+(\d{2,4})/))) return MONTHS[m[2].toLowerCase()] ? ymd(+m[3], MONTHS[m[2].toLowerCase()], +m[1]) : null;
  return null;
}

// -> cents (signed), or null
export function parseAmount(s) {
  s = String(s ?? '').trim();
  if (!s) return null;
  let neg = /^\(.*\)$/.test(s) || /-/.test(s) || /\bCR\b/i.test(s);
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (!isFinite(n)) return null;
  return Math.round(n * 100) * (neg ? -1 : 1);
}

const PAYMENT_RE = /\b(AUTOPAY|AUTO PAY|PAYMENT THANK|THANK YOU|ONLINE PAYMENT|ONLINE PMT|MOBILE PAYMENT|ACH PMT|ACH PAYMENT|PAYMENT - |PAYMENT RECEIVED|DIRECTPAY|EPAYMENT|E-PAYMENT)\b/i;

const HINTS = [
  [/grocer|supermarket/i, 'Groceries'], [/restaurant|dining|food|coffee|bar\b/i, 'Dining'],
  [/gas|fuel|auto|automotive|transport|parking/i, 'Gas & Auto'], [/travel|airline|lodging|hotel|air/i, 'Travel'],
  [/merchandise|shopping|retail|department|clothing/i, 'Shopping'], [/home|hardware|furnish|improve/i, 'Home'],
  [/utilit|phone|internet|cable|service/i, 'Utilities & Bills'], [/subscri/i, 'Subscriptions'],
  [/health|medical|pharmac|drug/i, 'Health'], [/entertain|recreation|amusement/i, 'Entertainment'],
  [/insurance/i, 'Insurance'], [/fee|interest/i, 'Fees & Interest'],
];

export function parseCsvStatement(text) {
  const rows = parseCsv(text);
  const hi = rows.findIndex(r => {
    const j = r.map(x => x.toLowerCase()).join('|');
    return /date/.test(j) && /(amount|debit|credit)/.test(j);
  });
  if (hi < 0) return { error: 'Could not find a header row with a date and an amount (or debit/credit) column.' };
  const head = rows[hi].map(x => x.trim().toLowerCase());
  const find = (...res) => { for (const re of res) { const i = head.findIndex(h => re.test(h)); if (i >= 0) return i; } return -1; };
  const iDate = find(/^trans(action)?\.? date$/, /^posted? date$|^post date|^posting date$/, /date/);
  const iDesc = find(/^description$/, /merchant|payee|details|name|memo/);
  const iAmt = find(/^amount( \(usd\))?$/, /^amount/);
  const iDeb = find(/^debit/), iCre = find(/^credit/);
  const iCat = find(/^category$/), iType = find(/^type$/);
  if (iDate < 0 || iDesc < 0 || (iAmt < 0 && iDeb < 0)) return { error: 'Missing a date, description or amount column.' };

  const out = [];
  let neg = 0, pos = 0, skipped = 0;
  for (const r of rows.slice(hi + 1)) {
    const ymd = parseDate(r[iDate]);
    const desc = (r[iDesc] || '').trim();
    if (!ymd || !desc) { skipped++; continue; }
    if (iType >= 0 && /payment|autopay/i.test(r[iType] || '')) { skipped++; continue; }
    if (PAYMENT_RE.test(desc)) { skipped++; continue; }
    let cents;
    if (iAmt >= 0) {
      cents = parseAmount(r[iAmt]);
      if (cents == null) { skipped++; continue; }
      cents > 0 ? pos++ : neg++;
    } else {                                                   // separate debit / credit columns
      const d = parseAmount(r[iDeb]), c = iCre >= 0 ? parseAmount(r[iCre]) : null;
      cents = d ? Math.abs(d) : c ? -Math.abs(c) : null;
      if (cents == null) { skipped++; continue; }
    }
    out.push({ ymd, cents, desc, hint: iCat >= 0 ? r[iCat] : '' });
  }
  // With a single signed column, purchases are the majority sign. Amex-style
  // files are positive-for-spend, Chase-style negative-for-spend.
  const flip = iAmt >= 0 && neg > pos;
  return { format: 'CSV', rows: out, flip, skipped };
}

// --- OFX / QFX -----------------------------------------------------------

export function parseOfxStatement(text) {
  const out = [];
  let skipped = 0;
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi) || [];
  const tag = (b, n) => { const m = b.match(new RegExp(`<${n}>([^<\\r\\n]*)`, 'i')); return m ? m[1].trim() : ''; };
  for (const b of blocks) {
    const ymd = parseDate(tag(b, 'DTPOSTED'));
    const amt = parseFloat(tag(b, 'TRNAMT'));
    const desc = tag(b, 'NAME') || tag(b, 'MEMO');
    if (!ymd || !isFinite(amt) || !desc || PAYMENT_RE.test(desc) || /PAYMENT/i.test(tag(b, 'TRNTYPE'))) { skipped++; continue; }
    out.push({ ymd, cents: Math.round(-amt * 100), desc, hint: '' });     // OFX: purchases are negative
  }
  return { format: 'OFX', rows: out, flip: false, skipped };
}

export function parseStatement(name, text) {
  if (/\.(ofx|qfx)$/i.test(name) || /<OFX>/i.test(text.slice(0, 2000))) return parseOfxStatement(text);
  return parseCsvStatement(text);
}

// --- merchants & categories ------------------------------------------------

export function merchantKey(desc) {
  let s = String(desc).toUpperCase();
  s = s.replace(/^(SQ|TST|PP|PAYPAL|SP|GOOGLE|APLPAY)\s*\*\s*/, '');
  s = s.replace(/[*#]/g, ' ').replace(/\b\S*\d{3,}\S*\b/g, ' ');            // store numbers, ids, phones
  s = s.replace(/\b[A-Z]{2}\s*$/, ' ');                                     // trailing state
  s = s.replace(/[^A-Z&' ]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.split(' ').slice(0, 3).join(' ') || 'UNKNOWN';
}

const RULES = [
  ['Fees & Interest', /INTEREST CHARGE|ANNUAL FEE|LATE FEE|FOREIGN TRANSACTION|FINANCE CHARGE|MEMBERSHIP FEE/],
  ['Gas & Auto', /COSTCO GAS|SHELL|CHEVRON|EXXON|MOBIL|CIRCLE K|QUIKTRIP|\bQT\b|SPEEDWAY|ARCO|VALERO|CONOCO|FUEL|PARKING|TOLL|CAR WASH|AUTOZONE|O'?REILLY|JIFFY|DISCOUNT TIRE|TESLA SUPERCHARGER|\bGAS\b|UBER(?! EATS)|LYFT|DMV|MVD/],
  ['Groceries', /SAFEWAY|FRY'?S|KROGER|WHOLE ?FOODS|WHOLEFDS|TRADER JOE|COSTCO|SPROUTS|ALBERTSONS|PUBLIX|\bALDI\b|INSTACART|SMITHS|BASHAS|GROCERY|MARKET/],
  ['Travel', /AIRLINES?|DELTA AIR|UNITED AIR|SOUTHWEST|AMERICAN AIR|ALASKA AIR|JETBLUE|HOTEL|MARRIOTT|HILTON|HYATT|AIRBNB|VRBO|EXPEDIA|BOOKING\.COM|HERTZ|AVIS|ENTERPRISE RENT|SPIRIT AIR|FRONTIER|KAYAK|RESORT|\bINN\b|CRUISE/],
  ['Dining', /RESTAURANT|CAFE|COFFEE|STARBUCKS|MCDONALD|CHIPOTLE|DOORDASH|UBER EATS|GRUBHUB|PIZZA|GRILL|TAVERN|BREWING|BREWERY|TACO|SUSHI|DUNKIN|CHICK-FIL|WENDY|BURGER|KITCHEN|BISTRO|DINER|BAKERY|STEAK|BBQ|\bBAR\b|PUB\b|SUBWAY|PANERA/],
  ['Home', /HOME DEPOT|LOWE'?S|ACE HARDWARE|MENARDS|FLOOR|FURNITURE|PLUMB|LANDSCAP|HVAC|ROOFING|MATTRESS|WAYFAIR|POOL/],
  ['Utilities & Bills', /\bAPS\b|\bSRP\b|SOUTHWEST GAS|\bCOX\b|VERIZON|AT&T|T-MOBILE|XFINITY|COMCAST|SPECTRUM|WATER|ELECTRIC|CITY OF|UTILIT|WASTE|CENTURYLINK|TRASH/],
  ['Subscriptions', /NETFLIX|SPOTIFY|HULU|DISNEY|HBO|YOUTUBE|APPLE\.COM|ICLOUD|GOOGLE ONE|PRIME VIDEO|PATREON|ADOBE|MICROSOFT|OPENAI|ANTHROPIC|CLAUDE|DROPBOX|PELOTON|PARAMOUNT|PEACOCK|NYTIMES|SIRIUS|AUDIBLE|SUBSCRIPTION/],
  ['Health', /PHARMACY|\bCVS\b|WALGREENS|DENTAL|DENTIST|MEDICAL|CLINIC|HOSPITAL|PHYSICIAN|OPTOMET|VISION|URGENT CARE|LABCORP|QUEST DIAG|DERMATOL|THERAPY|VETERINAR|\bVET\b/],
  ['Entertainment', /THEATER|THEATRE|CINEMA|\bAMC\b|TICKETMASTER|STUBHUB|GOLF|CASINO|CONCERT|TOPGOLF|LIVE NATION|MUSEUM|FANDUEL|DRAFTKINGS|ESPN|SEATGEEK|VIVID SEATS/],
  ['Insurance', /INSURANCE|GEICO|STATE FARM|ALLSTATE|PROGRESSIVE|USAA/],
  ['Shopping', /AMAZON|AMZN|TARGET|WALMART|BEST BUY|NORDSTROM|MACY|ETSY|EBAY|IKEA|TJ ?MAXX|\bROSS\b|OLD NAVY|NIKE|APPLE STORE|SEPHORA|ULTA|KOHL|MARSHALLS|DICK'?S|BASS PRO|CABELA|REI\b/],
];

export function categorize(key, hint = '') {
  for (const [cat, re] of RULES) if (re.test(key)) return cat;
  for (const [re, cat] of HINTS) if (hint && re.test(hint)) return cat;
  return 'Other';
}

export const catOf = (spend, key, hint) => spend.cat[key] || categorize(key, hint);

// --- ingest -----------------------------------------------------------------

const idxOf = (arr, v) => { let i = arr.indexOf(v); if (i < 0) { arr.push(v); i = arr.length - 1; } return i; };

// Adds parsed rows to the store. Overlapping statements are safe: a row is
// skipped when the vault already holds as many identical rows as the file has.
export function ingest(spend, cardName, rows, flip) {
  const ci = idxOf(spend.cards, cardName);
  const have = new Map();
  for (const [ymd, cents, c, m] of spend.tx) {
    if (c !== ci) continue;
    const k = `${ymd}|${cents}|${m}`;
    have.set(k, (have.get(k) || 0) + 1);
  }
  const seen = new Map();
  let added = 0, dupes = 0;
  for (const r of rows) {
    const cents = flip ? -r.cents : r.cents;
    const mi = idxOf(spend.merch, merchantKey(r.desc));
    const k = `${r.ymd}|${cents}|${mi}`;
    const n = (seen.get(k) || 0) + 1;
    seen.set(k, n);
    if (n <= (have.get(k) || 0)) { dupes++; continue; }
    spend.tx.push([r.ymd, cents, ci, mi]);
    added++;
    if (r.hint && !spend.hints) spend.hints = {};
    if (r.hint && !spend.hints[spend.merch[mi]]) spend.hints[spend.merch[mi]] = r.hint;
  }
  return { added, dupes };
}

export function removeCard(spend, ci) {
  spend.tx = spend.tx.filter(t => t[2] !== ci).map(t => (t[2] > ci ? [t[0], t[1], t[2] - 1, t[3]] : t));
  spend.cards.splice(ci, 1);
}

// --- roll-up -----------------------------------------------------------------

const ym = ymd => Math.floor(ymd / 100);
const monthIndex = v => Math.floor(v / 100) * 12 + (v % 100) - 1;

export function summarize(spend) {
  const empty = { months: 0, cards: [], categories: [], typical: 0, oneOffs: [], recurring: [], monthly: [], span: null };
  if (!spend.tx.length) return empty;

  const last = Math.max(...spend.tx.map(t => monthIndex(ym(t[0]))));
  const first = Math.max(last - (spend.months || 12) + 1, Math.min(...spend.tx.map(t => monthIndex(ym(t[0])))));
  const inWin = spend.tx.filter(t => monthIndex(ym(t[0])) >= first);
  const oneOffLimit = (spend.oneOff || 0) * 100;

  const cardMonths = spend.cards.map((_, ci) => {
    const ms = inWin.filter(t => t[2] === ci).map(t => monthIndex(ym(t[0])));
    return ms.length ? Math.max(...ms) - Math.min(...ms) + 1 : 0;
  });

  const cat = new Map(), card = spend.cards.map(() => ({ total: 0, count: 0 })), oneOffs = [];
  const byMerchCard = new Map();
  const monthly = new Map();
  for (const [ymd, cents, ci, mi] of inWin) {
    const key = spend.merch[mi];
    const c = catOf(spend, key, spend.hints?.[key]);
    card[ci].count++;
    if (cents > oneOffLimit && oneOffLimit > 0) { oneOffs.push({ ymd, cents, card: spend.cards[ci], merchant: key, cat: c }); continue; }
    const inc = spend.include[c] !== false;
    const mo = cardMonths[ci] || 1;
    const rec = cat.get(c) || { total: 0, monthly: 0 };
    rec.total += cents; rec.monthly += cents / mo;
    cat.set(c, rec);
    if (inc) {
      card[ci].total += cents / mo;
      monthly.set(ym(ymd), (monthly.get(ym(ymd)) || 0) + cents);
      const mk = `${key}|${ci}`;
      const g = byMerchCard.get(mk) || { key, cat: c, months: new Map() };
      g.months.set(ym(ymd), (g.months.get(ym(ymd)) || 0) + cents);
      byMerchCard.set(mk, g);
    }
  }

  const categories = [...cat.entries()].map(([name, v]) => ({ name, total: v.total / 100, monthly: v.monthly / 100, included: spend.include[name] !== false }))
    .sort((a, b) => b.monthly - a.monthly);
  const typical = categories.filter(c => c.included).reduce((s, c) => s + c.monthly, 0);

  // recurring: charged in at least three separate months for a similar amount
  const recurring = [];
  for (const g of byMerchCard.values()) {
    const vals = [...g.months.values()].filter(v => v > 0);
    if (vals.length < 3) continue;
    const lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi / lo > 1.6) continue;
    recurring.push({ merchant: g.key, cat: g.cat, monthly: vals.reduce((a, b) => a + b, 0) / vals.length / 100, months: vals.length });
  }
  recurring.sort((a, b) => b.monthly - a.monthly);

  return {
    months: last - first + 1,
    cards: spend.cards.map((name, i) => ({ name, monthly: card[i].total / 100, months: cardMonths[i], count: card[i].count })),
    categories, typical,
    oneOffs: oneOffs.sort((a, b) => b.cents - a.cents).map(o => ({ ...o, amount: o.cents / 100 })),
    recurring: recurring.slice(0, 25),
    monthly: [...monthly.entries()].sort((a, b) => a[0] - b[0]).map(([m, c]) => ({ ym: m, total: c / 100 })),
    span: { from: first, to: last },
  };
}

// Top merchants by total, for the recategorise table.
export function topMerchants(spend, n = 40) {
  const tot = new Map();
  for (const [, cents, , mi] of spend.tx) tot.set(mi, (tot.get(mi) || 0) + cents);
  return [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([mi, c]) => ({ key: spend.merch[mi], total: c / 100, cat: catOf(spend, spend.merch[mi], spend.hints?.[spend.merch[mi]]) }));
}
