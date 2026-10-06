// ---------------------------------------------------------------------------
// Sync. One Firestore document per vault, ledger/{id}, holding only
//   { v, salt, iv, ct, rev, ts }   — ciphertext plus a revision counter.
// Talks to Firestore's REST endpoint directly (no SDK). The rules forbid list
// and delete, and require rev to advance by exactly one, so two devices can't
// silently overwrite each other; a lost race comes back as a conflict.
// The last sealed blob is also cached in localStorage so the app still opens
// offline, and edits made offline are pushed on the next unlock.
// ---------------------------------------------------------------------------

const PROJECT = 'bourbonffldraft';
const KEY = 'AIzaSyAp1tnKQKXJuE-XZrETMGX6yCM5XxYzOWg'; // public web key, same as the other sites
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/ledger`;
const CACHE = id => `ledger.blob.${id.slice(0, 12)}`;

const toFields = b => ({
  fields: {
    v: { integerValue: String(b.v) },
    salt: { stringValue: b.salt },
    iv: { stringValue: b.iv },
    ct: { stringValue: b.ct },
    rev: { integerValue: String(b.rev) },
    ts: { integerValue: String(b.ts) },
  },
});
const fromFields = d => {
  const f = d.fields || {};
  return {
    v: +f.v.integerValue, salt: f.salt.stringValue, iv: f.iv.stringValue,
    ct: f.ct.stringValue, rev: +f.rev.integerValue, ts: +f.ts.integerValue,
  };
};

export function readLocal(id) {
  try { return JSON.parse(localStorage.getItem(CACHE(id))); } catch { return null; }
}
export function writeLocal(id, blob, dirty) {
  try { localStorage.setItem(CACHE(id), JSON.stringify({ ...blob, dirty: !!dirty })); } catch { /* quota / private mode */ }
}
export function clearLocal() {
  try { Object.keys(localStorage).filter(k => k.startsWith('ledger.blob.')).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
}

// -> { blob } | { missing: true } | { error: 'denied' | 'offline' | string }
export async function pull(id) {
  let res;
  try { res = await fetch(`${BASE}/${id}?key=${KEY}`, { cache: 'no-store' }); }
  catch { return { error: 'offline' }; }
  if (res.status === 404) return { missing: true };
  if (res.status === 403) return { error: 'denied' };
  if (!res.ok) return { error: `http ${res.status}` };
  return { blob: fromFields(await res.json()) };
}

// -> { ok: true } | { conflict: true } | { error }
export async function push(id, blob, isNew) {
  let res;
  const q = `key=${KEY}` + (isNew ? '&currentDocument.exists=false' : '');
  try {
    res = await fetch(`${BASE}/${id}?${q}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toFields(blob)),
    });
  } catch { return { error: 'offline' }; }
  if (res.ok) return { ok: true };
  if (res.status === 409) return { conflict: true };
  if (res.status === 403) return isNew ? { error: 'denied' } : { conflict: true };
  return { error: `http ${res.status}` };
}
