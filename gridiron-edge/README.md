# Gridiron Edge

A bet calibrator and situational scorer for NFL and college football.

Single-file static HTML — no build step, no backend, no dependencies. Open `index.html` and it runs.

**Live:** https://cherno.briansavesbillions.com/gridiron-edge/

---

## What it does

This is a decision-support tool, not a pick generator. Ask it whether a bet is worth making and its most
common correct answer is "pass." Ask it which bet to make on a game you are watching anyway, and it will
answer that too — but it will tell you plainly which question it is answering.

### Which bet? — one game, all six contracts

A game offers six ways in: either moneyline, either spread, over or under. The rest of this app assumes
you already know which one you want. Often you don't — you want money on tonight's game and the honest
question is *which contract*.

They are not interchangeable. The same opinion priced as a moneyline and as a spread can differ by
several points of vig, and a −450 favourite pays $5 on $20, so being right barely matters. Pick a game
and this ranks all six at the best price any of your books is showing:

| Column | What it is |
|---|---|
| Win chance | De-vigged market probability at that book's line, pushes excluded — or your own number, if you gave one |
| Pays | What your stake actually returns, net of exchange fees |
| Vig | EV against the de-vigged consensus. **The column that earns the panel its place** — it is where a moneyline reveals itself as double the cost of the equivalent spread |
| Fit | How well the contract matches the shape of bet you asked for |

Two controls shape the answer, and both are preferences rather than predictions:

- **Kind of bet you want** — a target hit rate from 75% down to 30%. The fit score is
  `p^(1−w) · b^w`, a weighted geometric mean of win probability and payout multiple. At fair odds
  that peaks at `p* = (1−2w)/(1−w)`, so the control is inverted to `w = (1−p*)/(2−p*)` and you pick
  the win rate rather than an exponent.
- **Skip anything paying less than** — a hard payout floor, default −200. Short favourites still appear
  below the table for comparison, marked and excluded from the recommendation.

**Which ranking is live is stated on every render.** If a book is priced 1% or better off the consensus,
the top line is that bet and the panel says *Ranked by edge*. Otherwise it says *Ranked by fit*, and
carries an explicit warning that none of the six is +EV — fit picks the best-shaped, best-priced way to
have money on the game, and does not make the bet profitable.

Fill in a projected margin or total and the six are re-priced against your number instead of the
market's, a **Your edge** column appears, and the reasoning changes to match: an edge that comes from
your own projection is not a stale line that will correct, it is you against the market. If your number
moves any win probability more than 8 points past the market's, the panel says so before it says
anything else. A situational lean with no projection of your own is applied to the market's number,
since a lean is an adjustment rather than a projection.

Every row has a **Details** button that loads that exact contract into the book-by-book view below.

### Calibrator

The single-contract view, for when you already know what you want to price. It works off one number —
your projected home margin, or your projected total — and prices every book's offer against it.

**That field opens on the current consensus** rather than at zero, and refills whenever the game, the
market or the slate changes. Left where it lands, your number *is* the market's number: every edge shown
is pure line shopping, which is the honest default. Move it and the edges become yours — the gap between
your number and the consensus is the bet, and the field says how far off it you are, with one click back.
Zero was never a neutral starting point; it is a pick'em call on every game, and it made the first look
at any game read as a large edge on the home dog.

What it does with that number:

- Strips the vig from each book's two-way price to recover the market's true implied probability
- Converts your projection into a win probability **at each book's own line**, so a board of
  −2.5 / −3 / −3.5 gets evaluated line by line rather than collapsed to one number
- Returns edge, EV per $100, a fractional-Kelly stake, and a verdict: Bet / Lean / Thin / Pass
- Flags key-number crossings and shows push probability explicitly
- A reality-check panel compares your number to the de-vigged market consensus, and warns you when
  you disagree by enough that the input is the more likely culprit than the edge

### How the consensus is built

Not every book deserves an equal vote. Sharp books make the number; retail books copy it and shade
toward public money. A flat median lets seven retail books outvote the two that actually know
something, dragging the "consensus" toward retail pricing — the very thing you're trying to beat.

So the consensus is a **weighted median of what each book's price implies**, in margin (or total) space
rather than probability space. Two consequences:

- **Every book contributes**, even on a fragmented board. Books aren't discarded for sitting off the
  modal line — their price is inverted through the discrete model to a common footing first.
- **Sharp books carry 4× weight** (tunable in Settings; 1 gives a flat median). At the default, two
  sharp books outweigh seven retail ones, so the consensus is effectively "what the market makers
  think," degrading gracefully to the wider market when no sharp book is present.

| Sharp book | Region key | Notes |
|---|---|---|
| LowVig | `us` | already in a default US fetch |
| BetOnline | `us` | already in a default US fetch |
| Pinnacle | `eu` | the sharpest signal; doubles credit cost |
| Novig / ProphetX | `us_ex` | exchanges |

Pinnacle is worth fetching as a *price signal* even if you can't bet there — use the book filter to
keep it out of recommendations while it still anchors the consensus.

### The board covers this week only

A football week runs **Tuesday through Monday night** — college's Tuesday-to-Saturday slate and the NFL's
Thursday, Sunday and Monday games all sit inside one window. The Best Board and the cross-market gap scan
rank only games kicking off inside it; the week rolls over on Tuesday.

The odds feed returns everything with a price posted, which by Sunday afternoon already includes next
Thursday and beyond. Those aren't bets you can shop today. A book sitting off consensus eight days out
has usually just not sharpened the number yet, and it will move several times before kickoff — so it
surfaces as a fat edge that is really an absence of pricing. Games past the boundary stay in the
Calibrator's dropdown, where pricing a future game on purpose is fine; they are counted as *held back*
in the board's section note rather than silently dropped.

### Spread or moneyline: one row per team

A team's spread and its moneyline are two prices for the same opinion, so the board gives each team one
row — whichever contract has the bigger edge — and shows the other in an **Other way** column with its
best price, edge and win rate. It is tempting to take the spread when the moneyline flags, because it
wins more often. It is usually a mistake: the edge lives in the contract a book mispriced, not in the
team. A +170 moneyline the field prices at +150 is +8.8% at a 40% win rate; the same team's fairly priced
+3 at −110 wins 50% of decided bets and is −4.2%. Moneylines are fetched by default for this reason.

### Prediction markets

Kalshi, Polymarket, Novig and ProphetX arrive through the same API under the `us_ex` region — no second
integration. They're structurally different from sportsbooks in ways that matter:

- **No vig.** You trade against other users, so de-vigging an exchange quote finds almost no hold —
  because there isn't any.
- **The cost is a separate trading fee.** Kalshi charges roughly `k × P × (1−P)` per contract with
  k = 0.07, peaking near 1.75¢ at even money — well inside a typical 4–5% sportsbook hold.
- **Binary settlement.** No pushes. Contracts are worded "by N or more", so mass landing exactly on the
  number is treated as a loss, which errs toward understating an edge rather than inventing one.
- **CFTC-regulated**, so they operate in states where sportsbooks can't.

**The fee model is not optional.** Left out, every exchange quote looks like a free 2–3% edge and swamps
the board — measured at 3.18% of phantom edge on a test quote. The coefficient is editable in Settings;
Polymarket and Novig default to zero.

### Cross-market gaps

Book-versus-exchange disagreements run wider and last longer than book-versus-book, because the crowds
are different — recreational money on one side, traders on the other. When the best price on each side
implies under 100% combined *after fees*, both sides can be backed for a locked profit.

Fees change these materially: a test gap prices at 1.84% with the fee model and 3.57% without, so a
marginal "2% arb" is really a loss. Liquidity is the binding constraint the API can't show you — a price
good for 20 contracts often isn't good for 500, and a partial fill on one side leaves a directional bet.

### Line movement and staleness

Fetches already cost credits, so the app keeps snapshots of where the consensus sat and reports how far
it has drifted since. A book still on an old number while the market has moved toward your side is a
much stronger signal than a static outlier — that's the difference between a stale line and a book that
simply disagrees. The board shows drift toward the bet side and how long ago each book last updated.

### Weekly Slate Planner

Build a card from the Calibrator or the Best Board, then size the whole thing at once.

Per-bet Kelly assumes the bet is your only exposure. It isn't — every additional bet competes for the
same bankroll, so summing individually-sized stakes systematically over-bets you. The planner simulates
the full slate and solves for the stake vector that maximises expected log growth across all bets
together, typically cutting total exposure 10–30% versus sizing one game at a time.

Bets on the same game are resolved from a single simulated game — one margin, one total — so a team's
spread and its moneyline correlate exactly instead of being treated as independent. Same-game pairs get
sized roughly 30% smaller than equivalent independent bets, because they can't diversify each other.

Also reports the chance the card finishes down, the 90% outcome range, worst case, and flags correlated
exposure (multiple bets on one game, a pile of overs, a card that's all favourites).

### CLV Tracker

The check on everything above. Results can't tell you whether the board works for a very long time — at a
2% edge, profit takes thousands of bets to separate from luck. The closing price settles it in a few dozen.
It is the market's best estimate once all the news is in, so a bet priced better than the no-vig closing
consensus had a real edge whatever happened in the game.

- **Log bets once they're placed** — from a Best Board row, under a Calibrator verdict, or the whole Slate
  Planner card at its sized stakes. Price, line and stake stay editable to match the actual fill.
- **Closing reads.** Every normal fetch records the consensus for tracked bets for free. **Capture closes**
  pulls only the games and markets you have bets on, from a fixed ten-book list anchored by Pinnacle and LowVig, so a
  kickoff window costs a credit or two. Optional auto-capture fires 10 minutes before each kickoff while the
  page is open — a static page has nowhere else to run.
- **CLV** re-prices each bet at its own line and price against the last pre-kickoff consensus, through the
  same discrete-margin model and exchange fee handling as the board. A read counts as a close only if it
  was taken within 3 hours of kickoff; earlier reads show as provisional or "early".
- **Grading** uses the Odds API scores endpoint (2 credits per league, reaches back 3 days). Older bets are
  graded by hand.
- Reports average CLV with a 95% range, share of bets beating the close, the profit CLV implies, and actual
  P&L with its own range — shown side by side because the gap between the two widths is the whole point.
  Breakdowns by market, book, league and source show where an edge holds or leaks.

**Board picks as paper bets.** With *Log every pick as a paper bet* on (the default, Best Board tab), each
fetch logs the board's top picks per league — top 10 at 0.5% edge or better by default, deliberately wider than the board, at the suggested
stake — the first time each team or total is flagged. They capture closes, grade and report exactly like
placed bets but sit in their own view, so the board's record and yours never mix. Finished games
auto-grade on load and hourly while the page is open, at most every 6 hours (2 credits per league). The
scores endpoint only reaches back 3 days, so open the page at least that often or grade stragglers by hand.

**Calibration.** Two breakdowns exist to tune the board: **by edge when logged** (do big flagged edges
hold up, or are they mostly bad data?) and **by hours before kickoff** (how fast does an edge decay?). Each
shows *Kept* — the share of the flagged edge still there at the close. Once board picks have 30 closes, the
Best Board scales every edge, stake and its minimum-edge filter by that retention (clamped to 0–1; a
checkbox shows raw numbers). Paper picks always log raw edges, so the measurement never feeds on itself.

The log lives in this browser. Export CSV for analysis, and back up to JSON — clearing site data clears it.

### Situational Scorer

Ten weighted factors — rest, travel, weather, injuries, motivation, line movement vs. tickets, pace,
talent gap, environment, coaching — each rated −2 to +2. Weights differ by league, because the two
markets are not the same problem:

| Factor | NFL | CFB |
|---|---|---|
| Injury edge | ×1.4 | ×1.6 |
| Motivation spot | ×0.7 | ×1.3 |
| Talent gap vs. line | ×0.4 | ×1.2 |
| Line move vs. tickets | ×1.3 | ×1.1 |

The output is a points lean with a contribution breakdown, which feeds back into the calibrator as an
adjustment to your projected margin. It is not a bet signal on its own.

---

## Setup

The app reads live lines from [the-odds-api.com](https://the-odds-api.com). You need your own key —
the free tier allows 500 credits/month.

1. Open the app → **Settings** tab
2. Paste your key, choose your markets, click **Save**
3. **Calibrator** → **Fetch live odds**

### Making the free tier last

The `/odds` endpoint bills **credits = markets × regions**, not one credit per request. Requesting all
three markets across US books costs 3 credits per league, so a both-league scan is 6. Two things keep
that in check:

**Fetch only the markets you price.** All three markets (the default) is 3 credits per league on US
books — 6 for both, or about 83 full scans a month. Dropping moneyline makes it 4 a scan and 125 a
month, at the cost of the Best Board's spread-versus-moneyline comparison. Every extra region
multiplies all of this.

**Name books instead of regions.** The API bills every 10 named books as one region. The default fetch —
*Your books + Pinnacle & LowVig* — requests your picked books plus the two sharp anchors, filling any unused
slots in the last group of ten with deep US books. Up to 10 books costs the same as one region, so it gets
Pinnacle (otherwise only in the EU region) into the consensus for less than the regions your books sit in.
LowVig stands in for BetOnline, which prices almost identically.

**Slates are cached in the browser.** Reopening the app, reloading the page, and switching leagues all
cost nothing; only "Fetch live odds" spends credits. One fetch pulls every game in the league and the
selector then works entirely offline against that snapshot, so pull once per slate and work the whole
card off it.

The Settings tab shows the live credit cost of your current configuration and the age of each cached
slate. There's also a manual line-entry path for when quota runs out or lines aren't posted yet.

If you genuinely outgrow 500 credits, the paid tier is $30/month for 20,000. Running multiple free
accounts to extend the quota violates their terms and risks all of the keys.

### Cloud tracking

Auto-capture and auto-grade only run while the page is open. Cloud tracking moves both into a scheduled
GitHub Action in a **private** repo, using the files in [`cloud/`](cloud/):

1. Create a private repo (e.g. `gridiron-edge-data`). Put `cloud/tracker.mjs` at its root and
   `cloud/tracker.yml` at `.github/workflows/tracker.yml`.
2. Add your Odds API key as an Actions secret named `ODDS_API_KEY`.
3. Create a fine-grained personal access token with access to **that repo only** and
   **Contents: read and write**. Paste the repo and token into Settings → Cloud tracking.

The page writes `watch.json` — games with open or ungraded bets: ids, kickoff times, markets, no stakes or
books. Every 15 minutes through football kickoff windows, the Action captures one closing read per game
within 40 minutes of kickoff (ten named books, one credit per market) and pulls final scores every 3 hours
once games finish (2 credits per league). It writes the raw responses to `closes.json` and `scores.json`
and stops spending below 60 remaining credits. The page prices and grades those with its own model when it
next opens, so the logic lives in one place; while cloud tracking is connected, the page's own auto-capture
and auto-grade stand down so credits aren't spent twice.

Cost: roughly 1,000 Actions minutes a month against a private repo's 2,000 free, since runs are confined
to kickoff windows. The token lives in browser storage that other github.io Pages sites on the same
account domain can read, which is why it should be scoped to the one data repo.

### Sharing it without sharing your key

The app is useless without an odds key, and a key is a signup and a quota — too much friction for
someone who just wants to see what this does. So `demo/slate.json` holds a snapshot of a recent slate,
and **a visitor with no key of their own gets the whole app running on it**: every tab, real prices from
real books, no signup, and nobody's credits spent. Your key is never in the page, never in the repo, and
never handed to anyone.

It is deliberately not live and says so everywhere — a banner above every tab leads with the age of the
data and the instruction not to bet off it, because a stale line is a genuinely dangerous thing to put in
front of someone. The Best Board's existing "these prices are N hours old" warning fires off the snapshot
age too. Once every game in it has kicked off, each tab explains that rather than just going empty.

The snapshot is loaded into memory only. It never enters the localStorage slate cache, never logs paper
bets and never records closes, so a visitor's CLV history can't be polluted by prices nobody could have
bet. **Saving a key exits demo mode permanently** and drops the snapshot rather than leave stale prices
sitting under a banner that no longer shows. If you already have a key saved, `demo/slate.json` is never
even requested.

#### Refreshing it

```bash
ODDS_API_KEY=your-key node tools/refresh-demo.mjs
```

Or let [`.github/workflows/demo-slate.yml`](.github/workflows/demo-slate.yml) do it — add `ODDS_API_KEY`
as an Actions secret (Settings → Secrets and variables → Actions) and it runs Wednesday and Saturday
mornings, committing the result only when it changed.

Cost is the same billing as the app: 3 credits per league, 6 a run, about **52 credits a month** against
the 500-credit free tier. Drop a cron line to halve it. The script refuses to run below 60 remaining
credits, so a demo refresh is the first thing to stop spending rather than the thing that empties your
quota. An empty pull in the off-season leaves the previous snapshot in place — last week's games beat no
games.

Until you run it once there is no snapshot, and the app behaves exactly as it did before: no key, no
slate, manual entry only.

### About the key

Your key is stored in `localStorage` under `ge_apiKey` and is sent only to `api.the-odds-api.com`.

**It is never committed to this repo, and it must not be.** Do not hardcode a key into `index.html` to
avoid re-entering it — that publishes a working key to a public URL. `localStorage` is per-origin, so
running the app from a local file and from the Pages URL each require entering the key once.

---

## Modeling notes

**Probabilities exclude pushes.** Everything displayed is conditional on the bet actually resolving, so
your win probability, the break-even rate, and de-vigged market prices are all directly comparable.
Showing a raw win probability next to break-even doesn't reconcile on whole-number spreads, where a
meaningful share of games land exactly on the line.

**Spreads and moneylines are priced off a discrete margin distribution, not a smooth curve.** A normal
model badly undervalues buying off a key number — it smooths through the lump of games that land exactly
on 3. Instead, a normal envelope is re-weighted by empirical key-number multipliers derived from actual
margin frequencies, then renormalised. A margin of exactly 3 occurs about 2.6x more often than smooth in
the NFL, but only about 1.8x in college.

The result is a half-point value curve that matches reality:

| Buying off | NFL | CFB |
|---|---|---|
| 3 | 4.24% | 2.69% |
| 7 | 3.12% | 2.26% |
| 10 | 2.22% | 1.89% |
| 5 (not a key number) | 0.59% | 0.53% |

Push probability falls out of the same distribution, so it correctly depends on where the line sits
relative to your projection rather than being a flat table lookup. Totals stay on the normal model —
there's no equivalently reliable frequency table for exact totals, and their key numbers are much weaker.

**Default standard deviations** are 13.5 (NFL margin), 10.5 (NFL total), 16.0 (CFB margin), 13.0
(CFB total). All are editable under Settings, along with the maximum situational lean. Raising the max
lean is how a discipline tool quietly becomes a rationalization tool — the defaults are deliberately
conservative.

---

## Disclaimer

For personal use. This tool measures whether a price beats your own projection; it does not predict
outcomes and offers no guarantee of profit. The vig is real and most bets are not worth making. Check
that sports wagering is legal where you are, and never stake money you need.

## Look and feel

Shares the dark navy / gold identity of the DBFFL draft-order board, so the two sites read as one
set of tools. Dark is the default; the toggle still switches to light, which is the sensible theme
for printing a slate card.

The analytical tables are deliberately left dense. This is a tool for scanning numbers, and card
styling would have cost rows per screen for no analytical gain.

## Team logos

The Best Board and the Slate Planner card show team logos, matched from the Odds API's team names.

The map lives in `TEAM_ART` inside `index.html` rather than being fetched at runtime: ESPN's team
endpoint sends no `Access-Control-Allow-Origin` header, so a browser cannot call it, and baking the
map in keeps the app single-file and usable from `file://`. Logo images themselves are served from
`a.espncdn.com`, which does allow cross-origin requests.

Odds API team names match ESPN `displayName` exactly, which is why a plain lookup works. Anything
unmatched falls back to a chip with the team's initials, so a name we don't know degrades to
something readable rather than a broken image.

To regenerate after a conference shuffle:

```bash
curl -s "https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?limit=1000" -o cfb.json
curl -s "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=100" -o nfl.json
```

Then rebuild the two objects as `displayName -> [espnId, abbreviation]` for college and
`displayName -> abbreviation` for the NFL, skipping any team with no `logos` entry.

