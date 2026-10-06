// Gridiron Edge cloud tracker. Runs on a schedule in GitHub Actions inside a private repo.
//
// The page writes watch.json: games with open or ungraded bets (id, league, kickoff, markets).
// This script captures one closing read shortly before each kickoff and pulls final scores
// afterwards, storing the raw API responses in closes.json and scores.json. The page prices and
// grades them with its own model the next time it opens, so the logic lives in one place.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const KEY = process.env.ODDS_API_KEY;
const BASE = process.env.ODDS_API_BASE || 'https://api.the-odds-api.com';
if (!KEY) { console.error('ODDS_API_KEY secret is not set.'); process.exit(1); }

const SPORT = { nfl: 'americanfootball_nfl', cfb: 'americanfootball_ncaaf' };
// Must match CLOSE_BOOKS in index.html. Pinnacle and LowVig anchor the consensus; ten named
// books bill as one region.
const CLOSE_BOOKS = ['pinnacle', 'lowvig', 'draftkings', 'fanduel', 'betmgm', 'williamhill_us',
                     'betrivers', 'bovada', 'fanatics', 'espnbet'];
const CAPTURE_WITHIN_MIN = 40;   // runs are every 15 minutes, and GitHub often starts them late
const GOOD_CLOSE_MIN = 45;       // a read this close to kickoff needs no second capture
const GRADE_EVERY_H = 3;
const CREDIT_FLOOR = 60;         // leave room for fetches from the page
const KEEP_DAYS = 7;

const now = Date.now();
const read = (file, fallback) => existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;
const files = { closes: read('closes.json', {}), scores: read('scores.json', {}), meta: read('meta.json', {}) };
const before = JSON.stringify(files);
const { closes, scores, meta } = files;
const watch = read('watch.json', { games: [] }).games || [];

const kick = g => new Date(g.commence).getTime();
const byLeague = list => list.reduce((m, g) => ((m[g.league] ||= []).push(g), m), {});
const lowOnCredits = () => typeof meta.remaining === 'number' && meta.remaining < CREDIT_FLOOR;
const isoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

async function api(path, params) {
  const qs = Object.entries({ apiKey: KEY, ...params })
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2C/g, ',').replace(/%3A/g, ':')}`).join('&');
  const res = await fetch(`${BASE}/v4/sports/${path}?${qs}`);
  const remaining = res.headers.get('x-requests-remaining');
  if (remaining !== null) meta.remaining = Number(remaining);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function captureCloses() {
  const due = watch.filter(g => {
    const mins = (kick(g) - now) / 60000, have = closes[g.gameKey];
    return mins > 0 && mins <= CAPTURE_WITHIN_MIN && !(have && (kick(g) - have.ts) / 60000 <= GOOD_CLOSE_MIN);
  });
  for (const [league, games] of Object.entries(byLeague(due))) {
    if (lowOnCredits()) { console.log(`Skipping ${league} capture: ${meta.remaining} credits left.`); continue; }
    const markets = [...new Set(games.flatMap(g => g.markets))].join(',');
    const data = await api(`${SPORT[league]}/odds`, {
      bookmakers: CLOSE_BOOKS.join(','), markets, oddsFormat: 'american',
      eventIds: games.map(g => g.gameKey).join(','), commenceTimeFrom: isoNow()
    });
    const ts = Date.now();
    data.forEach(ev => { closes[ev.id] = { ts, league, game: ev }; });
    console.log(`Captured ${data.length} of ${games.length} ${league} games (${markets}).`);
  }
}

async function gradeGames() {
  if (now - (meta.lastGrade || 0) < GRADE_EVERY_H * 3600e3) return;
  const due = watch.filter(g => kick(g) < now - 3.5 * 3600e3 && kick(g) > now - 3 * 864e5
                             && !(scores[g.gameKey] && scores[g.gameKey].completed));
  if (!due.length) return;
  meta.lastGrade = now;
  for (const [league, games] of Object.entries(byLeague(due))) {
    if (lowOnCredits()) { console.log(`Skipping ${league} scores: ${meta.remaining} credits left.`); continue; }
    const data = await api(`${SPORT[league]}/scores`, { daysFrom: 3, eventIds: games.map(g => g.gameKey).join(',') });
    const done = data.filter(ev => ev.completed);
    done.forEach(ev => { scores[ev.id] = { ts: Date.now(), league, ...ev }; });
    console.log(`Scores: ${done.length} of ${games.length} ${league} games final.`);
  }
}

function prune() {
  const cutoff = now - KEEP_DAYS * 864e5;
  for (const table of [closes, scores]) {
    for (const [id, v] of Object.entries(table)) {
      const t = new Date(v.commence_time || (v.game && v.game.commence_time)).getTime();
      if (!isNaN(t) && t < cutoff) delete table[id];
    }
  }
}

let failed = null;
try {
  await captureCloses();
  await gradeGames();
} catch (e) {
  failed = e;
} finally {
  prune();
  // Write only on change, so quiet runs don't produce commits.
  if (JSON.stringify(files) !== before) {
    for (const [name, value] of Object.entries(files)) writeFileSync(`${name}.json`, JSON.stringify(value, null, 1) + '\n');
  }
}
console.log(`${watch.length} game${watch.length === 1 ? '' : 's'} watched.`);
if (failed) { console.error(failed.message); process.exit(1); }
