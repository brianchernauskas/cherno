# Prescott Home Tour

A phone-first planner for a Sat Sep 26 – Sun Sep 27, 2026 house-hunting weekend in Prescott, AZ:
seven listings (realtor.com plus the agent’s flexmls collection), a map, a suggested visit order, and shared notes, photos and 1–5 scores.

Live: https://cherno.briansavesbillions.com/prescott-homes/

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Page shell |
| `style.css` | All styling, light + dark |
| `data.js` | The seven houses, drive-time matrix, wildfire figures, nearest places |
| `store.js` | Firestore adapter with a this-device-only fallback |
| `app.js` | Plan builder, map, house pages, notes/photos/scores, compare table |

No build step. Preview locally with `npx serve prescott-homes --listen 3019`.

## Where the data came from (pulled 2026-09-21)

- **Listings:** realtor.com listing pages (MLS data). Photos are hotlinked from the listing CDNs (realtor.com, Spark/flexmls), not copied.
- **Wildfire:** USDA Forest Service *Wildfire Risk to Communities* 2024 rasters, via
  `imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation`. Hazard class (WHP) and risk to potential
  structures were sampled on a 7×7 grid at 60 m spacing around each house, because a single point
  often lands on a "developed / non-burnable" pixel that makes a house look safer than its surroundings.
- **Nearest grocery / gas / restaurant:** OpenStreetMap (Overpass), ranked by driving distance from OSRM.
- **Drive times:** OSRM public server; the plan pads them 10%.
- **Elevation:** USGS EPQS.

The Chandler start address is never stored. `data.js` has drive times from it, not its location.

## Shared notes and locking things down

The page uses the existing `bourbonffldraft` Firebase project (the pick'em site's), in its own
`prescott` collection. [`firestore.rules`](firestore.rules) is the **full** rules file for the
project: paste all of it into Firebase console → bourbonffldraft → Firestore → Rules. It leaves
the pick'em blocks unchanged and accepts only what this site actually writes: the seven known
houses, the known fields, and capped sizes. Notes and photos can be added or deleted but not
edited. If the rules reject the collection entirely, the page falls back to saving on the device
and shows a banner saying so.

There's still no login, so anyone with the URL can add or delete. Keep offer amounts and finances
out of it.

**About the API key GitHub flagged.** A Firebase web key has to reach the browser, so there's no
way to hide it, and it isn't what protects the data (the rules are). To stop the key being
reused from other sites, restrict it in Google Cloud console → APIs & Services → Credentials →
the "Browser key (auto created by Firebase)":

- Application restrictions → Websites: `https://brianchernauskas.github.io/*`, `http://localhost:*/*`
- API restrictions → Restrict key → **Cloud Firestore API** only

The pick'em GitHub Actions jobs send a matching `Referer` header (`tools/lib.mjs`), so they
keep working under the restriction.

Layout:

```
prescott/plan                      visit order, day per house, booked times, settings
prescott/{house}/notes/{id}        { by, text, ts }
prescott/{house}/photos/{id}       { by, caption, data: JPEG data URL, ts }
prescott/{house}/scores/{person}   { by, scores: { kitchen: 4, ... }, ts }
```

Photos are shrunk on the phone to about 1400 px, JPEG ~0.7, and kept under ~850 KB so each one fits
in a single Firestore document (1 MiB cap). There's no Firebase Storage, so no paid plan is needed.

## Deploy

GitHub Pages from `main`, root. Bump the `?v=` stamps in `index.html` and the imports in
`app.js` whenever JS or CSS changes. Pages caches for 10 minutes, and a mixed old/new module set
renders a blank page.
