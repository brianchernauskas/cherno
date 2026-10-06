// ---------------------------------------------------------------------------
// The finance engine. Pure functions, no DOM, so it can be unit-tested in Node.
//
// A scenario is run month by month for `horizonYears`:
//   loans      existing mortgage (or the cash-out refi that replaces it), a HELOC,
//              and a mortgage on the second home — each simulated separately
//   taxes      recomputed each year from that year's deductible interest
//   cash flow  net income - spending - loan payments - second-home carrying cost
//   wealth     home equity (both homes) + a side fund that compounds the monthly
//              surplus (or drains on a deficit) at `savingsReturnPct`
// Every scenario is then compared with the no-purchase baseline, which is the
// only fair way to weigh "a house that costs money" against "a house that is
// also an asset".
//
// Everything is in nominal dollars; rates are percentages (7.25 = 7.25%).
// ---------------------------------------------------------------------------

export const DEFAULT_INPUTS = {
  // income & tax
  salary: 0, bonus: 0, raisePct: 3, vaMonthly: 0, otherIncomeMonthly: 0,
  filing: 'single', stateTaxPct: 2.5,
  // balance sheet
  liquidSavings: 0, savingsReturnPct: 4, inflationPct: 3, appreciationPct: 3.5,
  // current home
  curName: 'Current home', curValue: 0, curBalance: 0, curRatePct: 3.25, curMonthsLeft: 300, curPaymentOverride: 0,
  curEscrowMonthly: 0, curPropTaxAnnual: 0,
  // second home
  tgtName: 'Second home', tgtAddress: '', price: 0, closingPct: 3, repairs: 0, repairRecoveryPct: 50,
  taxRatePct: 0.55, insuranceAnnual: 2400, hoaMonthly: 0, carryMonthly: 350, maintPct: 0.75,
  // lending market
  primePct: 6.75, helocMarginPct: 0.5, helocDrawYears: 10, helocAmortYears: 20, helocDriftPct: 0,
  refiRatePct: 7.0, refiTermYears: 30, refiCostPct: 1.5,
  mortRatePct: 7.5, mortTermYears: 30, maxCltvPct: 80,
  // tax toggles
  helocDeductible: false, deductSecondHome: true,
  horizonYears: 30,
  fixed: [],            // [{ name, monthly }] recurring costs that don't run through the cards
};

export const DEFAULT_SCENARIOS = [
  { id: 'base', name: 'Status quo', buy: false },
  { id: 'mh', name: 'Mortgage + HELOC', buy: true, downPct: 20, source: 'heloc', helocPlan: 'payoff', helocPayoffYears: 15, includeRepairs: true },
  { id: 'mr', name: 'Mortgage + cash-out refi', buy: true, downPct: 20, source: 'refi', includeRepairs: true },
  { id: 'ch', name: 'All cash via HELOC', buy: true, downPct: 100, source: 'heloc', helocPlan: 'payoff', helocPayoffYears: 15, includeRepairs: true },
  { id: 'cr', name: 'All cash via cash-out refi', buy: true, downPct: 100, source: 'refi', includeRepairs: true },
];

// --- amortization --------------------------------------------------------

export function pmt(P, ratePct, n) {
  if (n <= 0) return P;
  const r = ratePct / 1200;
  return r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));
}

const zeros = n => new Array(n + 1).fill(0);

function fixedLoan(P, ratePct, term, H, payOverride) {
  const bal = zeros(H), int = zeros(H), pay = zeros(H);
  bal[0] = P;
  if (P <= 0) return { bal, int, pay };
  const p = payOverride > 0 ? payOverride : pmt(P, ratePct, term);
  const r = ratePct / 1200;
  let b = P;
  for (let t = 1; t <= H; t++) {
    if (b <= 0.005) { b = 0; continue; }
    const i = b * r, pp = Math.min(p, b + i);
    b = b + i - pp;
    bal[t] = b; int[t] = i; pay[t] = pp;
  }
  return { bal, int, pay };
}

// HELOC: variable rate. 'io' pays interest through the draw period, then
// amortizes over the repayment period; 'payoff' amortizes over a chosen term
// from day one. Re-amortizing every month at the current rate is how a real
// variable-rate line behaves.
function helocLoan(P, rateAt, plan, drawM, amortM, payoffM, H) {
  const bal = zeros(H), int = zeros(H), pay = zeros(H);
  bal[0] = P;
  if (P <= 0) return { bal, int, pay };
  let b = P;
  for (let t = 1; t <= H; t++) {
    if (b <= 0.005) { b = 0; continue; }
    const rate = rateAt(t), i = b * rate / 1200;
    let p;
    if (plan === 'io') p = t <= drawM ? i : pmt(b, rate, drawM + amortM - t + 1);
    else p = pmt(b, rate, payoffM - t + 1);
    p = Math.min(p, b + i);
    b = b + i - p;
    bal[t] = b; int[t] = i; pay[t] = p;
  }
  return { bal, int, pay };
}

// --- tax -----------------------------------------------------------------
// 2026 federal figures (IRS Rev. Proc. 2025-32 / OBBBA). Brackets, the standard
// deduction and the Social Security wage base are indexed forward at the
// inflation input; the Medicare surtax thresholds are statutory and not indexed.
// The SALT cap follows the 2025 law: $40,400 in 2026, +1% a year to 2029, then
// back to $10,000 in 2030.

const TAX = {
  single: { std: 16100, med: 200000, br: [[12400, .10], [50400, .12], [105700, .22], [201775, .24], [256225, .32], [640600, .35], [Infinity, .37]] },
  mfj: { std: 32200, med: 250000, br: [[24800, .10], [100800, .12], [211400, .22], [403550, .24], [512450, .32], [768700, .35], [Infinity, .37]] },
};
const SS_BASE = 184500;
export const FIRST_YEAR = 2027;

export function saltCap(year) {
  return year >= 2030 ? 10000 : 40400 * Math.pow(1.01, Math.max(0, year - 2026));
}

export function annualTax({ wages, filing, stateRatePct, propTax, mortInterest, yearIndex, inflationPct }) {
  const T = TAX[filing] || TAX.single;
  const idx = Math.pow(1 + inflationPct / 100, yearIndex - 1);
  const year = FIRST_YEAR + yearIndex - 1;
  const w = Math.max(0, wages);

  const ss = 0.062 * Math.min(w, SS_BASE * idx);
  const medicare = 0.0145 * w + 0.009 * Math.max(0, w - T.med);
  const state = (stateRatePct / 100) * Math.max(0, w - T.std * idx);

  const itemized = Math.min(saltCap(year), state + propTax) + mortInterest;
  const std = T.std * idx;
  const deduction = Math.max(std, itemized);
  const taxable = Math.max(0, w - deduction);

  let fed = 0, lo = 0;
  for (const [hi, rate] of T.br) {
    const top = hi * idx;
    if (taxable > lo) fed += (Math.min(taxable, top) - lo) * rate;
    lo = top;
    if (taxable <= top) break;
  }
  return { fed, state, fica: ss + medicare, total: fed + state + ss + medicare, itemized: itemized > std, deduction };
}

// --- one scenario ----------------------------------------------------------

export function lendingHeadroom(inp) {
  return Math.max(0, (inp.curValue * inp.maxCltvPct) / 100 - inp.curBalance);
}

export function runScenario(inp, sc, opts = {}) {
  const stress = opts.stress || { rate: 0, income: 0 };
  const cardMonthly = opts.cardMonthly || 0;
  const Y = Math.max(1, Math.round(inp.horizonYears));
  const H = Y * 12;
  const buy = !!sc.buy;

  // --- funding the purchase
  const closing = buy ? (inp.price * inp.closingPct) / 100 : 0;
  const repairs = buy && sc.includeRepairs !== false ? inp.repairs : 0;
  const down = buy ? (inp.price * (sc.downPct ?? 20)) / 100 : 0;
  const cashNeed = down + closing + repairs;
  const fromSavings = sc.source === 'savings' ? cashNeed : Math.min(sc.cashUsed || 0, cashNeed);
  const borrow = cashNeed - fromSavings;

  const B = inp.curBalance;
  const useRefi = buy && sc.source === 'refi';
  const useHeloc = buy && sc.source === 'heloc';
  const refiRate = sc.refiRatePct ?? inp.refiRatePct;
  const refiPrincipal = useRefi ? (B + borrow) / (1 - inp.refiCostPct / 100) : 0;
  const refiCosts = useRefi ? (refiPrincipal * inp.refiCostPct) / 100 : 0;
  const helocDraw = useHeloc ? borrow : 0;
  const helocBase = sc.helocRatePct ?? (inp.primePct + inp.helocMarginPct);
  const helocRateAt = t => helocBase + stress.rate + (inp.helocDriftPct || 0) * Math.floor((t - 1) / 12);
  const mortRate = sc.mortRatePct ?? inp.mortRatePct;
  const mortPrincipal = buy ? Math.max(0, inp.price - down) : 0;

  // --- loans
  const current = useRefi
    ? fixedLoan(refiPrincipal, refiRate, inp.refiTermYears * 12, H, 0)
    : fixedLoan(B, inp.curRatePct, inp.curMonthsLeft, H, inp.curPaymentOverride);
  const heloc = helocLoan(helocDraw, helocRateAt, sc.helocPlan || 'payoff', inp.helocDrawYears * 12,
    inp.helocAmortYears * 12, (sc.helocPayoffYears || 15) * 12, H);
  const second = fixedLoan(mortPrincipal, mortRate, inp.mortTermYears * 12, H, 0);

  // --- year-by-year tax
  const qualShare = useRefi ? Math.min(1, B / refiPrincipal) : 1;   // only the old balance is acquisition debt
  const taxes = [];
  for (let y = 1; y <= Y; y++) {
    let mortInt = 0;
    for (let t = (y - 1) * 12 + 1; t <= y * 12; t++) {
      const qualBal = current.bal[t - 1] * qualShare + (inp.deductSecondHome ? second.bal[t - 1] : 0);
      const f = Math.min(1, 750000 / Math.max(1, qualBal));
      mortInt += (current.int[t] * qualShare + (inp.deductSecondHome ? second.int[t] : 0)) * f
        + (inp.helocDeductible ? heloc.int[t] : 0);
    }
    const infl = Math.pow(1 + inp.inflationPct / 100, y - 1);
    const wages = (inp.salary + inp.bonus) * Math.pow(1 + inp.raisePct / 100, y - 1) * (1 - stress.income / 100);
    const propTax = inp.curPropTaxAnnual * infl + (buy ? ((inp.price * inp.taxRatePct) / 100) * infl : 0);
    taxes.push({ wages, ...annualTax({
      wages, filing: inp.filing, stateRatePct: inp.stateTaxPct, propTax, mortInterest: mortInt,
      yearIndex: y, inflationPct: inp.inflationPct }) });
  }

  // --- monthly cash flow and wealth
  const growth = Math.pow(1 + inp.appreciationPct / 100, 1 / 12);
  const rs = inp.savingsReturnPct / 1200;
  const fixedSum = (inp.fixed || []).reduce((s, r) => s + (+r.monthly || 0), 0);
  const v1_0 = inp.curValue;
  const v2_0 = buy ? inp.price + (repairs * inp.repairRecoveryPct) / 100 : 0;

  let fund = -fromSavings;
  // year 0: equity in both homes less every new dollar borrowed, less cash spent
  const wealth = [v1_0 - (useRefi ? refiPrincipal : B) - helocDraw + (buy ? v2_0 - mortPrincipal : 0) + fund];

  const surplusByYear = [], netByYear = [];
  let peak = 0, peakYear = 0, interest10 = 0, month1 = null;
  let ySurplus = 0, yNet = 0;

  for (let t = 1; t <= H; t++) {
    const y = Math.ceil(t / 12), infl = Math.pow(1 + inp.inflationPct / 100, y - 1);
    const tx = taxes[y - 1];
    const net = (tx.wages - tx.total) / 12 + (inp.vaMonthly + inp.otherIncomeMonthly) * infl;
    const living = (cardMonthly + fixedSum + inp.curEscrowMonthly) * infl;
    const carry = buy
      ? (((inp.price * inp.taxRatePct) / 100 + inp.insuranceAnnual + (inp.price * inp.maintPct) / 100) / 12 + inp.hoaMonthly + inp.carryMonthly) * infl
      : 0;
    const payCur = current.pay[t], payHeloc = heloc.pay[t], paySecond = second.pay[t];
    const loans = payCur + payHeloc + paySecond;
    const surplus = net - living - carry - loans;

    fund = fund * (1 + rs) + surplus;
    ySurplus += surplus; yNet += net;
    if (t <= 120) {
      interest10 += current.int[t] + heloc.int[t] + second.int[t];
      if (loans > peak + 0.5) { peak = loans; peakYear = y; }
    }
    if (t === 1) {
      const qualifying = tx.wages / 12 + inp.vaMonthly * 1.25;        // lenders gross up non-taxable income
      const secondCarry = buy ? ((inp.price * inp.taxRatePct) / 100 + inp.insuranceAnnual) / 12 + inp.hoaMonthly : 0;
      const obligations = loans + inp.curEscrowMonthly + secondCarry;
      month1 = {
        net, living, carry, payCur, payHeloc, paySecond, loans, surplus,
        cards: cardMonthly, fixed: fixedSum, escrow: inp.curEscrowMonthly,
        gross: tx.wages / 12, tax: tx.total / 12, qualifying, obligations, dti: qualifying > 0 ? obligations / qualifying : 0,
      };
    }
    if (t % 12 === 0) {
      const g = Math.pow(growth, t);
      const v1 = v1_0 * g, v2 = buy ? v2_0 * g : 0;
      wealth.push(v1 - current.bal[t] - heloc.bal[t] + (buy ? v2 - second.bal[t] : 0) + fund);
      surplusByYear.push(ySurplus / 12);
      netByYear.push(yNet / 12);
      ySurplus = 0; yNet = 0;
    }
  }

  const chDebt0 = (useRefi ? refiPrincipal : B) + helocDraw;
  const blended = chDebt0 > 0
    ? (((useRefi ? refiRate : inp.curRatePct) * (useRefi ? refiPrincipal : B)) + helocBase * helocDraw) / chDebt0 : 0;

  return {
    id: sc.id, name: sc.name, buy,
    funding: { down, closing, repairs, cashNeed, fromSavings, borrow, helocDraw, refiPrincipal, refiCosts, mortPrincipal, chDebt0 },
    cltv: inp.curValue > 0 ? chDebt0 / inp.curValue : 0,
    overCap: inp.curValue > 0 && chDebt0 / inp.curValue > inp.maxCltvPct / 100 + 1e-9,
    blended, helocRate: helocBase + stress.rate, mortRate, refiRate,
    month1, peak, peakYear, interest10,
    wealth, surplusByYear, netByYear,
    firstYearTax: taxes[0],
    // for the payment-shock view
    helocIO: helocDraw * helocBase / 1200,
    loans: { current, heloc, second },
  };
}

export function compare(inp, scenarios, opts = {}) {
  const out = scenarios.map(sc => runScenario(inp, sc, opts));
  const base = out.find(r => !r.buy) || runScenario(inp, { id: 'base', name: 'Status quo', buy: false }, opts);
  out.forEach(r => { r.wealthDelta = r.wealth.map((w, i) => w - base.wealth[i]); });
  return out;
}
