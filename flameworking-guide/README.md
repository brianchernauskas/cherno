# The Borosilicate Flameworking Guide — COE 33

A single-file, illustrated field guide to flameworking borosilicate (COE 33) glass.

**Live:** https://cherno.briansavesbillions.com/flameworking-guide/

## Contents

| # | Section |
|---|---------|
| 00 | Start Here |
| 01 | Glass 101: What COE 33 Means |
| 02 | Studio, Torch & Tools |
| 03 | Safety & Ventilation |
| 04 | Heat & Flame Control |
| 05 | Core Techniques |
| 06 | Color & Chemistry |
| 07 | Fuming Deep Dive |
| 08 | Annealing & Finishing |
| 09 | The Industry in 2026 |
| 10 | The Practice Ladder |
| 11 | Troubleshooting & Glossary |
| 12 | Suppliers & Schools |

## Notes

- Everything lives in `index.html` — no build step, no dependencies. All 22 diagrams are hand-authored inline SVG.
- Section 09 cites its sources at the bottom of the page. Market and pricing figures are sourced; community and technique observations are labelled as such.
- Temperature and annealing figures are starting points for borosilicate 3.3 and should be verified against your own glass, kiln, and work.

## Analytics

Set `window.GA_ID` near the top of `index.html` to a GA4 Measurement ID (`G-XXXXXXXXXX`) to activate. While it is empty, no script loads and no cookies are set.

- Standalone property — deliberately **not** the Proxima tag (`G-N5E1D26WRG`) used by the work tools.
- Google Signals and ad personalisation are disabled; this collects traffic counts, not an advertising profile.
- The guide is one URL with JS-switched sections, so automatic pageviews are turned off and each section is tracked manually as `/flameworking-guide/#N`. That's what makes it possible to see which sections people actually read.
- `page_path` / `page_location` are pinned to a canonical string, never derived from `location.*` — opening the file over `file://` or `data:` would otherwise put the whole document into `pathname`.

## Deploying changes

```
git add . && git commit -m "..." && git push
```

GitHub Pages rebuilds automatically in about a minute.
