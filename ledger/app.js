import * as C from './crypto.js';
import * as St from './store.js';
import { DEFAULT_INPUTS, DEFAULT_SCENARIOS, compare, lendingHeadroom, pmt } from './model.js';
import * as Sp from './spending.js';
import { lineChart, stackBars, money, compact } from './charts.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (x, dp = 0) => (x * 100).toFixed(dp) + '%';
const IDLE_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------- state

const freshState = () => ({
  v: 1,
  inputs: structuredClone(DEFAULT_INPUTS),
  scenarios: DEFAULT_SCENARIOS.map((s, i) => ({ ...s, slot: i })),
  touched: [],
  spend: Sp.emptySpend(),
  spendOverride: null,
  stress: { rate: 0, income: 0 },
  cmpBase: 'base',
  updated: 0,
});

function hydrate(raw) {
  const d = freshState();
  return {
    ...d, ...raw,
    inputs: { ...d.inputs, ...(raw.inputs || {}) },
    spend: { ...d.spend, ...(raw.spend || {}) },
    stress: { ...d.stress, ...(raw.stress || {}) },
    scenarios: (raw.scenarios && raw.scenarios.length ? raw.scenarios : d.scenarios),
  };
}

let state = null;
let session = null;          // { id, key, salt, remoteRev }
let saveTimer = null, saving = false, again = false, idleTimer = null;
let tab = 'scenarios';
let pending = [];            // parsed statement files waiting to be added
let drawCharts = null;       // redraws the scenario charts at the current width

// ---------------------------------------------------------------- status + save

function setStatus(kind, text) {
  const p = $('#status');
  p.className = `pill ${kind}`;
  $('#status-text').textContent = text;
}

function touch() {
  if (!state) return;
  state.updated = Date.now();
  setStatus('busy', 'Unsaved changes…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 1200);
}

async function save() {
  if (!state || !session) return;
  if (saving) { again = true; return; }
  saving = true;
  clearTimeout(saveTimer);
  try {
    const { iv, ct } = await C.seal(session.key, state);
    if (ct.length > 880000) setStatus('err', 'Vault is nearly full — remove old statements');
    const blob = { v: 1, salt: session.salt, iv, ct, rev: session.remoteRev + 1, ts: Date.now() };
    St.writeLocal(session.id, blob, true);
    setStatus('busy', 'Saving…');
    const r = await St.push(session.id, blob, session.remoteRev === 0);
    if (r.ok) {
      session.remoteRev = blob.rev;
      St.writeLocal(session.id, blob, false);
      setStatus('ok', `Synced · rev ${blob.rev}`);
      renderVaultStats();
    } else if (r.conflict) {
      setStatus('err', 'Conflict — another device saved first');
      resolveConflict();
    } else if (r.error === 'denied') {
      setStatus('err', 'Saved on this device only — sync rule not published');
    } else {
      setStatus('err', 'Offline — saved on this device, will retry');
    }
  } catch (e) {
    console.error(e);
    setStatus('err', 'Save failed');
  } finally {
    saving = false;
    if (again) { again = false; save(); }
  }
}

async function resolveConflict() {
  const r = await ask({
    title: 'Another device saved changes',
    body: 'A newer copy of this vault exists in the cloud. You can load it (dropping the edits made here since the last sync) or overwrite it with what you have on this device.',
    buttons: [{ label: 'Load the newer copy', value: 'load' }, { label: 'Keep this device’s version', value: 'keep', primary: true }],
  });
  const remote = await St.pull(session.id);
  if (!remote.blob) return;
  if (r.value === 'load') {
    state = hydrate(await C.open(session.key, remote.blob.iv, remote.blob.ct));
    session.remoteRev = remote.blob.rev;
    St.writeLocal(session.id, remote.blob, false);
    setStatus('ok', `Synced · rev ${remote.blob.rev}`);
    render();
  } else {
    session.remoteRev = remote.blob.rev;
    save();
  }
}

// ---------------------------------------------------------------- unlock / lock

const lockMsg = (t, kind = '') => { const m = $('#lock-msg'); m.textContent = t; m.className = `msg ${kind}`; };

async function unlock(pass, create) {
  const btn = $('#lock-go'); btn.disabled = true;
  try {
    lockMsg('Deriving key… (a second or two on purpose)');
    const id = await C.deriveId(pass);
    const [remote, local] = [await St.pull(id), St.readLocal(id)];

    let blob = null, isNew = false, offline = false;
    if (remote.blob) {
      blob = remote.blob;
      if (local && local.rev > remote.blob.rev && local.dirty) blob = local;          // edits made offline
    } else if (remote.missing) {
      if (local) { blob = { ...local, rev: 1 }; isNew = true; }
      else if (!create) { showCreate(); return; }
      else isNew = true;
    } else {
      if (local) { blob = local; offline = true; }
      else if (!create) {
        showCreate(remote.error === 'denied'
          ? 'Cloud sync isn’t available (the Firestore rule isn’t published), and this device has no copy. Re-enter the passphrase to start a vault on this device only.'
          : 'Can’t reach the server, and this device has no copy. Re-enter the passphrase to start a vault here; it will reconcile when you’re back online.');
        return;
      }
      else { isNew = true; offline = true; }
    }

    let salt, key;
    if (blob) {
      salt = blob.salt; key = await C.deriveKey(pass, C.unb64(salt));
      try { state = hydrate(await C.open(key, blob.iv, blob.ct)); }
      catch { lockMsg('That passphrase doesn’t open this vault.', 'err'); return; }
    } else {
      const s = C.newSalt(); salt = C.b64(s); key = await C.deriveKey(pass, s);
      state = freshState();
    }
    session = { id, key, salt, remoteRev: isNew ? 0 : (remote.blob ? remote.blob.rev : 0) };
    $('#lock').classList.add('hide');
    $('#pass').value = ''; $('#pass2').value = '';
    if (isNew || (blob && blob === local && local.dirty)) { setStatus('busy', 'Saving…'); save(); }
    else setStatus(offline ? 'err' : 'ok', offline ? 'Offline — using this device’s copy' : `Synced · rev ${blob.rev}`);
    bumpIdle();
    render();
  } catch (e) {
    console.error(e); lockMsg('Something went wrong: ' + (e.message || e), 'err');
  } finally { btn.disabled = false; }
}

function showCreate(msg) {
  $('#create-fields').classList.remove('hide');
  $('#lock-go').textContent = 'Create vault';
  $('#lock-go').dataset.mode = 'create';
  lockMsg(msg || 'No vault exists for that passphrase yet. Re-enter it below to create one. If you meant to open an existing vault, that was a typo — retype it above.', 'err');
}

async function lockNow() {
  if (state && session && saveTimer) await save();
  state = null; session = null; pending = [];
  $('#view').textContent = '';
  $('#lock').classList.remove('hide');
  $('#create-fields').classList.add('hide');
  $('#lock-go').textContent = 'Unlock'; delete $('#lock-go').dataset.mode;
  lockMsg('');
  setStatus('', 'Locked');
  $('#pass').focus();
}

function bumpIdle() { clearTimeout(idleTimer); if (state) idleTimer = setTimeout(lockNow, IDLE_MS); }

// ---------------------------------------------------------------- dialogs

function ask({ title, body, fields = [], buttons }) {
  return new Promise(res => {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<h3>${esc(title)}</h3><p>${esc(body || '')}</p>
      ${fields.map(f => `<div class="field"><label>${esc(f.label)}</label><input id="d-${f.id}" type="${f.type || 'text'}" autocomplete="off"></div>`).join('')}
      <div class="row" style="justify-content:flex-end;margin-top:14px">${buttons.map((b, i) => `<button class="btn ${b.primary ? 'primary' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]'); if (!b) return;
      const out = { value: buttons[+b.dataset.i].value };
      fields.forEach(f => { out[f.id] = $(`#d-${f.id}`, dlg).value; });
      dlg.close(); dlg.remove(); res(out);
    });
    dlg.addEventListener('cancel', e => { e.preventDefault(); });
    dlg.showModal();
  });
}

// ---------------------------------------------------------------- input model

const SECTIONS = [
  { title: 'Income & tax', note: 'Salary is taxed with 2026 federal brackets, FICA and Arizona’s flat rate; VA disability is not taxed. Enter pre-tax salary.', fields: [
    { k: 'salary', label: 'Base salary', u: '$', hint: 'per year' },
    { k: 'bonus', label: 'Bonus / variable', u: '$', hint: 'per year, taxed as wages' },
    { k: 'raisePct', label: 'Annual raise', u: '%' },
    { k: 'vaMonthly', label: 'VA disability', u: '$', hint: 'per month, tax-free; lenders gross it up 25%' },
    { k: 'otherIncomeMonthly', label: 'Other income', u: '$', hint: 'per month, after tax (planned income goes here)' },
    { k: 'filing', label: 'Filing status', kind: 'select', opts: [['single', 'Single'], ['mfj', 'Married filing jointly']], hint: 'Only your income is modeled' },
    { k: 'stateTaxPct', label: 'State income tax', u: '%', hint: 'Arizona flat rate' },
  ] },
  { title: 'Cash & growth', fields: [
    { k: 'liquidSavings', label: 'Liquid savings', u: '$', hint: 'Used for reserves only' },
    { k: 'savingsReturnPct', label: 'Return on spare cash', u: '%', hint: 'Compounds each scenario’s surplus (or drains a shortfall)' },
    { k: 'inflationPct', label: 'Inflation', u: '%', hint: 'Grows spending, carrying costs, tax brackets' },
    { k: 'appreciationPct', label: 'Home appreciation', u: '%', hint: 'Both homes, per year' },
    { k: 'horizonYears', label: 'Projection length', u: 'yr', hint: '10–40' },
  ] },
  { title: 'Current home', fields: [
    { k: 'curName', label: 'Name', kind: 'text', hint: 'Only for your reference' },
    { k: 'curValue', label: 'Market value', u: '$' },
    { k: 'curBalance', label: 'Mortgage balance', u: '$' },
    { k: 'curRatePct', label: 'Mortgage rate', u: '%' },
    { k: 'curMonthsLeft', label: 'Months remaining', u: 'mo', hint: 'From your statement' },
    { k: 'curPaymentOverride', label: 'Actual P&I payment', u: '$', hint: 'Optional. Blank/0 = computed from balance, rate and term' },
    { k: 'curEscrowMonthly', label: 'Taxes + insurance + HOA', u: '$', hint: 'per month, whatever isn’t in P&I' },
    { k: 'curPropTaxAnnual', label: 'Property tax', u: '$', hint: 'per year — only feeds the itemized-deduction estimate' },
  ] },
  { title: 'Second home', fields: [
    { k: 'tgtName', label: 'Name', kind: 'text' },
    { k: 'tgtAddress', label: 'Address', kind: 'text', hint: 'Stays inside the encrypted vault' },
    { k: 'price', label: 'Purchase price', u: '$' },
    { k: 'closingPct', label: 'Closing costs', u: '%', hint: 'Of price; includes prepaids' },
    { k: 'repairs', label: 'Repairs / renovation', u: '$' },
    { k: 'repairRecoveryPct', label: 'Repair cost recovered in value', u: '%', hint: 'Renovations rarely add dollar-for-dollar' },
    { k: 'taxRatePct', label: 'Property tax rate', u: '%', hint: 'Of price, per year' },
    { k: 'insuranceAnnual', label: 'Homeowners insurance', u: '$', hint: 'per year; wildfire areas run higher' },
    { k: 'hoaMonthly', label: 'HOA', u: '$', hint: 'per month' },
    { k: 'carryMonthly', label: 'Utilities & upkeep', u: '$', hint: 'per month while owned' },
    { k: 'maintPct', label: 'Maintenance reserve', u: '%', hint: 'Of price, per year' },
  ] },
  { title: 'Lending market', note: 'Rates are placeholders from late September 2026 averages (prime ~6.75–7%, 30-yr fixed ~7%, second homes ~7.5%). Replace them with real quotes.', fields: [
    { k: 'primePct', label: 'Prime rate', u: '%' },
    { k: 'helocMarginPct', label: 'HELOC margin over prime', u: '%' },
    { k: 'helocDrawYears', label: 'HELOC draw period', u: 'yr' },
    { k: 'helocAmortYears', label: 'HELOC repayment period', u: 'yr' },
    { k: 'helocDriftPct', label: 'HELOC rate drift', u: '%', hint: 'Change per year; 0 = flat' },
    { k: 'refiRatePct', label: 'Cash-out refi rate', u: '%' },
    { k: 'refiTermYears', label: 'Refi term', u: 'yr' },
    { k: 'refiCostPct', label: 'Refi closing costs', u: '%', hint: 'Of the new loan, incl. points' },
    { k: 'mortRatePct', label: 'Second-home mortgage rate', u: '%' },
    { k: 'mortTermYears', label: 'Second-home mortgage term', u: 'yr' },
    { k: 'maxCltvPct', label: 'Max combined LTV', u: '%', hint: 'Most lenders stop at 80–85%' },
  ] },
  { title: 'Tax treatment', note: 'Interest on debt secured by one home but spent on another generally isn’t deductible. These switches let you test the alternatives; they are estimates, not tax advice.', fields: [
    { k: 'helocDeductible', label: 'Treat HELOC interest as deductible', kind: 'bool', hint: 'Off by default: the line is secured by the current home but funds the second' },
    { k: 'deductSecondHome', label: 'Deduct second-home mortgage interest', kind: 'bool', hint: 'A qualified second residence — on by default' },
  ] },
];

const isTouched = k => state.touched.includes(k);

function fieldHTML(f) {
  const v = state.inputs[f.k];
  const dot = !isTouched(f.k) && f.kind !== 'bool' ? '<span class="dot-unconfirmed" title="Default — not yet confirmed"></span>' : '';
  let control;
  if (f.kind === 'select') control = `<select data-k="${f.k}" data-t="text">${f.opts.map(([val, lab]) => `<option value="${val}" ${v === val ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
  else if (f.kind === 'bool') control = `<label class="check"><input type="checkbox" data-k="${f.k}" data-t="bool" ${v ? 'checked' : ''}>${esc(f.label)}</label>`;
  else if (f.kind === 'text') control = `<input type="text" data-k="${f.k}" data-t="text" value="${esc(v)}" autocomplete="off">`;
  else {
    const pre = f.u === '$';
    control = `<div class="unit ${pre ? 'pre' : ''}"><input type="number" inputmode="decimal" step="any" data-k="${f.k}" data-t="num" value="${v === 0 ? '' : esc(v)}" placeholder="0"><span>${esc(f.u)}</span></div>`;
  }
  const label = f.kind === 'bool' ? '' : `<label>${dot}${esc(f.label)}</label>`;
  return `<div class="field">${label}${control}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
}

function fixedRowsHTML() {
  const rows = state.inputs.fixed.map((r, i) => `
    <div class="row" style="margin-bottom:8px" data-fixed="${i}">
      <input type="text" data-fx="${i}" data-f="name" value="${esc(r.name)}" placeholder="e.g. Utilities, car payment, insurance" style="flex:2;min-width:180px">
      <div class="unit pre" style="flex:1;min-width:120px;position:relative"><input type="number" inputmode="decimal" step="any" data-fx="${i}" data-f="monthly" value="${r.monthly || ''}" placeholder="0" style="padding-left:24px"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-3)">$</span></div>
      <button class="btn small ghost danger" data-act="fx-del" data-i="${i}" aria-label="Remove">✕</button>
    </div>`).join('');
  return rows || '<p class="note">None yet. Add anything you pay from a bank account rather than a card: auto loans, utilities on autopay, insurance, tuition, subscriptions billed by ACH.</p>';
}

function renderInputs() {
  $('#view').innerHTML = `
    <div class="legend-note"><span class="dot-unconfirmed"></span> A default you haven’t confirmed yet — edit the field (or type the same value) to clear the dot.</div>
    ${SECTIONS.map(s => `
      <h2>${esc(s.title)}</h2>
      <div class="card">${s.note ? `<p class="note" style="margin-bottom:14px">${esc(s.note)}</p>` : ''}
      <div class="fields">${s.fields.map(fieldHTML).join('')}</div></div>`).join('')}
    <h2>Fixed monthly costs (not on cards)</h2>
    <div class="card"><div id="fixed-rows">${fixedRowsHTML()}</div>
      <div class="row" style="margin-top:6px"><button class="btn small" data-act="fx-add">+ Add a line</button><span class="sub" id="fixed-total"></span></div></div>
    <h2>Derived</h2>
    <div class="card" id="derived"></div>`;
  renderDerived();
}

function renderDerived() {
  const i = state.inputs;
  const pay = i.curPaymentOverride > 0 ? i.curPaymentOverride : (i.curBalance > 0 ? pmt(i.curBalance, i.curRatePct, i.curMonthsLeft) : 0);
  const fx = i.fixed.reduce((s, r) => s + (+r.monthly || 0), 0);
  const eq = i.curValue - i.curBalance;
  $('#derived').innerHTML = `<div class="grid g4">
    <div class="stat"><div class="l">Current-home P&I</div><div class="v">${money(pay)}</div><div class="d">per month${i.curPaymentOverride > 0 ? ' (your figure)' : ' (computed)'}</div></div>
    <div class="stat"><div class="l">Equity</div><div class="v">${money(eq)}</div><div class="d">${i.curValue ? pct(i.curBalance / i.curValue, 0) + ' loan-to-value' : '—'}</div></div>
    <div class="stat"><div class="l">Borrowing headroom</div><div class="v">${money(lendingHeadroom(i))}</div><div class="d">at ${i.maxCltvPct}% combined LTV</div></div>
    <div class="stat"><div class="l">Fixed non-card costs</div><div class="v">${money(fx)}</div><div class="d">per month</div></div></div>`;
  const t = $('#fixed-total'); if (t) t.textContent = fx ? `Total ${money(fx)}/mo` : '';
}

// ---------------------------------------------------------------- scenarios

const SLOT_NAMES = ['Baseline', 'Series 1', 'Series 2', 'Series 3', 'Series 4', 'Series 5'];

function spendingMonthly() {
  const sm = Sp.summarize(state.spend);
  return { sm, monthly: state.spendOverride != null ? state.spendOverride : sm.typical };
}

function renderScenarios() {
  const inp = state.inputs;
  if (!inp.salary && !inp.curValue && !inp.price) {
    $('#view').innerHTML = `<div class="card empty"><h3>Nothing to model yet</h3>
      <p>Fill in <b>Inputs</b> (income, current home, second home), or load a starter file from the <b>Vault</b> tab.</p>
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn primary" data-go="inputs">Open Inputs</button><button class="btn" data-go="vault">Open Vault</button></div></div>`;
    return;
  }
  const { sm, monthly } = spendingMonthly();
  const res = compare(inp, state.scenarios, { stress: state.stress, cardMonthly: monthly });
  const baseRes = res.find(r => r.id === state.cmpBase) || res.find(r => !r.buy) || res[0];
  res.forEach(r => { r.delta = r.wealth.map((w, i) => w - baseRes.wealth[i]); });
  const Y = res[0].wealth.length - 1;
  const base = res.find(r => !r.buy) || res[0];

  const tile = (l, v, d) => `<div class="card stat"><div class="l">${esc(l)}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
  const stressOn = state.stress.rate || state.stress.income;

  let html = `<h2>Where you stand</h2><div class="grid g4">
    ${tile('Equity in ' + esc(inp.curName), money(inp.curValue - inp.curBalance), `${money(inp.curBalance)} owed on ${money(inp.curValue)}`)}
    ${tile('Borrowing headroom', money(lendingHeadroom(inp)), `to ${inp.maxCltvPct}% combined LTV`)}
    ${tile('Net income', money(base.month1.net), 'per month, after tax, incl. VA')}
    ${tile('Everyday spending', money(monthly + base.month1.fixed + base.month1.escrow), sm.months ? `${money(monthly)} cards · ${money(base.month1.fixed + base.month1.escrow)} fixed` : 'No statements imported yet')}
  </div>
  <h2>What if</h2>
  <div class="card filters">
    <div class="slider"><span class="lab">HELOC rate</span><input type="range" id="st-rate" min="0" max="4" step="0.25" value="${state.stress.rate}"><span class="val" id="st-rate-v">${state.stress.rate ? '+' + state.stress.rate + ' pt' : '0 pt'}</span></div>
    <div class="slider"><span class="lab">Income drops</span><input type="range" id="st-inc" min="0" max="40" step="5" value="${state.stress.income}"><span class="val" id="st-inc-v">${state.stress.income ? '−' + state.stress.income + '%' : '0%'}</span></div>
    <div class="slider"><span class="lab">Compare wealth against</span><select id="cmp" style="width:auto">${state.scenarios.map(s => `<option value="${esc(s.id)}" ${s.id === baseRes.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    ${stressOn ? '<button class="btn small" data-act="reset-stress">Reset</button>' : ''}
  </div>`;

  // --- comparison table
  const flagDti = d => d <= .36 ? `<span class="flag ok">✓ ${pct(d)}</span>` : d <= .43 ? `<span class="flag warn">▲ ${pct(d)}</span>` : `<span class="flag bad">✕ ${pct(d)}</span>`;
  const cell = (r, fn) => `<td class="num">${fn(r)}</td>`;
  const yrs = [5, 10, 20, 30].filter(y => y <= Y);
  const rowsDef = [
    ['sec', 'Funding'],
    ['Cash needed at closing', r => r.buy ? money(r.funding.cashNeed) : '—'],
    [`Debt on ${esc(inp.curName)} afterward`, r => money(r.funding.chDebt0)],
    ['Combined loan-to-value', r => `${pct(r.cltv)}${r.overCap ? ' <span class="flag bad">✕ over cap</span>' : ''}`],
    ['Blended rate on that debt', r => r.funding.chDebt0 ? r.blended.toFixed(2) + '%' : '—'],
    ['sec', 'Monthly, first month'],
    ['Current-home mortgage', r => money(r.month1.payCur)],
    ['HELOC payment', r => r.month1.payHeloc ? money(r.month1.payHeloc) : '—'],
    ['Second-home mortgage', r => r.month1.paySecond ? money(r.month1.paySecond) : '—'],
    ['Second-home carrying costs', r => r.month1.carry ? money(r.month1.carry) : '—'],
    ['Everyday living costs', r => money(r.month1.living)],
    ['Net income', r => money(r.month1.net)],
    ['strong', 'Monthly surplus', r => money(r.month1.surplus), r => (r.month1.surplus < 0 ? 'neg' : 'pos')],
    ['Debt-to-income (lender view)', r => flagDti(r.month1.dti)],
    ['sec', 'Risk over time'],
    ['Highest loan payments, first 10 yrs', r => `${money(r.peak)} <span class="sub">yr ${r.peakYear}</span>`],
    ['Interest paid, first 10 yrs', r => money(r.interest10)],
    ['Federal + state + payroll tax, yr 1', r => money(r.firstYearTax.total)],
    ['sec', `Wealth vs. ${esc(baseRes.name)}`],
    ...yrs.map(y => [`After ${y} years`, r => r.id === baseRes.id ? '—' : money(r.delta[y]), r => (r.id === baseRes.id ? '' : r.delta[y] < 0 ? 'neg' : 'pos')]),
  ];
  const trs = rowsDef.map(d => {
    if (d[0] === 'sec') return `<tr class="sec"><th colspan="${res.length + 1}">${d[1]}</th></tr>`;
    if (d[0] === 'strong') return `<tr><th class="strong">${d[1]}</th>${res.map(r => `<td class="num strong ${d[3](r)}">${d[2](r)}</td>`).join('')}</tr>`;
    const clsFn = d[2];
    return `<tr><th>${d[0]}</th>${res.map(r => `<td class="num ${clsFn ? clsFn(r) : ''}">${d[1](r)}</td>`).join('')}</tr>`;
  });

  html += `<h2>Scenarios side by side</h2><div class="card"><div class="tablewrap"><table>
    <thead><tr><th>${stressOn ? 'Stress applied' : ''}</th>${res.map(r => `<th><span class="chip bg${state.scenarios.find(s => s.id === r.id).slot}"></span>${esc(r.name)}</th>`).join('')}</tr></thead>
    <tbody>${trs.join('')}</tbody></table></div>
    <p class="note" style="margin-top:12px">Debt-to-income counts loan payments plus taxes, insurance and HOA on both homes against gross income, with VA disability grossed up 25%. ✓ under 36%, ▲ to 43%, ✕ above. “Wealth” is home equity in both homes plus a side fund that compounds each month’s surplus, so a scenario that costs more cash flow is charged for it. Estimates only — not lending or tax advice.</p></div>`;

  html += `<h2>Where the month’s money goes</h2><div class="card chartcard"><h3>Monthly outflow vs. net income</h3>
    <div class="legend"><span><i class="box bk1"></i>Current-home mortgage</span><span><i class="box bk2"></i>HELOC</span><span><i class="box bk3"></i>Second-home mortgage</span><span><i class="box bk4"></i>Second-home carrying costs</span><span><i class="box bkg"></i>Living costs</span><span><b>|</b> Net income</span></div>
    <div id="ch-stack"></div></div>
    <h2>Over time</h2><div class="grid g2">
    <div class="card chartcard"><h3>Wealth vs. ${esc(baseRes.name)}</h3><p class="sub">Cumulative, nominal dollars. Includes equity in both homes and the compounding of each month’s surplus.</p><div class="legend" id="lg1"></div><div id="ch-delta"></div></div>
    <div class="card chartcard"><h3>Monthly surplus by year</h3><p class="sub">Average per month after all obligations. Watch the step where a HELOC switches from interest-only.</p><div class="legend" id="lg2"></div><div id="ch-surplus"></div></div></div>`;

  // --- scenario editor
  html += `<h2>Scenario settings</h2>${state.scenarios.map(scEditorHTML).join('')}
    <div class="row"><button class="btn" data-act="sc-add" ${state.scenarios.length >= 6 ? 'disabled' : ''}>+ Add a scenario</button><span class="sub">Up to six, so each keeps its own color.</span></div>`;

  $('#view').innerHTML = html;

  drawCharts = () => {
  const legend = list => list.map(r => `<span><i class="bg${state.scenarios.find(s => s.id === r.id).slot}"></i>${esc(r.name)}</span>`).join('');
  stackBars($('#ch-stack'), {
    rows: res.map(r => ({
      label: r.name, marker: r.month1.net,
      segs: [
        { name: 'Current-home mortgage', key: 1, value: r.month1.payCur },
        { name: 'HELOC', key: 2, value: r.month1.payHeloc },
        { name: 'Second-home mortgage', key: 3, value: r.month1.paySecond },
        { name: 'Second-home carrying costs', key: 4, value: r.month1.carry },
        { name: 'Living costs', key: 'g', value: r.month1.living },
      ],
    })),
  });
  const others = res.filter(r => r.id !== baseRes.id);
  $('#lg1').innerHTML = legend(others);
  lineChart($('#ch-delta'), {
    series: others.map(r => ({ name: r.name, slot: state.scenarios.find(s => s.id === r.id).slot, values: r.delta })),
    xs: Array.from({ length: Y + 1 }, (_, i) => i), xFmt: x => (x === 0 ? 'Now' : `Yr ${x}`), tipHead: x => (x === 0 ? 'At closing' : `After ${x} years`),
  });
  $('#lg2').innerHTML = legend(res);
  lineChart($('#ch-surplus'), {
    series: res.map(r => ({ name: r.name, slot: state.scenarios.find(s => s.id === r.id).slot, values: r.surplusByYear })),
    xs: Array.from({ length: Y }, (_, i) => i + 1), xFmt: x => `Yr ${x}`, tipHead: x => `Year ${x}`, xTick: 5,
  });
  };
  drawCharts();
}

function scEditorHTML(s) {
  const f = (k, label, unit, val, hint = '') => `<div class="field"><label>${esc(label)}</label><div class="unit ${unit === '$' ? 'pre' : ''}"><input type="number" inputmode="decimal" step="any" data-sc="${esc(s.id)}" data-f="${k}" value="${val ?? ''}" placeholder="${hint ? esc(hint) : '0'}"><span>${unit}</span></div></div>`;
  const sel = (k, label, opts, val) => `<div class="field"><label>${esc(label)}</label><select data-sc="${esc(s.id)}" data-f="${k}">${opts.map(([v, l]) => `<option value="${v}" ${val === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
  const ck = (k, label, val) => `<div class="field" style="align-self:end"><label class="check"><input type="checkbox" data-sc="${esc(s.id)}" data-f="${k}" ${val ? 'checked' : ''}>${esc(label)}</label></div>`;
  return `<details class="sc"><summary><span class="chip-i bg${s.slot}"></span>${esc(s.name)}<span class="badge">${s.buy ? 'purchase' : 'no purchase'}</span></summary>
    <div class="body"><div class="fields" style="margin-top:12px">
      <div class="field"><label>Name</label><input type="text" data-sc="${esc(s.id)}" data-f="name" value="${esc(s.name)}"></div>
      ${ck('buy', 'Buy the second home', s.buy)}
      ${s.buy ? `
        ${f('downPct', 'Down payment', '%', s.downPct ?? 20)}
        ${sel('source', 'Cash comes from', [['heloc', 'HELOC on current home'], ['refi', 'Cash-out refi on current home'], ['savings', 'Savings']], s.source || 'heloc')}
        ${f('cashUsed', 'Savings applied first', '$', s.cashUsed || '')}
        ${ck('includeRepairs', 'Fund repairs too', s.includeRepairs !== false)}
        ${s.source === 'heloc' ? `${sel('helocPlan', 'HELOC repayment', [['payoff', 'Pay off over a set term'], ['io', 'Interest-only, then amortize']], s.helocPlan || 'payoff')}
          ${(s.helocPlan || 'payoff') === 'payoff' ? f('helocPayoffYears', 'Payoff term', 'yr', s.helocPayoffYears ?? 15) : ''}
          ${f('helocRatePct', 'HELOC rate override', '%', s.helocRatePct, 'market')}` : ''}
        ${s.source === 'refi' ? f('refiRatePct', 'Refi rate override', '%', s.refiRatePct, 'market') : ''}
        ${s.downPct < 100 ? f('mortRatePct', 'Mortgage rate override', '%', s.mortRatePct, 'market') : ''}` : ''}
    </div>
    <div class="row" style="margin-top:12px"><button class="btn small" data-act="sc-dup" data-id="${esc(s.id)}" ${state.scenarios.length >= 6 ? 'disabled' : ''}>Duplicate</button>
      <button class="btn small danger" data-act="sc-del" data-id="${esc(s.id)}" ${state.scenarios.length <= 1 ? 'disabled' : ''}>Remove</button></div></div></details>`;
}

function freeSlot() {
  const used = new Set(state.scenarios.map(s => s.slot));
  for (let i = 1; i <= 5; i++) if (!used.has(i)) return i;
  return 5;
}

// ---------------------------------------------------------------- spending

const fileCard = n => n.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Card';
const ymLabel = v => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][(v % 100) - 1]} ${Math.floor(v / 100)}`;
const ymdLabel = v => `${String(Math.floor(v / 100) % 100).padStart(2, '0')}/${String(v % 100).padStart(2, '0')}/${Math.floor(v / 10000)}`;
const monthFromIdx = i => Math.floor(i / 12) * 100 + (i % 12) + 1;

function renderSpending() {
  const sp = state.spend, sm = Sp.summarize(sp);
  let html = `<h2>Import statements</h2>
  <div class="drop" id="drop"><p><b>Drop card statements here</b> or <label style="color:var(--accent);cursor:pointer;text-decoration:underline">browse<input type="file" id="file" accept=".csv,.ofx,.qfx,text/csv" multiple hidden></label></p>
  <p class="sub" style="margin-top:6px">CSV, OFX or QFX from each card’s “download transactions” page. Files are read in this browser and never uploaded — only the cleaned transaction list is kept, inside the encrypted vault. Overlapping statements are de-duplicated.</p></div>
  <div id="pending" class="stack" style="margin-top:12px"></div>`;

  if (!sp.tx.length) {
    html += `<div class="card empty" style="margin-top:20px"><h3>No spending yet</h3><p>Add a few months from each card. The average of what you actually spend becomes the “everyday living” line in every scenario.</p></div>`;
    $('#view').innerHTML = html; renderPending(); return;
  }

  const { monthly } = spendingMonthly();
  html += `<h2>Typical monthly spending</h2><div class="grid g4">
    <div class="card stat"><div class="l">From statements</div><div class="v">${money(sm.typical)}</div><div class="d">${sm.months} month${sm.months === 1 ? '' : 's'} · ${ymLabel(monthFromIdx(sm.span.from))} – ${ymLabel(monthFromIdx(sm.span.to))}</div></div>
    <div class="card stat"><div class="l">Used in scenarios</div><div class="v">${money(monthly)}</div><div class="d">${state.spendOverride != null ? 'your override' : 'same as statements'}</div></div>
    <div class="card stat"><div class="l">Cards</div><div class="v">${sp.cards.length}</div><div class="d">${sp.tx.length.toLocaleString()} transactions</div></div>
    <div class="card"><div class="field"><label>Override the average</label><div class="unit pre"><input type="number" id="ovr" inputmode="decimal" placeholder="${Math.round(sm.typical)}" value="${state.spendOverride ?? ''}"><span>$</span></div><div class="hint">Blank = use statements. Payments and transfers are already excluded.</div></div></div></div>
  <div class="row" style="margin-top:12px;gap:22px">
    <div class="field" style="width:190px"><label>Look-back window</label><select id="win">${[3, 6, 9, 12, 18, 24].map(m => `<option value="${m}" ${sp.months === m ? 'selected' : ''}>Last ${m} months</option>`).join('')}</select></div>
    <div class="field" style="width:230px"><label>Treat single charges over</label><div class="unit pre"><input type="number" id="oneoff" value="${sp.oneOff || ''}" placeholder="off"><span>$</span></div><div class="hint">as one-offs, left out of the average</div></div></div>

  <h2>By category</h2><div class="card">${(() => {
    const mx = Math.max(...sm.categories.map(c => c.monthly), 1);
    return sm.categories.map(c => `<div class="barrow ${c.included ? '' : 'off'}"><input type="checkbox" data-inc="${esc(c.name)}" ${c.included ? 'checked' : ''} aria-label="Include ${esc(c.name)}"><span>${esc(c.name)}</span><div><div class="bar" data-w="${Math.max(0, c.monthly / mx * 100).toFixed(1)}"></div></div><span class="num" style="text-align:right">${money(c.monthly)}</span></div>`).join('');
  })()}<p class="note" style="margin-top:8px">Untick a category to leave it out (say, Travel that isn’t part of a normal month).</p></div>

  <div class="grid g2" style="margin-top:12px">
    <div><h2>By card</h2><div class="card"><div class="tablewrap"><table><thead><tr><th>Card</th><th>Months</th><th>Per month</th><th></th></tr></thead><tbody>${sm.cards.map((c, i) => `<tr><td>${esc(c.name)}</td><td class="num">${c.months}</td><td class="num">${money(c.monthly)}</td><td><button class="btn small ghost danger" data-act="card-del" data-i="${i}">Remove</button></td></tr>`).join('')}</tbody></table></div></div></div>
    <div><h2>Recurring charges</h2><div class="card"><div class="tablewrap"><table><thead><tr><th>Merchant</th><th>Months</th><th>Per month</th></tr></thead><tbody>${sm.recurring.length ? sm.recurring.slice(0, 12).map(r => `<tr><td>${esc(r.merchant)}</td><td class="num">${r.months}</td><td class="num">${money(r.monthly)}</td></tr>`).join('') : '<tr><td colspan="3" class="sub">None found yet — needs 3+ similar monthly charges.</td></tr>'}</tbody></table></div></div></div></div>`;

  if (sm.oneOffs.length) html += `<h2>One-offs left out</h2><div class="card"><div class="tablewrap"><table><thead><tr><th>Date</th><th>Merchant</th><th>Card</th><th>Amount</th></tr></thead><tbody>${sm.oneOffs.slice(0, 15).map(o => `<tr><td>${ymdLabel(o.ymd)}</td><td>${esc(o.merchant)}</td><td>${esc(o.card)}</td><td class="num">${money(o.amount)}</td></tr>`).join('')}</tbody></table></div></div>`;

  const tm = Sp.topMerchants(sp, 30);
  html += `<h2>Fix categories</h2><div class="card"><p class="note" style="margin-bottom:8px">Your biggest merchants. Changing one re-sorts every charge from it.</p><div class="tablewrap"><table><thead><tr><th>Merchant</th><th>Total</th><th style="text-align:left">Category</th></tr></thead><tbody>${tm.map(m => `<tr><td>${esc(m.key)}</td><td class="num">${money(m.total)}</td><td style="text-align:left"><select data-mc="${esc(m.key)}" style="min-width:160px">${Sp.CATEGORIES.map(c => `<option ${c === m.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div></div>`;
  $('#view').innerHTML = html;
  document.querySelectorAll('.bar[data-w]').forEach(b => { b.style.width = b.dataset.w + '%'; });
  renderPending();
}

function renderPending() {
  const host = $('#pending'); if (!host) return;
  host.innerHTML = pending.map((p, i) => {
    if (p.error) return `<div class="card"><b>${esc(p.name)}</b> <span class="flag bad">✕ ${esc(p.error)}</span> <button class="btn small ghost" data-act="pend-del" data-i="${i}">Dismiss</button></div>`;
    const rows = p.rows, spend = rows.reduce((s, r) => s + (p.flip ? -r.cents : r.cents), 0) / 100;
    const from = Math.min(...rows.map(r => r.ymd)), to = Math.max(...rows.map(r => r.ymd));
    return `<div class="card"><div class="row"><b style="flex:1">${esc(p.name)}</b><span class="badge">${p.format}</span><button class="btn small ghost" data-act="pend-del" data-i="${i}">Dismiss</button></div>
      <div class="row" style="margin-top:10px;align-items:end">
        <div class="field" style="width:220px"><label>Card name</label><input type="text" data-pc="${i}" list="cards" value="${esc(p.card)}"></div>
        <div class="stat"><div class="l">${rows.length} transactions</div><div class="d">${ymdLabel(from)} – ${ymdLabel(to)} · net spend ${money(spend)}</div></div>
        ${p.format === 'CSV' ? `<label class="check" style="margin-left:auto"><input type="checkbox" data-pf="${i}" ${p.flip ? 'checked' : ''}>Purchases are negative in this file</label>` : ''}
        <button class="btn primary" data-act="pend-add" data-i="${i}">Add to vault</button></div>
      <p class="sub" style="margin-top:8px">${p.skipped} payment/transfer/blank rows skipped. Sample: ${rows.slice(0, 3).map(r => esc(r.desc.slice(0, 28))).join(' · ')}</p></div>`;
  }).join('') + `<datalist id="cards">${state.spend.cards.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`;
}

async function takeFiles(files) {
  for (const f of files) {
    const text = await f.text();
    const r = Sp.parseStatement(f.name, text);
    if (r.error) pending.push({ name: f.name, error: r.error });
    else if (!r.rows.length) pending.push({ name: f.name, error: 'No transactions found.' });
    else pending.push({ name: f.name, format: r.format, rows: r.rows, flip: r.flip, skipped: r.skipped, card: fileCard(f.name) });
  }
  renderPending();
}

// ---------------------------------------------------------------- vault tab

function renderVault() {
  $('#view').innerHTML = `
  <h2>Vault</h2><div class="card stack">
    <div class="grid g4" id="vstats"></div>
    <p class="note">Everything on this page’s data — inputs, transactions, scenarios — is sealed in your browser with AES-256-GCM before it leaves. The key comes from your passphrase (PBKDF2, 600,000 rounds) and is never stored; the server holds ciphertext under an ID derived from the passphrase. Forget the passphrase and nobody, including me, can open it. The page locks itself after 15 idle minutes.</p>
    <div class="row"><button class="btn" data-act="lock">Lock now</button><button class="btn" data-act="chpass">Change passphrase</button></div></div>
  <h2>Move data in and out</h2><div class="card stack">
    <div class="row"><button class="btn" data-act="bk-dl">Download encrypted backup</button><button class="btn" data-act="bk-up">Restore an encrypted backup</button>
      <input type="file" id="bk-file" accept=".json,application/json" hidden></div>
    <div class="row"><button class="btn" data-act="seed-up">Load a starter file (plain JSON)</button><button class="btn" data-act="plain-dl">Export everything as plain JSON</button>
      <input type="file" id="seed-file" accept=".json,application/json" hidden></div>
    <p class="note">A starter file fills in inputs you’d otherwise type; keep it out of any public repository. The plain export is <b>unencrypted</b> — treat it like a bank statement.</p>
    <div class="row"><button class="btn danger" data-act="wipe">Forget this browser’s cached copy</button></div></div>`;
  renderVaultStats();
}

function renderVaultStats() {
  const h = $('#vstats'); if (!h || !session) return;
  const l = St.readLocal(session.id);
  h.innerHTML = `<div class="stat"><div class="l">Revision</div><div class="v">${session.remoteRev}</div><div class="d">cloud copy</div></div>
    <div class="stat"><div class="l">Sealed size</div><div class="v">${l ? Math.round(l.ct.length / 1024) : '—'} KB</div><div class="d">of ~880 KB available</div></div>
    <div class="stat"><div class="l">Transactions</div><div class="v">${state.spend.tx.length.toLocaleString()}</div><div class="d">${state.spend.cards.length} cards</div></div>
    <div class="stat"><div class="l">Last saved</div><div class="v" style="font-size:18px">${l ? new Date(l.ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</div><div class="d">this device</div></div>`;
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const stamp = () => new Date().toISOString().slice(0, 10);

async function restoreBackup(file) {
  let blob;
  try { blob = JSON.parse(await file.text()); if (!blob.salt || !blob.iv || !blob.ct) throw 0; } catch { alert('That doesn’t look like a Ledger backup.'); return; }
  const r = await ask({ title: 'Passphrase for this backup', body: 'Enter the passphrase the backup was made with. This replaces the data currently in the vault.',
    fields: [{ id: 'p', label: 'Passphrase', type: 'password' }], buttons: [{ label: 'Cancel', value: 'no' }, { label: 'Restore', value: 'go', primary: true }] });
  if (r.value !== 'go') return;
  try {
    const key = await C.deriveKey(r.p, C.unb64(blob.salt));
    state = hydrate(await C.open(key, blob.iv, blob.ct));
    touch(); render();
  } catch { alert('That passphrase doesn’t open the backup.'); }
}

async function changePassphrase() {
  const r = await ask({ title: 'Change passphrase', body: 'Your data is re-sealed under a new passphrase and saved as a new vault. The old cloud copy can’t be deleted (by design) but stays sealed under the old passphrase.',
    fields: [{ id: 'a', label: 'New passphrase', type: 'password' }, { id: 'b', label: 'Repeat it', type: 'password' }],
    buttons: [{ label: 'Cancel', value: 'no' }, { label: 'Change', value: 'go', primary: true }] });
  if (r.value !== 'go') return;
  const bad = C.passphraseProblem(r.a);
  if (bad) return alert(bad);
  if (r.a !== r.b) return alert('The two entries differ.');
  setStatus('busy', 'Re-keying…');
  const old = session.id;
  const id = await C.deriveId(r.a), s = C.newSalt();
  session = { id, key: await C.deriveKey(r.a, s), salt: C.b64(s), remoteRev: 0 };
  try { localStorage.removeItem(`ledger.blob.${old.slice(0, 12)}`); } catch { /* ignore */ }
  await save();
}

async function loadSeed(file) {
  let j;
  try { j = JSON.parse(await file.text()); } catch { alert('That file isn’t valid JSON.'); return; }
  const inputs = j.inputs || {};
  let n = 0;
  for (const [k, v] of Object.entries(inputs)) {
    if (!(k in DEFAULT_INPUTS)) continue;
    state.inputs[k] = v; n++;
    if (k !== 'fixed' && !state.touched.includes(k)) state.touched.push(k);
  }
  if (Array.isArray(j.scenarios) && j.scenarios.length) state.scenarios = j.scenarios.map((s, i) => ({ slot: s.slot ?? (s.buy ? Math.min(i, 5) : 0), ...s }));
  (j.untouched || []).forEach(k => { state.touched = state.touched.filter(t => t !== k); });
  touch(); tab = 'scenarios'; render();
  setStatus('busy', `Loaded ${n} inputs — saving…`);
}

// ---------------------------------------------------------------- shell + events

function render() {
  if (!state) return;
  drawCharts = null;
  document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  ({ scenarios: renderScenarios, inputs: renderInputs, spending: renderSpending, vault: renderVault }[tab] || renderScenarios)();
  window.scrollTo(0, 0);
}
const go = t => { tab = t; location.hash = t; render(); };

function setPath(obj, path, val) {
  const parts = path.split('.'); const last = parts.pop();
  const tgt = parts.reduce((o, k) => o[k], obj); tgt[last] = val;
}

document.addEventListener('DOMContentLoaded', () => {
  const theme = (() => { try { return localStorage.getItem('ledger.theme'); } catch { return null; } })();
  if (theme) document.documentElement.dataset.theme = theme;
  $('#theme').addEventListener('click', () => {
    const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('ledger.theme', t); } catch { /* ignore */ }
    if (state && tab === 'scenarios') render();
  });
  $('#lock-btn').addEventListener('click', lockNow);
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (drawCharts && tab === 'scenarios') drawCharts(); }, 150); });

  $('#lock-form').addEventListener('submit', async e => {
    e.preventDefault();
    const p = $('#pass').value, create = $('#lock-go').dataset.mode === 'create';
    if (create) {
      const bad = C.passphraseProblem(p);
      if (bad) return lockMsg(bad, 'err');
      if (p !== $('#pass2').value) return lockMsg('The two entries differ.', 'err');
    } else if (!p) return lockMsg('Enter your passphrase.', 'err');
    unlock(p, create);
  });
  $('#pass').addEventListener('input', () => { if ($('#lock-go').dataset.mode === 'create') { $('#create-fields').classList.add('hide'); $('#lock-go').textContent = 'Unlock'; delete $('#lock-go').dataset.mode; lockMsg(''); } });

  document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => state && go(b.dataset.tab)));
  const h = location.hash.slice(1); if (['scenarios', 'inputs', 'spending', 'vault'].includes(h)) tab = h;

  ['pointerdown', 'keydown', 'scroll'].forEach(ev => document.addEventListener(ev, bumpIdle, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.hidden && state && saveTimer) save(); });

  const view = $('#view');

  view.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.k) {                                      // global input
      const v = t.dataset.t === 'bool' ? t.checked : t.dataset.t === 'num' ? (parseFloat(String(t.value).replace(/,/g, '')) || 0) : t.value;
      state.inputs[t.dataset.k] = v;
      if (!state.touched.includes(t.dataset.k)) { state.touched.push(t.dataset.k); t.closest('.field')?.querySelector('.dot-unconfirmed')?.remove(); }
      touch(); renderDerived(); return;
    }
    if (t.dataset.fx !== undefined) {                       // fixed-cost rows
      const r = state.inputs.fixed[+t.dataset.fx]; r[t.dataset.f] = t.dataset.f === 'monthly' ? (parseFloat(t.value) || 0) : t.value;
      touch(); renderDerived(); return;
    }
    if (t.dataset.sc) {                                     // scenario editor
      const s = state.scenarios.find(x => x.id === t.dataset.sc); const f = t.dataset.f;
      if (t.type === 'checkbox') s[f] = t.checked;
      else if (t.type === 'number') { const n = parseFloat(t.value); if (isNaN(n)) delete s[f]; else s[f] = n; }
      else s[f] = t.value;
      if (f === 'buy' && t.checked) { s.downPct ??= 20; s.source ??= 'heloc'; s.includeRepairs ??= true; if (!s.slot) s.slot = freeSlot(); }
      touch(); const open = [...document.querySelectorAll('details.sc')].map(d => d.open); render(); document.querySelectorAll('details.sc').forEach((d, i) => { d.open = open[i]; }); return;
    }
    if (t.id === 'st-rate' || t.id === 'st-inc') return;
    if (t.id === 'cmp') { state.cmpBase = t.value; touch(); render(); return; }
    if (t.id === 'ovr') { state.spendOverride = t.value === '' ? null : parseFloat(t.value) || 0; touch(); render(); return; }
    if (t.id === 'win') { state.spend.months = +t.value; touch(); render(); return; }
    if (t.id === 'oneoff') { state.spend.oneOff = parseFloat(t.value) || 0; touch(); render(); return; }
    if (t.dataset.inc) { state.spend.include[t.dataset.inc] = t.checked; touch(); render(); return; }
    if (t.dataset.mc) { state.spend.cat[t.dataset.mc] = t.value; touch(); render(); return; }
    if (t.dataset.pc !== undefined) { pending[+t.dataset.pc].card = t.value.trim().slice(0, 40) || 'Card'; return; }
    if (t.dataset.pf !== undefined) { pending[+t.dataset.pf].flip = t.checked; renderPending(); return; }
    if (t.id === 'file') { takeFiles([...t.files]); t.value = ''; return; }
    if (t.id === 'bk-file') { if (t.files[0]) restoreBackup(t.files[0]); t.value = ''; return; }
    if (t.id === 'seed-file') { if (t.files[0]) loadSeed(t.files[0]); t.value = ''; }
  });

  view.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'st-rate') { state.stress.rate = +t.value; $('#st-rate-v').textContent = +t.value ? `+${t.value} pt` : '0 pt'; clearTimeout(view._st); view._st = setTimeout(() => { touch(); render(); }, 160); }
    if (t.id === 'st-inc') { state.stress.income = +t.value; $('#st-inc-v').textContent = +t.value ? `−${t.value}%` : '0%'; clearTimeout(view._st); view._st = setTimeout(() => { touch(); render(); }, 160); }
  });

  view.addEventListener('click', async e => {
    const b = e.target.closest('[data-act],[data-go]'); if (!b) return;
    if (b.dataset.go) return go(b.dataset.go);
    const i = +b.dataset.i, id = b.dataset.id;
    switch (b.dataset.act) {
      case 'fx-add': state.inputs.fixed.push({ name: '', monthly: 0 }); touch(); renderInputs(); break;
      case 'fx-del': state.inputs.fixed.splice(i, 1); touch(); renderInputs(); break;
      case 'reset-stress': state.stress = { rate: 0, income: 0 }; touch(); render(); break;
      case 'sc-add': state.scenarios.push({ id: 's' + Date.now().toString(36), name: 'New scenario', buy: true, downPct: 20, source: 'heloc', helocPlan: 'payoff', helocPayoffYears: 15, includeRepairs: true, slot: freeSlot() }); touch(); render(); break;
      case 'sc-dup': { const s = state.scenarios.find(x => x.id === id); state.scenarios.push({ ...s, id: 's' + Date.now().toString(36), name: s.name + ' (copy)', slot: s.buy ? freeSlot() : 0 }); touch(); render(); break; }
      case 'sc-del': state.scenarios = state.scenarios.filter(x => x.id !== id); if (state.cmpBase === id) state.cmpBase = state.scenarios[0].id; touch(); render(); break;
      case 'pend-del': pending.splice(i, 1); renderPending(); break;
      case 'pend-add': {
        const p = pending[i]; const r = Sp.ingest(state.spend, p.card, p.rows, p.flip);
        pending.splice(i, 1); touch(); render();
        setStatus('busy', `Added ${r.added} transactions${r.dupes ? `, ${r.dupes} duplicates skipped` : ''}`);
        break;
      }
      case 'card-del': if (confirm(`Remove ${state.spend.cards[i]} and all its transactions?`)) { Sp.removeCard(state.spend, i); touch(); render(); } break;
      case 'lock': lockNow(); break;
      case 'chpass': changePassphrase(); break;
      case 'bk-dl': { const l = St.readLocal(session.id); if (l) { const { dirty, ...blob } = l; download(`ledger-backup-${stamp()}.json`, JSON.stringify(blob)); } break; }
      case 'bk-up': $('#bk-file').click(); break;
      case 'seed-up': $('#seed-file').click(); break;
      case 'plain-dl': if (confirm('This file is NOT encrypted. Save it somewhere private and delete it when you’re done. Continue?')) download(`ledger-plain-${stamp()}.json`, JSON.stringify(state, null, 1)); break;
      case 'wipe': if (confirm('Remove the cached copy from this browser? The cloud copy is untouched; you’ll need your passphrase to open it again.')) { St.clearLocal(); lockNow(); } break;
    }
  });

  const dz = () => $('#drop');
  view.addEventListener('dragover', e => { if (dz()?.contains(e.target)) { e.preventDefault(); dz().classList.add('over'); } });
  view.addEventListener('dragleave', () => dz()?.classList.remove('over'));
  view.addEventListener('drop', e => { if (dz()?.contains(e.target)) { e.preventDefault(); dz().classList.remove('over'); takeFiles([...e.dataTransfer.files]); } });

  $('#pass').focus();
});
