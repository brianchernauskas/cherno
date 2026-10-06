# Ledger

A private household-finance scenario planner. Static site, no build step, no dependencies.

**Live:** https://cherno.briansavesbillions.com/ledger/ — it opens to a passphrase prompt and shows nothing without one.

## What it does

- **Scenarios** — runs a no-purchase baseline against up to five purchase/financing structures month by month: HELOC, cash-out refinance, second-home mortgage, or all cash. Each is compared on cash flow, lender-style debt-to-income, payment shock, interest paid, and long-run wealth (home equity plus a side fund that compounds each month's surplus). A stress panel shifts the HELOC rate and income.
- **Inputs** — income, current home, second home, lending market, tax switches, and fixed non-card costs. Defaults that haven't been confirmed carry an amber dot.
- **Spending** — drop card statements (CSV, OFX, QFX). They're parsed in the browser, payments are dropped, merchants are cleaned and categorised, overlapping statements are de-duplicated, and the monthly average feeds every scenario.
- **Vault** — lock, change passphrase, encrypted backup and restore.

Tax is an estimate: 2026 federal brackets and standard deduction, FICA, Arizona's flat rate, itemising when it beats the standard deduction (SALT cap included, including its 2030 reversion), and interest deductibility tracked per loan. It is not tax or lending advice.

## Where the data lives

None of it is in this repository. The repo is code only.

```
passphrase ──PBKDF2 (fixed salt, 600k)──▶ 128-bit document id
passphrase ──PBKDF2 (random salt, 600k)─▶ AES-256-GCM key (memory only)
state ─▶ JSON ─▶ gzip ─▶ AES-GCM ─▶ Firestore  ledger/{id} = { v, salt, iv, ct, rev, ts }
```

- Everything is sealed in the browser before it leaves. The server only ever holds ciphertext.
- The document id is derived from the passphrase, so it can't be listed or guessed. The Firestore rule allows `get` by id, no `list`, no `delete`, and requires `rev` to advance by exactly one, so two devices can't silently overwrite each other.
- The sealed blob is also cached in `localStorage`, so the app opens offline and pushes edits made offline on the next unlock.
- The page locks itself after 15 idle minutes. A strict Content-Security-Policy limits network access to Firestore.
- A forgotten passphrase cannot be recovered. Download an encrypted backup from the Vault tab.

Uploaded statements never leave the browser; only the cleaned transaction list (date, amount, merchant, card) is stored, inside the vault.

## Setup (once)

Add the block in [`firestore.rules.snippet`](firestore.rules.snippet) inside `match /databases/{database}/documents { … }` in the Firebase console (Firestore → Rules) for the `bourbonffldraft` project, next to the existing blocks, and publish. Until then the app still works, saving to the browser only, and says so in the status pill.

## Starter numbers

A local, gitignored `starter-inputs.json` can pre-fill inputs. Load it from Vault → *Load a starter file*. Shape:

```json
{ "inputs": { "salary": 0, "curValue": 0, "curBalance": 0, "price": 0 } }
```

Never commit it. The plain-JSON export is likewise unencrypted and ignored by `.gitignore`.

## Develop

```
npx serve ledger --listen 3022
node test/model.test.mjs
node test/spending.test.mjs
```

`model.js` is pure (no DOM) and covered by the first test; `spending.js` by the second. Both use synthetic data.
