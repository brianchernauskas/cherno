// ---------------------------------------------------------------------------
// Two hand-rolled SVG charts: a multi-series line chart with a snapping
// crosshair, and horizontal stacked bars with per-segment hover. No library.
// Colors come from CSS classes (c0..c5 for series, fk1..fkg for the stack) so
// the light/dark themes swap in one place. Series are told apart by dash
// pattern as well as hue, and every value is also in the table view.
// ---------------------------------------------------------------------------

const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const money = (n, dp = 0) => {
  const v = Math.round(n * 10 ** dp) / 10 ** dp;
  return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
};
export const compact = n => {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}k`;
  return `${s}$${Math.round(a)}`;
};

function niceTicks(lo, hi, n = 5) {
  if (lo === hi) { hi = lo + 1; }
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw) || raw;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, out = [];
  for (let v = a; v <= b + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}

let tipEl;
function tip() {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip hide'; document.body.appendChild(tipEl); }
  return tipEl;
}
function showTip(x, y, head, rows) {
  const t = tip();
  t.textContent = '';
  if (head) { const h = document.createElement('div'); h.className = 'h'; h.textContent = head; t.appendChild(h); }
  for (const r of rows) {
    const d = document.createElement('div'); d.className = 'r';
    const k = document.createElement('i'); k.className = `${r.box ? 'box ' : ''}${r.bg || ''}`; d.appendChild(k);
    const n = document.createElement('span'); n.textContent = r.name; d.appendChild(n);
    const b = document.createElement('b'); b.textContent = r.value; d.appendChild(b);
    t.appendChild(d);
  }
  t.classList.remove('hide');
  const w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 14)) + 'px';
  t.style.top = Math.max(8, Math.min(innerHeight - h - 8, y - h / 2)) + 'px';
}
const hideTip = () => tip().classList.add('hide');

// series: [{ name, slot, values[] }]  xs: label per index
export function lineChart(host, { series, xs, yFmt = compact, xTick = 5, xFmt = x => x, tipHead = x => x, height = 300 }) {
  const W = Math.max(300, Math.round(host.clientWidth || 760)), H = height, L = 58, R = 12, T = 12, B = 28;
  const all = series.flatMap(s => s.values);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 5);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const X = i => L + (i / Math.max(1, xs.length - 1)) * (W - L - R);
  const Y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);

  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Line chart">`;
  for (const t of ticks) svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${L - 8}" y="${Y(t) + 4}" text-anchor="end">${esc(yFmt(t))}</text>`;
  xs.forEach((x, i) => { if (i % xTick === 0) svg += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${esc(xFmt(x))}</text>`; });
  if (y0 < 0 && y1 > 0) svg += `<line class="zero" x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  for (const s of series) {
    const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    svg += `<path class="ln c${s.slot}" d="${d}"/>`;
  }
  svg += `<line class="cross hide" id="xh" y1="${T}" y2="${H - B}"/>`;
  series.forEach((s, k) => { svg += `<circle class="pt c${s.slot} hide" data-k="${k}" r="4.5"/>`; });
  svg += `<rect id="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/></svg>`;
  host.innerHTML = svg;

  const el = host.querySelector('svg'), hit = host.querySelector('#hit'), xh = host.querySelector('#xh');
  const pts = [...host.querySelectorAll('.pt')];
  const move = e => {
    const r = el.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(xs.length - 1, Math.round(((px - L) / (W - L - R)) * (xs.length - 1))));
    xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.classList.remove('hide');
    series.forEach((s, k) => { pts[k].setAttribute('cx', X(i)); pts[k].setAttribute('cy', Y(s.values[i])); pts[k].classList.remove('hide'); });
    const rows = series.map(s => ({ name: s.name, value: yFmt(s.values[i]), bg: `bg${s.slot}`, v: s.values[i] })).sort((a, b) => b.v - a.v);
    showTip(e.clientX, e.clientY, tipHead(xs[i]), rows);
  };
  const leave = () => { xh.classList.add('hide'); pts.forEach(p => p.classList.add('hide')); hideTip(); };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', leave);
}

// rows: [{ label, slot, segs: [{ name, key, value }], marker }]   key -> fk class
export function stackBars(host, { rows, fmt = money, markerName = 'Net income' }) {
  const W = Math.max(300, Math.round(host.clientWidth || 760));
  const narrow = W < 560;                     // labels move above the bars on phones
  const rowH = 30, gap = narrow ? 30 : 10, L = narrow ? 8 : 190, R = 12, T = 22, B = 26;
  const H = T + rows.length * (rowH + gap) + B;
  const max = Math.max(...rows.map(r => Math.max(r.marker || 0, r.segs.reduce((s, x) => s + x.value, 0)))) * 1.04 || 1;
  const ticks = niceTicks(0, max, 5);
  const top = ticks[ticks.length - 1];
  const X = v => L + (v / top) * (W - L - R);

  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly outflow by scenario">`;
  for (const t of ticks) svg += `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="${T - 6}" y2="${H - B}"/><text x="${X(t)}" y="${H - 8}" text-anchor="middle">${esc(compact(t))}</text>`;
  rows.forEach((r, i) => {
    const y = T + i * (rowH + gap);
    svg += narrow
      ? `<text class="rowlabel" x="${L}" y="${y - 6}">${esc(r.label)}</text>`
      : `<text class="rowlabel" x="${L - 12}" y="${y + rowH / 2 + 4}" text-anchor="end">${esc(r.label)}</text>`;
    let x = L;
    r.segs.forEach((s, j) => {
      if (s.value <= 0) return;
      const w = (s.value / top) * (W - L - R);
      svg += `<rect class="seg fk${s.key}" data-r="${i}" data-s="${j}" x="${x}" y="${y}" width="${Math.max(0, w)}" height="${rowH}" rx="3" tabindex="0"/>`;
      if (w > 54) svg += `<text class="segval t${s.key}" x="${x + w / 2}" y="${y + rowH / 2 + 4}" text-anchor="middle">${esc(compact(s.value))}</text>`;
      x += w;
    });
    if (r.marker) svg += `<line class="mk" x1="${X(r.marker)}" x2="${X(r.marker)}" y1="${y - 5}" y2="${y + rowH + 5}"/>`;
  });
  svg += '</svg>';
  host.innerHTML = svg;

  const show = (e, rect) => {
    const r = rows[+rect.dataset.r], s = r.segs[+rect.dataset.s];
    const total = r.segs.reduce((a, b) => a + b.value, 0);
    const box = rect.getBoundingClientRect();
    const rowsOut = [{ name: s.name, value: fmt(s.value), bg: `bk${s.key}`, box: true }, { name: 'Row total', value: fmt(total) }];
    if (r.marker) rowsOut.push({ name: markerName, value: fmt(r.marker) });
    showTip(e.clientX || box.right, e.clientY || box.top, r.label, rowsOut);
  };
  host.querySelectorAll('.seg').forEach(rect => {
    rect.addEventListener('pointermove', e => show(e, rect));
    rect.addEventListener('focus', () => show({}, rect));
    rect.addEventListener('pointerleave', hideTip);
    rect.addEventListener('blur', hideTip);
  });
}
