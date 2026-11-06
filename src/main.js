/* 時光膠囊 / Time Capsule: the app. Screens and look are ported from the prototype;
   data comes from Supabase. Capsule content is only ever returned by the server's
   open_capsule() function, once the open time has passed. */
import './styles.css';
import { createClient } from '@supabase/supabase-js';
import { IC, vessel, face, PORTRAITS } from './art.js';
import { LANG, setLangValue, STR, tr, vname, FREE_VESSELS } from './i18n.js';

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
};
const uid = () => S.user?.id;

const toCapsule = r => ({
  id: r.id, sender: r.sender, recipient: r.recipient, vessel: r.vessel, hint: r.hint,
  sealedAt: Date.parse(r.sealed_at), openAt: Date.parse(r.open_at),
  openedAt: r.opened_at ? Date.parse(r.opened_at) : null, opened: !!r.opened_at, isNew: !r.seen_at,
});

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
  rows.forEach(c => { if (old.get(c.id)?.message) c.message = old.get(c.id).message; });
  S.friends = fr.data.map(f => f.friend_id);
  const ids = new Set(S.friends);
  rows.forEach(c => { ids.add(c.sender); ids.add(c.recipient); });
  ids.delete(me);
  if (ids.size) {
    const { data, error } = await sb.from('profiles').select('id, name, avatar').in('id', [...ids]);
    if (error) throw error;
    data.forEach(p => S.people.set(p.id, p));
  }
  const rank = c => ({ ready: 0, time: 1, opened: 2 }[status(c, 'in')]);
  S.inbox = rows.filter(c => c.recipient === me)
    .sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? b.openedAt - a.openedAt : a.openAt - b.openAt));
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

/* ---------- Sign in (email one-time code) ---------- */
function showSignIn(inviter) {
  const s = root('auth');
  const st = { step: 'email', email: '', busy: false, err: '' };
  const render = () => {
    s.innerHTML = `<div class="auth-top">${langBtn()}</div>
    <div class="scroll auth-body">
      <div class="auth-vessel">${vessel('dome')}</div>
      <h1 class="auth-title">${tr('appName')}</h1>
      <p class="tagline">${tr('tagline')}</p>
      ${inviter ? `<p class="invite-banner"><span class="av">${face(inviter.avatar)}</span>${esc(tr('inviteBanner', inviter.name))}</p>` : ''}
      <form class="auth-form" novalidate>
        ${st.step === 'email'
          ? `<h2>${tr('signInH')}</h2><p class="sub">${tr('signInSub')}</p>
             <label class="field"><span>${tr('emailLabel')}</span><input id="email" type="email" autocomplete="email" inputmode="email" required value="${esc(st.email)}" placeholder="you@example.com"></label>
             <button class="btn" ${st.busy ? 'disabled' : ''}>${tr('sendCode')}</button>`
          : `<h2>${tr('codeH')}</h2><p class="sub">${esc(tr('codeSub', st.email))}</p>
             <label class="field"><span>${tr('codeLabel')}</span><input id="code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" required></label>
             <button class="btn" ${st.busy ? 'disabled' : ''}>${tr('verify')}</button>
             <button type="button" class="link" data-act="change">${tr('changeEmail')}</button>`}
        <p class="err" role="alert">${esc(st.err)}</p>
      </form>
    </div>`;
    $('input', s)?.focus();
  };
  s._render = render;
  s.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'lang') setLang(LANG === 'zh' ? 'en' : 'zh');
    if (a === 'change') { st.step = 'email'; st.err = ''; render(); }
  });
  s.addEventListener('submit', async e => {
    e.preventDefault();
    if (st.busy) return;
    st.err = '';
    if (st.step === 'email') {
      const email = $('#email', s).value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { $('#email', s).focus(); return; }
      st.email = email; st.busy = true; render();
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      st.busy = false;
      if (error) { console.error(error); st.err = tr('sendFail'); } else st.step = 'code';
      render();
    } else {
      const token = $('#code', s).value.replace(/\D/g, '');
      if (token.length !== 6) { $('#code', s).focus(); return; }
      st.busy = true; render();
      const { error } = await sb.auth.verifyOtp({ email: st.email, token, type: 'email' });
      st.busy = false;
      if (error) { console.error(error); st.err = tr('badCode'); render(); return; }
      start();
    }
  });
  render();
}

/* ---------- Profile (name + illustrated portrait) ---------- */
function profileForm(s, { first, onDone }) {
  const d = {
    name: S.profile?.name || '',
    pick: Math.max(0, PORTRAITS.findIndex(p => JSON.stringify(p) === JSON.stringify(S.profile?.avatar))),
    busy: false,
  };
  const render = () => {
    s.innerHTML = `${first ? `<div class="auth-top">${langBtn()}</div>` : bar(tr('editProfile'))}
    <form class="scroll create-body profile-form" novalidate>
      <h2>${tr('profileH')}</h2><p class="sub">${tr('profileSub')}</p>
      <div class="profile-preview"><span class="av xl">${face(PORTRAITS[d.pick])}</span></div>
      <label class="field"><span>${tr('nameLabel')}</span><input id="pname" maxlength="40" autocomplete="nickname" value="${esc(d.name)}" placeholder="${tr('namePh')}"></label>
      <h3>${tr('pickFace')}</h3>
      <div class="faces" role="radiogroup" aria-label="${tr('pickFace')}">${PORTRAITS.map((p, i) =>
        `<button type="button" role="radio" aria-checked="${i === d.pick}" class="face-opt ${i === d.pick ? 'sel' : ''}" data-face="${i}"><span class="av">${face(p)}</span></button>`).join('')}</div>
      <button class="btn save-btn" ${d.name.trim() && !d.busy ? '' : 'disabled'}>${tr('save')}</button>
    </form>`;
  };
  s._render = render;
  s.addEventListener('input', e => {
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
    const row = { id: uid(), name, avatar: PORTRAITS[d.pick] };
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
  else if (st === 'ready') head = tr('ready');
  else if (st === 'waiting') head = tr('waiting');
  else head = tr(side === 'in' ? 'openedIn' : 'openedOut', md(c.openedAt));
  return `<button class="card st-${st}" data-id="${c.id}" aria-label="${esc(tr('cardAria', side, pname(who)))}">
    ${side === 'in' && c.isNew && !c.opened ? '<span class="tag">NEW</span>' : ''}
    ${vessel(c.vessel)}
    <p class="head">${head}</p>
    <p class="place">${IC.pin}${tr('anywhere')}</p>
    <div class="meta"><span class="who">${tr(side === 'in' ? 'from' : 'to')} ${avatar(who)} ${esc(pname(who))}</span><time>${fmt(c.sealedAt)}</time></div>
  </button>`;
}
function renderHome() {
  const side = S.tab, list = side === 'in' ? S.inbox : S.sent;
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
      <div class="top-r">${langBtn()}</div>
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
    if (act === 'lang') return setLang(LANG === 'zh' ? 'en' : 'zh');
    const card = e.target.closest('.card[data-id]');
    if (card) {
      const rail = card.parentElement;
      if (!card.classList.contains('center')) {
        rail.scrollTo({ left: card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2, behavior: REDUCED ? 'auto' : 'smooth' });
        return;
      }
      openCapsule(card.dataset.id);
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
  return `<button class="btn hold" data-act="hold"><span>${tr('hold')}</span></button><p class="tiny">${tr('holdNote')}</p>`;
}

function pagerView(c, st) {
  const timeOk = c.openAt <= Date.now();
  const from = `<p class="from">${tr('from')} ${avatar(c.sender)} ${esc(pname(c.sender))}</p>`;
  const story = timeOk
    ? tr('storyArrived', fmt(c.sealedAt), Math.round((c.openAt - c.sealedAt) / DAY), fmt(c.openAt)) + tr('storyNow')
    : (() => { const r = remain(c.openAt - Date.now()); return tr('storyWaiting', fmt(c.sealedAt), Math.floor((Date.now() - c.sealedAt) / DAY), r.n, r.u, fmt(c.openAt)); })();
  const hint = c.hint || tr('defaultHint');
  const pages = [
    `${from}<div class="p-vessel">${vessel(c.vessel)}</div><p class="story">${story}</p>
      ${timeOk ? '' : countdownHTML(c)}
      ${timeOk ? `<div class="go"><button class="btn" data-goto="1">${tr('goOpen')}</button></div>` : ''}`,
    `${from}
      <div class="stage st-${st}"><div class="halo"></div>${vessel(c.vessel)}</div>
      <ul class="conds">
        <li class="${timeOk ? 'ok' : ''}">${timeOk ? IC.check : IC.lock}<div><b>${tr('condTime')}</b><span>${fmt(c.openAt)}</span></div></li>
      </ul>
      <blockquote class="hint">${quote(esc(hint))}<cite>${esc(tr('hintBy', pname(c.sender)))}</cite></blockquote>
      ${actionHTML(c, st)}`,
  ];
  return `${bar(tr('openTitle'))}
    <div class="pager">${pages.map((p, i) => `<section class="page" aria-label="${tr('page', i + 1)}"><div class="paper">${p}<span class="pno">${i + 1}</span></div></section>`).join('')}</div>
    <div class="pdots" aria-hidden="true">${pages.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>`;
}

function letterView(c) {
  const self = c.sender === uid();
  return `${bar(self ? tr('letterSelf') : tr('letterFrom', esc(pname(c.sender))))}
  <div class="scroll">
    <div class="opened-stage">${vessel(c.vessel)}</div>
    <article class="letter">
      ${c.message != null ? paras(c.message) : `<p class="sub">${tr('loading')}</p>`}
      <p class="sign">${esc(self ? tr('pastMe') : pname(c.sender))}<br><time>${tr('sealedOn', fmt(c.sealedAt))}</time></p>
    </article>
    <p class="opened-at">${tr('openedRecord', fmt(c.openedAt), '')}</p>
    <button class="btn ghost" data-act="reply">${self ? tr('replySelf') : tr('replyTo', esc(pname(c.sender)))}</button>
  </div>`;
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
      <li class="${c.opened ? 'done' : ''}"><b>${tr('tlOpen', to)}</b><span>${c.opened ? fmt(c.openedAt) : tr('tlAnytime')}</span></li>
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
  s.innerHTML = side === 'out' ? sentView(c, st) : st === 'opened' ? letterView(c) : pagerView(c, st);
  if (side === 'in' && st === 'opened' && c.message == null) fetchContent(s, c);
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
  };
  const hb = $('.hold', s);
  if (hb) bindHold(hb, () => openIt(s, c));
}
async function fetchContent(s, c) {
  const { data, error } = await sb.rpc('open_capsule', { p_id: c.id });
  if (error || !data?.[0]) { console.error(error); toast(tr('errGeneric')); return; }
  c.message = data[0].message;
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
  // Ask the server first: it decides whether the time has come.
  const req = sb.rpc('open_capsule', { p_id: c.id });
  $('.stage', s)?.classList.add('opening');
  navigator.vibrate?.(40);
  const [{ data, error }] = await Promise.all([req, new Promise(r => setTimeout(r, REDUCED ? 0 : 1100))]);
  if (error || !data?.[0]) {
    console.error(error);
    toast(error?.hint === 'locked' ? tr('notYet') : tr('errGeneric'));
    renderCapsule(s, c, 'in', 1);
    return;
  }
  Object.assign(c, { opened: true, openedAt: Date.parse(data[0].opened_at), message: data[0].message, isNew: false });
  renderHome();
  renderCapsule(s, c, 'in');
}

/* ---------- Create ---------- */
const QUICK = [{ k: 'm1', days: 30 }, { k: 'm6', days: 182 }, { k: 'y1', days: 365 }, { k: 'y5', days: 1826 }];
function validStep(d) {
  if (d.step === 1) return !!d.to;
  if (d.step === 2) return d.msg.trim().length > 0;
  if (d.step === 3) return !!d.vessel;
  return !!d.openAt && !d.busy;
}
const STEPS = {
  1: d => `<h2>${tr('s1h')}</h2><p class="sub">${tr('s1sub')}</p>
    <div class="people">${['future', ...S.friends].map(id => `<button class="person ${d.to === id ? 'sel' : ''}" data-to="${id}">${avatar(id)}<span>${esc(pname(id))}</span></button>`).join('')}
      <button class="person invite-person" data-act="invite"><span class="av plus">${IC.plus}</span><span>${tr('inviteFriend')}</span></button></div>`,
  2: d => `<h2>${tr('s2h')}</h2>
    <textarea id="msg" maxlength="500" placeholder="${tr('msgPh')}" aria-label="${tr('msgAria')}">${esc(d.msg)}</textarea><p class="count"><span id="cnt">${d.msg.length}</span> / 500</p>
    <label class="field"><span>${tr('hintLabel')}</span><input id="hint" maxlength="40" value="${esc(d.hint)}" placeholder="${tr('hintPh')}"></label>`,
  3: d => `<h2>${tr('s3h')}</h2><p class="sub">${tr('s3sub')}</p>
    <div class="vgrid">${FREE_VESSELS.map(k =>
      `<button class="vopt ${d.vessel === k ? 'sel' : ''}" data-vessel="${k}" aria-pressed="${d.vessel === k}">${vessel(k)}<b>${esc(vname(k))}</b></button>`).join('')}</div>`,
  4: d => {
    const tomorrow = fmtDate(Date.now() + DAY).replaceAll('/', '-');
    const custom = d.quick === 'custom' && d.openAt ? fmtDate(d.openAt) : '';
    const quick = import.meta.env.DEV ? [...QUICK, { k: 'dev', mins: 2 }] : QUICK;
    return `<h2>${tr('s4h')}</h2>
    <h3>${tr('whenH')}</h3>
    <div class="chips">${quick.map(q => `<button class="chip ${d.quick === q.k ? 'sel' : ''}" data-quick="${q.k}">${q.k === 'dev' ? tr('devQuick') : STR[LANG].quick[q.k]}</button>`).join('')}
      <label class="chip date-chip ${d.quick === 'custom' ? 'sel' : ''}">${custom || tr('customDate')}<input type="date" id="date" min="${tomorrow}" value="${custom.replaceAll('/', '-')}" aria-label="${tr('dateAria')}"></label></div>
    ${d.openAt ? `<p class="sub" style="margin-top:10px">${tr('arrives', fmt(d.openAt))}</p>` : ''}`;
  },
};
function openCreate(preTo) {
  const d = { to: preTo || null, msg: '', hint: '', vessel: null, openAt: null, quick: null, step: 1, sealed: false, busy: false };
  const s = push('sheet');
  const render = () => {
    s.innerHTML = `${bar(tr('createTitle'), 'close')}
      <div class="progress" aria-hidden="true"><i style="width:${d.step * 25}%"></i></div>
      <div class="scroll create-body"><p class="step-count" style="text-align:left;margin:12px 0 0">${tr('step', d.step)}</p>${STEPS[d.step](d)}</div>
      <footer class="actions">${d.step > 1 ? `<button class="btn ghost" data-act="prev">${tr('prev')}</button>` : ''}<button class="btn" data-act="next" ${validStep(d) ? '' : 'disabled'}>${d.busy ? tr('sealing') : tr(d.step < 4 ? 'next' : 'sealSend')}</button></footer>`;
    if (d.sealed) showSeal();
  };
  s._render = render;
  const upd = () => { const n = $('[data-act=next]', s); if (n) n.disabled = !validStep(d); };
  const who = () => (d.to === 'future' ? tr('you') : pname(d.to));
  const showSeal = () => {
    const ov = document.createElement('div');
    ov.className = 'seal-ov';
    ov.innerHTML = `<div class="seal-stage">${vessel(d.vessel)}<div class="wax" aria-hidden="true">封</div></div>
      <h2>${tr('sealed')}</h2><p>${tr('sealMsg', fmt(d.openAt), esc(who()), '')}</p>
      <button class="btn" data-act="done">${tr('done')}</button>`;
    s.appendChild(ov);
  };
  const seal = async () => {
    d.busy = true; render();
    const { error } = await sb.rpc('send_capsule', {
      p_recipient: d.to === 'future' ? uid() : d.to,
      p_vessel: d.vessel,
      p_message: d.msg.trim(),
      p_hint: d.hint.trim() || tr('defaultHint'),
      p_open_at: new Date(d.openAt).toISOString(),
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
  s.addEventListener('change', e => {
    if (e.target.id === 'date' && e.target.value) { d.openAt = new Date(e.target.value + 'T09:00').getTime(); d.quick = 'custom'; render(); }
  });
  s.addEventListener('click', e => {
    const el = e.target.closest('[data-to],[data-vessel],[data-quick],[data-act]');
    if (!el) return;
    const ds = el.dataset;
    if (ds.to !== undefined) { d.to = ds.to; render(); }
    else if (ds.vessel) { d.vessel = ds.vessel; render(); }
    else if (ds.quick) {
      d.quick = ds.quick;
      d.openAt = ds.quick === 'dev' ? Date.now() + 2 * MIN : Date.now() + QUICK.find(q => q.k === ds.quick).days * DAY;
      render();
    }
    else if (ds.act === 'close') pop(s);
    else if (ds.act === 'invite') openInvite();
    else if (ds.act === 'prev') { d.step--; render(); }
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
      <div class="profile">${avatar(uid(), 'xl')}<h2>${esc(S.profile.name)}</h2><p>${esc(S.user.email || '')}</p>
        <button class="link" data-act="edit">${tr('editProfile')}</button></div>
      <dl class="stats"><div><dt>${tr('statIn')}</dt><dd>${S.inbox.length}</dd></div><div><dt>${tr('statOut')}</dt><dd>${S.sent.length}</dd></div><div><dt>${tr('statOpened')}</dt><dd>${opened}</dd></div></dl>
      <ul class="menu">
        <li><span>${tr('language')}</span><div class="seg small" role="radiogroup" aria-label="${tr('language')}"><button role="radio" aria-selected="${LANG === 'zh'}" aria-checked="${LANG === 'zh'}" data-lang="zh">繁中</button><button role="radio" aria-selected="${LANG === 'en'}" aria-checked="${LANG === 'en'}" data-lang="en">English</button></div></li>
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
  s.onclick = async e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'back') return pop(s);
    if (a === 'invite') return openInvite();
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
const urlInvite = new URLSearchParams(location.search).get('invite');
if (urlInvite) {
  try { sessionStorage.setItem('tc-invite', urlInvite); } catch { /* private mode */ }
  history.replaceState(null, '', location.pathname);
}
const pendingInvite = () => { try { return sessionStorage.getItem('tc-invite'); } catch { return null; } };

async function start() {
  const { data: { session } } = await sb.auth.getSession();
  const code = pendingInvite();
  if (!session) {
    let inviter = null;
    if (code) {
      const { data } = await sb.rpc('invite_info', { p_code: code });
      inviter = data?.[0] || null;
      if (!inviter) { try { sessionStorage.removeItem('tc-invite'); } catch { /* */ } toast(tr('inviteBad')); }
    }
    return showSignIn(inviter);
  }
  S.user = session.user;
  const { data: profile, error } = await sb.from('profiles').select('*').eq('id', uid()).maybeSingle();
  if (error) { console.error(error); toast(tr('errGeneric')); return; }
  if (!profile) {
    const s = root();
    return profileForm(s, { first: true, onDone: start });
  }
  S.profile = profile;
  if (code) {
    try { sessionStorage.removeItem('tc-invite'); } catch { /* */ }
    var { data: inviterId, error: ie } = await sb.rpc('accept_invite', { p_code: code });
    if (ie) { console.error(ie); toast(tr('inviteBad')); }
  }
  try { await loadAll(); } catch (e) { console.error(e); toast(tr('errGeneric')); }
  initHome();
  if (inviterId && inviterId !== uid()) toast(tr('inviteAccepted', pname(inviterId)));
}

applyLang();
start();
