// ---------------------------------------------------------------------------
// Vault crypto. Everything the app stores is sealed in the browser first:
//
//   passphrase --PBKDF2(fixed app salt)-->  document id   (the only thing the
//                                           server ever sees besides ciphertext)
//   passphrase --PBKDF2(random salt)----->  AES-256-GCM key (never leaves memory)
//
// State is JSON -> gzip -> AES-GCM. The two derivations use different salts, so
// the id reveals nothing about the key. Web Crypto only; no dependencies.
// ---------------------------------------------------------------------------

const ITER = 600000;                       // OWASP 2023 floor for PBKDF2-SHA256
const ID_SALT = new TextEncoder().encode('ledger.doc-id.v1');
const AAD = new TextEncoder().encode('ledger.v1');
const enc = new TextEncoder();
const dec = new TextDecoder();

export const MIN_PASSPHRASE = 12;

export function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

async function baseKey(pass) {
  return crypto.subtle.importKey('raw', enc.encode(pass.normalize('NFKC')), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
}

export async function deriveId(pass) {
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: ID_SALT, iterations: ITER }, await baseKey(pass), 128);
  return hex(new Uint8Array(bits));
}

export async function deriveKey(pass, salt) {
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER },
    await baseKey(pass), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export const newSalt = () => crypto.getRandomValues(new Uint8Array(16));

async function pipe(bytes, stream) {
  const w = stream.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
const gzip = b => pipe(b, new CompressionStream('gzip'));
const gunzip = b => pipe(b, new DecompressionStream('gzip'));

export async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = await gzip(enc.encode(JSON.stringify(obj)));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, plain));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function open(key, ivB64, ctB64) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(ivB64), additionalData: AAD }, key, unb64(ctB64));
  return JSON.parse(dec.decode(await gunzip(new Uint8Array(plain))));
}

// A rough gate, not a meter: length is what protects an offline guess against
// the stored ciphertext, so that is what we insist on.
export function passphraseProblem(p) {
  if (p.length < MIN_PASSPHRASE) return `Use at least ${MIN_PASSPHRASE} characters — a few unrelated words works well.`;
  if (new Set(p).size < 6) return 'That has too few distinct characters.';
  return '';
}
