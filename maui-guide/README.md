# Maui Guide

Mobile-first trip guide for Aug 28 – Sep 5, 2026. Static site, no build step, deploys to GitHub Pages.

## Run it locally

```bash
npx serve maui-guide --listen 4178
```

## Set your own passphrase

The confirmation numbers are AES-256-GCM encrypted into `vault.js`. The prototype ships with a
placeholder passphrase — **change it before publishing**:

```bash
node tools/encrypt.js "four random words you will remember"
```

That reads `secrets.json`, encrypts it, and rewrites `vault.js`. Commit `vault.js`; never commit
`secrets.json` (it is gitignored).

### If a passphrase you believe is correct gets rejected

```bash
node tools/check.js "your phrase here"
```

Runs locally, sends nothing anywhere. It reports whether the phrase opens `vault.js`, and shows
what the shell actually handed over — character count, space count, word count, and a masked
shape — so you can spot mangling without exposing the phrase.

Spaces are part of the passphrase. It is encoded byte-for-byte, so `four random words` and
`fourrandomwords` derive different keys.

Three ways Windows silently encrypts something other than what you typed:

- **Unquoted input.** `node tools/encrypt.js correct horse battery staple` passes only `correct`;
  the rest become separate arguments and are dropped. `encrypt.js` now refuses this rather than
  accepting it, but a vault built before that guard existed may have been created this way.
- **PowerShell expanding `$` or a backtick** inside double quotes — `"blue $river tall stone"`
  becomes `blue  tall stone` before Node sees it. Use single quotes in PowerShell.
- **Curly quotes or non-breaking spaces** from pasting out of a document or browser.

If the checker unlocks it but the page will not, the browser is holding cached bytes: hard-reload
or clear site data for the origin. If the phrase is genuinely lost, nothing is destroyed —
`secrets.json` is intact and unpublished, so re-run `encrypt.js` with a new phrase and push
`vault.js`.

**Re-run this any time you edit `secrets.json`** — `vault.js` is a build artifact and goes stale
silently otherwise. If a passphrase you know is correct gets rejected, you are almost certainly
looking at a cached or stale `vault.js` rather than a wrong passphrase.

### What the encryption does and does not do

- **Does:** make the published ciphertext meaningless to anyone without the passphrase. This is
  real AES-256-GCM with a PBKDF2-SHA256 key at 600,000 rounds, not a JavaScript `if` statement.
- **Does not:** hide the ciphertext. Anyone who finds the URL can download `vault.js` and attempt
  passphrases offline at whatever rate their hardware allows. A short or guessable passphrase
  ("maui2026", a hotel name, a date) will fall. Four random words will not.
- Payment card details are deliberately absent from `secrets.json` entirely.

### What is deliberately NOT in the public files

The encryption only helps for things that are actually inside it. These were pulled out of
`data.js` because plaintext in a public repo is plaintext forever — crawler caches outlive a
repo going private:

- **Home address.** The itinerary no longer names it. A public page combining a home address
  with exact travel dates tells anyone reading it which house is empty and until when.
- **Surnames.** Masked to a short form. Most hotel and airline systems key on last name, so a
  surname plus a confirmation number is often enough to modify a booking.
- **The Costco reservation number.** It lives only in `secrets.json` now. It was previously
  duplicated in plaintext in `data.js`, which silently defeated the vault for that value.
- **The Smartwaiver link.** It is a capability URL — `?auto_tag=fh_id_...` identifies the
  booking with no authentication at all, so anyone who has the link can act on it. It now
  lives in `secrets.json` under `links`, and the Sign-waiver button on the sail card reads
  "Unlock for waiver" until the vault is open.

If you add anything new, the test is: would you be comfortable with this on a billboard next
to your name? If not, it belongs in `secrets.json`, not `data.js`.

## Files

| File | What it is |
|---|---|
| `index.html` | Page shell and bottom nav |
| `data.js` | **All trip content** — itinerary, hotels, spots, happy hours, restaurants, packing, notes |
| `app.js` | Rendering, the SVG map projection, base switching, vault decrypt |
| `styles.css` | Mobile-first styles, light and dark |
| `secrets.json` | Plaintext confirmation numbers — **gitignored, never publish** |
| `vault.js` | Generated ciphertext — safe to commit |
| `tools/encrypt.js` | Re-encrypts `secrets.json` with your passphrase |
| `tools/check.js` | Tests a passphrase against `vault.js` and diagnoses shell mangling |
| `sw.js` | Cache-first service worker so the guide works with no signal |

## Editing content

Everything readable lives in `data.js`. Adding a spot means adding one object with a
`dist` entry for each base:

```js
{ id:'foo', name:'Somewhere', cat:'beach', lat:20.7, lon:-156.4,
  blurb:'…', tip:'…',
  dist:{ kaanapali:[12, 25], wailea:[4, 9] } }   // [miles, minutes]
```

The map draws itself from `lat`/`lon` — no image assets, no map library, nothing to update by hand.

## Previewing another day

The Today section changes shape depending on when you open it: a countdown plus outstanding
tasks before the trip, then today's plan, what's next, and which happy hours are open once
you're on-island. To see any other day:

```
index.html?now=2026-09-02T15:10
```

`?now=YYYY-MM-DD` works too and assumes midday. Times are Hawaii local.

## Checklists

The packing list and the pre-departure tasks store their checked state in `localStorage`,
which means **per device, per browser** — it does not sync to a second phone. That is a
deliberate limit of a static site with no backend, not an oversight.

## Data caveats

- **Drive times are curated estimates**, not live routing. They were cross-checked against
  published Maui driving-time tables; the long ones (Haleakalā, Hāna, airport transfers) match
  those sources. Treat them as planning numbers.
- **Happy hour prices are what published guides reported in 2026 and they move.** Each venue
  carries a confidence tag. `Verify by phone` means a single source, or sources that disagreed —
  most often on times. Call before building a plan around one.
- **Duke's Beach House has no happy hour.** It was listed with soft price ranges in the first
  version; the operator discontinued it, confirmed by two sources. The dinner reservation is
  unaffected, but do not plan a cheap warm-up there.
- **Pailolo is the one West Maui venue with no published figures at all.** Four-hour window,
  2–6 pm, discounts confirmed, amounts not documented anywhere. Listed honestly as such rather
  than filled in with plausible numbers.
- The Kai Kanani confirmation contains an internal contradiction about the 4:00 pm resort pickup
  versus the 4:30 pm store check-in. Both are shown on the sail card rather than silently picking one.
- Two restaurants carry unresolved happy hour status: **The Plantation House** runs one but does not
  publish times or prices anywhere I could verify, and **Matteo's** was last reported to have dropped
  theirs when they moved to a 4:45 pm open, though listings still mention a bar-lounge window. Both
  say so on their cards.
- **Sansei's** early bird is Sun/Mon 5:00–5:45 pm, dine-in only. The discount itself is not published.
  The Kīhei branch has closed; Kapalua is the only Maui location left.

## Keeping it out of search

`index.html` carries `noindex, nofollow, noarchive, nosnippet, noimageindex`. The URL still
works for anyone you send it to — it just should not surface in a search for a real name
alongside dates a house is empty.

**A `robots.txt` in this repo would do nothing.** Crawlers only read robots.txt from the domain
root, which for a project page is `brianchernauskas.github.io/robots.txt` — served from a
`brianchernauskas.github.io` repo, not this one. Adding one here would look like protection
while providing none.

It would also be counterproductive alongside `noindex`: a robots.txt `Disallow` stops the
crawler fetching the page at all, so it never sees the `noindex`, and the bare URL can still
appear in results. The meta tag alone is the correct mechanism. Compliance is voluntary, so
this deters well-behaved search engines, not a determined reader.

## Deploying

Push to a repo, then Settings → Pages → deploy from branch, root. Re-run `tools/encrypt.js`
first if you have not set your own passphrase.
