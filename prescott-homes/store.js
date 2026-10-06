// ---------------------------------------------------------------------------
// Shared storage. Firestore (the bourbonffldraft project, collection
// `prescott`) when the rules allow it; otherwise this device's localStorage,
// with a banner so nobody thinks their notes are shared when they aren't.
//
//   prescott/plan                      visit order, day, booked times
//   prescott/{house}/notes/{id}        { by, text, ts }
//   prescott/{house}/photos/{id}       { by, caption, data (jpeg data URL), ts }
//   prescott/{house}/scores/{person}   { by, scores: {cat: 1-5}, ts }
// ---------------------------------------------------------------------------

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAp1tnKQKXJuE-XZrETMGX6yCM5XxYzOWg',
  authDomain: 'bourbonffldraft.firebaseapp.com',
  projectId: 'bourbonffldraft',
  storageBucket: 'bourbonffldraft.firebasestorage.app',
  messagingSenderId: '993985146902',
  appId: '1:993985146902:web:31441406f152d043f74537',
};
const ROOT = 'prescott';
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

let mode = 'local';
let db, fs;
const listeners = new Map(); // local-mode subscribers, keyed by path

export const isShared = () => mode === 'firestore';

export async function initStore() {
  try {
    const appMod = await import(SDK + 'firebase-app.js');
    fs = await import(SDK + 'firebase-firestore.js');
    db = fs.getFirestore(appMod.initializeApp(FIREBASE_CONFIG, 'prescott'));
    // A read proves the rules let us in; a denied read means the rule
    // hasn't been added yet, so fall back rather than fail every save.
    await fs.getDoc(fs.doc(db, ROOT, 'plan'));
    mode = 'firestore';
  } catch (err) {
    console.warn('Shared storage unavailable, using this device only:', err?.code || err);
    mode = 'local';
  }
  return mode;
}

// --- local fallback ---------------------------------------------------------

function lsGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem('ph:' + key)) ?? fallback; } catch { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem('ph:' + key, JSON.stringify(val)); return true; }
  catch { return false; }
}
function emit(key) {
  (listeners.get(key) || []).forEach(fn => fn(lsGet(key, key === 'plan' ? null : [])));
}
function localSub(key, fn, fallback) {
  if (!listeners.has(key)) listeners.set(key, []);
  listeners.get(key).push(fn);
  fn(lsGet(key, fallback));
  return () => listeners.set(key, listeners.get(key).filter(f => f !== fn));
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// --- plan -------------------------------------------------------------------

export function watchPlan(fn) {
  if (mode === 'local') return localSub('plan', fn, null);
  return fs.onSnapshot(fs.doc(db, ROOT, 'plan'), s => fn(s.exists() ? s.data() : null), e => console.error(e));
}
export async function savePlan(plan) {
  if (mode === 'local') { lsSet('plan', plan); emit('plan'); return; }
  await fs.setDoc(fs.doc(db, ROOT, 'plan'), plan);
}

// --- per-house lists (notes, photos) ----------------------------------------

export function watchList(house, kind, fn) {
  const key = `${house}/${kind}`;
  if (mode === 'local') return localSub(key, fn, []);
  const q = fs.query(fs.collection(db, ROOT, house, kind), fs.orderBy('ts', 'desc'));
  return fs.onSnapshot(q, s => fn(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => console.error(e));
}
export async function addItem(house, kind, item) {
  const rec = { ...item, ts: Date.now() };
  if (mode === 'local') {
    const key = `${house}/${kind}`;
    const list = lsGet(key, []);
    list.unshift({ id: uid(), ...rec });
    if (!lsSet(key, list)) throw new Error('This phone’s storage is full. Shared saving needs to be switched on for more photos.');
    emit(key);
    return;
  }
  await fs.addDoc(fs.collection(db, ROOT, house, kind), rec);
}
export async function removeItem(house, kind, id) {
  if (mode === 'local') {
    const key = `${house}/${kind}`;
    lsSet(key, lsGet(key, []).filter(x => x.id !== id));
    emit(key);
    return;
  }
  await fs.deleteDoc(fs.doc(db, ROOT, house, kind, id));
}

// --- scores (one doc per person per house) ----------------------------------

export function watchScores(house, fn) {
  const key = `${house}/scores`;
  if (mode === 'local') return localSub(key, fn, []);
  return fs.onSnapshot(fs.collection(db, ROOT, house, 'scores'), s => fn(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => console.error(e));
}
export async function saveScore(house, person, scores) {
  const id = person.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'anon';
  const rec = { by: person, scores, ts: Date.now() };
  if (mode === 'local') {
    const key = `${house}/scores`;
    const list = lsGet(key, []).filter(x => x.id !== id);
    list.push({ id, ...rec });
    lsSet(key, list);
    emit(key);
    return;
  }
  await fs.setDoc(fs.doc(db, ROOT, house, 'scores', id), rec);
}
