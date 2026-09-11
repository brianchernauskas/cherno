# Cherno

A dashboard for the personal (non-Proxima) sites — the counterpart to
[proxima-tools-hub](https://github.com/brianchernauskas/proxima-tools-hub), with
no auth gate and no Proxima branding.

**Live:** https://brianchernauskas.github.io/cherno/

## What's on it

| Site | Repo | Shelf |
| --- | --- | --- |
| Draft Order Pick'em | [draft-order-pickem](https://github.com/brianchernauskas/draft-order-pickem) | Football |
| Gridiron Edge | [gridiron-edge](https://github.com/brianchernauskas/gridiron-edge) | Football |
| Flameworking Guide | [flameworking-guide](https://github.com/brianchernauskas/flameworking-guide) | Craft |
| Maui Guide | [maui-guide](https://github.com/brianchernauskas/maui-guide) | Travel |

## Adding a site

Everything on the page is rendered from the `SITES` array near the top of the
`<script>` block in `index.html`. Add one entry and the card, the shelf heading,
the header pill and the hero stats all follow — group counts and totals are
derived, never hand-maintained (they drifted out of sync on the Proxima hub once).

```js
{
  group:  'Craft',                 // creates the shelf if it's new
  accent: 'flame',                 // --flame / --flame-dim in :root
  tag:    'Borosilicate · Guide',
  name:   'Flameworking Guide',
  repo:   'flameworking-guide',    // used for the "updated N ago" stamp
  url:    'https://brianchernauskas.github.io/flameworking-guide/',
  cta:    'Read the guide',
  desc:   '...',
  links:  [ { label: 'Fuming', href: '...#7' } ]   // optional deep links
}
```

A new accent needs a `--name` / `--name-dim` pair in **both** `:root` and
`:root[data-theme="light"]` — the light values are darkened so the tag text keeps
contrast on a white card.

## How the "updated" stamps work

Each card reads `pushed_at` from `https://api.github.com/repos/brianchernauskas/<repo>`.
The GitHub API sends CORS headers, so this works straight from the page with no
token and no build step. Unauthenticated calls are limited to 60/hour per IP, so
results are cached in `localStorage` for six hours; if a call fails or the limit
is hit, the card keeps its em dash and nothing else changes. The dot next to the
stamp picks up the card's accent colour when the repo was touched in the last 30 days.

Private repos return 404 to an unauthenticated call, so only public repos get a
stamp. `europetrip` is private with no Pages site and is deliberately not listed.

## Privacy

`<meta name="robots" content="noindex, nofollow">` rather than a `robots.txt` —
for a project page under `github.io`, `robots.txt` is only honoured from the
domain-root repo, and a `Disallow` there would stop crawlers ever reading the
noindex. The page itself holds nothing sensitive; it links only to sites that are
already public.

## Deploying

```bash
git add . && git commit -m "..." && git push
```

GitHub Pages rebuilds in about a minute. Serving `main` from the repo root.

## Local preview

```bash
npx serve cherno --listen 3010
```
