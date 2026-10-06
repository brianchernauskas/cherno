import { TRIP, PLACES, LEGS, RECOMMENDED, HOUSES, SCORE_CATS } from './data.js?v=202609261400';
import * as store from './store.js?v=202609261400';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = Object.fromEntries(HOUSES.map(h => [h.id, h]));
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const ppsf = h => Math.round(h.price / h.sqft);
const PAD = 1.10; // drive-time padding for traffic and parking
const ACTIVE = HOUSES.filter(h => !h.inactive);            // still for sale, so still on the route
const isActive = id => Boolean(byId[id]) && !byId[id].inactive;

const DEFAULT_PLAN = () => ({
  order: [...RECOMMENDED],
  day: Object.fromEntries(ACTIVE.map(h => [h.id, h.defaultDay || 'sat'])),
  booked: {},
  depart: '08:00',
  sunStart: '09:00',
  dwell: 45,
  lunch: true,
});

let plan = DEFAULT_PLAN();
let me = '';
let selected = RECOMMENDED[0];
const notes = {}, photos = {}, scores = {};
let photoUnsub = null;

try { me = localStorage.getItem('ph:me') || ''; } catch {}
try { selected = localStorage.getItem('ph:sel') || selected; } catch {}
if (!byId[selected]) selected = RECOMMENDED[0];

// --- time helpers -----------------------------------------------------------

const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const toHHMM = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fmt = m => { m = Math.round(m); let h = Math.floor(m / 60) % 24; const mm = String(m % 60).padStart(2, '0'); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${mm} ${ap}`; };
const leg = (a, b) => { const l = LEGS[a]?.[b]; return l ? { mi: l[0], min: Math.ceil(l[1] * PAD) } : { mi: 0, min: 0 }; };
const daysOnMarket = h => !h.listed ? '—' : Math.max(0, Math.floor((Date.now() - new Date(h.listed + 'T12:00:00-07:00')) / 864e5));
const ago = ts => {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return new Date(ts).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
};

// --- schedule ---------------------------------------------------------------

function buildDay(day) {
  const stops = plan.order.filter(id => isActive(id) && plan.day[id] === day);
  const items = [];
  const startAt = day === 'sat' ? 'home' : 'hotel';
  let t = toMin(day === 'sat' ? plan.depart : plan.sunStart);
  items.push({ kind: 'fixed', t, label: day === 'sat' ? 'Leave Chandler' : 'Leave SpringHill Suites', icon: day === 'sat' ? '🚗' : 'H' });
  let at = startAt, lunched = !plan.lunch || day === 'sun';
  stops.forEach((id, i) => {
    const d = leg(at, id);
    t += d.min;
    items.push({ kind: 'drive', ...d });
    const b = plan.booked[id];
    let wait = 0;
    if (b && toMin(b) > t) { wait = toMin(b) - t; t = toMin(b); }
    const late = b && toMin(b) < t - 1;
    items.push({ kind: 'house', id, t, end: t + Number(plan.dwell), n: i + 1, wait, late, booked: b });
    t += Number(plan.dwell);
    at = id;
    if (!lunched && t >= 11 * 60 + 45 && i < stops.length - 1) {
      items.push({ kind: 'lunch', t }); t += 45; lunched = true;
    }
  });
  const endAt = day === 'sat' ? 'hotel' : 'home';
  const d = leg(at, endAt);
  if (stops.length || day === 'sat') {
    t += d.min;
    items.push({ kind: 'drive', ...d });
    items.push({ kind: 'fixed', t, label: day === 'sat' ? 'SpringHill Suites · check in, then Whiskey Row (3 min)' : 'Home to Chandler', icon: day === 'sat' ? 'H' : '🏠' });
  }
  return { items, stops };
}

function renderDay(day) {
  const el = $(day === 'sat' ? '#tlSat' : '#tlSun');
  const { items, stops } = buildDay(day);
  if (day === 'sun' && !stops.length) {
    el.innerHTML = `<li class="empty-day">Nothing on Sunday yet. Tap <b>→ Sun</b> on a home to move it here.</li>`;
    return;
  }
  const sameDay = plan.order.filter(id => isActive(id) && plan.day[id] === day);
  el.innerHTML = items.map(it => {
    if (it.kind === 'drive') return `<li class="tl-drive"><span>🚗 ${it.min} min · ${it.mi} mi</span></li>`;
    if (it.kind === 'fixed') return `<li class="tl"><span class="tl-time">${fmt(it.t)}</span><div class="tl-box fixed"><span class="num ico">${it.icon}</span><div class="tl-main"><div class="tl-name">${esc(it.label)}</div></div></div></li>`;
    if (it.kind === 'lunch') return `<li class="tl"><span class="tl-time">${fmt(it.t)}</span><div class="tl-box lunch"><span class="num ico">🍴</span><div class="tl-main"><div class="tl-name">Lunch</div><div class="tl-meta">45 min, near the next stop</div></div></div></li>`;
    const h = byId[it.id];
    const idx = sameDay.indexOf(it.id);
    const other = day === 'sat' ? 'sun' : 'sat';
    return `<li class="tl"><span class="tl-time">${fmt(it.t)}</span>
      <div class="tl-box">
        <span class="num ${day}">${it.n}</span>
        <div class="tl-main">
          <div class="tl-name"><a href="#homes" data-go="${h.id}">${esc(h.addr)}</a></div>
          <div class="tl-meta">${money(h.price)} · ${h.beds} bd · ${h.sqft.toLocaleString()} sq ft · until ${fmt(it.end)}${it.wait ? ` · <span class="tl-wait">${it.wait} min spare before booked time</span>` : ''}${it.late ? ` · <span class="late">can’t make ${fmt(toMin(it.booked))}. Reorder or leave earlier</span>` : ''}</div>
        </div>
        <div class="tl-ctl">
          <label class="booked-lbl">Booked<input class="booked" type="time" step="300" data-book="${h.id}" value="${esc(plan.booked[h.id] || '')}"></label>
          <button class="icon-btn" data-move="${h.id}" data-dir="-1" ${idx === 0 ? 'disabled' : ''} aria-label="Move earlier">↑</button>
          <button class="icon-btn" data-move="${h.id}" data-dir="1" ${idx === sameDay.length - 1 ? 'disabled' : ''} aria-label="Move later">↓</button>
          <button class="day-btn" data-day="${h.id}" data-to="${other}">→ ${other === 'sun' ? 'Sun' : 'Sat'}</button>
        </div>
      </div></li>`;
  }).join('');
}

function renderPlan() {
  $('#depart').value = plan.depart;
  $('#sunStart').value = plan.sunStart;
  $('#dwell').value = plan.dwell;
  $('#lunch').checked = !!plan.lunch;
  renderDay('sat');
  renderDay('sun');
}

let saveTimer;
function commitPlan() {
  renderPlan(); renderMapPins(); renderPicker(); renderCompare();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.savePlan({ ...plan, updatedBy: me || 'someone', ts: Date.now() }).catch(err => toastErr(err)), 400);
}

function wirePlan() {
  $('#depart').addEventListener('change', e => { plan.depart = e.target.value || '08:00'; commitPlan(); });
  $('#sunStart').addEventListener('change', e => { plan.sunStart = e.target.value || '09:00'; commitPlan(); });
  $('#dwell').addEventListener('change', e => { plan.dwell = Math.min(120, Math.max(15, Number(e.target.value) || 45)); commitPlan(); });
  $('#lunch').addEventListener('change', e => { plan.lunch = e.target.checked; commitPlan(); });
  $('#resetPlan').addEventListener('click', () => { if (confirm('Reset the order, days and booked times to the recommended plan? Everyone with the link will see the reset.')) { plan = DEFAULT_PLAN(); commitPlan(); } });
  $('#plan').addEventListener('click', e => {
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const id = mv.dataset.move, dir = Number(mv.dataset.dir);
      const same = plan.order.filter(x => isActive(x) && plan.day[x] === plan.day[id]);
      const j = same.indexOf(id) + dir;
      if (j < 0 || j >= same.length) return;
      const a = plan.order.indexOf(id), b = plan.order.indexOf(same[j]);
      [plan.order[a], plan.order[b]] = [plan.order[b], plan.order[a]];
      commitPlan(); return;
    }
    const dy = e.target.closest('[data-day]');
    if (dy) { plan.day[dy.dataset.day] = dy.dataset.to; commitPlan(); return; }
    const go = e.target.closest('[data-go]');
    if (go) selectHouse(go.dataset.go);
  });
  $('#plan').addEventListener('change', e => {
    const bk = e.target.closest('[data-book]');
    if (bk) { plan.booked[bk.dataset.book] = bk.value; commitPlan(); }
  });
}

// --- map --------------------------------------------------------------------

let map, pinLayer, poiLayer, routeLayer;
function initMap() {
  if (!window.L) { $('#map').innerHTML = '<p class="none" style="padding:16px">The map couldn’t load. Check your connection.</p>'; return; }
  map = L.map('map', { scrollWheelZoom: false, tap: true }).setView([34.55, -112.47], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  pinLayer = L.layerGroup().addTo(map);
  poiLayer = L.layerGroup().addTo(map);
  const hi = L.divIcon({ className: '', html: '<div class="pin-hotel">H</div>', iconSize: [26, 26], iconAnchor: [13, 13] });
  L.marker([PLACES.hotel.lat, PLACES.hotel.lon], { icon: hi, zIndexOffset: 500 }).addTo(map).bindPopup(`<b>${PLACES.hotel.name}</b><br>${PLACES.hotel.addr}`);
  const si = L.divIcon({ className: '', html: '<div class="pin-star"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
  L.marker([PLACES.whiskey.lat, PLACES.whiskey.lon], { icon: si }).addTo(map).bindPopup('<b>Whiskey Row</b><br>Courthouse Square · 3 min from the hotel');
  map.fitBounds(L.latLngBounds(HOUSES.map(h => [h.lat, h.lon]).concat([[PLACES.hotel.lat, PLACES.hotel.lon]])).pad(0.12));
  renderMapPins();
}

function numberFor(id) {
  if (!isActive(id)) return '—';
  const same = plan.order.filter(x => isActive(x) && plan.day[x] === plan.day[id]);
  return same.indexOf(id) + 1;
}

let routeReq = 0;
function renderMapPins() {
  if (!map) return;
  pinLayer.clearLayers();
  HOUSES.forEach(h => {
    const day = plan.day[h.id];
    const tone = h.inactive ? 'off' : day === 'sun' ? 'sun' : '';
    const icon = L.divIcon({ className: '', html: `<div class="pin ${tone} ${h.id === selected ? 'sel' : ''}"><b>${h.inactive ? '·' : numberFor(h.id)}</b></div>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
    L.marker([h.lat, h.lon], { icon, zIndexOffset: 1000 }).addTo(pinLayer)
      .bindPopup(`<b>${esc(h.addr)}</b><br>${money(h.price)} · ${h.beds} bd / ${h.baths} ba · ${h.sqft.toLocaleString()} sq ft<br>${h.inactive ? 'Under contract — not on the route' : (day === 'sun' ? 'Sunday' : 'Saturday') + ' stop ' + numberFor(h.id)}<br><a href="#homes" class="pop-link" data-go="${h.id}">Open details →</a>`);
  });
  renderPois();
  drawRoutes();
}

function renderPois() {
  if (!map) return;
  poiLayer.clearLayers();
  const h = byId[selected];
  const ic = { grocery: '🛒', gas: '⛽', restaurant: '🍴' };
  Object.entries(h.near).forEach(([k, p]) => {
    const icon = L.divIcon({ className: '', html: `<div class="pin-poi">${ic[k]}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
    L.marker([p.lat, p.lon], { icon }).addTo(poiLayer).bindPopup(`<b>${esc(p.name)}</b><br>${p.mi} mi · ${p.min} min from ${esc(h.short)}`);
  });
}

// Road-following lines from the public OSRM server; straight dashes if it's down.
async function drawRoutes() {
  const req = ++routeReq;
  routeLayer.clearLayers();
  const hotel = [PLACES.hotel.lat, PLACES.hotel.lon];
  const sat = plan.order.filter(id => isActive(id) && plan.day[id] === 'sat').map(id => [byId[id].lat, byId[id].lon]);
  const sun = plan.order.filter(id => isActive(id) && plan.day[id] === 'sun').map(id => [byId[id].lat, byId[id].lon]);
  const lines = [];
  if (sat.length) lines.push({ pts: [...sat, hotel], color: '#2F5D46' });
  if (sun.length) lines.push({ pts: [hotel, ...sun], color: '#6A4FB0' });
  for (const ln of lines) {
    let coords = ln.pts, dashed = true;
    try {
      const q = ln.pts.map(p => `${p[1]},${p[0]}`).join(';');
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${q}?overview=full&geometries=geojson`);
      const j = await r.json();
      if (j.routes?.[0]) { coords = j.routes[0].geometry.coordinates.map(c => [c[1], c[0]]); dashed = false; }
    } catch {}
    if (req !== routeReq) return;
    L.polyline(coords, { color: ln.color, weight: 4, opacity: .75, dashArray: dashed ? '6 8' : null }).addTo(routeLayer);
  }
}

// --- homes ------------------------------------------------------------------

function visitSequence() {
  const on = d => plan.order.filter(id => isActive(id) && plan.day[id] === d);
  return [...on('sat'), ...on('sun'), ...HOUSES.filter(h => h.inactive).map(h => h.id)];
}

function renderPicker() {
  const seq = visitSequence();
  $('#picker').innerHTML = seq.map(id => byId[id]).map(h => {
    const n = (notes[h.id] || []).length;
    return `<button class="pick ${h.inactive ? 'off' : ''}" role="tab" aria-selected="${h.id === selected}" data-pick="${h.id}">
      <span class="num ${h.inactive ? 'ico' : plan.day[h.id]}">${numberFor(h.id)}</span>
      <span><span class="pick-t">${esc(h.short)}</span><br><span class="pick-p">${h.inactive ? 'Under contract' : money(h.price)}</span></span>
      ${n ? `<span class="badge">${n} note${n > 1 ? 's' : ''}</span>` : ''}
    </button>`;
  }).join('');
}

function selectHouse(id, scroll = true) {
  if (!byId[id]) return;
  selected = id;
  try { localStorage.setItem('ph:sel', id); } catch {}
  renderPicker(); renderHouse(); renderMapPins();
  if (photoUnsub) photoUnsub();
  photoUnsub = store.watchList(id, 'photos', list => { photos[id] = list; if (selected === id) renderGallery(); });
  if (scroll) $('#homes').scrollIntoView({ behavior: 'smooth' });
}

const FIRE_KEY = [['veryHigh', 'Very high', 'var(--f-vh)'], ['high', 'High', 'var(--f-high)'], ['moderate', 'Moderate', 'var(--f-mod)'], ['low', 'Low', 'var(--f-low)'], ['nonburn', 'Developed / non-burnable', 'var(--f-nb)']];

function renderHouse() {
  const h = byId[selected];
  const dom = daysOnMarket(h);
  const maxRps = Math.max(...HOUSES.map(x => x.fire.rps));
  const lot = h.lotAcres != null ? `${h.lotAcres} ac` : '—';
  const lotN = h.lotAcres != null ? `${Math.round(h.lotAcres * 43560).toLocaleString()} sq ft` : h.lotNote;
  const asksDone = (() => { try { return JSON.parse(localStorage.getItem('ph:asks:' + h.id)) || {}; } catch { return {}; } })();
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(h.addr + ', ' + h.city)}`;
  const nearRow = (ic, label, p, extra = '') => `<li><span class="ic">${ic}</span><a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}" target="_blank" rel="noopener"><div class="nm">${esc(p.name)}</div><div class="wh">${esc(label)}${p.where ? ' · ' + esc(p.where) : ''}${extra}</div></a><div class="d">${p.min} min<small>${p.mi} mi</small></div></li>`;
  const w = LEGS[h.id].whiskey, ht = LEGS[h.id].hotel;

  $('#house').innerHTML = `
    <div class="photos" id="listingPhotos">${h.photos.map((u, i) => `<img src="${u}" loading="${i < 2 ? 'eager' : 'lazy'}" alt="${esc(h.addr)} listing photo ${i + 1}" data-full="${u}" referrerpolicy="no-referrer">`).join('')}</div>
    <p class="photo-note"><span>${h.photoCount ? `${h.photos.length} of ${h.photoCount}` : h.photos.length} listing photo${h.photos.length > 1 || h.photoCount ? 's' : ''}${h.photos.length > 1 ? ' · swipe →' : ''}</span><a href="${h.url}" target="_blank" rel="noopener">All photos on ${h.src || 'realtor.com'}</a></p>
    ${h.inactive ? `<div class="warn off"><b>Under contract.</b> ${esc(h.statusNote || '')}</div>` : ''}
    ${h.photoWarning ? `<div class="warn"><b>Heads up:</b> ${esc(h.photoWarning)}</div>` : ''}
    ${h.approxPin ? `<div class="warn"><b>Heads up:</b> The map pin and drive times use a point on the street, since the map data doesn’t know this address yet. Directions use the street address.</div>` : ''}

    <div class="h-head">
      <div><h3>${esc(h.addr)}</h3><div class="h-city">${esc(h.city)} · ${esc(h.area)}</div></div>
      <div style="text-align:right"><div class="price">${money(h.price)}</div><span class="chip ${h.inactive ? 'off' : /reduced/i.test(h.status) ? 'clay' : ''}">${esc(h.status)}</span></div>
    </div>
    <div class="h-actions">
      <a class="primary-link" href="${gmaps}" target="_blank" rel="noopener">Directions</a>
      <a href="${h.url}" target="_blank" rel="noopener">Listing on ${h.src || 'realtor.com'}${h.mls ? ' · MLS #' + h.mls : ''}</a>
      <a href="#map-sec">Show on map</a>
    </div>

    <div class="stats">
      <div class="stat"><div class="stat-v">${h.beds}</div><div class="stat-l">Bedrooms</div></div>
      <div class="stat"><div class="stat-v">${h.baths}</div><div class="stat-l">Bathrooms</div></div>
      <div class="stat"><div class="stat-v">${h.sqft.toLocaleString()}</div><div class="stat-l">Square feet</div></div>
      <div class="stat"><div class="stat-v">${lot}</div><div class="stat-l">Land</div><div class="stat-n">${esc(lotN)}</div></div>
      <div class="stat"><div class="stat-v">${h.yearBuilt}</div><div class="stat-l">Year built</div>${h.yearNote ? `<div class="stat-n">${esc(h.yearNote)}</div>` : ''}</div>
      <div class="stat"><div class="stat-v">$${ppsf(h)}</div><div class="stat-l">Per sq ft</div></div>
      <div class="stat"><div class="stat-v">${dom}</div><div class="stat-l">Days on market</div><div class="stat-n">${h.listed ? 'Listed ' + new Date(h.listed + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Listing date not on the sheet'}</div></div>
      <div class="stat"><div class="stat-v">${h.elevation.toLocaleString()} ft</div><div class="stat-l">Elevation</div></div>
    </div>

    <div class="grid2">
      <div class="card">
        <h4>The short version</h4>
        <p class="summary">${esc(h.summary)}</p>
        <ul class="plain">${h.good.map(g => `<li>${esc(g)}</li>`).join('')}</ul>
      </div>
      <div class="card">
        <h4>Ask the agent</h4>
        <ul class="asks">${h.ask.map((a, i) => `<li><input type="checkbox" id="ask-${h.id}-${i}" data-ask="${i}" ${asksDone[i] ? 'checked' : ''}><label for="ask-${h.id}-${i}">${esc(a)}</label></li>`).join('')}</ul>
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <h4>Nearby</h4>
        <ul class="near">
          ${nearRow('🛒', 'Nearest grocery', h.near.grocery)}
          ${nearRow('⛽', 'Nearest gas', h.near.gas)}
          ${nearRow('🍴', 'Nearest restaurant', h.near.restaurant)}
          <li><span class="ic">🥃</span><div><div class="nm">Whiskey Row</div><div class="wh">Courthouse Square, downtown</div></div><div class="d">${Math.ceil(w[1])} min<small>${w[0]} mi</small></div></li>
          <li><span class="ic">🏨</span><div><div class="nm">SpringHill Suites</div><div class="wh">Your hotel</div></div><div class="d">${Math.ceil(ht[1])} min<small>${ht[0]} mi</small></div></li>
        </ul>
      </div>
      <div class="card">
        <h4>Wildfire risk</h4>
        <div class="fire-head"><span class="fire-pill ${h.fire.tone}">${esc(h.fire.rating)}</span><span class="small muted">USFS hazard within ~200 m of the house</span></div>
        <div class="mixbar">${FIRE_KEY.filter(([k]) => h.fire.mix[k]).map(([k, , c]) => `<i style="width:${h.fire.mix[k]}%;background:${c}" title="${k} ${h.fire.mix[k]}%"></i>`).join('')}</div>
        <div class="mixkey">${FIRE_KEY.filter(([k]) => h.fire.mix[k]).map(([k, l, c]) => `<span style="--c:${c}">${l} ${h.fire.mix[k]}%</span>`).join('')}</div>
        <div class="rel">
          <div class="small muted" style="margin-bottom:4px">Modeled risk to a home, compared with the other homes</div>
          ${[...HOUSES].sort((a, b) => b.fire.rps - a.fire.rps).map(x => `<div class="rel-row ${x.id === h.id ? 'me' : ''}"><span>${esc(x.short)}</span><span class="rel-bar"><i style="width:${Math.max(2, x.fire.rps / maxRps * 100)}%"></i></span><span>${x.fire.rps}</span></div>`).join('')}
        </div>
        <p class="fire-text">${esc(h.fire.text)}</p>
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <h4>Details</h4>
        <dl class="facts">
          <dt>HOA</dt><dd>${esc(h.hoa)}</dd>
          <dt>Property tax</dt><dd>${esc(h.tax)}</dd>
          <dt>Water</dt><dd>${esc(h.water)}</dd>
          <dt>Sewer</dt><dd>${esc(h.sewer)}</dd>
          <dt>Heating</dt><dd>${esc(h.heat)}</dd>
          <dt>Cooling</dt><dd>${esc(h.cool)}</dd>
          <dt>Garage</dt><dd>${esc(h.garage)}</dd>
          ${h.builder ? `<dt>Builder</dt><dd>${esc(h.builder)}</dd>` : ''}
        </dl>
      </div>
      <div class="card">
        <h4>Your scores${me ? ` · ${esc(me)}` : ''}</h4>
        <div class="scores" id="scoreBox"></div>
        <div class="score-total" id="scoreTotal"></div>
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <h4>Notes</h4>
        <form class="note-form" id="noteForm">
          <textarea id="noteText" placeholder="What stood out? Smells, noise, light, what you’d change…" maxlength="4000"></textarea>
          <div class="row"><button class="primary" type="submit">Add note</button></div>
        </form>
        <ul class="notes" id="noteList"></ul>
      </div>
      <div class="card">
        <h4>Our photos</h4>
        <div class="upload">
          <input type="text" id="photoCap" placeholder="Caption (optional)" maxlength="140">
          <span class="ghost file-btn" role="button">📷 Add photos<input type="file" id="photoIn" accept="image/*" multiple></span>
        </div>
        <div class="upl-status" id="uplStatus"></div>
        <div class="gallery" id="gallery"></div>
      </div>
    </div>`;

  renderNotes(); renderScores(); renderGallery();

  $('#house').querySelectorAll('[data-ask]').forEach(cb => cb.addEventListener('change', () => {
    asksDone[cb.dataset.ask] = cb.checked;
    try { localStorage.setItem('ph:asks:' + h.id, JSON.stringify(asksDone)); } catch {}
  }));
  $('#noteForm').addEventListener('submit', async e => {
    e.preventDefault();
    const txt = $('#noteText').value.trim();
    if (!txt) return;
    if (!(await ensureMe())) return;
    const btn = e.submitter; btn.disabled = true;
    try { await store.addItem(h.id, 'notes', { by: me, text: txt }); $('#noteText').value = ''; }
    catch (err) { toastErr(err); }
    btn.disabled = false;
  });
  $('#photoIn').addEventListener('change', e => uploadPhotos(h.id, [...e.target.files]).finally(() => { e.target.value = ''; }));
}

function renderNotes() {
  const list = notes[selected] || [];
  const el = $('#noteList'); if (!el) return;
  el.innerHTML = list.length ? list.map(n => `<li><div class="note-meta"><span><b>${esc(n.by)}</b> · ${ago(n.ts)}</span><button class="del" data-del-note="${n.id}">Delete</button></div><div class="note-text">${esc(n.text)}</div></li>`).join('')
    : '<li class="none" style="border:0">No notes yet.</li>';
  el.querySelectorAll('[data-del-note]').forEach(b => b.addEventListener('click', () => {
    if (confirm('Delete this note for everyone?')) store.removeItem(selected, 'notes', b.dataset.delNote).catch(toastErr);
  }));
}

function renderGallery() {
  const el = $('#gallery'); if (!el) return;
  const list = photos[selected] || [];
  el.innerHTML = list.length ? list.map(p => `<figure><img src="${p.data}" alt="${esc(p.caption || 'Photo')}" data-full="${p.data}" data-cap="${esc((p.caption ? p.caption + ' · ' : '') + p.by)}"><button class="del" data-del-photo="${p.id}" aria-label="Delete photo">×</button><figcaption>${esc(p.caption || '')}${p.caption ? '<br>' : ''}${esc(p.by)} · ${ago(p.ts)}</figcaption></figure>`).join('')
    : '<p class="none">No photos yet. Snap a few during the walkthrough.</p>';
  el.querySelectorAll('[data-del-photo]').forEach(b => b.addEventListener('click', () => {
    if (confirm('Delete this photo for everyone?')) store.removeItem(selected, 'photos', b.dataset.delPhoto).catch(toastErr);
  }));
}

function scoreStats(id) {
  const list = scores[id] || [];
  const people = list.map(s => {
    const v = Object.values(s.scores || {}).filter(Number.isFinite);
    return { by: s.by, avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, n: v.length, gut: s.scores?.gut };
  }).filter(p => p.n);
  const all = people.filter(p => p.avg != null);
  return { people, avg: all.length ? all.reduce((a, b) => a + b.avg, 0) / all.length : null };
}

function renderScores() {
  const box = $('#scoreBox'); if (!box) return;
  const mine = (scores[selected] || []).find(s => me && s.by.toLowerCase() === me.toLowerCase())?.scores || {};
  const list = scores[selected] || [];
  box.innerHTML = SCORE_CATS.map(([k, label]) => {
    const others = list.filter(s => s.by.toLowerCase() !== me.toLowerCase() && s.scores?.[k]).map(s => `${esc(s.by)} ${s.scores[k]}`);
    return `<div class="score-row"><div class="lbl">${label}${others.length ? `<small>${others.join(' · ')}</small>` : ''}</div>
      <div class="seg" role="group" aria-label="${label}">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${mine[k] === n ? 'on' : ''}" data-cat="${k}" data-v="${n}" aria-pressed="${mine[k] === n}">${n}</button>`).join('')}</div></div>`;
  }).join('');
  box.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', async () => {
    if (!(await ensureMe())) return;
    const cur = { ...((scores[selected] || []).find(s => s.by.toLowerCase() === me.toLowerCase())?.scores || {}) };
    const v = Number(b.dataset.v);
    if (cur[b.dataset.cat] === v) delete cur[b.dataset.cat]; else cur[b.dataset.cat] = v;
    store.saveScore(selected, me, cur).catch(toastErr);
  }));
  const st = scoreStats(selected);
  $('#scoreTotal').innerHTML = st.people.length
    ? st.people.map(p => `<span>${esc(p.by)}: <b>${p.avg.toFixed(1)}</b> / 5 <span class="muted small">(${p.n} of ${SCORE_CATS.length})</span></span>`).join('')
    : '<span class="muted">Tap 1–5 for each category. Everyone rates separately.</span>';
}

// --- photo upload: shrink on the phone, store as JPEG in Firestore -----------

async function shrink(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  const w0 = bmp.width, h0 = bmp.height;
  for (const [max, q] of [[1400, .72], [1200, .62], [1000, .55], [800, .5]]) {
    const s = Math.min(1, max / Math.max(w0, h0));
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', q);
    if (url.length < 850_000) return url; // Firestore docs cap at 1 MiB
  }
  throw new Error('That photo is too large to save, even after shrinking.');
}

async function uploadPhotos(house, files) {
  if (!files.length || !(await ensureMe())) return;
  const status = $('#uplStatus');
  const cap = $('#photoCap').value.trim();
  let done = 0;
  for (const f of files) {
    status.textContent = `Saving photo ${done + 1} of ${files.length}…`;
    try { await store.addItem(house, 'photos', { by: me, caption: cap, data: await shrink(f) }); done++; }
    catch (err) { toastErr(err); break; }
  }
  status.textContent = done ? `Saved ${done} photo${done > 1 ? 's' : ''}.` : '';
  if (done) $('#photoCap').value = '';
  setTimeout(() => { if (status.textContent.startsWith('Saved')) status.textContent = ''; }, 4000);
}

// --- compare ----------------------------------------------------------------

function renderCompare() {
  const hs = visitSequence().map(id => byId[id]);
  const min = f => Math.min(...hs.map(f));
  const max = f => Math.max(...hs.map(f));
  const cell = (v, best) => `<td class="${best ? 'best' : ''}">${v}</td>`;
  const row = (label, fn, bestFn) => `<tr><th>${label}</th>${hs.map(h => cell(fn(h), bestFn ? bestFn(h) : false)).join('')}</tr>`;
  const grp = label => `<tr class="grp"><th>${label}</th>${hs.map(() => '<td></td>').join('')}</tr>`;
  const stats = Object.fromEntries(hs.map(h => [h.id, scoreStats(h.id)]));
  const people = [...new Set(hs.flatMap(h => stats[h.id].people.map(p => p.by)))];
  const bestAvg = Math.max(...hs.map(h => stats[h.id].avg ?? -1));
  $('#cmp').innerHTML = `
    <thead><tr><th></th>${hs.map(h => `<th class="${h.inactive ? 'off' : ''}"><a href="#homes" data-go="${h.id}" style="color:inherit;text-decoration:none">${esc(h.short)}</a><small>${h.inactive ? 'Under contract' : (plan.day[h.id] === 'sun' ? 'Sun' : 'Sat') + ' #' + numberFor(h.id)}</small></th>`).join('')}</tr></thead>
    <tbody>
      ${grp('The house')}
      ${row('Price', h => money(h.price), h => h.price === min(x => x.price))}
      ${row('$ / sq ft', h => '$' + ppsf(h), h => ppsf(h) === min(ppsf))}
      ${row('Bed / bath', h => `${h.beds} / ${h.baths}`, h => h.beds === max(x => x.beds))}
      ${row('Sq ft', h => h.sqft.toLocaleString(), h => h.sqft === max(x => x.sqft))}
      ${row('Land', h => h.lotAcres != null ? h.lotAcres + ' ac' : '—', h => h.lotAcres === max(x => x.lotAcres ?? 0))}
      ${row('Year built', h => h.yearBuilt, h => h.yearBuilt === max(x => x.yearBuilt))}
      ${row('Days on market', h => daysOnMarket(h))}
      ${grp('Running costs')}
      ${row('HOA', h => esc(h.hoa.replace(/ ·.*/, '')))}
      ${row('Property tax', h => esc(h.tax.replace(/\s*\(.*\)/, '')))}
      ${row('Water / sewer', h => `${esc(h.water)} / ${esc(h.sewer)}`)}
      ${grp('Location')}
      ${row('Wildfire', h => `<span class="f-${h.fire.tone}">${esc(h.fire.rating)}</span>`)}
      ${row('To Whiskey Row', h => Math.ceil(LEGS[h.id].whiskey[1]) + ' min', h => LEGS[h.id].whiskey[1] === min(x => LEGS[x.id].whiskey[1]))}
      ${row('To grocery', h => h.near.grocery.min + ' min', h => h.near.grocery.min === min(x => x.near.grocery.min))}
      ${row('To gas', h => h.near.gas.min + ' min', h => h.near.gas.min === min(x => x.near.gas.min))}
      ${row('To restaurant', h => h.near.restaurant.min + ' min', h => h.near.restaurant.min === min(x => x.near.restaurant.min))}
      ${row('Elevation', h => h.elevation.toLocaleString() + ' ft')}
      ${grp('Your verdict')}
      ${people.length ? people.map(p => row(esc(p) + ' avg', h => { const s = stats[h.id].people.find(x => x.by === p); return s ? s.avg.toFixed(1) : '—'; })).join('') : ''}
      ${people.length ? people.map(p => row(esc(p) + ' gut', h => { const s = stats[h.id].people.find(x => x.by === p); return s?.gut ?? '—'; })).join('') : ''}
      ${row('Combined', h => stats[h.id].avg != null ? stats[h.id].avg.toFixed(1) : '—', h => stats[h.id].avg != null && stats[h.id].avg === bestAvg)}
      ${row('Notes', h => (notes[h.id] || []).length || '—')}
    </tbody>`;
}

// --- who am I ---------------------------------------------------------------

function renderMe() { $('#whoName').textContent = me || 'Who’s this?'; }
function ensureMe() {
  if (me) return Promise.resolve(true);
  return askMe();
}
// One prompt at a time: a second tap while the dialog is open waits on the
// same answer instead of replacing the handlers and stranding the first action.
let asking = null, cancelAsk = null;
function askMe() {
  const dlg = $('#whoDlg');
  if (asking && dlg.open) return asking;
  if (cancelAsk) cancelAsk(); // dialog was dismissed without a close event reaching us
  $('#whoInput').value = me;
  return asking = new Promise(res => {
    let settled = false;
    const done = ok => { if (settled) return; settled = true; asking = cancelAsk = null; if (dlg.open) dlg.close(); res(ok); };
    cancelAsk = () => done(false);
    $('#whoCancel').onclick = () => done(false);
    dlg.onclose = () => { if (!dlg.open) done(false); }; // Escape closes it natively; ignore a late event after reopening
    dlg.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const v = $('#whoInput').value.trim();
      if (!v) return;
      me = v; try { localStorage.setItem('ph:me', me); } catch {}
      renderMe(); renderScores(); done(true);
    };
    dlg.showModal();
    setTimeout(() => $('#whoInput').focus(), 50);
  });
}

// --- misc -------------------------------------------------------------------

function toastErr(err) {
  console.error(err);
  alert(err?.message || 'Something went wrong saving that. Check your connection and try again.');
}

function renderCountdown() {
  const sat = new Date(TRIP.sat + 'T00:00:00-07:00');
  const d = Math.ceil((sat - Date.now()) / 864e5);
  $('#countdown').textContent = d > 1 ? `Sat Sep 26 – Sun Sep 27 · ${d} days to go` : d === 1 ? 'Tomorrow · Sat Sep 26' : d === 0 ? 'Today’s the day' : 'Sat Sep 26 – Sun Sep 27';
}

function lightbox() {
  const lb = $('#lightbox');
  document.addEventListener('click', e => {
    const img = e.target.closest('img[data-full]');
    if (img) { lb.querySelector('img').src = img.dataset.full; lb.querySelector('p').textContent = img.dataset.cap || ''; lb.hidden = false; return; }
    if (e.target.closest('.lb-close') || e.target === lb) lb.hidden = true;
    const go = e.target.closest('[data-go]');
    if (go && !e.target.closest('#plan')) { e.preventDefault(); selectHouse(go.dataset.go); }
    const pick = e.target.closest('[data-pick]');
    if (pick) selectHouse(pick.dataset.pick, false);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.hidden = true; });
}

function scrollSpy() {
  const links = [...document.querySelectorAll('.tabs a')];
  const secs = links.map(a => document.querySelector(a.getAttribute('href')));
  const on = () => {
    let i = 0;
    secs.forEach((s, j) => { if (s.getBoundingClientRect().top < 120) i = j; });
    links.forEach((a, j) => a.classList.toggle('on', j === i));
  };
  addEventListener('scroll', on, { passive: true }); on();
}

async function main() {
  renderCountdown(); renderMe();
  $('#whoBtn').addEventListener('click', askMe);
  wirePlan(); lightbox(); scrollSpy();
  renderPlan(); renderPicker(); renderHouse();
  initMap();

  const mode = await store.initStore();
  const banner = $('#banner');
  if (mode !== 'firestore') {
    banner.hidden = false;
    banner.innerHTML = '<b>Saving to this device only.</b> Shared notes aren’t switched on yet, so anything added here stays on this phone.';
  }

  store.watchPlan(p => {
    if (!p) return;
    const base = DEFAULT_PLAN();
    plan = { ...base, ...p, day: { ...base.day, ...(p.day || {}) }, booked: { ...(p.booked || {}) } };
    plan.order = [...new Set([...(p.order || []).filter(isActive), ...RECOMMENDED])];
    renderPlan(); renderMapPins(); renderPicker(); renderCompare();
  });
  HOUSES.forEach(h => {
    store.watchList(h.id, 'notes', list => { notes[h.id] = list; if (selected === h.id) renderNotes(); renderPicker(); renderCompare(); });
    store.watchScores(h.id, list => { scores[h.id] = list; if (selected === h.id) renderScores(); renderCompare(); });
  });
  selectHouse(selected, false);
  renderCompare();
  setInterval(() => { renderNotes(); }, 60_000);
}

main();
