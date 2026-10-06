// Run: node test/model.test.mjs   — sanity checks for the finance engine.
import assert from 'node:assert/strict';
import { pmt, annualTax, saltCap, runScenario, compare, DEFAULT_INPUTS, DEFAULT_SCENARIOS, lendingHeadroom } from '../model.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// amortization: textbook values
near(pmt(320000, 7.5, 360), 2237.49, 0.01, '30y $320k @7.5%');
near(pmt(100000, 0, 100), 1000, 1e-9, 'zero rate');

// tax: 2026 single, $100k wages, standard deduction, no state tax
{
  const t = annualTax({ wages: 100000, filing: 'single', stateRatePct: 0, propTax: 0, mortInterest: 0, yearIndex: 1, inflationPct: 3 });
  // taxable 83,900: 1240 + 12%*(50400-12400) + 22%*(83900-50400) = 1240+4560+7370
  near(t.fed, 13170, 1, 'federal on $100k');
  near(t.fica, 7650, 1, 'FICA on $100k');
}
assert.equal(saltCap(2030), 10000);
near(saltCap(2026), 40400, 0.01, 'SALT 2026');

// a loan with no growth and no costs: baseline equity should just track amortization
const inp = {
  ...DEFAULT_INPUTS, salary: 250000, vaMonthly: 2000, curValue: 800000, curBalance: 120000, curRatePct: 3.5,
  curMonthsLeft: 300, price: 350000, repairs: 60000, curEscrowMonthly: 900, curPropTaxAnnual: 4500,
  fixed: [{ name: 'Other', monthly: 3000 }],
};
const res = compare(inp, DEFAULT_SCENARIOS, { cardMonthly: 6000 });
const by = Object.fromEntries(res.map(r => [r.id, r]));

// funding arithmetic
near(by.mh.funding.cashNeed, 70000 + 10500 + 60000, 1e-6, 'cash need, 20% down');
near(by.mh.funding.helocDraw, 140500, 1e-6, 'HELOC draw');
near(by.ch.funding.cashNeed, 350000 + 10500 + 60000, 1e-6, 'cash need, all cash');
near(by.cr.funding.refiPrincipal, (120000 + 420500) / (1 - 0.015), 1, 'refi principal');
assert.equal(by.ch.funding.mortPrincipal, 0);

// baseline delta must be zero everywhere
by.base.wealthDelta.forEach(d => near(d, 0, 1e-6, 'baseline delta'));

// baseline loan pays off at its own maturity (300 months)
near(by.base.loans.current.bal[300], 0, 0.01, 'existing mortgage retires');

// HELOC payoff plan retires the line in 15 years
near(by.mh.loans.heloc.bal[180], 0, 0.5, 'HELOC 15y payoff');

// a refi replaces the existing mortgage: no leftover payments on the old one
assert.ok(by.mr.loans.current.pay[1] > by.base.loans.current.pay[1], 'refi payment larger than the 3.25% loan');

// stress moves only variable-rate scenarios
const stressed = compare(inp, DEFAULT_SCENARIOS, { cardMonthly: 6000, stress: { rate: 2, income: 0 } });
assert.ok(stressed.find(r => r.id === 'mh').month1.payHeloc > by.mh.month1.payHeloc, 'HELOC payment rises with rates');
near(stressed.find(r => r.id === 'mr').month1.payCur, by.mr.month1.payCur, 1e-6, 'refi unaffected by HELOC shock');

// headroom
near(lendingHeadroom(inp), 0.8 * 800000 - 120000, 1e-6, 'headroom at 80% CLTV');

// print a readable summary
const $ = n => Math.round(n).toLocaleString('en-US');
for (const r of res) {
  console.log(`${r.name.padEnd(28)} borrow ${$(r.funding.chDebt0).padStart(8)}  CLTV ${(r.cltv * 100).toFixed(0)}%  blended ${r.blended.toFixed(2)}%  ` +
    `pay ${$(r.month1.loans).padStart(6)}  net ${$(r.month1.net)}  surplus ${$(r.month1.surplus).padStart(6)}  DTI ${(r.month1.dti * 100).toFixed(0)}%  ` +
    `Δ10y ${$(r.wealthDelta[10]).padStart(8)}  Δ30y ${$(r.wealthDelta[30]).padStart(8)}`);
}
console.log('ok');
