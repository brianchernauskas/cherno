import { TRIP, BASES, DAYS, SPOTS, HAPPY, SAIL, NOTES, EATS, PRETRIP, PACKING } from './data.js';
import { VAULT } from './vault.js';

/* ==========================================================================
   State
   ========================================================================== */

const state = {
  base: 'kaanapali',
  filter: 'all',
  day: null,
  eatArea: 'all',
  packOpen: true,
};

/* Set once the vault is unlocked, so links held behind the passphrase
   (the Smartwaiver capability URL) can render as real links. */
let UNLOCKED = null;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const baseOf = (k) => BASES.find((b) => b.key === k);

/* ==========================================================================
   Time helpers — everything on-island is Pacific/Honolulu, which never
   observes DST. Phoenix never does either, so the offset is a constant 3h.
   ========================================================================== */

const HST = 'Pacific/Honolulu';

/* ?now=2026-09-02T15:10 previews any moment of the trip. Handy for checking
   what a given day will look like before you are standing in it. */
const NOW_OVERRIDE = (() => {
  const q = new URLSearchParams(location.search).get('now');
  const t = q ? Date.parse(q.includes('T') ? `${q}:00-10:00` : `${q}T12:00:00-10:00`) : NaN;
  return Number.isNaN(t) ? null : new Date(t);
})();
const rightNow = () => NOW_OVERRIDE || new Date();

function hawaiiNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HST, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(rightNow()).reduce((a, p) => (a[p.type] = p.value, a), {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: (+parts.hour % 24) * 60 + (+parts.minute),
    dow: new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`).getUTCDay(),
  };
}

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

function fmtTime(hhmm) {
  let [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return m === 0 ? `${h} ${ap}` : `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric',
  });
}

const nightsBetween = (a, b) =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

/* ==========================================================================
   Icons
   ========================================================================== */

const P = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
     stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

const ICON = {
  flight:  P('<path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a.7.7 0 0 0-.7 1.1l4.4 4.4-2.1 2.1-2.4-.5-1 1 3 1.8 1.8 3 1-1-.5-2.4 2.1-2.1 4.4 4.4a.7.7 0 0 0 1.1-.7Z"/>'),
  car:     P('<path d="M5 17H3v-5l2-5h14l2 5v5h-2M5 17a2 2 0 1 0 4 0M5 17h4m10 0a2 2 0 1 0-4 0m4 0h-4m-6 0h6M5 12h14"/>'),
  hotel:   P('<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4"/>'),
  dining:  P('<path d="M3 3v7a3 3 0 0 0 6 0V3M6 10v11M17 3c-1.5 1.5-2 3.5-2 6s.5 3 2 3 2-.5 2-3-.5-4.5-2-6ZM17 12v9"/>'),
  boat:    P('<path d="M3 17.5c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0M4.5 14 12 3l7.5 11M12 3v11"/>'),
  ride:    P('<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M12 7v5l3 2"/>'),
  idea:    P('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.2V17h6v-1.3c0-.8.4-1.6 1-2.2A6 6 0 0 0 12 3Z"/>'),
  todo:    P('<path d="M9 11l3 3 5-6"/><rect x="3" y="3" width="18" height="18" rx="3"/>'),
  phone:   P('<path d="M15.5 21A13.5 13.5 0 0 1 3 8.5 3 3 0 0 1 6 5.5h1.5a1 1 0 0 1 1 .8l.7 3a1 1 0 0 1-.3.9l-1.3 1.3a12 12 0 0 0 4.9 4.9l1.3-1.3a1 1 0 0 1 .9-.3l3 .7a1 1 0 0 1 .8 1V18a3 3 0 0 1-3 3Z"/>'),
  pin:     P('<path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>'),
  lock:    P('<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  key:     P('<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M17 6l2.5 2.5M14.5 8.5 17 11"/>'),
  alert:   P('<path d="M12 9v4M12 17h.01M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>'),
  map:     P('<path d="m9 4-6 2.5v14L9 18l6 2.5 6-2.5v-14L15 6.5 9 4Zm0 0v14m6-11.5v14"/>'),
  cal:     P('<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  glass:   P('<path d="M5 3h14l-6 8v7M13 18h3M13 18h-3"/>'),
  compass: P('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>'),
  clock:   P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>'),
  sun:     P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  wifi:    P('<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M1.5 9a15 15 0 0 1 21 0"/>'),
  shield:  P('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>'),
  wave:    P('<path d="M2 16c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3M2 10c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/>'),
  card:    P('<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20M6 15h4"/>'),
  turtle:  P('<path d="M4 14a8 8 0 0 1 16 0M4 14h16M6 14v3M18 14v3M12 6V4M9 18h1.5M13.5 18H15"/><path d="M9 11.5h6"/>'),
};

/* ==========================================================================
   Map — projects lat/lon into SVG space and draws a smoothed coastline.
   ========================================================================== */

/* Coastline traced clockwise from Nakalele Point. [lon, lat] */
const COAST = [
  [-156.5877, 21.0294], [-156.6270, 21.0208], [-156.6570, 21.0080], [-156.6800, 20.9840],
  [-156.6950, 20.9500], [-156.7000, 20.9200], [-156.6870, 20.8760], [-156.6640, 20.8480],
  [-156.6400, 20.8280], [-156.5900, 20.8000], [-156.5450, 20.7930], [-156.5100, 20.7920],
  [-156.4900, 20.7780], [-156.4650, 20.7600], [-156.4480, 20.7200], [-156.4400, 20.6800],
  [-156.4430, 20.6300], [-156.4180, 20.5950], [-156.3800, 20.5980], [-156.3200, 20.6200],
  [-156.2400, 20.6300], [-156.1400, 20.6400], [-156.0500, 20.6700], [-155.9880, 20.7200],
  [-155.9770, 20.7700], [-156.0000, 20.8100], [-156.0600, 20.8600], [-156.1500, 20.9000],
  [-156.2500, 20.9200], [-156.3400, 20.9350], [-156.3900, 20.9250], [-156.4400, 20.9100],
  [-156.4750, 20.9050], [-156.5100, 20.9150], [-156.5400, 20.9400], [-156.5600, 20.9800],
];

const MAP = { w: 720, h: 470, pad: 26 };
const BOUNDS = { lon0: -156.72, lon1: -155.95, lat0: 20.56, lat1: 21.06 };
const COSLAT = Math.cos(20.82 * Math.PI / 180);

function project(lat, lon) {
  const spanX = (BOUNDS.lon1 - BOUNDS.lon0) * COSLAT;
  const spanY = (BOUNDS.lat1 - BOUNDS.lat0);
  const k = Math.min((MAP.w - MAP.pad * 2) / spanX, (MAP.h - MAP.pad * 2) / spanY);
  const offX = (MAP.w - spanX * k) / 2;
  const offY = (MAP.h - spanY * k) / 2;
  return {
    x: offX + (lon - BOUNDS.lon0) * COSLAT * k,
    y: offY + (BOUNDS.lat1 - lat) * k,
  };
}

/* Catmull-Rom → cubic bezier, so the coast reads as coast and not a polygon. */
function smoothClosedPath(pts) {
  const n = pts.length;
  const at = (i) => pts[(i % n + n) % n];
  let d = `M ${at(0).x.toFixed(1)} ${at(0).y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d + ' Z';
}

const CAT_COLOR = {
  beach: '#f2c14e', snorkel: '#2f8f8a', scenic: '#e8703a',
  town: '#8d7bb5', landmark: '#147b8c',
};

function renderMap() {
  const island = smoothClosedPath(COAST.map(([lon, lat]) => project(lat, lon)));
  const active = baseOf(state.base);

  // Volcano shading — two soft masses under the coastline.
  const wm = project(20.90, -156.60), hk = project(20.72, -156.25);

  const pins = SPOTS.map((s) => {
    const p = project(s.lat, s.lon);
    const c = CAT_COLOR[s.cat] || '#7d949d';
    const near = s.dist[state.base][1] <= 25;
    return `<g class="mp-hit" tabindex="0" role="button" data-spot="${s.id}"
              aria-label="${s.name}, ${s.dist[state.base][1]} minutes from ${active.short}">
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9" fill="transparent"/>
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${near ? 4.6 : 3.4}"
              fill="${c}" fill-opacity="${near ? 1 : .5}" stroke="#fff" stroke-width="1.3"/>
    </g>`;
  }).join('');

  const hotels = BASES.map((b) => {
    const p = project(b.lat, b.lon);
    const on = b.key === state.base;
    const lx = b.key === 'kaanapali' ? p.x + 15 : p.x + 15;
    const ly = b.key === 'kaanapali' ? p.y - 9 : p.y + 5;
    return `<g>
      ${on ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="17" fill="${b.accent}" fill-opacity=".16">
        <animate attributeName="r" values="12;21;12" dur="3.4s" repeatCount="indefinite"/>
        <animate attributeName="fill-opacity" values=".26;0;.26" dur="3.4s" repeatCount="indefinite"/>
      </circle>` : ''}
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${on ? 8 : 6}"
              fill="${b.accent}" stroke="#fff" stroke-width="2.4"/>
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="mp-label"
            fill="${b.accent}" font-size="15" font-weight="700">${b.short}</text>
    </g>`;
  }).join('');

  return `
  <svg class="mapsvg" viewBox="0 0 ${MAP.w} ${MAP.h}" role="img"
       aria-label="Map of Maui showing both hotels and every spot in this guide">
    <defs>
      <linearGradient id="sea" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#0e4a5f"/><stop offset="1" stop-color="#07293a"/>
      </linearGradient>
      <linearGradient id="land" x1="0.1" y1="0" x2="0.7" y2="1">
        <stop offset="0" stop-color="#3f7d55"/>
        <stop offset="0.55" stop-color="#5b8f52"/>
        <stop offset="1" stop-color="#8a9a4d"/>
      </linearGradient>
      <radialGradient id="peak"><stop offset="0" stop-color="#7a6a45" stop-opacity=".85"/>
        <stop offset="1" stop-color="#7a6a45" stop-opacity="0"/></radialGradient>
      <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="7"/>
      </filter>
      <clipPath id="clipIsland"><path d="${island}"/></clipPath>
    </defs>

    <rect width="${MAP.w}" height="${MAP.h}" fill="url(#sea)" rx="13"/>

    <!-- reef halo -->
    <path d="${island}" fill="none" stroke="#2f8f8a" stroke-opacity=".5" stroke-width="11" filter="url(#soft)"/>
    <path d="${island}" fill="url(#land)"/>
    <g clip-path="url(#clipIsland)">
      <ellipse cx="${wm.x}" cy="${wm.y}" rx="72" ry="62" fill="url(#peak)"/>
      <ellipse cx="${hk.x}" cy="${hk.y}" rx="128" ry="86" fill="url(#peak)"/>
    </g>
    <path d="${island}" fill="none" stroke="#f6efe4" stroke-opacity=".55" stroke-width="1.5"/>

    <g>${pins}</g>
    <g>${hotels}</g>

    <text x="${MAP.w - 14}" y="${MAP.h - 12}" text-anchor="end"
          fill="#f6efe4" fill-opacity=".4" font-size="11">Solid pins ≤ 25 min from ${active.short}</text>
  </svg>
  <div class="map-legend">
    ${Object.entries(CAT_COLOR).map(([k, v]) =>
      `<span><i class="lg-dot" style="background:${v}"></i>${k}</span>`).join('')}
  </div>`;
}

/* ==========================================================================
   Sections
   ========================================================================== */

function renderCountdown() {
  const now = rightNow();
  const dep = new Date(TRIP.start);
  const end = new Date(TRIP.end);
  const hn = hawaiiNow();

  // On-trip: show the live "what's now" card instead of a countdown.
  const today = DAYS.find((d) => d.date === hn.date);
  if (today) {
    const upcoming = today.events.find((e) => toMin(e.time) >= hn.minutes) || today.events.at(-1);
    return `<div class="cd-live">
      <div class="cd-live-k">Day ${DAYS.indexOf(today) + 1} · ${fmtDate(today.date)}</div>
      <div class="cd-live-t">${today.title}</div>
      ${upcoming ? `<div class="cd-live-d">Next — ${fmtTime(upcoming.time)} · ${upcoming.title}</div>` : ''}
    </div>`;
  }

  if (now > end) {
    return `<div class="cd-live"><div class="cd-live-k">Trip complete</div>
      <div class="cd-live-t">Hope it was good.</div></div>`;
  }

  const ms = dep - now;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000) % 24;
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const cell = (n, l) => `<div class="cd-cell"><div class="cd-n">${n}</div><div class="cd-l">${l}</div></div>`;
  return `<div class="countdown">
    ${cell(d, 'days')}${cell(String(h).padStart(2, '0'), 'hrs')}
    ${cell(String(m).padStart(2, '0'), 'min')}${cell(String(s).padStart(2, '0'), 'sec')}
  </div>`;
}

function renderHotels() {
  return BASES.map((b) => {
    const n = nightsBetween(b.checkIn, b.checkOut);
    const on = b.key === state.base;
    return `<article class="card hotel ${on ? 'is-active' : ''}" style="--hc:${b.accent}">
      <div class="hotel-top">
        <div>
          <div class="hotel-region">${b.region}</div>
          <h3>${b.name}</h3>
          <div class="hotel-dates">${fmtDate(b.checkIn)} · ${b.checkInTime} → ${fmtDate(b.checkOut)} · ${b.checkOutTime}</div>
          <div class="hotel-room">${b.room}</div>
        </div>
        <div class="nights"><b>${n}</b><span>nights</span></div>
      </div>
      <ul class="perks">${b.perks.map((p) => `<li>${p}</li>`).join('')}</ul>
      ${b.note ? `<p class="hotel-note">${b.note}</p>` : ''}
      <div class="hotel-acts">
        <a class="btn" href="tel:${b.phone}">${ICON.phone}${b.phoneLabel}</a>
        <a class="btn" target="_blank" rel="noopener"
           href="https://maps.apple.com/?q=${encodeURIComponent(b.name + ', ' + b.address)}">${ICON.pin}Map</a>
      </div>
    </article>`;
  }).join('');
}

function renderDays() {
  const hn = hawaiiNow();
  const show = state.day ? DAYS.filter((d) => d.date === state.day) : DAYS;

  const nav = `<div class="daynav" role="group" aria-label="Jump to a day">
    <button class="daychip" data-day="all" aria-pressed="${!state.day}">
      <b>All</b><span>9 days</span></button>
    ${DAYS.map((d, i) => `<button class="daychip ${d.date === hn.date ? 'is-today' : ''}"
        data-day="${d.date}" aria-pressed="${state.day === d.date}">
        <b>${d.date.slice(8)}</b><span>${d.label}</span></button>`).join('')}
  </div>`;

  const body = show.map((d) => {
    const b = baseOf(d.base);
    return `<article class="card day" style="--hc:${b.accent}">
      <div class="day-head">
        <span class="day-date">${fmtDate(d.date)}</span>
        <h3>${d.title}</h3>
        <span class="day-badge">${d.transition ? 'Move day' : b.short}</span>
      </div>
      <ul class="tl">${d.events.map(renderEvent).join('')}</ul>
    </article>`;
  }).join('');

  return nav + body;
}

function renderEvent(e, past = false) {
  const ic = ICON[e.kind] || ICON.idea;
  const cls = [e.lock ? 'is-lock' : (e.kind === 'idea' ? 'is-idea' : ''), past ? 'is-past' : ''].filter(Boolean).join(' ');
  const acts = [];
  if (e.vault)  acts.push(`<button class="chip" data-vaultjump="${e.vault}">${ICON.lock}Details</button>`);
  if (e.phone)  acts.push(`<a class="chip" href="tel:${e.phone}">${ICON.phone}Call</a>`);
  if (e.flag === 'sailTime') acts.push(`<a class="chip chip-alert" href="#sail">${ICON.alert}Time conflict</a>`);

  return `<li class="ev ${cls}">
    <div class="ev-dot">${ic}</div>
    <div class="ev-body">
      <div class="ev-meta">
        <span class="ev-time">${fmtTime(e.time)}</span>
        <span class="ev-tz">${e.tz}</span>
      </div>
      <div class="ev-title">${e.title}</div>
      ${e.detail ? `<div class="ev-detail">${e.detail}</div>` : ''}
      ${acts.length ? `<div class="ev-acts">${acts.join('')}</div>` : ''}
    </div>
  </li>`;
}

const CATS = [
  ['all', 'All'], ['beach', 'Beaches'], ['snorkel', 'Snorkel'],
  ['scenic', 'Scenic'], ['town', 'Towns'], ['landmark', 'Landmarks'],
];

function renderSpots() {
  const b = baseOf(state.base);
  const list = SPOTS
    .filter((s) => state.filter === 'all' || s.cat === state.filter)
    .sort((a, c) => a.dist[state.base][1] - c.dist[state.base][1]);

  const filters = `<div class="filters" role="group" aria-label="Filter spots">
    ${CATS.map(([k, l]) => `<button class="fchip" data-cat="${k}"
        aria-pressed="${state.filter === k}">${l}</button>`).join('')}
  </div>`;

  const cards = list.map((s) => {
    const [mi, min] = s.dist[state.base];
    const walk = s.walkFrom === state.base;
    const flags = [];
    if (s.caution)   flags.push('<span class="flag flag-caution">Take care</span>');
    if (s.reserve)   flags.push('<span class="flag flag-reserve">Reservation</span>');
    if (s.boatOnly)  flags.push('<span class="flag flag-boat">Boat only</span>');
    if (s.sensitive) flags.push('<span class="flag flag-respect">Be respectful</span>');

    return `<article class="card spot" id="spot-${s.id}">
      <div class="spot-top">
        <div style="min-width:0">
          <div class="spot-cat" style="color:${CAT_COLOR[s.cat]}">${s.cat}</div>
          <h3>${s.name}</h3>
        </div>
        <div class="distbox">
          <div class="dist-t">${min >= 60 ? `${Math.floor(min / 60)}h ${min % 60 ? min % 60 + 'm' : ''}`.trim() : `${min} min`}</div>
          <div class="dist-m">${mi} mi${s.boatOnly ? ' to harbor' : ''}</div>
          ${walk ? '<div class="dist-walk">Walkable</div>' : ''}
        </div>
      </div>
      <p class="spot-blurb">${s.blurb}</p>
      <p class="spot-tip"><b>Tip.</b> ${s.tip}</p>
      ${flags.length ? `<div class="flags">${flags.join('')}</div>` : ''}
      <div class="hotel-acts">
        <a class="btn" target="_blank" rel="noopener"
           href="https://maps.apple.com/?daddr=${s.lat},${s.lon}&dirflg=d">${ICON.compass}Directions</a>
      </div>
    </article>`;
  }).join('');

  return `${filters}<div class="spotlist">${cards}</div>
    <p class="foot" style="padding-top:14px">Sorted by drive time from <b>${b.short}</b>.
    Times assume normal daytime traffic and are estimates, not routing output.</p>`;
}

function renderHappy() {
  const hn = hawaiiNow();
  const list = [...HAPPY].sort((a, b) => a.dist[state.base][1] - b.dist[state.base][1]);

  const cards = list.map((h) => {
    const from = toMin(h.from), to = toMin(h.to);
    const open = hn.minutes >= from && hn.minutes < to;
    const [mi, min] = h.dist[state.base];

    return `<article class="card hh ${open ? 'is-open' : ''}">
      <div class="hh-top">
        <div style="min-width:0">
          <h3>${h.name}</h3>
          <div class="hh-where">${h.where}</div>
        </div>
        <div class="distbox">
          <div class="dist-t">${min} min</div>
          <div class="dist-m">${mi} mi</div>
        </div>
      </div>
      <div class="hh-when">
        <i class="dot"></i>${h.days} · ${fmtTime(h.from)} – ${fmtTime(h.to)}
        ${open ? '<span class="openflag">On now</span>' : ''}
      </div>
      <ul class="prices">
        ${h.prices.map(([i, v]) => `<li><span class="p-item">${i}</span><span class="p-val">${v}</span></li>`).join('')}
      </ul>
      ${h.note ? `<p class="hh-note">${h.note}</p>` : ''}
      <span class="conf conf-${h.confidence}">
        ${h.confidence === 'good' ? 'Corroborated' : 'Verify by phone'}
      </span>
      <div class="hotel-acts">
        <a class="btn" href="tel:${h.phone}">${ICON.phone}${h.phoneLabel}</a>
        <a class="btn" target="_blank" rel="noopener"
           href="https://maps.apple.com/?daddr=${h.lat},${h.lon}&dirflg=d">${ICON.compass}Go</a>
      </div>
    </article>`;
  }).join('');

  return `<div class="hhlist">${cards}</div>
    <p class="foot" style="padding-top:14px">
      <b>Prices are what published sources reported in 2026 and they move.</b>
      Anything tagged <i>Verify by phone</i> came from a single source or had sources
      that disagreed on times. Treat every figure as a starting point, not a quote.
    </p>`;
}

function renderSail() {
  const c = SAIL.conflict;
  return `<article class="card sail" id="sail">
    <div class="sail-eyebrow">${fmtDate(SAIL.date)} · ${SAIL.guests}</div>
    <h3>${SAIL.operator} — ${SAIL.trip}</h3>
    <div class="sail-when">${SAIL.window}</div>

    <ul class="sail-steps">
      <li><span class="ss-time">3:45</span><span class="ss-body"><b>Booked window opens</b>
        Be ready and outside — allow a 15-minute pickup window.</span></li>
      <li><span class="ss-time">4:00</span><span class="ss-body"><b>Pickup at Grand Wailea</b>
        Side Group Entrance. You are staying here, so this is a 30-second walk.</span></li>
      <li><span class="ss-time">4:30</span><span class="ss-body"><b>Check in at the store</b>
        ${SAIL.store.address}</span></li>
      <li><span class="ss-time">4:45</span><span class="ss-body"><b>Depart — promptly</b>
        Vans shuttle to ${SAIL.beach.name} for beach loading.</span></li>
      <li><span class="ss-time">6:30</span><span class="ss-body"><b>Back at the store</b>
        Sunset is around 6:42 that evening.</span></li>
    </ul>

    <div class="conflict">
      <div class="conflict-h">${ICON.alert}Your confirmation contradicts itself</div>
      <div class="conflict-q"><b>${c.a.label} — ${c.a.time}.</b> ${c.a.text}</div>
      <div class="conflict-q"><b>${c.b.label} — ${c.b.time}.</b> ${c.b.text}</div>
      <p style="font-size:12.5px;color:rgba(255,255,255,.82);margin-top:10px">
        Both can be true — the van collects you at 4:00 and delivers you to check-in at 4:30 —
        but it is worth one phone call to be certain which one you are expected at.
      </p>
    </div>

    <ul class="sail-bring">${SAIL.bring.map((x) => `<li>${x}</li>`).join('')}</ul>
    <p style="font-size:12.5px;color:rgba(255,255,255,.72);margin-top:12px">${SAIL.cancel}</p>

    <div class="sail-acts">
      ${UNLOCKED?.links?.waiver
        ? `<a class="btn btn-gold" href="${UNLOCKED.links.waiver}" target="_blank" rel="noopener">${ICON.todo}Sign waiver</a>`
        : `<button class="btn btn-gold" data-vaultjump="sail">${ICON.lock}Unlock for waiver</button>`}
      <a class="btn" href="tel:${SAIL.phone}">${ICON.phone}${SAIL.phoneLabel}</a>
      <a class="btn" target="_blank" rel="noopener"
         href="https://maps.apple.com/?daddr=${SAIL.store.lat},${SAIL.store.lon}&dirflg=d">${ICON.compass}Store</a>
    </div>
  </article>`;
}

function renderNotes() {
  return NOTES.map((n) => `<article class="card note">
    <div class="note-ic">${ICON[n.icon] || ICON.idea}</div>
    <div><h3>${n.title}</h3><p>${n.body}</p></div>
  </article>`).join('');
}

/* ==========================================================================
   Today — the section that changes what it is depending on when you open it.
   Before the trip it is a countdown plus the things you still owe.
   During the trip it is today's plan, what is next, and what is open now.
   ========================================================================== */

const store = {
  get(k, fallback) {
    try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function daysUntil(iso) {
  const hn = hawaiiNow();
  return Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(hn.date + 'T00:00:00Z')) / 86400000);
}

function openNowList() {
  const hn = hawaiiNow();
  return HAPPY.filter((h) => hn.minutes >= toMin(h.from) && hn.minutes < toMin(h.to))
              .sort((a, b) => a.dist[state.base][1] - b.dist[state.base][1]);
}

function renderToday() {
  const hn = hawaiiNow();
  const today = DAYS.find((d) => d.date === hn.date);
  const clock = fmtTime(`${String(Math.floor(hn.minutes / 60)).padStart(2, '0')}:${String(hn.minutes % 60).padStart(2, '0')}`);

  /* ---- On-island ---- */
  if (today) {
    const b = baseOf(today.base);
    const idx = DAYS.indexOf(today) + 1;
    const next = today.events.find((e) => toMin(e.time) >= hn.minutes);
    const done = today.events.filter((e) => toMin(e.time) < hn.minutes).length;
    const open = openNowList();

    return `
    <article class="card today" style="--hc:${b.accent}">
      <div class="today-head">
        <div>
          <div class="today-k">Day ${idx} of 9 · ${b.short}</div>
          <h3>${today.title}</h3>
        </div>
        <div class="today-clock"><b>${clock}</b><span>Maui</span></div>
      </div>

      ${next ? `<div class="nextup">
        <div class="nextup-k">Next up</div>
        <div class="nextup-t">${fmtTime(next.time)} — ${next.title}</div>
        ${next.detail ? `<div class="nextup-d">${next.detail}</div>` : ''}
        ${next.phone ? `<a class="chip" href="tel:${next.phone}" style="margin-top:9px">${ICON.phone}Call</a>` : ''}
      </div>` : `<div class="nextup"><div class="nextup-k">Nothing left today</div>
        <div class="nextup-t">${done} things done. Go watch the sunset.</div></div>`}

      <ul class="tl" style="margin-top:14px">${today.events.map((e) =>
        renderEvent(e, toMin(e.time) < hn.minutes)).join('')}</ul>
    </article>

    ${open.length ? `<article class="card today-open">
      <div class="today-k" style="color:var(--teal)">Happy hour, open right now</div>
      <ul class="opennow">${open.slice(0, 4).map((h) => `<li>
        <div><b>${h.name}</b><span>${h.where}</span></div>
        <div class="on-right"><b>${h.dist[state.base][1]} min</b><span>till ${fmtTime(h.to)}</span></div>
      </li>`).join('')}</ul>
      ${open.length > 4 ? `<a class="chip" href="#happy">${ICON.glass}${open.length - 4} more open</a>` : ''}
    </article>` : ''}`;
  }

  /* ---- After ---- */
  if (rightNow() > new Date(TRIP.end)) {
    return `<article class="card today"><div class="today-k">Trip complete</div>
      <h3>Nine days, two hotels, one boat.</h3></article>`;
  }

  /* ---- Before ---- */
  const out = daysUntil(DAYS[0].date);
  const checked = store.get('maui.pretrip', {});
  const remaining = PRETRIP.filter((t) => !checked[t.id]).length;

  return `
  <article class="card today">
    <div class="today-head">
      <div>
        <div class="today-k">Not there yet</div>
        <h3>${out === 1 ? 'Tomorrow' : `${out} days out`}</h3>
      </div>
      <div class="today-clock"><b>${clock}</b><span>Maui now</span></div>
    </div>
    <p class="today-lede">${ledeText(remaining)}</p>
    <div class="ev-acts"><a class="chip" href="#pack">${ICON.todo}Packing list</a>
      <a class="chip" href="#itinerary">${ICON.cal}Full itinerary</a></div>
  </article>

  <article class="card pretrip">
    <div class="today-k">Before you leave</div>
    <ul class="tasks">${PRETRIP.map((t) => {
      const on = !!checked[t.id];
      const due = daysUntil(t.by);
      const late = due < 0 && !on;
      return `<li class="task ${on ? 'is-done' : ''}">
        <button class="tick" data-pretrip="${t.id}" role="checkbox" aria-checked="${on}"
                aria-label="${t.title}">${on ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>' : ''}</button>
        <div class="task-body">
          <div class="task-t">${t.title}</div>
          <div class="task-d">${t.detail}</div>
          <div class="task-acts">
            <span class="due ${late ? 'is-late' : ''}">${late ? 'Overdue' : due === 0 ? 'Today' : due === 1 ? 'By tomorrow' : `By ${fmtDate(t.by)}`}</span>
            ${t.vaultLink
              ? (UNLOCKED?.links?.[t.vaultLink]
                  ? `<a class="chip" href="${UNLOCKED.links[t.vaultLink]}" target="_blank" rel="noopener">${ICON.todo}Open</a>`
                  : `<button class="chip" data-vaultjump="${t.vaultLink}">${ICON.lock}Unlock</button>`)
              : ''}
            ${t.tel ? `<a class="chip" href="tel:${t.tel}">${ICON.phone}Call</a>` : ''}
          </div>
        </div>
      </li>`;
    }).join('')}</ul>
  </article>`;
}

/* ==========================================================================
   Restaurants
   ========================================================================== */

const EAT_AREAS = [['all', 'All'], ['West Maui', 'West'], ['South Maui', 'South'], ['North Shore', 'North Shore']];

function renderEats() {
  const list = EATS
    .filter((e) => state.eatArea === 'all' || e.area === state.eatArea)
    .sort((a, b) => a.dist[state.base][1] - b.dist[state.base][1]);

  const filters = `<div class="filters" role="group" aria-label="Filter restaurants">
    ${EAT_AREAS.map(([k, l]) => `<button class="fchip" data-eatarea="${k}"
       aria-pressed="${state.eatArea === k}">${l}</button>`).join('')}
  </div>`;

  const cards = list.map((e) => {
    const [mi, min] = e.dist[state.base];
    const hh = e.hh ? HAPPY.find((h) => h.id === e.hh) : null;
    return `<article class="card eat ${e.booked ? 'is-booked' : ''}" id="eat-${e.id}">
      <div class="spot-top">
        <div style="min-width:0">
          <div class="eat-meta">
            <span class="eat-price">${e.price}</span>
            <span class="eat-cuisine">${e.cuisine}</span>
            ${e.star ? '<span class="eat-star">Don\'t miss</span>' : ''}
          </div>
          <h3>${e.name}</h3>
          <div class="hh-where">${e.where}</div>
        </div>
        <div class="distbox">
          <div class="dist-t">${min >= 60 ? `${Math.floor(min / 60)}h ${min % 60 || ''}`.trim() : `${min} min`}</div>
          <div class="dist-m">${mi} mi</div>
        </div>
      </div>

      <p class="spot-blurb">${e.blurb}</p>
      <p class="spot-tip"><b>Tip.</b> ${e.tip}</p>

      <div class="eat-facts">
        <span><b>Booking</b>${e.book}</span>
        <span><b>Hours</b>${e.hours}</span>
      </div>

      ${hh ? `<a class="hh-link" href="#happy">${ICON.glass}
        Happy hour ${hh.days.toLowerCase()} ${fmtTime(hh.from)}–${fmtTime(hh.to)}</a>` : ''}

      <div class="hotel-acts">
        <a class="btn" href="tel:${e.phone}">${ICON.phone}${e.phoneLabel}</a>
        <a class="btn" target="_blank" rel="noopener"
           href="https://maps.apple.com/?daddr=${e.lat},${e.lon}&dirflg=d">${ICON.compass}Go</a>
      </div>
    </article>`;
  }).join('');

  return `${filters}<div class="spotlist">${cards}</div>`;
}

/* ==========================================================================
   Packing
   ========================================================================== */

const TICK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>';

/* Toggle one checkbox in place. Re-rendering the whole list would throw away
   the scroll position, which is miserable halfway down a packing list. */
function setTick(btn, on) {
  btn.setAttribute('aria-checked', String(on));
  btn.innerHTML = on ? TICK_SVG : '';
  btn.closest('.task')?.classList.toggle('is-done', on);
}

function updatePackCount() {
  const checked = store.get('maui.pack', {});
  const all = PACKING.reduce((a, g) => a + g.items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;
  const c = $('.pack-count'); if (c) c.textContent = `${done} of ${all} packed`;
  const bar = $('.bar i'); if (bar) bar.style.width = `${all ? Math.round((done / all) * 100) : 0}%`;
}

const ledeText = (left) =>
  `You land at 2:19 pm on Friday and pick up the car an hour later. ` +
  (left ? `<b>${left} thing${left > 1 ? 's' : ''} still to do</b> before you go.`
        : 'Everything on the list is done.');

function renderPacking() {
  const checked = store.get('maui.pack', {});
  const all = PACKING.reduce((a, g) => a + g.items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;
  const pct = all ? Math.round((done / all) * 100) : 0;

  return `<article class="card packing">
    <div class="pack-head">
      <div>
        <div class="today-k">Packing</div>
        <div class="pack-count">${done} of ${all} packed</div>
      </div>
      <button class="chip" data-packreset>Reset</button>
    </div>
    <div class="bar"><i style="width:${pct}%"></i></div>

    ${PACKING.map((g) => `<div class="pack-group">
      <h4>${g.group}</h4>
      <ul class="tasks">${g.items.map((it) => {
        const k = `${g.group}::${it}`;
        const on = !!checked[k];
        return `<li class="task ${on ? 'is-done' : ''}">
          <button class="tick" data-pack="${k.replace(/"/g, '&quot;')}" role="checkbox"
                  aria-checked="${on}" aria-label="${it.replace(/"/g, '&quot;')}">${on ? TICK_SVG : ''}</button>
          <div class="task-body"><div class="task-t">${it}</div></div>
        </li>`;
      }).join('')}</ul>
    </div>`).join('')}

    <p class="foot" style="padding:12px 0 0">Saved on this device only — it does not sync to Amanda's phone.</p>
  </article>`;
}

/* ==========================================================================
   Vault — AES-GCM decrypt in the browser.
   ========================================================================== */

const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function unlock(pass) {
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64(VAULT.salt), iterations: VAULT.kdf.iterations, hash: VAULT.kdf.hash },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64(VAULT.iv) }, key, b64(VAULT.ct)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

function renderVaultOpen(data) {
  const mono = /^[A-Z0-9#]{5,}$/;
  const item = (it) => `<div class="vitem">
    <div class="vitem-h"><b>${it.title}</b><span>${it.when}</span></div>
    <ul class="vrows">${it.rows.map(([k, v]) =>
      `<li><span class="vk">${k}</span><span class="vv ${mono.test(v) ? 'mono copyable' : ''}"
         ${mono.test(v) ? `data-copy="${v}" title="Tap to copy"` : ''}>${v}</span></li>`).join('')}</ul>
  </div>`;

  const bk = data.booking;
  return `
    <div class="vitem">
      <div class="vitem-h"><b>${bk.label} — ${bk.package}</b><span>Booked ${bk.booked}</span></div>
      <ul class="vrows">
        <li><span class="vk">Reservation</span><span class="vv mono copyable" data-copy="${bk.ref}">${bk.ref}</span></li>
        <li><span class="vk">Membership</span><span class="vv mono copyable" data-copy="${bk.membership}">${bk.membership}</span></li>
        <li><span class="vk">Total</span><span class="vv">${bk.total}</span></li>
      </ul>
    </div>
    ${data.travelers.map((t) => `<div class="vitem">
      <div class="vitem-h"><b>${t.name}</b><span>Traveler</span></div>
      <ul class="vrows">
        <li><span class="vk">Known Traveler #</span><span class="vv mono copyable" data-copy="${t.ktn}">${t.ktn}</span></li>
        <li><span class="vk">AAdvantage</span><span class="vv mono">${t.aa}</span></li>
      </ul></div>`).join('')}
    ${Object.values(data.items).map(item).join('')}`;
}

function wireVault() {
  const form = $('#vaultForm'), input = $('#vaultPass'), msg = $('#vaultMsg'), out = $('#vaultOut');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const pass = input.value;
    if (!pass) return;
    msg.className = 'vault-msg';
    msg.textContent = 'Deriving key…';
    try {
      const data = await unlock(pass);
      UNLOCKED = data;
      out.innerHTML = renderVaultOpen(data);
      form.hidden = true;
      msg.className = 'vault-msg ok';
      msg.textContent = 'Unlocked. Stays open until you reload.';
      $('#sailWrap').innerHTML = renderSail();
      paint();
      $('#vaultSub').textContent = 'Tap any code to copy it.';
      sessionStorage.setItem('maui.k', pass);
    } catch {
      msg.className = 'vault-msg err';
      msg.textContent = 'Wrong passphrase.';
      input.select();
    }
  });

  // Re-open silently within the same session.
  const cached = sessionStorage.getItem('maui.k');
  if (cached) { input.value = cached; form.requestSubmit(); }

  out.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-copy]');
    if (!t) return;
    navigator.clipboard?.writeText(t.dataset.copy);
    const was = t.textContent;
    t.textContent = 'copied';
    setTimeout(() => { t.textContent = was; }, 900);
  });
}

/* ==========================================================================
   Boot
   ========================================================================== */

function paint() {
  $('#map').innerHTML       = renderMap();
  $('#hotels').innerHTML    = renderHotels();
  $('#itineraryBody').innerHTML = renderDays();
  $('#spotsBody').innerHTML   = renderSpots();
  $('#happyBody').innerHTML   = renderHappy();
  $('#todayBody').innerHTML   = renderToday();
  $('#eatsBody').innerHTML    = renderEats();
  $('#packBody').innerHTML    = renderPacking();

  const b = baseOf(state.base);
  document.documentElement.style.setProperty('--accent', b.accent);
  $$('.bs-btn').forEach((el) => el.setAttribute('aria-pressed', el.dataset.base === state.base));
  $('#spotsNote').textContent = `From ${b.short}`;
  $('#happyNote').textContent = `From ${b.short}`;
  $('#eatsNote').textContent  = `From ${b.short}`;
}

function boot() {
  $('#countdown').innerHTML = renderCountdown();
  $('#sailWrap').innerHTML  = renderSail();
  $('#notes').innerHTML     = renderNotes();

  // Default to whichever hotel you are actually in.
  const hn = hawaiiNow();
  const today = DAYS.find((d) => d.date === hn.date);
  if (today) state.base = today.base;

  paint();
  wireVault();

  document.body.addEventListener('click', (ev) => {
    const bs = ev.target.closest('.bs-btn');
    if (bs) { state.base = bs.dataset.base; paint(); return; }

    const fc = ev.target.closest('.fchip[data-cat]');
    if (fc) { state.filter = fc.dataset.cat; paint(); return; }

    const dc = ev.target.closest('.daychip');
    if (dc) { state.day = dc.dataset.day === 'all' ? null : dc.dataset.day; paint(); return; }

    const ea = ev.target.closest('[data-eatarea]');
    if (ea) { state.eatArea = ea.dataset.eatarea; paint(); return; }

    const pt = ev.target.closest('[data-pretrip]');
    if (pt) {
      const m = store.get('maui.pretrip', {});
      const on = !m[pt.dataset.pretrip];
      m[pt.dataset.pretrip] = on;
      store.set('maui.pretrip', m);
      setTick(pt, on);
      const left = PRETRIP.filter((t) => !m[t.id]).length;
      const lede = $('.today-lede');
      if (lede) lede.innerHTML = ledeText(left);
      return;
    }

    const pk = ev.target.closest('[data-pack]');
    if (pk) {
      const m = store.get('maui.pack', {});
      const on = !m[pk.dataset.pack];
      m[pk.dataset.pack] = on;
      store.set('maui.pack', m);
      setTick(pk, on);
      updatePackCount();
      return;
    }

    if (ev.target.closest('[data-packreset]')) {
      store.set('maui.pack', {});
      $('#packBody').innerHTML = renderPacking();
      return;
    }

    const vj = ev.target.closest('[data-vaultjump]');
    if (vj) { $('#vault').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('#vaultPass').focus(); return; }

    const mp = ev.target.closest('[data-spot]');
    if (mp) {
      state.filter = 'all'; paint();
      const el = $(`#spot-${mp.dataset.spot}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.animate([{ boxShadow: '0 0 0 0 rgba(232,112,58,.6)' },
                   { boxShadow: '0 0 0 12px rgba(232,112,58,0)' }], { duration: 900 });
    }
  });

  document.body.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      const mp = ev.target.closest?.('[data-spot]');
      if (mp) { ev.preventDefault(); mp.click(); }
    }
  });

  // Live countdown, only while it is still counting down.
  if (!DAYS.some((d) => d.date === hawaiiNow().date) && rightNow() < new Date(TRIP.start)) {
    setInterval(() => { $('#countdown').innerHTML = renderCountdown(); }, 1000);
  }

  // Nav highlight.
  const secs = $$('section[id]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      $$('.nav a').forEach((a) => a.classList.toggle('is-on', a.hash === `#${e.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  secs.forEach((s) => io.observe(s));

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
