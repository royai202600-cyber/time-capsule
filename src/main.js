/* 時光膠囊 / Time Capsule: the app. Screens and look are ported from the prototype;
   data comes from Supabase. Capsule content is only ever returned by the server's
   open_capsule() function, once the open time (and, if set, the place) is reached. */
import './styles.css';
import 'leaflet/dist/leaflet.css';
import Leaflet from 'leaflet';
import qrcode from 'qrcode-generator';
import { createClient } from '@supabase/supabase-js';
import { IC, vessel, face, PORTRAITS } from './art.js';
import { LANG, L, setLangValue, STR, tr, vname, VESSELS } from './i18n.js';

// A password-reset link lands here with type=recovery in the URL; read it before the client clears it.
let recovering = /type=recovery/.test(location.hash + location.search);
const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

const DAY = 864e5, HOUR = 36e5, MIN = 6e4;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
function fmt(ms) {
  const d = new Date(ms); let h = d.getHours(); const ap = h < 12 ? 'am' : 'pm'; h = h % 12 || 12;
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(h)}:${pad(d.getMinutes())} ${ap}`;
}
const fmtDate = ms => { const d = new Date(ms); return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`; };
const md = ms => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()}`; };

/* ---------- State ---------- */
const S = {
  tab: 'in',
  user: null,          // Supabase auth user
  profile: null,       // my profile row
  people: new Map(),   // id -> { name, avatar }
  friends: [],         // friend ids
  inbox: [],
  sent: [],
  places: new Map(),   // id -> place row (name, lat, lng, radius_m)
  here: null,          // latest GPS fix { lat, lng, acc, at }
  geo: 'idle',         // idle | asking | ok | denied | none
  vessels: new Map(),  // id -> { price_mop, edition_total, brand }
  owned: new Map(),    // vessel id -> edition number (null if not numbered)
  stock: new Map(),    // limited vessel id -> how many are left
};
const pad3 = n => String(n).padStart(3, '0');
const owns = k => (S.vessels.get(k)?.price_mop ?? 0) === 0 || S.owned.has(k);
async function loadShop() {
  const [v, o, st] = await Promise.all([
    sb.from('vessels').select('*').order('sort'),
    sb.from('owned_vessels').select('vessel, edition_no'),
    sb.rpc('vessel_stock'),
  ]);
  if (v.error || o.error || st.error) { console.error(v.error || o.error || st.error); return; }
  S.vessels = new Map(v.data.map(r => [r.id, r]));
  S.owned = new Map(o.data.map(r => [r.vessel, r.edition_no]));
  S.stock = new Map(st.data.map(r => [r.vessel, r.remaining]));
}
const uid = () => S.user?.id;

const toCapsule = r => ({
  id: r.id, sender: r.sender, recipient: r.recipient, vessel: r.vessel, hint: r.hint,
  sealedAt: Date.parse(r.sealed_at), openAt: Date.parse(r.open_at),
  openedAt: r.opened_at ? Date.parse(r.opened_at) : null, opened: !!r.opened_at, isNew: !r.seen_at,
  place: r.place, handwritten: r.handwritten, edition: r.edition_no,
});

/* ---------- Places and the phone's location ---------- */
const plname = id => { const p = S.places.get(id); return p ? (LANG === 'zh' ? p.name_zh : p.name_en) : ''; };
const plwhy = id => { const p = S.places.get(id); return p ? (LANG === 'zh' ? p.why_zh : p.why_en) : ''; };
const plcity = id => { const p = S.places.get(id); return p ? (LANG === 'zh' ? p.city_zh : p.city_en) : ''; };
function meters(lat1, lng1, lat2, lng2) {
  const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}
// Metres from me to a place, or null while we don't know where I am.
function distTo(id) {
  const p = S.places.get(id);
  return p && S.here ? meters(S.here.lat, S.here.lng, p.lat, p.lng) : null;
}
const kmText = m => (m >= 100000 ? Math.round(m / 1000).toLocaleString() : (m / 1000).toFixed(1));
const atPlace = c => { const d = distTo(c.place); return d != null && d <= (S.places.get(c.place)?.radius_m ?? 100); };

let watchId = null, lastGeoRender = 0;
// Start watching GPS (asks permission the first time). Only called when a capsule needs a place.
function wantLocation() {
  if (watchId != null || S.geo === 'denied' || S.geo === 'none') return;
  // Development only: pretend to be somewhere. In the console: tcFakeGps(22.19383, 113.53999)
  if (import.meta.env.DEV) {
    const fake = (() => { try { return localStorage.getItem('tc-fake-gps'); } catch { return null; } })();
    window.tcFakeGps = (lat, lng) => {
      try { localStorage.setItem('tc-fake-gps', `${lat},${lng}`); } catch { /* */ }
      const before = S.here; S.here = { lat, lng, acc: 10, at: Date.now() }; S.geo = 'ok'; watchId = -1; onHere(before);
    };
    if (fake) { const [lat, lng] = fake.split(',').map(Number); return window.tcFakeGps(lat, lng); }
  }
  if (!navigator.geolocation) { S.geo = 'none'; return; }
  S.geo = 'asking';
  watchId = navigator.geolocation.watchPosition(pos => {
    const before = S.here;
    S.here = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, at: pos.timestamp };
    S.geo = 'ok';
    onHere(before);
  }, err => {
    console.warn('geolocation', err);
    S.geo = err.code === 1 ? 'denied' : 'none';
    navigator.geolocation.clearWatch(watchId); watchId = null;
    $$('.screen', app).forEach(x => x._render?.());
  }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
}
// New GPS fix: update maps and distances; fully redraw only when something changed state, or every 15 s.
function onHere(before) {
  const changed = !before || [...S.inbox].some(c => c.place && !c.opened &&
    (meters(before.lat, before.lng, S.places.get(c.place).lat, S.places.get(c.place).lng) <= S.places.get(c.place).radius_m) !== atPlace(c));
  $$('.screen', app).forEach(x => x._onHere?.());
  if (changed || Date.now() - lastGeoRender > 15000) {
    lastGeoRender = Date.now();
    if (home?.isConnected) renderHome();
    $$('.screen', app).filter(x => x !== home && x._geoRender).forEach(x => x._render?.());
  }
}

/* 'future' is the recipient choice for a capsule to yourself. */
function pname(id) {
  if (id === 'future') return tr('future');
  if (id === uid()) return S.profile?.name || tr('me');
  return S.people.get(id)?.name || '…';
}
const avatar = (id, cls = '') => {
  const p = id === 'future' || id === uid() ? S.profile : S.people.get(id);
  return `<span class="av ${cls}" aria-hidden="true">${face(p?.avatar, id === 'future')}</span>`;
};

function status(c, side) {
  if (c.opened) return 'opened';
  if (c.openAt > Date.now()) return 'time';
  if (side === 'out') return 'waiting';
  if (c.place && !atPlace(c)) return 'place';
  return 'ready';
}
function remain(ms) {
  let n, u;
  if (ms >= DAY) { n = Math.ceil(ms / DAY); u = 'd'; }
  else if (ms >= HOUR) { n = Math.ceil(ms / HOUR); u = 'h'; }
  else { n = Math.max(1, Math.ceil(ms / MIN)); u = 'm'; }
  return { n, u: unitWord(n, u) };
}
const unitWord = (n, u) => LANG === 'zh'
  ? { d: '天', h: '小時', m: '分鐘' }[u]
  : { d: n === 1 ? 'day' : 'days', h: n === 1 ? 'hour' : 'hours', m: 'min' }[u];
const quote = s => (LANG === 'zh' ? `「${s}」` : `“${s}”`);
const paras = s => esc(s).split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
const findCapsule = id => S.inbox.find(c => c.id === id) || S.sent.find(c => c.id === id);
const bar = (title, btn = 'back') =>
  `<header class="bar"><button class="icon-btn" data-act="${btn}" aria-label="${tr(btn)}">${btn === 'back' ? IC.back : IC.close}</button><h1>${title}</h1><span></span></header>`;

/* ---------- Data ---------- */
async function loadAll() {
  const me = uid();
  const [caps, fr] = await Promise.all([
    sb.from('capsules').select('*'),
    sb.from('friendships').select('friend_id, created_at').order('created_at'),
  ]);
  if (caps.error) throw caps.error;
  if (fr.error) throw fr.error;
  const rows = caps.data.map(toCapsule);
  // Keep content we already fetched for opened capsules.
  const old = new Map([...S.inbox, ...S.sent].map(c => [c.id, c]));
  rows.forEach(c => { const o = old.get(c.id); if (o?.opened && o.message !== undefined) { c.message = o.message; c.drawing = o.drawing; c.photo = o.photo; c.gift = o.gift; } });
  S.friends = fr.data.map(f => f.friend_id);
  const ids = new Set(S.friends);
  rows.forEach(c => { ids.add(c.sender); ids.add(c.recipient); });
  ids.delete(me);
  if (ids.size) {
    const { data, error } = await sb.from('profiles').select('id, name, avatar').in('id', [...ids]);
    if (error) throw error;
    data.forEach(p => S.people.set(p.id, p));
  }
  const rank = c => ({ ready: 0, place: 1, time: 2, opened: 3 }[status(c, 'in')]);
  S.inbox = rows.filter(c => c.recipient === me)
    .sort((a, b) => rank(a) - rank(b) || (rank(a) === 3 ? b.openedAt - a.openedAt : a.openAt - b.openAt));
  S.sent = rows.filter(c => c.sender === me).sort((a, b) => b.sealedAt - a.sealedAt);
}
async function refresh() {
  try { await loadAll(); } catch (e) { console.error(e); return; }
  if (home?.isConnected) renderHome();
}

/* ---------- Screen stack ---------- */
const app = $('#app');
let home;
function push(anim = 'push') {
  const s = document.createElement('section');
  s.className = `screen ${anim}-in`;
  s.dataset.anim = anim;
  app.appendChild(s);
  s.addEventListener('animationend', e => { if (e.target === s) s.classList.remove(`${anim}-in`); }, { once: true });
  return s;
}
function pop(s = app.lastElementChild) {
  if (!s || s === home || s.dataset.root) return;
  s.classList.add(s.dataset.anim === 'sheet' ? 'sheet-out' : 'pop-out');
  setTimeout(() => s.remove(), REDUCED ? 0 : 280);
}
/* Replace everything with one root screen (sign-in, first profile setup, or home). */
function root(cls = '') {
  app.innerHTML = '';
  home = null;
  const s = document.createElement('section');
  s.className = `screen ${cls}`;
  s.dataset.root = '1';
  app.appendChild(s);
  return s;
}
let toastT;
function toast(m) {
  const el = $('#toast'); el.textContent = m; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ---------- Language ---------- */
function applyLang() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-Hant' : 'en';
  document.title = tr('appName');
}
function setLang(l) {
  setLangValue(l);
  applyLang();
  $$('.screen', app).forEach(s => s._render?.());
}
const langBtn = () => `<button class="lang-btn" data-act="lang" aria-label="${tr('langAria')}">${tr('langBtn')}</button>`;

/* ---------- Sign in: email + password (verified by email), or Google ---------- */
// Google's standard "G" mark, as their sign-in branding guidelines ask.
const GOOGLE_G = '<svg class="ic" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
// Errors from Supabase Auth, shown in the user's language.
function authError(error) {
  const c = error?.code || '';
  if (c === 'invalid_credentials') return tr('badLogin');
  if (c === 'weak_password') return tr('weakPw');
  if (c.includes('rate_limit')) return tr('rateLimit');
  if (c === 'user_already_exists' || c === 'email_exists') return tr('alreadyExists');
  if (c === 'email_address_invalid') return tr('emailInvalid');
  if (c === 'email_address_not_authorized') return tr('emailNotAllowed');
  return tr('errGeneric');
}
const PW_MIN = 8;
const validEmail = e => /^\S+@\S+\.\S+$/.test(e);

/* mode: signin | signup | forgot | check (kind: verify | reset) */
function showSignIn(inviter, mode = 'signin') {
  const s = root('auth');
  const st = { mode, kind: '', email: '', busy: false, err: '', note: '', showPw: false };
  const pwField = (label, auto) => `<label class="field"><span>${label}</span>
      <span class="pw-wrap"><input id="pw" type="${st.showPw ? 'text' : 'password'}" autocomplete="${auto}" minlength="${PW_MIN}" required>
      <button type="button" class="pw-toggle" data-act="showpw">${tr(st.showPw ? 'hidePw' : 'showPw')}</button></span></label>`;
  const emailField = () => `<label class="field"><span>${tr('emailLabel')}</span><input id="email" type="email" autocomplete="email" inputmode="email" required value="${esc(st.email)}" placeholder="you@example.com"></label>`;
  const body = () => {
    if (st.mode === 'check') return `<div class="auth-form check">
        <h2>${tr('checkH')}</h2>
        <p class="sub">${esc(tr(st.kind === 'verify' ? 'checkVerify' : 'checkReset', st.email))}</p>
        ${st.kind === 'verify' ? `<button type="button" class="btn ghost" data-act="resend" ${st.busy ? 'disabled' : ''}>${tr('resend')}</button>` : ''}
        <button type="button" class="link" data-act="signin">${tr('backToSignIn')}</button>
        <p class="err" role="alert">${esc(st.err)}</p><p class="ok-note" role="status">${esc(st.note)}</p></div>`;
    if (st.mode === 'forgot') return `<form class="auth-form" novalidate>
        <h2>${tr('forgotH')}</h2><p class="sub">${tr('forgotSub')}</p>
        ${emailField()}
        <button class="btn" ${st.busy ? 'disabled' : ''}>${tr('sendReset')}</button>
        <button type="button" class="link" data-act="signin">${tr('backToSignIn')}</button>
        <p class="err" role="alert">${esc(st.err)}</p></form>`;
    const up = st.mode === 'signup';
    return `<button type="button" class="btn google" data-act="google">${GOOGLE_G}<span>${tr('google')}</span></button>
      <p class="or"><span>${tr('orEmail')}</span></p>
      <div class="seg small auth-seg" role="tablist">
        <button type="button" role="tab" aria-selected="${!up}" data-act="signin">${tr('signInTab')}</button>
        <button type="button" role="tab" aria-selected="${up}" data-act="signup">${tr('signUpTab')}</button>
      </div>
      <form class="auth-form" novalidate>
        ${emailField()}
        ${pwField(up ? tr('pwNewLabel', PW_MIN) : tr('pwLabel'), up ? 'new-password' : 'current-password')}
        <button class="btn" ${st.busy ? 'disabled' : ''}>${tr(up ? 'signUpBtn' : 'signInBtn')}</button>
        ${up ? '' : `<button type="button" class="link" data-act="forgot">${tr('forgot')}</button>`}
        <p class="err" role="alert">${esc(st.err)}</p>
      </form>`;
  };
  const render = () => {
    // Keep what was typed when the screen redraws (language switch, show password).
    const typed = { email: $('#email', s)?.value, pw: $('#pw', s)?.value };
    if (typed.email != null) st.email = typed.email.trim();
    s.innerHTML = `<div class="auth-top">${langBtn()}</div>
    <div class="scroll auth-body">
      <div class="auth-vessel">${vessel('dome')}</div>
      <h1 class="auth-title">${tr('appName')}</h1>
      <p class="tagline">${tr('tagline')}</p>
      ${inviter ? `<p class="invite-banner"><span class="av">${face(inviter.avatar)}</span>${esc(tr('inviteBanner', inviter.name))}</p>` : ''}
      ${body()}
    </div>`;
    if (typed.pw && $('#pw', s)) $('#pw', s).value = typed.pw;
  };
  const go = m => { st.mode = m; st.err = ''; st.note = ''; render(); };
  s._render = render;
  s.addEventListener('click', async e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'lang') setLang(LANG === 'zh' ? 'en' : 'zh');
    else if (a === 'signin' || a === 'signup' || a === 'forgot') go(a);
    else if (a === 'showpw') { st.showPw = !st.showPw; render(); $('#pw', s)?.focus(); }
    else if (a === 'google') {
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/` } });
      if (error) { console.error(error); st.err = tr('errGeneric'); render(); }
    } else if (a === 'resend') {
      st.busy = true; st.err = ''; st.note = ''; render();
      const { error } = await sb.auth.resend({ type: 'signup', email: st.email, options: { emailRedirectTo: `${location.origin}/` } });
      st.busy = false;
      if (error) { console.error(error); st.err = authError(error); } else st.note = tr('resent');
      render();
    }
  });
  s.addEventListener('submit', async e => {
    e.preventDefault();
    if (st.busy) return;
    const email = $('#email', s).value.trim(), pw = $('#pw', s)?.value || '';
    st.email = email; st.err = '';
    if (!validEmail(email)) { st.err = tr('emailInvalid'); render(); return; }
    if (st.mode !== 'forgot' && st.mode === 'signup' && pw.length < PW_MIN) { st.err = tr('weakPw', PW_MIN); render(); $('#pw', s).value = pw; return; }
    if (st.mode === 'signin' && !pw) { $('#pw', s).focus(); return; }
    st.busy = true; render();
    if (st.mode === 'signup') {
      const { data, error } = await sb.auth.signUp({ email, password: pw, options: { emailRedirectTo: `${location.origin}/` } });
      st.busy = false;
      if (error) { console.error(error); st.err = authError(error); render(); return; }
      // Supabase hides whether an address exists: an existing account comes back with no identities.
      if (data.user && !data.user.identities?.length) { st.mode = 'signin'; st.err = tr('alreadyExists'); render(); return; }
      if (data.session) return start(); // email verification turned off
      st.mode = 'check'; st.kind = 'verify'; render();
    } else if (st.mode === 'signin') {
      const { error } = await sb.auth.signInWithPassword({ email, password: pw });
      st.busy = false;
      if (error?.code === 'email_not_confirmed') { st.mode = 'check'; st.kind = 'verify'; st.err = tr('notConfirmed'); render(); return; }
      if (error) { console.error(error); st.err = authError(error); render(); return; }
      start();
    } else {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/` });
      st.busy = false;
      if (error) { console.error(error); st.err = authError(error); render(); return; }
      st.mode = 'check'; st.kind = 'reset'; render();
    }
  });
  render();
}

/* After tapping the reset link in the email: choose a new password. */
function showNewPassword() {
  const s = root('auth');
  const st = { busy: false, err: '', showPw: false };
  const render = () => {
    const pw = $('#pw', s)?.value;
    s.innerHTML = `<div class="auth-top">${langBtn()}</div>
    <div class="scroll auth-body">
      <div class="auth-vessel">${vessel('envelope')}</div>
      <form class="auth-form" novalidate>
        <h2>${tr('newPwH')}</h2>
        <label class="field"><span>${tr('pwNewLabel', PW_MIN)}</span>
          <span class="pw-wrap"><input id="pw" type="${st.showPw ? 'text' : 'password'}" autocomplete="new-password" minlength="${PW_MIN}" required>
          <button type="button" class="pw-toggle" data-act="showpw">${tr(st.showPw ? 'hidePw' : 'showPw')}</button></span></label>
        <button class="btn" ${st.busy ? 'disabled' : ''}>${tr('newPwBtn')}</button>
        <p class="err" role="alert">${esc(st.err)}</p>
      </form>
    </div>`;
    if (pw) $('#pw', s).value = pw;
  };
  s._render = render;
  s.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'lang') setLang(LANG === 'zh' ? 'en' : 'zh');
    if (a === 'showpw') { st.showPw = !st.showPw; render(); }
  });
  s.addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('#pw', s).value;
    if (pw.length < PW_MIN) { st.err = tr('weakPw', PW_MIN); render(); return; }
    st.busy = true; st.err = ''; render();
    const { error } = await sb.auth.updateUser({ password: pw });
    st.busy = false;
    if (error) { console.error(error); st.err = authError(error); render(); return; }
    recovering = false;
    toast(tr('pwUpdated'));
    start();
  });
  render();
}

/* ---------- Profile (name + illustrated portrait) ---------- */
function profileForm(s, { first, onDone }) {
  const d = {
    name: S.profile?.name || S.user?.user_metadata?.full_name || S.user?.user_metadata?.name || '',
    city: S.profile?.city || '',
    pick: Math.max(0, PORTRAITS.findIndex(p => JSON.stringify(p) === JSON.stringify(S.profile?.avatar))),
    busy: false,
  };
  const render = () => {
    s.innerHTML = `${first ? `<div class="auth-top">${langBtn()}</div>` : bar(tr('editProfile'))}
    <form class="scroll create-body profile-form" novalidate>
      <h2>${tr('profileH')}</h2><p class="sub">${tr('profileSub')}</p>
      <div class="profile-preview"><span class="av xl">${face(PORTRAITS[d.pick])}</span></div>
      <label class="field"><span>${tr('nameLabel')}</span><input id="pname" maxlength="40" autocomplete="nickname" value="${esc(d.name)}" placeholder="${tr('namePh')}"></label>
      <label class="field"><span>${tr('cityLabel')}</span><input id="pcity" maxlength="40" autocomplete="address-level2" value="${esc(d.city)}" placeholder="${tr('cityPh')}"></label>
      <h3>${tr('pickFace')}</h3>
      <div class="faces" role="radiogroup" aria-label="${tr('pickFace')}">${PORTRAITS.map((p, i) =>
        `<button type="button" role="radio" aria-checked="${i === d.pick}" class="face-opt ${i === d.pick ? 'sel' : ''}" data-face="${i}"><span class="av">${face(p)}</span></button>`).join('')}</div>
      <button class="btn save-btn" ${d.name.trim() && !d.busy ? '' : 'disabled'}>${tr('save')}</button>
    </form>`;
  };
  s._render = render;
  s.addEventListener('input', e => {
    if (e.target.id === 'pcity') { d.city = e.target.value; return; }
    if (e.target.id !== 'pname') return;
    d.name = e.target.value;
    $('.save-btn', s).disabled = !d.name.trim();
  });
  s.addEventListener('click', e => {
    const f = e.target.closest('[data-face]');
    if (f) { d.pick = +f.dataset.face; render(); return; }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'lang') setLang(LANG === 'zh' ? 'en' : 'zh');
    if (a === 'back') pop(s);
  });
  s.addEventListener('submit', async e => {
    e.preventDefault();
    const name = d.name.trim();
    if (!name || d.busy) return;
    d.busy = true; render();
    const row = { id: uid(), name, avatar: PORTRAITS[d.pick], city: d.city.trim() || null };
    const { data, error } = await sb.from('profiles').upsert(row).select().single();
    d.busy = false;
    if (error) { console.error(error); toast(tr('errGeneric')); render(); return; }
    S.profile = data;
    onDone();
  });
  render();
}

/* ---------- Home ---------- */
function cardHTML(c, side) {
  const st = status(c, side);
  const who = side === 'in' ? c.sender : (c.recipient === uid() ? 'future' : c.recipient);
  let head;
  if (st === 'time') { const r = remain(c.openAt - Date.now()); head = tr('headTime', r.n, r.u); }
  else if (st === 'place') { const d = distTo(c.place); head = d == null ? tr('headNeedPlace') : tr('headPlace', kmText(d)); }
  else if (st === 'ready') head = tr('ready');
  else if (st === 'waiting') head = tr('waiting');
  else head = tr(side === 'in' ? 'openedIn' : 'openedOut', md(c.openedAt));
  return `<button class="card st-${st}" data-id="${c.id}" aria-label="${esc(tr('cardAria', side, pname(who)))}">
    ${side === 'in' && c.isNew && !c.opened ? '<span class="tag">NEW</span>' : ''}
    ${c.handwritten ? `<span class="seal-mark" title="${tr('handMarkTitle')}">${tr('handMark')}</span>` : ''}
    ${c.edition ? `<span class="ed">${esc(S.vessels.get(c.vessel)?.brand || '')} No.${pad3(c.edition)}</span>` : ''}
    ${vessel(c.vessel)}
    <p class="head"><span>${head}</span></p>
    <p class="place">${IC.pin}<span>${c.place ? esc(plname(c.place)) : tr('anywhere')}</span></p>
    <div class="meta"><span class="who">${tr(side === 'in' ? 'from' : 'to')} ${avatar(who)} ${esc(pname(who))}</span><time>${fmt(c.sealedAt)}</time></div>
  </button>`;
}
function renderHome() {
  const side = S.tab, list = side === 'in' ? S.inbox : S.sent;
  if (S.inbox.some(c => c.place && !c.opened)) wantLocation();
  const ready = list.filter(c => status(c, side) === 'ready').length;
  const summary = list.length
    ? (side === 'in' ? tr('summaryIn', list.length, ready) : tr('summaryOut', list.length, list.filter(c => !c.opened).length))
    : '';
  const keep = $('#rail', home)?.scrollLeft || 0;
  home.innerHTML = `
    <header class="home-top">
      <button class="me-btn" data-act="me">${avatar(uid())}<span>${tr('my')}</span></button>
      <div class="seg" role="tablist">
        <button role="tab" aria-selected="${side === 'in'}" data-tab="in">${tr('inbox')}</button>
        <button role="tab" aria-selected="${side === 'out'}" data-tab="out">${tr('sent')}</button>
      </div>
      <div class="top-r">${langBtn()}<button class="icon-btn" data-act="shop" aria-label="${tr('shop')}">${IC.shop}</button></div>
    </header>
    <div class="rail" id="rail">${list.length ? list.map(c => cardHTML(c, side)).join('')
      : `<div class="card empty">${vessel(side === 'in' ? 'bottle' : 'envelope')}<p class="head">${tr(side === 'in' ? 'emptyIn' : 'emptyOut')}</p></div>`}</div>
    <div class="dots" aria-hidden="true">${list.length > 1 ? list.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('') : ''}</div>
    <p class="summary">${summary}</p>
    <button class="fab" data-act="create" aria-label="${tr('newCapsule')}">${IC.plus}</button>`;
  const rail = $('#rail', home);
  rail.scrollLeft = keep;
  rail.addEventListener('scroll', () => updateRail(rail), { passive: true });
  requestAnimationFrame(() => updateRail(rail));
}
function updateRail(rail) {
  const r = rail.getBoundingClientRect(), cx = r.left + r.width / 2;
  let bi = 0, bd = Infinity;
  [...rail.children].forEach((el, i) => {
    const w = el.offsetWidth, center = el.offsetLeft - rail.scrollLeft + w / 2 + r.left;
    const off = (center - cx) / w, d = Math.min(1, Math.abs(off));
    el.style.transform = `scale(${1 - d * 0.1})`;
    el.style.opacity = String(1 - d * 0.5);
    el.classList.toggle('center', d < 0.2);
    if (Math.abs(off) < bd) { bd = Math.abs(off); bi = i; }
  });
  $$('.dots i', home).forEach((d, i) => d.classList.toggle('on', i === bi));
}
function initHome() {
  home = root('home');
  home._render = renderHome;
  home.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { S.tab = tab.dataset.tab; $('#rail', home).scrollLeft = 0; renderHome(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'me') return openMe();
    if (act === 'create') return openCreate();
    if (act === 'shop') return openShop();
    if (act === 'lang') return setLang(LANG === 'zh' ? 'en' : 'zh');
    const card = e.target.closest('.card[data-id]');
    if (card) {
      const rail = card.parentElement;
      if (!card.classList.contains('center')) {
        rail.scrollTo({ left: card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2, behavior: REDUCED ? 'auto' : 'smooth' });
        return;
      }
      openCapsule(card.dataset.id, S.tab);
    }
  });
  renderHome();
}

/* ---------- Capsule: opening pages ---------- */
function cdParts(ms) {
  ms = Math.max(0, ms);
  const d = Math.floor(ms / DAY); ms -= d * DAY;
  const h = Math.floor(ms / HOUR); ms -= h * HOUR;
  const m = Math.floor(ms / MIN); ms -= m * MIN;
  return { d, h: pad(h), m: pad(m), s: pad(Math.floor(ms / 1000)) };
}
function countdownHTML(c) {
  const p = cdParts(c.openAt - Date.now());
  const labels = LANG === 'zh' ? ['天', '時', '分', '秒'] : ['days', 'hrs', 'min', 'sec'];
  return `<div class="cd" data-cd="${c.openAt}" role="timer" aria-label="${tr('timerAria')}">${['d', 'h', 'm', 's']
    .map((k, i) => `<div><b data-u="${k}">${p[k]}</b><small>${labels[i]}</small></div>`).join('')}</div>`;
}
// Tick countdowns; when one reaches zero, redraw so the capsule becomes openable.
setInterval(() => {
  let due = false;
  $$('[data-cd]').forEach(el => {
    const left = +el.dataset.cd - Date.now();
    const p = cdParts(left);
    $$('[data-u]', el).forEach(b => { b.textContent = p[b.dataset.u]; });
    if (left <= 0 && !el.dataset.done) { el.dataset.done = '1'; due = true; }
  });
  if (due) $$('.screen', app).forEach(s => s._render?.());
}, 1000);
// Home headlines ("opens in N days") also change over time.
setInterval(() => { if (home?.isConnected && app.lastElementChild === home) renderHome(); }, 30000);

function actionHTML(c, st) {
  if (st === 'time') {
    const r = remain(c.openAt - Date.now());
    return `<button class="btn" disabled>${tr('waitBtn', r.n, r.u)}</button>`;
  }
  if (st === 'place') return `<button class="btn" disabled>${tr('needPlace')}</button>${geoNote()}`;
  return `<button class="btn hold" data-act="hold"><span>${tr('hold')}</span></button><p class="tiny">${tr('holdNote')}</p>`;
}

// What we know about the phone's location, for the place pages.
function geoNote() {
  if (S.geo === 'denied') return `<p class="tiny warn">${tr('geoDenied')}</p>`;
  if (S.geo === 'none') return `<p class="tiny warn">${tr('geoNone')}</p>`;
  if (!S.here) return `<p class="tiny">${tr('locating')}</p>`;
  return '';
}
function distLine(c) {
  const d = distTo(c.place);
  if (d == null) return geoNote();
  return `<p class="dist">${atPlace(c) ? tr('here') : tr('distFar', kmText(d))}</p>`;
}

const editionPill = c => {
  const V = S.vessels.get(c.vessel);
  return V?.brand && c.edition ? `<p class="edition">${tr('edition', esc(V.brand), pad3(c.edition), V.edition_total)}</p>` : '';
};
function pagerView(c, st) {
  const timeOk = c.openAt <= Date.now();
  const from = `<p class="from">${tr('from')} ${avatar(c.sender)} ${esc(pname(c.sender))}</p>`;
  const place = c.place ? esc(plname(c.place)) : '';
  const story = timeOk
    ? tr('storyArrived', fmt(c.sealedAt), Math.round((c.openAt - c.sealedAt) / DAY), fmt(c.openAt)) + (c.place ? tr(st === 'ready' ? 'storyHere' : 'storyGo') : tr('storyNow'))
    : (() => { const r = remain(c.openAt - Date.now()); return tr('storyWaiting', fmt(c.sealedAt), Math.floor((Date.now() - c.sealedAt) / DAY), r.n, r.u, fmt(c.openAt)); })();
  const hint = c.hint || tr('defaultHint');
  const openPage = c.place ? 2 : 1;
  const pages = [
    `${from}${c.handwritten ? `<span class="seal-mark page-mark">${tr('handMark')}</span>` : ''}${editionPill(c)}<div class="p-vessel">${vessel(c.vessel)}</div><p class="story">${story}</p>
      ${timeOk ? '' : countdownHTML(c)}
      ${c.place
        ? `<div class="go"><span>${tr(timeOk ? 'goNow' : 'goLater')}</span><button class="place-link" data-goto="1">${IC.pin}${place}</button></div>`
        : (timeOk ? `<div class="go"><button class="btn" data-goto="1">${tr('goOpen')}</button></div>` : '')}`,
  ];
  if (c.place) pages.push(`${from}<div class="map real" aria-label="${esc(tr('mapAria', plname(c.place)))}"></div>
      <p class="map-name">${IC.pin}${place}</p>
      <p class="city">${esc(plcity(c.place))}</p>
      <div class="dist-wrap">${distLine(c)}</div>
      <div class="row"><button class="btn ghost" data-act="nav">${tr('nav')}</button>${st === 'ready' ? `<button class="btn" data-goto="${openPage}">${tr('goOpen')}</button>` : ''}</div>`);
  pages.push(`${from}
      <div class="stage st-${st}"><div class="halo"></div>${vessel(c.vessel)}</div>
      <ul class="conds">
        <li class="${timeOk ? 'ok' : ''}">${timeOk ? IC.check : IC.lock}<div><b>${tr('condTime')}</b><span>${fmt(c.openAt)}</span></div></li>
        ${c.place ? `<li class="${atPlace(c) ? 'ok' : ''}">${atPlace(c) ? IC.check : IC.lock}<div><b>${tr('condPlace')}</b><span>${place}${!atPlace(c) && distTo(c.place) != null ? tr('stillKm', kmText(distTo(c.place))) : ''}</span></div></li>` : ''}
      </ul>
      <blockquote class="hint">${quote(esc(hint))}<cite>${esc(tr('hintBy', pname(c.sender)))}</cite></blockquote>
      ${S.vessels.get(c.vessel)?.brand && S.places.get(c.place)?.brand_vessel === c.vessel ? `<p class="note">${tr('brandNote')}</p>` : ''}
      ${actionHTML(c, st)}`);
  return `${bar(tr('openTitle'))}
    <div class="pager">${pages.map((p, i) => `<section class="page" aria-label="${tr('page', i + 1)}"><div class="paper">${p}<span class="pno">${i + 1}</span></div></section>`).join('')}</div>
    <div class="pdots" aria-hidden="true">${pages.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>`;
}

/* Real map (OpenStreetMap) with the vessel as the pin, the 100 m circle, and you. */
function initMap(s, c) {
  const el = $('.map.real', s), p = S.places.get(c.place);
  if (!el || !p) return;
  const m = Leaflet.map(el, { zoomControl: false, attributionControl: true }).setView([p.lat, p.lng], 16);
  m.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  Leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  Leaflet.circle([p.lat, p.lng], { radius: p.radius_m, color: '#2f5d8a', weight: 1.5, fillColor: '#5a8fd0', fillOpacity: 0.12 }).addTo(m);
  const icon = Leaflet.divIcon({ className: 'vessel-pin', html: `<div class="pin-body">${vessel(c.vessel)}</div>`, iconSize: [58, 66], iconAnchor: [29, 66] });
  Leaflet.marker([p.lat, p.lng], { icon, keyboard: false }).addTo(m);
  s._map = { m, me: null, line: null, fitted: false };
  setTimeout(() => m.invalidateSize(), 350);
  updateMapHere(s, c);
}
function updateMapHere(s, c) {
  const mm = s._map, p = S.places.get(c.place);
  if (!mm || !S.here || !p) return;
  const me = [S.here.lat, S.here.lng], dest = [p.lat, p.lng];
  if (!mm.me) {
    mm.line = Leaflet.polyline([me, dest], { color: '#2f5d8a', weight: 3, dashArray: '2 8' }).addTo(mm.m);
    mm.me = Leaflet.circleMarker(me, { radius: 7, color: '#fff', weight: 3, fillColor: '#5a8fd0', fillOpacity: 1 }).addTo(mm.m);
  } else { mm.me.setLatLng(me); mm.line.setLatLngs([me, dest]); }
  // Zoom out to show both only when you're within a city's reach; otherwise keep the place in view.
  if (!mm.fitted && distTo(c.place) < 50000) { mm.fitted = true; mm.m.fitBounds(Leaflet.latLngBounds([me, dest]).pad(0.3)); }
}

function letterView(c) {
  const self = c.sender === uid();
  return `${bar(self ? tr('letterSelf') : tr('letterFrom', esc(pname(c.sender))))}
  <div class="scroll">
    <div class="opened-stage">${vessel(c.vessel)}</div>
    <article class="letter ${c.handwritten ? 'hand' : ''}">
      ${c.handwritten ? `<span class="seal-mark">${tr('handMark')}</span>` : ''}
      ${c.message === undefined ? `<p class="sub">${tr('loading')}</p>` : ''}
      ${c.drawing ? `<img class="drawing" src="${esc(c.drawing)}" alt="${tr('handAlt')}">` : ''}
      ${c.message ? paras(c.message) : ''}
      ${c.photo ? `<figure class="photo"><img src="${esc(c.photo)}" alt="${tr('photoAlt')}"></figure>` : ''}
      <p class="sign">${esc(self ? tr('pastMe') : pname(c.sender))}<br><time>${tr('sealedOn', fmt(c.sealedAt))}</time></p>
    </article>
    ${c.gift ? `<section class="gift" aria-label="${tr('giftAria')}">
      <div><p class="brand">${tr('giftHead', esc(S.vessels.get(c.vessel)?.brand || ''))}</p><h3>${tr('giftItemDemo')}</h3><p class="code">${esc(c.gift)}</p>
      <p>${tr('giftNote')}</p></div>${qrSVG(c.gift)}</section>` : ''}
    <p class="opened-at">${tr('openedRecord', fmt(c.openedAt), c.place ? esc(plname(c.place)) : '')}</p>
    <button class="btn ghost" data-act="reply">${self ? tr('replySelf') : tr('replyTo', esc(pname(c.sender)))}</button>
  </div>`;
}

// A real, scannable QR code for the gift pickup code.
function qrSVG(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return `<span class="qr" role="img" aria-label="${tr('qrAria')}">${q.createSvgTag({ cellSize: 3, margin: 0, scalable: true })}</span>`;
}
function sentView(c, st) {
  const now = Date.now();
  const to = esc(pname(c.recipient === uid() ? 'future' : c.recipient));
  return `${bar(tr('sentTitle', to))}
  <div class="scroll">
    <div class="stage"><div class="halo"></div>${vessel(c.vessel)}</div>
    <p class="vname">${esc(vname(c.vessel))}</p>
    ${st === 'time' ? countdownHTML(c) : ''}
    <ol class="timeline">
      <li class="done"><b>${tr('tlSealed')}</b><span>${fmt(c.sealedAt)}</span></li>
      <li class="${c.openAt <= now ? 'done' : ''}"><b>${tr('tlDeliver', to)}</b><span>${fmt(c.openAt)}</span></li>
      <li class="${c.opened ? 'done' : ''}"><b>${tr('tlOpen', to)}</b><span>${c.opened ? fmt(c.openedAt) + (c.place ? tr('tlAt', esc(plname(c.place))) : '') : (c.place ? tr('tlNeedPlace', esc(plname(c.place))) : tr('tlAnytime'))}</span></li>
    </ol>
    <div class="sealed-box"><div class="blur-lines" aria-hidden="true"><i></i><i></i><i></i><i></i></div>${tr('sealedBox')}</div>
    <blockquote class="hint">${quote(esc(c.hint || tr('defaultHint')))}<cite>${tr('yourHint')}</cite></blockquote>
  </div>`;
}

function openCapsule(id, side) {
  const c = findCapsule(id);
  if (!c) return;
  side ??= S.inbox.includes(c) ? 'in' : 'out';
  const s = push();
  s._render = () => {
    const pg = $('.pager', s);
    renderCapsule(s, c, side, pg ? Math.round(pg.scrollLeft / pg.clientWidth) : 0);
  };
  renderCapsule(s, c, side);
  if (side === 'in' && c.isNew) {
    c.isNew = false;
    sb.rpc('mark_seen', { p_id: c.id }).then(({ error }) => { if (error) console.error(error); else renderHome(); });
  }
}
function renderCapsule(s, c, side, page = 0) {
  const st = status(c, side);
  s._map?.m.remove(); s._map = null;
  s.innerHTML = side === 'out' ? sentView(c, st) : st === 'opened' ? letterView(c) : pagerView(c, st);
  if (side === 'in' && st === 'opened' && c.message === undefined) fetchContent(s, c);
  // Place capsules: watch GPS, keep the map and distance live, redraw when you arrive or leave.
  s._geoRender = side === 'in' && !!c.place && st !== 'opened';
  s._onHere = null;
  if (s._geoRender) {
    wantLocation();
    initMap(s, c);
    s._onHere = () => { updateMapHere(s, c); const w = $('.dist-wrap', s); if (w) w.innerHTML = distLine(c); };
  }
  const pg = $('.pager', s);
  if (pg) {
    page = Math.min(page, $$('.page', s).length - 1);
    pg.scrollLeft = pg.clientWidth * page;
    pg.addEventListener('scroll', () => {
      const i = Math.round(pg.scrollLeft / pg.clientWidth);
      $$('.pdots i', s).forEach((d, j) => d.classList.toggle('on', i === j));
    }, { passive: true });
    $$('.pdots i', s).forEach((d, j) => d.classList.toggle('on', j === page));
  }
  s.onclick = e => {
    const g = e.target.closest('[data-goto]');
    if (g && pg) { pg.scrollTo({ left: pg.clientWidth * +g.dataset.goto, behavior: REDUCED ? 'auto' : 'smooth' }); return; }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'back') pop(s);
    else if (a === 'reply') openCreate(c.sender === uid() ? 'future' : c.sender);
    else if (a === 'nav') {
      const p = S.places.get(c.place);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`, '_blank', 'noopener');
    }
  };
  const hb = $('.hold', s);
  if (hb) bindHold(hb, () => openIt(s, c));
}
async function fetchContent(s, c) {
  const { data, error } = await sb.rpc('open_capsule', { p_id: c.id });
  if (error || !data?.[0]) { console.error(error); toast(tr('errGeneric')); return; }
  c.message = data[0].message; c.drawing = data[0].drawing; c.photo = data[0].photo; c.gift = data[0].gift_code;
  if (s.isConnected) renderCapsule(s, c, 'in');
}
function bindHold(hb, done) {
  let raf, t0, finished = false;
  const begin = () => {
    if (finished) return;
    t0 = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - t0) / 1000);
      hb.style.setProperty('--p', p);
      if (p < 1) raf = requestAnimationFrame(tick); else { finished = true; done(); }
    };
    raf = requestAnimationFrame(tick);
  };
  const end = () => { if (finished) return; cancelAnimationFrame(raf); hb.style.setProperty('--p', 0); };
  hb.addEventListener('pointerdown', e => { e.preventDefault(); begin(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => hb.addEventListener(ev, end));
  hb.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); begin(); } });
  hb.addEventListener('keyup', end);
  hb.addEventListener('contextmenu', e => e.preventDefault());
}
async function openIt(s, c) {
  // Ask the server first: it decides whether the time has come, and whether you're at the place.
  const here = S.here ? { p_lat: S.here.lat, p_lng: S.here.lng, p_accuracy: S.here.acc } : {};
  const req = sb.rpc('open_capsule', { p_id: c.id, ...here });
  $('.stage', s)?.classList.add('opening');
  navigator.vibrate?.(40);
  const [{ data, error }] = await Promise.all([req, new Promise(r => setTimeout(r, REDUCED ? 0 : 1100))]);
  if (error || !data?.[0]) {
    console.error(error);
    const msg = { brand_place: tr('needMaisonShort'), locked: tr('notYet'), far: tr('tooFar'), no_location: tr('needLocation'), inaccurate: tr('inaccurate') }[error?.hint];
    toast(msg || tr('errGeneric'));
    renderCapsule(s, c, 'in', c.place ? 2 : 1);
    return;
  }
  Object.assign(c, { opened: true, openedAt: Date.parse(data[0].opened_at), message: data[0].message, drawing: data[0].drawing, photo: data[0].photo, gift: data[0].gift_code, isNew: false });
  renderHome();
  renderCapsule(s, c, 'in');
}

/* ---------- Create ---------- */
// Photos are shrunk to at most 1280 px and saved as JPEG, sealed with the letter.
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1280 / Math.max(im.width, im.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      let q = 0.82, out = cv.toDataURL('image/jpeg', q);
      while (out.length > 1400000 && q > 0.4) { q -= 0.12; out = cv.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    im.src = url;
  });
}
const QUICK = [{ k: 'm1', days: 30 }, { k: 'm6', days: 182 }, { k: 'y1', days: 365 }, { k: 'y5', days: 1826 }];
function validStep(d) {
  if (d.step === 1) return !!d.to;
  if (d.step === 2) return d.mode === 'type' ? d.msg.trim().length > 0 : !!d.drawing;
  if (d.step === 3) return !!d.vessel;
  return !!d.openAt && !d.busy;
}
const STEPS = {
  1: d => `<h2>${tr('s1h')}</h2><p class="sub">${tr('s1sub')}</p>
    <div class="people">${['future', ...S.friends].map(id => `<button class="person ${d.to === id ? 'sel' : ''}" data-to="${id}">${avatar(id)}<span>${esc(pname(id))}</span></button>`).join('')}
      <button class="person invite-person" data-act="invite"><span class="av plus">${IC.plus}</span><span>${tr('inviteFriend')}</span></button></div>`,
  2: d => `<h2>${tr('s2h')}</h2>
    <div class="seg small" role="tablist"><button role="tab" aria-selected="${d.mode === 'type'}" data-mode="type">${tr('type')}</button><button role="tab" aria-selected="${d.mode === 'hand'}" data-mode="hand">${tr('hand')}</button></div>
    ${d.mode === 'type'
      ? `<textarea id="msg" maxlength="500" placeholder="${tr('msgPh')}" aria-label="${tr('msgAria')}">${esc(d.msg)}</textarea><p class="count"><span id="cnt">${d.msg.length}</span> / 500</p>`
      : `<div class="pad"><canvas id="pad" width="600" height="520" aria-label="${tr('padAria')}"></canvas><button class="link" data-act="clear">${tr('clear')}</button></div><p class="sub">${tr('padNote')}</p>`}
    ${d.photo
      ? `<div class="photo-pick"><img src="${d.photo}" alt="${tr('photoAlt')}"><button class="toggle on" data-act="photo">${tr('photoOn')}</button></div>`
      : `<button class="toggle" data-act="photo">${tr('photoAdd')}</button>`}
    <input type="file" id="photo-file" accept="image/*" hidden>
    <label class="field"><span>${tr('hintLabel')}</span><input id="hint" maxlength="40" value="${esc(d.hint)}" placeholder="${tr('hintPh')}"></label>`,
  3: d => `<h2>${tr('s3h')}</h2><p class="sub">${tr('s3sub')}</p>
    <div class="vgrid">${[...S.vessels.keys()].map(k => {
      const own = owns(k);
      return `<button class="vopt ${d.vessel === k ? 'sel' : ''} ${own ? '' : 'locked'}" data-vessel="${k}" aria-pressed="${d.vessel === k}">${vessel(k)}<b>${esc(vname(k))}</b><span>${tr(own ? 'owned' : 'getInShop')}</span></button>`;
    }).join('')}</div>`,
  4: d => {
    const tomorrow = fmtDate(Date.now() + DAY).replaceAll('/', '-');
    const custom = d.quick === 'custom' && d.openAt ? fmtDate(d.openAt) : '';
    const quick = import.meta.env.DEV ? [...QUICK, { k: 'dev', mins: 2 }] : QUICK;
    return `<h2>${tr('s4h')}</h2>
    <h3>${tr('whenH')}</h3>
    <div class="chips">${quick.map(q => `<button class="chip ${d.quick === q.k ? 'sel' : ''}" data-quick="${q.k}">${q.k === 'dev' ? tr('devQuick') : STR[LANG].quick[q.k]}</button>`).join('')}
      <label class="chip date-chip ${d.quick === 'custom' ? 'sel' : ''}">${custom || tr('customDate')}<input type="date" id="date" min="${tomorrow}" value="${custom.replaceAll('/', '-')}" aria-label="${tr('dateAria')}"></label></div>
    ${d.openAt ? `<p class="sub" style="margin-top:10px">${tr('arrives', fmt(d.openAt))}</p>` : ''}
    <h3>${tr('whereH')}</h3>
    <div class="memory-card"><b>${tr('memoryH')}</b><span>${tr('memorySoon')}</span></div>
    <div class="places">${[null, ...[...S.places.values()].filter(p => !p.brand_vessel).map(p => p.id), ...[...S.places.values()].filter(p => p.brand_vessel).map(p => p.id)].map(id => {
      const p = id && S.places.get(id), dis = p?.brand_vessel && d.vessel !== p.brand_vessel;
      const sub = p ? `${esc(plcity(id))} · ${esc(plwhy(id))}${dis ? tr('needMaison') : ''}` : tr('anywhereSub');
      return `<button class="place-opt ${d.place === id ? 'sel' : ''}" data-place="${id ?? ''}" ${dis ? 'disabled' : ''}>${IC.pin}<span><b>${id ? esc(plname(id)) : tr('anywhere')}</b><small>${sub}</small></span></button>`;
    }).join('')}</div>
    <p class="sub" style="margin-top:10px">${tr('radiusNote')}</p>`;
  },
};
function openCreate(preTo) {
  const d = { to: preTo || null, mode: 'type', msg: '', drawing: null, photo: null, hint: '', vessel: null, openAt: null, quick: null, place: null, step: 1, sealed: false, busy: false };
  const s = push('sheet');
  const render = () => {
    s.innerHTML = `${bar(tr('createTitle'), 'close')}
      <div class="progress" aria-hidden="true"><i style="width:${d.step * 25}%"></i></div>
      <div class="scroll create-body"><p class="step-count" style="text-align:left;margin:12px 0 0">${tr('step', d.step)}</p>${STEPS[d.step](d)}</div>
      <footer class="actions">${d.step > 1 ? `<button class="btn ghost" data-act="prev">${tr('prev')}</button>` : ''}<button class="btn" data-act="next" ${validStep(d) ? '' : 'disabled'}>${d.busy ? tr('sealing') : tr(d.step < 4 ? 'next' : 'sealSend')}</button></footer>`;
    setupPad();
    if (d.sealed) showSeal();
  };
  s._render = render;
  // Handwriting pad (from the prototype): draw with a finger; saved as a PNG.
  const setupPad = () => {
    const cv = $('#pad', s); if (!cv) return;
    const ctx = cv.getContext('2d');
    Object.assign(ctx, { lineWidth: 6, lineCap: 'round', lineJoin: 'round', strokeStyle: '#1f2633' });
    if (d.drawing) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0); im.src = d.drawing; }
    let drawing = false;
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
    cv.addEventListener('pointerdown', e => { drawing = true; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + .1, y); ctx.stroke(); });
    cv.addEventListener('pointermove', e => { if (!drawing) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); });
    const stop = () => { if (!drawing) return; drawing = false; d.drawing = cv.toDataURL('image/png'); upd(); };
    cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);
  };
  const upd = () => { const n = $('[data-act=next]', s); if (n) n.disabled = !validStep(d); };
  const who = () => (d.to === 'future' ? tr('you') : pname(d.to));
  const showSeal = () => {
    const ov = document.createElement('div');
    ov.className = 'seal-ov';
    ov.innerHTML = `<div class="seal-stage">${vessel(d.vessel)}<div class="wax" aria-hidden="true">封</div></div>
      <h2>${tr('sealed')}</h2><p>${tr('sealMsg', fmt(d.openAt), esc(who()), d.place ? esc(plname(d.place)) : '')}</p>
      <button class="btn" data-act="done">${tr('done')}</button>`;
    s.appendChild(ov);
  };
  const seal = async () => {
    d.busy = true; render();
    const { error } = await sb.rpc('send_capsule', {
      p_recipient: d.to === 'future' ? uid() : d.to,
      p_vessel: d.vessel,
      p_message: d.mode === 'type' ? d.msg.trim() : null,
      p_drawing: d.mode === 'hand' ? d.drawing : null,
      p_hint: d.hint.trim() || tr('defaultHint'),
      p_open_at: new Date(d.openAt).toISOString(),
      p_place: d.place,
      p_photo: d.photo,
    });
    d.busy = false;
    if (error) { console.error(error); toast(tr('errGeneric')); render(); return; }
    d.sealed = true;
    render();
    navigator.vibrate?.([20, 60, 30]);
  };
  s.addEventListener('input', e => {
    if (e.target.id === 'msg') { d.msg = e.target.value; $('#cnt', s).textContent = d.msg.length; upd(); }
    if (e.target.id === 'hint') d.hint = e.target.value;
  });
  s.addEventListener('change', async e => {
    if (e.target.id === 'photo-file' && e.target.files[0]) {
      try { d.photo = await shrinkPhoto(e.target.files[0]); render(); } catch (err) { console.error(err); toast(tr('photoErr')); }
      return;
    }
    if (e.target.id === 'date' && e.target.value) { d.openAt = new Date(e.target.value + 'T09:00').getTime(); d.quick = 'custom'; render(); }
  });
  s.addEventListener('click', e => {
    const el = e.target.closest('[data-to],[data-mode],[data-vessel],[data-quick],[data-place],[data-act]');
    if (!el) return;
    const ds = el.dataset;
    if (ds.to !== undefined) { d.to = ds.to; render(); }
    else if (ds.mode) { d.mode = ds.mode; render(); }
    else if (ds.place !== undefined) { d.place = ds.place || null; render(); }
    else if (ds.vessel) {
      if (!owns(ds.vessel)) { openShop(ds.vessel, () => { if (owns(ds.vessel)) { d.vessel = ds.vessel; render(); } }); return; }
      d.vessel = ds.vessel;
      const bp = S.places.get(d.place)?.brand_vessel;
      if (bp && bp !== d.vessel) d.place = null;
      render();
    }
    else if (ds.quick) {
      d.quick = ds.quick;
      d.openAt = ds.quick === 'dev' ? Date.now() + 2 * MIN : Date.now() + QUICK.find(q => q.k === ds.quick).days * DAY;
      render();
    }
    else if (ds.act === 'close') pop(s);
    else if (ds.act === 'invite') openInvite();
    else if (ds.act === 'prev') { d.step--; render(); }
    else if (ds.act === 'clear') { d.drawing = null; render(); }
    else if (ds.act === 'photo') { if (d.photo) { d.photo = null; render(); } else $('#photo-file', s).click(); }
    else if (ds.act === 'next' && validStep(d)) { if (d.step < 4) { d.step++; render(); } else seal(); }
    else if (ds.act === 'done') finish();
  });
  const finish = async () => {
    S.tab = 'out';
    await refresh();
    $('#rail', home).scrollLeft = 0;
    renderHome();
    $$('.screen', app).filter(x => x !== home).forEach(x => (x === s ? pop(x) : x.remove()));
    toast(tr('sentTo', d.to === 'future' ? tr('future') : pname(d.to)));
  };
  render();
}

/* ---------- Shop (容器商店) ----------
   No payment yet: "buying" is free while testing, and limited editions are numbered by the server. */
function openShop(focus, onClose) {
  const s = push();
  const price = k => S.vessels.get(k)?.price_mop ?? 0;
  const render = () => {
    const M = S.vessels.get('maison'), ownM = S.owned.has('maison'), leftM = S.stock.get('maison');
    s.innerHTML = `${bar(tr('shop'))}
    <div class="scroll shop">
      ${M ? `<section class="brand-hero">
        ${vessel('maison')}
        <p class="brand-name">${esc(M.brand)} × ${tr('appName')}</p>
        <h2>${tr('brandH')}</h2>
        <p>${tr('brandP')}</p>
        <p class="left">${ownM ? tr('yourEdition', pad3(S.owned.get('maison')), M.edition_total) : tr('left', leftM ?? M.edition_total, M.edition_total)}</p>
        <button class="btn gold" data-buy="maison" ${ownM || leftM === 0 ? 'disabled' : ''}>${ownM ? tr('owned') : leftM === 0 ? tr('soldOut') : tr('buyFor', M.price_mop.toLocaleString())}</button>
      </section>` : ''}
      <h3 class="sec">${tr('allV')}</h3>
      <div class="vgrid">${[...S.vessels.keys()].filter(k => k !== 'maison').map(k => {
        const own = owns(k);
        return `<button class="vopt ${focus === k ? 'sel' : ''}" data-buy="${k}" ${own ? 'aria-disabled="true"' : ''}>${vessel(k)}<b>${esc(vname(k))}</b><span>${esc(L(VESSELS[k]?.desc))}</span><span class="price">${own ? tr('owned') : `MOP ${price(k)}`}</span></button>`;
      }).join('')}</div>
      <p class="fine">${tr('betaFree')}<br>${tr('fictional')}</p>
    </div>`;
    if (s.dataset.buying) showBuy(s.dataset.buying);
  };
  const showBuy = k => {
    const V = S.vessels.get(k);
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${tr('buyAria')}">${vessel(k)}<h2>${esc(tr('buyQ', vname(k)))}</h2>
      <p>MOP ${V.price_mop.toLocaleString()}${V.edition_total ? ` · ${tr('limitedN', V.edition_total)}` : ''}<br>${tr('demoPay')}</p>
      <div class="row"><button class="btn ghost" data-act="cancel">${tr('cancel')}</button><button class="btn" data-act="confirm">${tr('getFree')}</button></div></div>`;
    s.appendChild(m);
  };
  s._render = render;
  s.onclick = async e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'back') { pop(s); onClose?.(); return; }
    if (a === 'cancel') { delete s.dataset.buying; $('.modal', s)?.remove(); return; }
    if (a === 'confirm') {
      const k = s.dataset.buying;
      const btn = e.target.closest('button'); btn.disabled = true;
      const { error } = await sb.rpc('acquire_vessel', { p_vessel: k });
      delete s.dataset.buying;
      if (error) { console.error(error); toast(error.hint === 'sold_out' ? tr('soldOut') : error.hint === 'owned' ? tr('alreadyOwn', vname(k)) : tr('errGeneric')); }
      else toast(tr('bought', vname(k)));
      await loadShop();
      render();
      return;
    }
    const b = e.target.closest('[data-buy]');
    if (!b) return;
    const k = b.dataset.buy;
    if (owns(k)) { toast(tr('alreadyOwn', vname(k))); return; }
    s.dataset.buying = k;
    showBuy(k);
  };
  render();
  if (focus && !owns(focus)) { s.dataset.buying = focus; showBuy(focus); }
}

/* ---------- Invite a friend ---------- */
async function inviteLink() {
  let { data, error } = await sb.from('invites').select('code').eq('inviter', uid()).limit(1);
  if (error) throw error;
  let code = data[0]?.code;
  if (!code) {
    ({ data, error } = await sb.from('invites').insert({ inviter: uid() }).select('code').single());
    if (error) throw error;
    code = data.code;
  }
  return `${location.origin}/?invite=${encodeURIComponent(code)}`;
}
function openInvite() {
  const s = push('sheet');
  let link = '';
  const render = () => {
    s.innerHTML = `${bar(tr('inviteFriend'), 'close')}
    <div class="scroll create-body">
      <h2>${tr('inviteLinkH')}</h2>
      <p class="sub">${tr('inviteShareText', esc(S.profile.name))}</p>
      <input class="invite-link" readonly value="${esc(link || tr('loading'))}" aria-label="${tr('inviteLinkH')}">
      <div class="row" style="margin-top:12px">
        <button class="btn ghost" data-act="copy" ${link ? '' : 'disabled'}>${tr('copy')}</button>
        ${navigator.share ? `<button class="btn" data-act="share" ${link ? '' : 'disabled'}>${tr('share')}</button>` : ''}
      </div>
    </div>`;
  };
  s._render = render;
  s.onclick = async e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'close') pop(s);
    if (a === 'copy') {
      try { await navigator.clipboard.writeText(link); toast(tr('linkCopied')); }
      catch { $('.invite-link', s).select(); }
    }
    if (a === 'share') navigator.share({ title: tr('inviteShareTitle'), text: tr('inviteShareText', S.profile.name), url: link }).catch(() => {});
  };
  render();
  inviteLink().then(l => { link = l; render(); }).catch(err => { console.error(err); toast(tr('errGeneric')); });
}

/* ---------- Me ---------- */
function openMe() {
  const s = push();
  const render = () => {
    const opened = S.inbox.filter(c => c.opened).length;
    s.innerHTML = `${bar(tr('meTitle'))}
    <div class="scroll">
      <div class="profile">${avatar(uid(), 'xl')}<h2>${esc(S.profile.name)}</h2><p>${esc(S.profile.city || S.user.email || '')}</p>
        <button class="link" data-act="edit">${tr('editProfile')}</button></div>
      <dl class="stats"><div><dt>${tr('statIn')}</dt><dd>${S.inbox.length}</dd></div><div><dt>${tr('statOut')}</dt><dd>${S.sent.length}</dd></div><div><dt>${tr('statOpened')}</dt><dd>${opened}</dd></div></dl>
      <ul class="menu">
        <li><span>${tr('language')}</span><div class="seg small" role="radiogroup" aria-label="${tr('language')}"><button role="radio" aria-selected="${LANG === 'zh'}" aria-checked="${LANG === 'zh'}" data-lang="zh">繁中</button><button role="radio" aria-selected="${LANG === 'en'}" aria-checked="${LANG === 'en'}" data-lang="en">English</button></div></li>
        <li><label for="remind">${tr('remind')}</label><input id="remind" type="checkbox" class="switch" ${S.profile.remind_open ? 'checked' : ''}></li>
        <li><label for="nearby">${tr('nearby')}</label><input id="nearby" type="checkbox" class="switch" ${S.profile.remind_nearby ? 'checked' : ''}></li>
        <li class="soon-row"><small>${tr('remindSoon')}</small></li>
        <li><span>${tr('ownedV')}</span><button class="link" data-act="shop">${tr('ownedN', [...S.vessels.keys()].filter(owns).length)}</button></li>
      </ul>
      <h3 class="sec">${tr('friendsH')} <small>${tr('friendsN', S.friends.length)}</small></h3>
      ${S.friends.length
        ? `<ul class="menu friends">${S.friends.map(id => `<li><span class="who">${avatar(id)} ${esc(pname(id))}</span><button class="link" data-send="${id}">${tr('newCapsule')}</button></li>`).join('')}</ul>`
        : `<p class="sub">${tr('noFriends')}</p>`}
      <button class="btn ghost" data-act="invite" style="margin-top:12px">${tr('inviteFriend')}</button>
      <button class="link signout" data-act="signout">${tr('signOut')}</button>
    </div>`;
  };
  s._render = render;
  // Reminder preferences are saved now; the reminders themselves come with notifications.
  s.onchange = async e => {
    const col = { remind: 'remind_open', nearby: 'remind_nearby' }[e.target.id];
    if (!col) return;
    const { data, error } = await sb.from('profiles').update({ [col]: e.target.checked }).eq('id', uid()).select().single();
    if (error) { console.error(error); toast(tr('errGeneric')); e.target.checked = !e.target.checked; return; }
    S.profile = data;
  };
  s.onclick = async e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'back') return pop(s);
    if (a === 'invite') return openInvite();
    if (a === 'shop') return openShop(null, render);
    if (a === 'edit') {
      const p = push();
      profileForm(p, { first: false, onDone: () => { pop(p); render(); renderHome(); toast(tr('saved')); } });
      return;
    }
    if (a === 'signout') { await sb.auth.signOut(); location.reload(); return; }
    const f = e.target.closest('[data-send]');
    if (f) return openCreate(f.dataset.send);
    const l = e.target.closest('[data-lang]');
    if (l && l.dataset.lang !== LANG) setLang(l.dataset.lang);
  };
  render();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') pop(app.lastElementChild);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.profile) refresh(); });

/* ---------- Start ---------- */
// An invite link (?invite=CODE) is kept until you've signed in and accepted it.
// localStorage, not sessionStorage: the sign-in link from the email opens a new tab.
const urlInvite = new URLSearchParams(location.search).get('invite');
if (urlInvite) {
  try { localStorage.setItem('tc-invite', urlInvite); } catch { /* private mode */ }
  history.replaceState(null, '', location.pathname);
}
const pendingInvite = () => { try { return localStorage.getItem('tc-invite'); } catch { return null; } };

let starting = false;
async function start() {
  if (starting) return;
  starting = true;
  try { await boot(); } finally { starting = false; }
}
// Signing in by the email link in another tab also signs this tab in.
sb.auth.onAuthStateChange(event => {
  if (event === 'PASSWORD_RECOVERY') { recovering = true; setTimeout(showNewPassword, 0); return; }
  if (event === 'SIGNED_IN' && !S.user && !recovering) setTimeout(start, 0);
});
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  const code = pendingInvite();
  if (!session) {
    let inviter = null;
    if (code) {
      const { data } = await sb.rpc('invite_info', { p_code: code });
      inviter = data?.[0] || null;
      if (!inviter) { try { localStorage.removeItem('tc-invite'); } catch { /* */ } toast(tr('inviteBad')); }
    }
    return showSignIn(inviter);
  }
  S.user = session.user;
  if (recovering) return showNewPassword();
  const { data: profile, error } = await sb.from('profiles').select('*').eq('id', uid()).maybeSingle();
  if (error) { console.error(error); toast(tr('errGeneric')); return; }
  if (!profile) {
    const s = root();
    return profileForm(s, { first: true, onDone: start });
  }
  S.profile = profile;
  await loadShop();
  if (!S.places.size) {
    const { data: places, error: pe } = await sb.from('places').select('*').order('sort');
    if (pe) console.error(pe); else places.forEach(p => S.places.set(p.id, p));
  }
  if (code) {
    try { localStorage.removeItem('tc-invite'); } catch { /* */ }
    var { data: inviterId, error: ie } = await sb.rpc('accept_invite', { p_code: code });
    if (ie) { console.error(ie); toast(tr('inviteBad')); }
  }
  try { await loadAll(); } catch (e) { console.error(e); toast(tr('errGeneric')); }
  initHome();
  if (inviterId && inviterId !== uid()) toast(tr('inviteAccepted', pname(inviterId)));
}

applyLang();
start();
