#!/usr/bin/env node
/**
 * Refresh demo/slate.json — the snapshot the app runs on when a visitor has no key.
 *
 * Run it locally:      ODDS_API_KEY=xxxx node tools/refresh-demo.mjs
 * Or in CI:            .github/workflows/demo-slate.yml, on a schedule
 *
 * Cost is markets x regions per league, the same billing as the app: three markets on
 * one region of named books is 3 credits a league, 6 for both. Twice a week is about
 * 52 credits a month against a 500-credit free tier.
 *
 * The output is exactly what the /odds endpoint returns, minus games that have already
 * kicked off, so the page needs no special parsing for it. No key is written to it.
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'demo/slate.json');

const KEY = process.env.ODDS_API_KEY;
if (!KEY) {
  console.error('ODDS_API_KEY is not set. Locally: ODDS_API_KEY=xxxx node tools/refresh-demo.mjs');
  process.exit(1);
}

const SPORT = { nfl: 'americanfootball_nfl', cfb: 'americanfootball_ncaaf' };
const MARKETS = 'spreads,totals,h2h';

// The same default book list the app fetches: the user's usual books plus the two sharp
// anchors. Ten or fewer bookmakers bill as a single region, so this is the cheapest way
// to get Pinnacle — which otherwise only appears in the EU region — into the consensus.
const BOOKS = [
  'pinnacle', 'lowvig', 'betonlineag', 'draftkings', 'fanduel',
  'betmgm', 'caesars', 'espnbet', 'betrivers', 'bovada'
].join(',');

// A snapshot is only useful while games in it are still ahead of kickoff, so reach a
// little further out than the app's own fetch and let the page filter as time passes.
const HORIZON_DAYS = 8;

function iso(d) { return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); }

async function pull(league) {
  const now = new Date();
  const until = new Date(now.getTime() + HORIZON_DAYS * 86400e3);
  const url = `https://api.the-odds-api.com/v4/sports/${SPORT[league]}/odds`
            + `?apiKey=${encodeURIComponent(KEY)}`
            + `&bookmakers=${BOOKS}&markets=${MARKETS}&oddsFormat=american`
            + `&commenceTimeFrom=${iso(now)}&commenceTimeTo=${iso(until)}`;

  const res = await fetch(url);
  const remaining = res.headers.get('x-requests-remaining');
  if (!res.ok) {
    throw new Error(`${league}: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
  }
  const games = await res.json();
  console.log(`${league}: ${games.length} games, ${remaining ?? '?'} credits left`);
  return { games, remaining: remaining === null ? null : Number(remaining) };
}

// Refuse to spend the last of the quota on a demo refresh. The app itself is the thing
// the credits are for; this is a nicety and should be the first spend to stop.
const FLOOR = 60;

// Returns the process exit code. Written as a function returning rather than calling
// process.exit() so the fetch keep-alive sockets drain on their own — exiting out from
// under an open one aborts the runtime instead of reporting the code we meant.
async function main() {
  const snap = { fetchedAt: iso(new Date()), note: 'Demo snapshot. Not live odds.', nfl: [], cfb: [] };
  let remaining = null;

  for (const league of ['nfl', 'cfb']) {
    if (remaining !== null && remaining < FLOOR) {
      console.log(`Stopping before ${league}: ${remaining} credits left, floor is ${FLOOR}.`);
      break;
    }
    try {
      const r = await pull(league);
      snap[league] = r.games;
      remaining = r.remaining;
    } catch (e) {
      // A bad key or a dead endpoint should fail the run with one readable line, not a
      // stack trace — and one league failing must not discard the other's games.
      console.error(String(e.message || e));
      if (!snap.nfl.length && !snap.cfb.length) return 1;
      console.error(`Continuing with what ${league === 'nfl' ? 'cfb' : 'nfl'} returned.`);
      break;
    }
  }

  const total = snap.nfl.length + snap.cfb.length;
  if (!total) {
    // An empty pull is normal in the off-season and must not overwrite a good snapshot
    // with nothing — a page showing last week's games beats a page showing none.
    console.log('No upcoming games returned; leaving the existing snapshot in place.');
    return 0;
  }

  let prev = null;
  try { prev = JSON.parse(readFileSync(OUT, 'utf8')); } catch (e) { /* first run */ }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(snap) + '\n');

  const size = (JSON.stringify(snap).length / 1024).toFixed(0);
  console.log(`Wrote demo/slate.json — ${total} games, ${size} KB`
    + (prev ? `, replacing a snapshot from ${prev.fetchedAt}` : ''));
  return 0;
}

process.exitCode = await main();
