/* Bapa Sitaram billing — the screens, gestures and motion from the phone app.
   Data lives in MongoDB: this file keeps a copy in memory (S), sends changes to the server a moment
   after they happen, and pulls changes from other phones every few seconds. */

let started = false;

export function startApp(initial) {
  if (started) return; // React may call effects twice in development
  started = true;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + (Math.round((+n || 0) * 100) / 100).toLocaleString('en-IN');
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dayRange = key => { const [y, m, d] = key.split('-').map(Number); const from = new Date(y, m - 1, d).getTime(); return [from, new Date(y, m - 1, d + 1).getTime()]; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const svg = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  plus: svg('<path d="M12 5v14M5 12h14"/>', 2.4),
  minus: svg('<path d="M5 12h14"/>', 2.4),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 3),
  print: svg('<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>'),
  share: svg('<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/>'),
  warn: svg('<path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
  bag: svg('<path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/>'),
  plate: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>'),
  receipt: svg('<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>'),
  cash: svg('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>'),
  upi: svg('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2M9 7h6M9 10.5h6"/>'),
  card: svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'),
  table: svg('<rect x="4" y="4" width="16" height="16" rx="4"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  chev: svg('<path d="M9 6l6 6-6 6"/>'),
  qr: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M17 21h4v-4M14 18v3"/>')
};
const PAY_MODES = ['Cash', 'UPI'];
const PAY_IC = { Cash: IC.cash, UPI: IC.upi };

/* ---------- Data ---------- */
let S = { settings: initial.settings, cats: initial.cats, menu: initial.menu, tables: initial.tables, orders: initial.orders || {} };
// Version of the uploaded UPI QR image (null = none). The image itself is loaded from /api/qr?v=<version>.
let qrV = initial.qr || null;
const qrUrl = () => '/api/qr?v=' + qrV;
// Bills are fetched one day at a time; billsByDay['2026-11-16'] = [...]
const billsByDay = {};
const todayKey = dayKey(Date.now());
billsByDay[todayKey] = (initial.bills || []).filter(b => dayKey(b.time) === todayKey);

/* ---------- Server sync ---------- */
class AuthError extends Error {}
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  if (r.status === 401) { location.href = '/login'; throw new AuthError('signed out'); }
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Server error ' + r.status);
  setOnline(true);
  return r.json();
}
function setOnline(on) { $('netbar').classList.toggle('on', !on); }

const cfgOf = s => JSON.stringify({ settings: s.settings, cats: s.cats, menu: s.menu, tables: s.tables });
let syncedCfg = cfgOf(S);
let syncedOrders = Object.fromEntries(Object.entries(S.orders).map(([t, o]) => [t, JSON.stringify(o)]));
const ordersDiff = () => {
  const set = {}, unset = [];
  for (const t in S.orders) { const j = JSON.stringify(S.orders[t]); if (syncedOrders[t] !== j) set[t] = j; }
  for (const t in syncedOrders) if (!(t in S.orders)) unset.push(t);
  return { set, unset };
};
const hasPending = () => { const d = ordersDiff(); return cfgOf(S) !== syncedCfg || Object.keys(d.set).length > 0 || d.unset.length > 0; };

let flushT = null, flushing = false, again = false, retryT = null;
// Called after every change: sends it to the server shortly after (changes made quickly together go in one request)
function save() { clearTimeout(flushT); flushT = setTimeout(flush, 150); }
async function flush() {
  flushT = null;
  if (flushing) { again = true; return; }
  flushing = true; clearTimeout(retryT);
  try {
    const cfg = cfgOf(S);
    if (cfg !== syncedCfg) { await api('PUT', '/api/config', JSON.parse(cfg)); syncedCfg = cfg; }
    const { set, unset } = ordersDiff();
    if (Object.keys(set).length || unset.length) {
      await api('PATCH', '/api/orders', { set: Object.fromEntries(Object.entries(set).map(([t, j]) => [t, JSON.parse(j)])), unset });
      for (const t in set) syncedOrders[t] = set[t];
      for (const t of unset) delete syncedOrders[t];
    }
  } catch (e) {
    if (!(e instanceof AuthError)) { setOnline(false); retryT = setTimeout(flush, 5000); }
  }
  flushing = false;
  if (again) { again = false; flush(); }
  else if (pullMissed) pull(); // a live update arrived while this phone was sending
}
addEventListener('online', () => { flush(); pull(); });
addEventListener('offline', () => setOnline(false));
// Try to send unsaved changes if the page is closed
addEventListener('pagehide', () => { if (hasPending()) flush(); });

// Pull changes made on other phones. Postponed (not lost) while this phone has unsent changes or someone is
// typing in a field a redraw would disturb; it runs as soon as the change is sent or the field is left.
let pulling = false, pullMissed = false, lastPull = Date.now();
async function pull() {
  if (document.hidden) return;
  const typing = document.activeElement?.matches?.('input, select, textarea') && document.activeElement.id !== 'search';
  if (pulling || flushT || flushing || hasPending() || typing) { pullMissed = true; return; }
  pulling = true; pullMissed = false;
  try {
    const day = viewedDay();
    const [from, to] = dayRange(day);
    const st = await api('GET', `/api/state?from=${from}&to=${to}`);
    if (flushT || flushing || hasPending()) { pullMissed = true; return; } // the user changed something meanwhile
    lastPull = Date.now();
    const before = JSON.stringify([S, billsByDay[day], qrV]);
    S = { settings: st.settings, cats: st.cats, menu: st.menu, tables: st.tables, orders: st.orders || {} };
    billsByDay[day] = st.bills;
    qrV = st.qr || null;
    syncedCfg = cfgOf(S);
    syncedOrders = Object.fromEntries(Object.entries(S.orders).map(([t, o]) => [t, JSON.stringify(o)]));
    if (JSON.stringify([S, billsByDay[day], qrV]) !== before) refresh();
  } catch (e) { if (!(e instanceof AuthError)) setOnline(false); }
  finally { pulling = false; if (pullMissed) setTimeout(pull, 300); }
}
// Catch up on anything that arrived while a field was being edited
document.addEventListener('focusout', () => setTimeout(() => { if (pullMissed) pull(); }, 60));

/* Live updates: the server pushes a short message the moment another phone changes something (see app/api/live).
   If the live connection is down, the 8-second check below keeps things in sync. */
let live = null, liveOk = false, liveRetry = null, kickT = null;
function setLive(on) { liveOk = on; $('liveDot')?.classList.toggle('on', on); }
function connectLive() {
  if (!('EventSource' in window) || document.hidden) return;
  clearTimeout(liveRetry);
  live?.close();
  live = new EventSource('/api/live');
  live.onopen = () => setLive(true);
  live.onmessage = () => { clearTimeout(kickT); kickT = setTimeout(pull, 80); }; // several changes at once → one fetch
  live.addEventListener('fail', () => { live.close(); setLive(false); liveRetry = setTimeout(connectLive, 20000); });
  live.onerror = () => {
    setLive(false);
    // The browser reconnects by itself after a dropped connection; if it gave up (e.g. signed out), try again later
    if (live.readyState === EventSource.CLOSED) liveRetry = setTimeout(connectLive, 10000);
  };
}
connectLive();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { live?.close(); live = null; setLive(false); } // phones suspend background pages anyway
  else connectLive();
});
const viewedDay = () => (tab === 'bills' && !document.body.classList.contains('in-order') && $('billDate').value) || dayKey(Date.now());
// Re-draw whatever is on screen after data changed elsewhere
function refresh() {
  if (document.body.classList.contains('in-order')) { if (!S.tables.includes(current) && !isTakeaway(current)) show('tables', 'back'); else renderOrder(); }
  else if (tab === 'tables') renderTables();
  else if (tab === 'bills') renderBills();
  else if (tab === 'settings') renderSettings();
}
// Backup sync: every 8 s without a live connection, every 60 s with one
setInterval(() => {
  if (!document.hidden && !live) connectLive(); // e.g. the page was opened in the background
  if (!liveOk || Date.now() - lastPull > 60000) pull();
}, 8000);

// Load one day's bills from the server, then re-draw the bills screen
const loadingDays = new Set();
function ensureDay(key, then) {
  if (billsByDay[key] || loadingDays.has(key)) return;
  loadingDays.add(key);
  const [from, to] = dayRange(key);
  api('GET', `/api/bills?from=${from}&to=${to}`)
    .then(b => { billsByDay[key] = b; then?.(); })
    .catch(e => { if (!(e instanceof AuthError)) { setOnline(false); toast('Could not load bills. Check the internet.', IC.warn); } })
    .finally(() => loadingDays.delete(key));
}

/* ---------- Motion helpers ---------- */
// Restart a CSS animation on an element that is already on screen
function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
// Count a money/number element up to its new value
function countTo(el, to, fmt = inr) {
  const from = +el.dataset.v || 0; el.dataset.v = to;
  if (reduced.matches || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 700;
  const step = t => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(to);
  };
  requestAnimationFrame(step);
}
const whole = n => Math.round(n).toLocaleString('en-IN');
const rupees = n => '₹' + Math.round(n).toLocaleString('en-IN');
// Slide a segmented control's thumb under its active button
function moveThumb(seg) {
  const on = seg.querySelector('button.on'), th = seg.querySelector('.thumb');
  if (!on || !th || !on.offsetWidth) return;
  th.style.width = on.offsetWidth + 'px';
  th.style.transform = `translateX(${on.offsetLeft - 4}px)`;
}
addEventListener('resize', () => document.querySelectorAll('.seg').forEach(moveThumb));
// Shadow under the app bar once the page scrolls
addEventListener('scroll', () => document.querySelectorAll('.screen.on .appbar').forEach(a => a.classList.toggle('scrolled', scrollY > 4)), { passive: true });

/* ---------- Toast, sheets, dialogs ---------- */
let toastT;
function toast(msg, icon = IC.check) {
  const t = $('toast'); t.innerHTML = icon + `<span>${esc(msg)}</span>`; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400);
}
let sheetClose = null;
function openSheet(html, onClose) {
  $('sheetBody').innerHTML = html;
  $('sheet').scrollTop = 0;
  $('sheet').classList.add('on'); $('scrim').classList.add('on');
  sheetClose = onClose || null;
}
function closeSheet() {
  if (!$('sheet').classList.contains('on')) return;
  $('sheet').classList.remove('on'); $('scrim').classList.remove('on');
  const cb = sheetClose; sheetClose = null; if (cb) cb();
}
$('scrim').onclick = closeSheet;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

function confirmBox(title, body, okText, onOk, danger = true) {
  openSheet(`<div class="dlg"><div class="badge ${danger ? 'warn' : ''}">${danger ? IC.warn : IC.info}</div><h3>${esc(title)}</h3><p>${esc(body)}</p></div>
    <div class="row"><button class="btn ghost" data-x="no">Cancel</button><button class="btn ${danger ? 'dark' : 'gold'}" data-x="ok">${esc(okText)}</button></div>`);
  if (danger) hap('warn');
  $('sheetBody').querySelector('[data-x=no]').onclick = closeSheet;
  $('sheetBody').querySelector('[data-x=ok]').onclick = () => { closeSheet(); onOk(); };
}
function promptBox(title, placeholder, okText, onOk) {
  openSheet(`<div class="dlg" style="text-align:left"><h3 style="margin-bottom:14px">${esc(title)}</h3></div>
    <input id="pbIn" placeholder="${esc(placeholder)}" style="margin-bottom:16px">
    <div class="row"><button class="btn ghost" data-x="no">Cancel</button><button class="btn gold" data-x="ok">${esc(okText)}</button></div>`);
  const inp = $('pbIn');
  const go = () => { const v = inp.value.trim(); if (!v) { inp.focus(); return; } if (onOk(v) !== false) closeSheet(); };
  $('sheetBody').querySelector('[data-x=no]').onclick = closeSheet;
  $('sheetBody').querySelector('[data-x=ok]').onclick = go;
  inp.onkeydown = e => { if (e.key === 'Enter') go(); };
  setTimeout(() => inp.focus(), 300);
}

// Vibration on Android phones (iPhones don't allow it from websites)
function hap(kind = 'light') {
  if (navigator.vibrate && navigator.userActivation?.hasBeenActive) {
    try { navigator.vibrate(kind === 'success' ? [10, 50, 14] : kind === 'medium' ? 18 : 8); } catch (e) {}
  }
}

/* ---------- Navigation ---------- */
const TABS = ['tables', 'bills', 'settings'];
let tab = 'tables', enterT;
// dir: 'fwd' slides the new screen in from the right, 'back' from the left
function show(name, dir) {
  document.querySelectorAll('.screen').forEach(s => { s.classList.toggle('on', s.id === 's-' + name); s.classList.remove('in-right', 'in-left'); });
  if (dir) replay($('s-' + name), dir === 'back' ? 'in-left' : 'in-right');
  document.body.classList.toggle('in-order', name === 'order');
  if (name !== 'order') { tab = name; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name)); }
  // Cards rise in for a moment after a screen opens; later re-renders stay still
  document.body.classList.add('entering');
  clearTimeout(enterT); enterT = setTimeout(() => document.body.classList.remove('entering'), 900);
  window.scrollTo(0, 0);
  document.querySelectorAll('.appbar').forEach(a => a.classList.remove('scrolled'));
  if (name === 'tables') renderTables();
  if (name === 'bills') renderBills();
  if (name === 'settings') renderSettings();
  if (name === 'order') renderOrder();
  requestAnimationFrame(() => document.querySelectorAll('.screen.on .seg').forEach(moveThumb));
}
$('tabs').onclick = e => {
  const b = e.target.closest('button'); if (!b || b.dataset.tab === tab) return;
  hap('select');
  show(b.dataset.tab, TABS.indexOf(b.dataset.tab) > TABS.indexOf(tab) ? 'fwd' : 'back');
};

/* ---------- Gestures ----------
   Swipe left/right on Tables, Bills, Settings to move between them.
   On the order screen, swipe from the left edge to go back to tables.
   Drag a bottom sheet down to close it. */
let sw = null;
document.addEventListener('touchstart', e => {
  sw = null;
  if (e.touches.length !== 1 || $('sheet').classList.contains('on') || $('intro')) return;
  const t = e.touches[0];
  if (e.target.closest('input, select, textarea, .chips, .seg, .stepper, .mini-step, nav.tabs')) return;
  const inOrder = document.body.classList.contains('in-order');
  const edge = inOrder && t.clientX < 32;
  if (inOrder && !edge) return;
  if (!inOrder && innerWidth >= 900) return; // desktop uses the side rail
  sw = { x: t.clientX, y: t.clientY, t: Date.now(), dx: 0, lock: null, edge, el: document.querySelector('.screen.on') };
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!sw) return;
  const t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
  if (!sw.lock) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    sw.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
    if (sw.lock === 'x') sw.el.classList.add('dragging');
  }
  if (sw.lock !== 'x') return;
  sw.dx = dx;
  if (sw.edge) { sw.el.style.transform = `translateX(${Math.max(0, dx)}px)`; return; }
  const i = TABS.indexOf(tab), blocked = (dx > 0 && i === 0) || (dx < 0 && i === TABS.length - 1);
  sw.el.style.transform = `translateX(${dx * (blocked ? .12 : .4)}px)`;
  sw.el.style.opacity = 1 - Math.min(Math.abs(dx) / 1000, .25);
}, { passive: true });
function endSwipe() {
  if (!sw) return;
  const s = sw; sw = null;
  if (s.lock !== 'x') return;
  const el = s.el, fast = Math.abs(s.dx) / (Date.now() - s.t) > .45;
  const snapBack = () => {
    el.classList.remove('dragging');
    el.style.transition = 'transform .32s var(--ease), opacity .32s';
    el.style.transform = ''; el.style.opacity = '';
    setTimeout(() => { el.style.transition = ''; }, 340);
  };
  if (s.edge) {
    if (s.dx > innerWidth * .33 || (fast && s.dx > 40)) {
      el.classList.remove('dragging');
      el.style.transition = 'transform .24s var(--ease)';
      el.style.transform = `translateX(${innerWidth}px)`;
      hap('light');
      setTimeout(() => { el.style.transition = ''; el.style.transform = ''; show('tables', 'back'); }, 230);
    } else snapBack();
    return;
  }
  const next = TABS.indexOf(tab) + (s.dx < 0 ? 1 : -1);
  if ((Math.abs(s.dx) > 70 || (fast && Math.abs(s.dx) > 30)) && next >= 0 && next < TABS.length) {
    el.classList.remove('dragging'); el.style.transform = ''; el.style.opacity = '';
    hap('select');
    show(TABS[next], s.dx < 0 ? 'fwd' : 'back');
  } else snapBack();
}
document.addEventListener('touchend', endSwipe);
document.addEventListener('touchcancel', endSwipe);

// Drag the bill / receipt sheet down to close it (phones only; wider screens show a centred dialog)
let sd = null;
$('sheet').addEventListener('touchstart', e => {
  sd = null;
  if (innerWidth >= 640 || $('sheet').scrollTop > 0 || e.target.closest('input, select, .stepper, .seg')) return;
  sd = { y: e.touches[0].clientY, dy: 0, t: Date.now() };
}, { passive: true });
$('sheet').addEventListener('touchmove', e => {
  if (!sd) return;
  const dy = e.touches[0].clientY - sd.y;
  if (dy <= 0 || $('sheet').scrollTop > 0) { sd.dy = 0; $('sheet').style.transform = ''; return; }
  sd.dy = dy;
  $('sheet').style.transition = 'none';
  $('sheet').style.transform = `translateY(${dy}px)`;
}, { passive: true });
function endSheetDrag() {
  if (!sd) return;
  const s = sd; sd = null;
  const sheet = $('sheet');
  sheet.style.transition = ''; sheet.style.transform = '';
  if (s.dy > 110 || (s.dy > 40 && s.dy / (Date.now() - s.t) > .5)) { hap('light'); closeSheet(); }
}
$('sheet').addEventListener('touchend', endSheetDrag);
$('sheet').addEventListener('touchcancel', endSheetDrag);

/* ---------- Order math ---------- */
let current = 'Takeaway';
const order = t => S.orders[t] || { items: {}, disc: 0 };
const dish = id => S.menu.find(m => m.id == id);
function calc(t) {
  const o = order(t);
  const lines = Object.entries(o.items).map(([id, qty]) => ({ d: dish(id), qty })).filter(l => l.d && l.qty > 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const sub = lines.reduce((a, l) => a + l.d.price * l.qty, 0);
  const disc = sub * ((+o.disc || 0) / 100);
  const gstPct = o.gst ?? S.settings.gst ?? 0;
  const tax = (sub - disc) * (gstPct / 100);
  const total = Math.round(sub - disc + tax);
  return { o, lines, count, sub, disc, tax, gstPct, total };
}
function setQty(id, delta) {
  if (!S.orders[current]) S.orders[current] = { items: {}, disc: 0, openedAt: Date.now() };
  const it = S.orders[current].items;
  it[id] = (it[id] || 0) + delta;
  if (it[id] <= 0) delete it[id];
  if (!Object.keys(it).length) delete S.orders[current];
  save();
}
function since(t) {
  if (!t) return '';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/* ---------- Tables screen ---------- */
let tFilter = 'all';
function renderTables() {
  const h = new Date().getHours();
  $('greet').textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  $('restName').textContent = S.settings.name.replace(/\s*Restaurant$/i, '') || 'Billing';
  $('heroLabel').textContent = "Today's sales · " + new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  const today = dayKey(Date.now());
  ensureDay(today, () => { if (tab === 'tables') renderTables(); }); // after midnight
  const tb = (billsByDay[today] || []).filter(b => !b.void);
  const sales = tb.reduce((a, b) => a + b.total, 0);
  const takeaways = runningTakeaways();
  const running = S.tables.filter(t => calc(t).count > 0).length + takeaways.length;
  countTo($('todayAmt'), sales, rupees);
  countTo($('stBills'), tb.length, whole);
  countTo($('stRunning'), running, whole);
  countTo($('stAvg'), tb.length ? sales / tb.length : 0, rupees);
  $('tableCount').textContent = S.tables.length + (takeaways.length ? ` · ${takeaways.length} takeaway` : '');

  // Running takeaways first (they only exist while they have an order), then the tables
  const list = [...takeaways.map(t => ({ t, take: true, c: calc(t) })), ...S.tables.map(t => ({ t, c: calc(t) }))]
    .filter(x => tFilter === 'all' || (tFilter === 'busy' ? x.c.count : !x.c.count));
  $('tableGrid').innerHTML = list.map(({ t, take, c }, n) => c.count ? `
    <button class="tcard busy anim ${take ? 'take' : ''}" style="--i:${n + 2}" data-t="${esc(t)}">
      <span class="top"><span class="tn">${esc(t)}</span><span class="pill live">${take ? 'Parcel' : 'Running'}</span></span>
      <span class="ts">${plural(c.count, 'item')}${c.o.openedAt ? ' · ' + since(c.o.openedAt) : ''}</span>
      <span class="tv num">${inr(c.total)}</span>
    </button>` : `
    <button class="tcard free anim" style="--i:${n + 2}" data-t="${esc(t)}">
      <span class="top"><span class="tn">${esc(t)}</span><span class="pill free">Free</span></span>
      <span class="tv">Tap to start an order</span>
    </button>`).join('')
    + (tFilter === 'busy' && !list.length ? `<div class="empty" style="grid-column:1/-1">${IC.plate}No tables are running right now.</div>` : '')
    + (tFilter !== 'busy' ? `<button class="tcard add anim" style="--i:${list.length + 2}" id="quickAddTable"><span class="plus">${IC.plus}</span>Add table</button>` : '');
}
// Long-press (or right-click) a table for quick actions
let lp = null, lpFired = false;
$('tableGrid').addEventListener('touchstart', e => {
  const c = e.target.closest('.tcard[data-t]'); if (!c) return;
  lpFired = false;
  lp = setTimeout(() => { lpFired = true; hap('medium'); tableActions(c.dataset.t); }, 480);
}, { passive: true });
['touchmove', 'touchend', 'touchcancel'].forEach(ev => $('tableGrid').addEventListener(ev, () => clearTimeout(lp), { passive: true }));
$('tableGrid').addEventListener('contextmenu', e => {
  const c = e.target.closest('.tcard[data-t]'); if (!c) return;
  e.preventDefault(); tableActions(c.dataset.t);
});
$('tableGrid').onclick = e => {
  if (lpFired) { lpFired = false; return; }
  if (e.target.closest('#quickAddTable')) return addTablePrompt();
  const c = e.target.closest('.tcard[data-t]'); if (!c) return;
  hap('light');
  openTable(c.dataset.t);
};
// Takeaway: every tap starts a new parcel order, numbered with the lowest free number (Takeaway 1, 2, 3…).
// It appears on the Tables screen once a dish is added, and goes away when its bill is saved or cleared.
const isTakeaway = name => /^Takeaway( \d+)?$/i.test(String(name));
const takeNo = t => +(/\d+$/.exec(t)?.[0] || 0);
const runningTakeaways = () => Object.keys(S.orders).filter(t => isTakeaway(t) && calc(t).count).sort((a, b) => takeNo(a) - takeNo(b));
function nextTakeaway() {
  const used = new Set(Object.keys(S.orders).filter(isTakeaway).map(takeNo));
  let n = 1; while (used.has(n)) n++;
  return 'Takeaway ' + n;
}
$('quickTakeaway').onclick = () => { hap('light'); openTable(nextTakeaway()); };
function openTable(t) { current = t; search = ''; $('search').value = ''; show('order', 'fwd'); }

function tableActions(t) {
  const c = calc(t);
  const row = (act, icon, l1, l2, danger) => `<button class="li" data-ta="${act}"><span class="ic" ${danger ? 'style="color:var(--danger)"' : ''}>${icon}</span><span class="body"><span class="l1" ${danger ? 'style="color:var(--danger)"' : ''}>${l1}</span>${l2 ? `<span class="l2">${l2}</span>` : ''}</span>${IC.chev.replace('<svg', '<svg class="chev"')}</button>`;
  openSheet(`<div class="dlg" style="text-align:left"><h3>${esc(t)}</h3><p style="margin:0 0 14px">${c.count ? `${plural(c.count, 'item')} · ${inr(c.total)}${c.o.openedAt ? ' · open ' + since(c.o.openedAt) : ''}` : 'No running order'}</p></div>
    <div class="card list">
      ${row('open', IC.receipt, c.count ? 'Open order' : 'Start an order')}
      ${c.count ? row('move', IC.table, 'Move to another table', 'Customers changed tables') : ''}
      ${c.count ? row('clear', IC.trash, 'Clear order', '', true) : ''}
    </div>
    <button class="btn text" data-x style="margin-top:8px">Close</button>`);
  $('sheetBody').querySelector('[data-x]').onclick = closeSheet;
  $('sheetBody').querySelector('.list').onclick = e => {
    const a = e.target.closest('[data-ta]')?.dataset.ta; if (!a) return;
    if (a === 'open') { closeSheet(); openTable(t); }
    if (a === 'clear') confirmBox(`Clear ${t}?`, `All items for ${t} will be removed.`, 'Clear order', () => { delete S.orders[t]; save(); renderTables(); toast('Order cleared'); });
    if (a === 'move') {
      // Free tables, plus "new takeaway" when the customers decide to take it home
      const free = S.tables.filter(x => x !== t && !calc(x).count);
      if (!isTakeaway(t)) free.unshift(nextTakeaway());
      openSheet(`<div class="dlg" style="text-align:left"><h3>Move ${esc(t)} to…</h3><p style="margin:0 0 14px">Only free tables are shown.</p></div>
        <div class="card list">${free.map(x => `<button class="li" data-to="${esc(x)}"><span class="ic">${isTakeaway(x) ? IC.bag : IC.table}</span><span class="body"><span class="l1">${isTakeaway(x) ? 'New takeaway' : esc(x)}</span>${isTakeaway(x) ? `<span class="l2">Pack it as ${esc(x)}</span>` : ''}</span>${IC.chev.replace('<svg', '<svg class="chev"')}</button>`).join('') || '<div class="empty">All tables are busy.</div>'}</div>
        <button class="btn text" data-x style="margin-top:8px">Cancel</button>`);
      $('sheetBody').querySelector('[data-x]').onclick = closeSheet;
      $('sheetBody').querySelector('.list').onclick = ev => {
        const to = ev.target.closest('[data-to]')?.dataset.to; if (!to) return;
        S.orders[to] = S.orders[t]; delete S.orders[t]; save();
        closeSheet(); hap('success'); renderTables(); toast(`Order moved to ${to}`);
      };
    }
  };
}
$('tFilter').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  tFilter = b.dataset.f; hap('select');
  $('tFilter').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  moveThumb($('tFilter'));
  document.body.classList.add('entering'); clearTimeout(enterT); enterT = setTimeout(() => document.body.classList.remove('entering'), 700);
  renderTables();
};
function addTablePrompt() {
  promptBox('Add a table', 'e.g. Table 7, Room 101', 'Add table', v => {
    if (isTakeaway(v)) { toast('Takeaway names are used for parcel orders', IC.warn); return false; }
    if (S.tables.includes(v)) { toast('A table with this name already exists', IC.warn); return false; }
    S.tables.push(v); save(); renderTables(); if (tab === 'settings') renderSettings(); toast(`${v} added`);
  });
}

/* ---------- Order screen ---------- */
// The order screen opens on one category at a time (short list); "All" and search are there for everything else.
// The chosen category stays while moving between tables.
let cat = null, search = '';
function renderOrder() {
  $('orderTitle').textContent = current;
  renderChips(); renderMenu(); renderCart();
}
function renderChips() {
  const used = S.cats.filter(c => S.menu.some(m => m.cat === c));
  if (cat !== 'All' && !used.includes(cat)) cat = used[0] || 'All';
  $('chips').innerHTML = [['All', S.menu.length], ...used.map(c => [c, S.menu.filter(m => m.cat === c).length])]
    .map(([c, n]) => `<button class="chip ${c === cat ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}<span class="c">${n}</span></button>`).join('');
}
$('chips').onclick = e => {
  const b = e.target.closest('.chip'); if (!b) return;
  cat = b.dataset.c; hap('select'); renderChips();
  document.body.classList.add('entering'); clearTimeout(enterT); enterT = setTimeout(() => document.body.classList.remove('entering'), 600);
  renderMenu();
  $('chips').querySelector('.chip.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduced.matches ? 'auto' : 'smooth' });
  // If the list was scrolled down, jump back to the top of the chosen category (just under the pinned bar)
  const top = $('menuGrid').getBoundingClientRect().top + scrollY - $('chips').offsetHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--order-bar')) || 0);
  if (scrollY > top) scrollTo({ top, behavior: 'auto' });
};
$('search').oninput = e => { search = e.target.value.trim().toLowerCase(); renderMenu(); };
// Keep the category chips pinned right under the order screen's header, whatever its height
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--order-bar', Math.round(e.target.getBoundingClientRect().height) + 'px'))
  .observe(document.querySelector('#s-order .appbar'));

function dishRow(m, q, showCat) {
  return `<div class="dish ${q ? 'in' : ''}" data-id="${m.id}" role="button" tabindex="0" aria-label="Add ${esc(m.name)}">
      <span class="dt"><span class="dn">${esc(m.name)}</span><span class="dp num">${inr(m.price)}${showCat ? `<span class="dc"> · ${esc(m.cat)}</span>` : ''}</span></span>
      ${q ? `<span class="mini-step"><i data-minus aria-label="Remove one">−</i><span class="num qv">${q}</span><i aria-label="Add one">+</i></span>`
          : `<span class="add">${IC.plus}</span>`}
    </div>`;
}
function renderMenu() {
  const items = order(current).items;
  const list = S.menu.filter(m => (cat === 'All' || m.cat === cat) && m.name.toLowerCase().includes(search));
  // Group by category in menu order; a search shows one flat list with each dish's category
  const order_ = [...S.cats, ...new Set(list.map(m => m.cat).filter(c => !S.cats.includes(c)))];
  const groups = search ? [[null, list]] : order_.map(c => [c, list.filter(m => m.cat === c)]).filter(([, l]) => l.length);
  $('menuGrid').innerHTML = groups.map(([c, l], n) => `<section class="mgroup anim" style="--i:${n + 2}">
      ${c && cat === 'All' ? `<div class="mcat">${esc(c)}<span>${l.length}</span></div>` : ''}
      <div class="card mlist">${l.map(m => dishRow(m, items[m.id] || 0, !!search)).join('')}</div>
    </section>`).join('') || (S.menu.length
    ? `<div class="empty" style="grid-column:1/-1">${IC.plate}No dish matches “${esc(search)}”.<br>Add it in Settings → Menu.</div>`
    : `<div class="empty" style="grid-column:1/-1">${IC.plate}<b style="color:var(--ink)">Your menu is empty</b>Add your dishes and prices once, then tap them here to take orders.<button class="btn dark" id="goMenu" style="width:auto;padding:0 22px;height:46px;margin-top:6px">Add dishes</button></div>`);
  const go = $('goMenu');
  if (go) go.onclick = e => { e.stopPropagation(); show('settings', 'fwd'); setTimeout(() => $('newDish').focus(), 450); };
}
function tapDish(el, minus) {
  setQty(el.dataset.id, minus ? -1 : 1);
  hap('light');
  renderMenu(); renderCart();
  const card = $('menuGrid').querySelector(`.dish[data-id="${el.dataset.id}"]`);
  if (card && !minus) { replay(card, 'ring'); replay(card.querySelector('.qv'), 'pop'); }
  replay($('cbCount'), 'pop');
}
$('menuGrid').onclick = e => { const d = e.target.closest('.dish'); if (d) tapDish(d, !!e.target.closest('[data-minus]')); };
$('menuGrid').onkeydown = e => { const d = e.target.closest('.dish'); if (d && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tapDish(d, false); } };

function cartHTML() {
  const c = calc(current);
  if (!c.count) return `<div class="bill-head"><h3>Bill</h3></div><div class="empty">${IC.receipt}Tap a dish to start the order.</div>`;
  return `
    <div class="bill-head"><h3>Bill</h3><button class="link-btn danger" data-act="clear">Clear</button></div>
    <div class="sub" style="color:var(--mute);font-size:13px">${esc(current)} · ${plural(c.count, 'item')}</div>
    <div class="lines">${c.lines.map(l => `
      <div class="line">
        <div class="ln">${esc(l.d.name)}</div>
        <div class="stepper"><button data-q="${l.d.id}" data-d="-1" aria-label="Remove one">${IC.minus}</button><span class="num">${l.qty}</span><button data-q="${l.d.id}" data-d="1" aria-label="Add one">${IC.plus}</button></div>
        <div class="lp num">${inr(l.d.price)} × ${l.qty} = <b style="color:var(--ink)">${inr(l.d.price * l.qty)}</b></div>
      </div>`).join('')}
    </div>
    <div class="group-label">Discount and tax</div>
    <div class="row">
      <div class="affix lab"><label>Discount</label><input data-f="disc" type="number" inputmode="decimal" value="${+c.o.disc || 0}"><span>%</span></div>
      <div class="affix lab"><label>GST</label><input data-f="gst" type="number" inputmode="decimal" value="${c.gstPct}"><span>%</span></div>
    </div>
    <div class="group-label">Payment</div>
    <div class="seg" data-payseg><span class="thumb"></span>${PAY_MODES.map(p => `<button data-pay="${p}" class="${(PAY_MODES.includes(c.o.pay) ? c.o.pay : 'Cash') === p ? 'on' : ''}">${PAY_IC[p]}${p}</button>`).join('')}</div>
    <div class="summary">
      <div class="sr"><span>Subtotal</span><span class="num">${inr(c.sub)}</span></div>
      <div class="sr" data-row="disc" ${c.disc ? '' : 'hidden'}><span>Discount</span><span class="num" data-v="disc">−${inr(c.disc)}</span></div>
      <div class="sr" data-row="tax" ${c.tax ? '' : 'hidden'}><span>GST</span><span class="num" data-v="tax">+${inr(c.tax)}</span></div>
      <div class="total"><span>Total</span><b class="num" data-total>${inr(c.total)}</b></div>
    </div>
    <div class="stack" style="margin-top:16px">
      <button class="btn ghost" data-act="qr" ${qrV && c.o.pay === 'UPI' ? '' : 'hidden'}>${IC.qr}Show UPI QR · <span data-qrlabel>${inr(c.total)}</span></button>
      <button class="btn gold" data-act="save">${IC.check}<span data-savelabel>Save bill · ${inr(c.total)}</span></button>
    </div>`;
}

// Full-screen QR for the customer to scan. back: what "Back" does (re-open the bill, or the receipt)
function showQR(amount, label, back) {
  if (!qrV) return toast('Upload your UPI QR code in Settings first', IC.info);
  openSheet(`<div class="qr-pay">
      <div class="dlg"><h3>Scan to pay</h3></div>
      <div class="amt num">${inr(amount)}</div>
      <div class="sub">${esc(label)}</div>
      <img class="qr-big" src="${qrUrl()}" alt="UPI QR code">
    </div>
    <button class="btn dark" data-x>${back ? 'Back' : 'Close'}</button>`);
  hap('light');
  $('sheetBody').querySelector('[data-x]').onclick = () => { if (back) back(); else closeSheet(); };
}
function renderCart() {
  const c = calc(current);
  $('orderSub').textContent = c.count ? `${plural(c.count, 'item')} · ${inr(c.total)}` : 'New order';
  $('cartBar').classList.toggle('hidden', !c.count);
  $('cbTotal').textContent = inr(c.total);
  $('cbCount').textContent = c.count;
  $('cbLabel').textContent = c.o.disc ? `${current} · ${c.o.disc}% off` : current;
  // Don't re-render a bill whose input the user is typing into
  const side = $('cartSide');
  if (!side.contains(document.activeElement)) { side.innerHTML = cartHTML(); fixSeg(side); }
  if ($('sheet').classList.contains('on') && $('sheetBody').querySelector('[data-cart]') && !$('sheetBody').contains(document.activeElement)) {
    if (!c.count) closeSheet(); else { $('sheetBody').innerHTML = `<div data-cart>${cartHTML()}</div>`; fixSeg($('sheetBody')); }
  }
}
function fixSeg(root) { const s = root.querySelector('[data-payseg]'); if (s) requestAnimationFrame(() => moveThumb(s)); }
function updateTotalsOnly() {
  const c = calc(current);
  document.querySelectorAll('[data-total]').forEach(el => { el.textContent = inr(c.total); replay(el, 'bump'); });
  document.querySelectorAll('[data-savelabel]').forEach(el => el.textContent = 'Save bill · ' + inr(c.total));
  document.querySelectorAll('[data-qrlabel]').forEach(el => el.textContent = inr(c.total));
  document.querySelectorAll('[data-v=disc]').forEach(el => { el.textContent = '−' + inr(c.disc); el.parentElement.hidden = !c.disc; });
  document.querySelectorAll('[data-v=tax]').forEach(el => { el.textContent = '+' + inr(c.tax); el.parentElement.hidden = !c.tax; });
  $('cbTotal').textContent = inr(c.total);
  $('orderSub').textContent = `${plural(c.count, 'item')} · ${inr(c.total)}`;
}
$('cartBar').onclick = () => { openSheet(`<div data-cart>${cartHTML()}</div>`); fixSeg($('sheetBody')); };

// One handler for the bill in both the side panel and the sheet
function cartClick(e) {
  const q = e.target.closest('[data-q]');
  if (q) {
    setQty(q.dataset.q, +q.dataset.d); hap('light'); renderMenu(); forceCart();
    document.querySelectorAll('[data-total]').forEach(el => replay(el, 'bump'));
    return;
  }
  const p = e.target.closest('[data-pay]');
  if (p && S.orders[current]) {
    S.orders[current].pay = p.dataset.pay; save(); hap('select');
    const seg = p.closest('.seg'); seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === p)); moveThumb(seg);
    // keep the other copy (side panel / sheet) in sync without re-rendering this one
    document.querySelectorAll('[data-payseg]').forEach(s => { if (s !== seg) { s.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.pay === p.dataset.pay)); moveThumb(s); } });
    document.querySelectorAll('[data-act=qr]').forEach(b => b.hidden = !(qrV && p.dataset.pay === 'UPI'));
    return;
  }
  const a = e.target.closest('[data-act]');
  if (a && a.dataset.act === 'save') return saveBill(a);
  if (a && a.dataset.act === 'qr') {
    const inSheet = !!a.closest('#sheetBody');
    return showQR(calc(current).total, current, inSheet ? () => $('cartBar').click() : null);
  }
  if (a && a.dataset.act === 'clear') confirmBox('Clear this order?', `All items for ${current} will be removed.`, 'Clear order', () => {
    delete S.orders[current]; save(); renderMenu(); forceCart(); toast('Order cleared');
  });
}
function cartInput(e) {
  const f = e.target.dataset.f; if (!f || !S.orders[current]) return;
  const v = Math.max(0, +e.target.value || 0);
  S.orders[current][f] = f === 'disc' ? Math.min(v, 100) : v;
  save(); updateTotalsOnly();
}
function forceCart() { document.activeElement?.blur?.(); renderCart(); }
$('cartSide').addEventListener('click', cartClick);
$('cartSide').addEventListener('input', cartInput);
$('sheetBody').addEventListener('click', e => { if (e.target.closest('[data-cart]')) cartClick(e); });
$('sheetBody').addEventListener('input', e => { if (e.target.closest('[data-cart]')) cartInput(e); });
$('backBtn').onclick = () => show('tables', 'back');

// The server gives the bill its number and clears the table's order in one step
let savingBill = false;
async function saveBill(btn) {
  const c = calc(current); if (!c.count || savingBill) return;
  savingBill = true;
  const label = btn?.querySelector('[data-savelabel]');
  if (label) label.textContent = 'Saving…';
  const table = current;
  const draft = {
    time: Date.now(), table, pay: PAY_MODES.includes(c.o.pay) ? c.o.pay : 'Cash',
    items: c.lines.map(l => ({ name: l.d.name, price: l.d.price, qty: l.qty })),
    sub: c.sub, discPct: +c.o.disc || 0, d: c.disc, gstPct: c.gstPct, tax: c.tax, total: c.total
  };
  let bill;
  try { bill = await api('POST', '/api/bills', { bill: draft }); }
  catch (e) {
    savingBill = false;
    if (label) label.textContent = 'Save bill · ' + inr(c.total);
    if (!(e instanceof AuthError)) { setOnline(false); toast('Bill not saved. Check the internet and try again.', IC.warn); }
    return;
  }
  savingBill = false;
  (billsByDay[dayKey(bill.time)] ||= []).push(bill);
  delete S.orders[table];
  delete syncedOrders[table]; // the server already cleared it
  hap('success');
  renderMenu(); renderCart();
  showReceipt(bill, true);
}

/* ---------- Receipt / printing ---------- */
function receiptHTML(b) {
  const st = S.settings;
  const dt = new Date(b.time);
  return `<div class="slip">
    <div class="rh"><b>${esc(st.name)}</b>
      ${st.addr ? `<div>${esc(st.addr)}</div>` : ''}${st.phone ? `<div>Mo: ${esc(st.phone)}</div>` : ''}${st.gstin ? `<div>GSTIN: ${esc(st.gstin)}</div>` : ''}
    </div>
    <hr>
    <div class="rr"><span>Bill #${b.id}</span><span>${esc(b.table)}</span></div>
    <div class="rr" style="color:var(--mute)"><span>${dt.toLocaleDateString('en-IN')}</span><span>${dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></div>
    <hr>
    ${b.items.map(i => `<div class="rr"><span>${esc(i.name)} × ${i.qty}</span><span class="num">${inr(i.price * i.qty)}</span></div>`).join('')}
    <hr>
    <div class="rr"><span>Subtotal</span><span class="num">${inr(b.sub)}</span></div>
    ${b.d > 0 ? `<div class="rr"><span>Discount${b.discPct ? ' ' + b.discPct + '%' : ''}</span><span class="num">−${inr(b.d)}</span></div>` : ''}
    ${b.tax > 0 ? `<div class="rr"><span>CGST ${(b.gstPct || 0) / 2}%</span><span class="num">${inr(b.tax / 2)}</span></div><div class="rr"><span>SGST ${(b.gstPct || 0) / 2}%</span><span class="num">${inr(b.tax / 2)}</span></div>` : ''}
    <div class="rr rt"><span>Total</span><span class="num">${inr(b.total)}</span></div>
    <div class="rr" style="color:var(--mute)"><span>Paid by</span><span>${esc(b.pay)}</span></div>
    ${b.void ? '<div class="stamp"><span class="pill void">Cancelled</span></div>' : ''}
    ${st.footer ? `<div class="rf">${esc(st.footer)}</div>` : ''}
  </div>`;
}
function showReceipt(b, fresh) {
  openSheet(`
    ${fresh ? `<div class="dlg"><div class="done-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h3>Bill saved</h3><p style="margin:0">${esc(b.table)} · ${inr(b.total)} · ${esc(b.pay)}</p></div>`
             : `<div class="dlg" style="text-align:left"><h3>Bill #${b.id}</h3></div>`}
    ${receiptHTML(b)}
    <div class="stack">
      ${qrV && b.pay === 'UPI' && !b.void ? `<button class="btn dark" data-r="qr">${IC.qr}Show UPI QR · ${inr(b.total)}</button>` : ''}
      <button class="btn ${fresh ? 'dark' : 'text'}" data-r="done">${fresh ? 'Done' : 'Close'}</button>
      ${!fresh && !b.void ? '<button class="btn text" style="color:var(--danger)" data-r="void">Cancel this bill</button>' : ''}
    </div>`, fresh ? () => show('tables') : null);
  const qb = $('sheetBody').querySelector('[data-r=qr]');
  if (qb) qb.onclick = () => showQR(b.total, `Bill #${b.id} · ${b.table}`, () => showReceipt(b, fresh));
  $('sheetBody').querySelector('[data-r=done]').onclick = closeSheet;
  const v = $('sheetBody').querySelector('[data-r=void]');
  if (v) v.onclick = () => confirmBox(`Cancel bill #${b.id}?`, 'It stays in the list marked as cancelled and is removed from sales totals.', 'Cancel bill', async () => {
    try { await api('PATCH', `/api/bills/${b.id}`, { void: true }); }
    catch (e) { if (!(e instanceof AuthError)) toast('Could not cancel the bill. Check the internet.', IC.warn); return; }
    for (const d in billsByDay) billsByDay[d].forEach(x => { if (x.id === b.id) x.void = true; });
    renderBills(); toast(`Bill #${b.id} cancelled`);
  });
}

/* ---------- Bills screen ---------- */
$('billDate').value = dayKey(Date.now());
$('billDate').onchange = () => { document.body.classList.add('entering'); clearTimeout(enterT); enterT = setTimeout(() => document.body.classList.remove('entering'), 900); renderBills(); };
const billDay = () => $('billDate').value || dayKey(Date.now());
function dayBills() { return billsByDay[billDay()] || []; }
function renderBills() {
  const day = billDay();
  ensureDay(day, () => { if (tab === 'bills' && billDay() === day) renderBills(); });
  const all = dayBills(), live = all.filter(b => !b.void);
  const total = live.reduce((a, b) => a + b.total, 0);
  const isToday = day === dayKey(Date.now());
  $('dayLabel').textContent = isToday ? "Today's sales" : 'Sales on ' + new Date(dayRange(day)[0]).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  countTo($('dayAmt'), total, rupees);
  countTo($('dBills'), live.length, whole);
  countTo($('dAvg'), live.length ? total / live.length : 0, rupees);
  countTo($('dItems'), live.reduce((a, b) => a + b.items.reduce((x, i) => x + i.qty, 0), 0), whole);

  $('payStats').innerHTML = PAY_MODES.map((p, n) => {
    const v = live.filter(b => b.pay === p).reduce((a, b) => a + b.total, 0);
    return `<div class="card pay anim" style="--i:${n + 2}"><div class="k">${PAY_IC[p]}${p}</div><div class="v num">${inr(v)}</div><div class="meter"><i style="width:${total ? v / total * 100 : 0}%"></i></div></div>`;
  }).join('');

  const qty = {};
  live.forEach(b => b.items.forEach(i => qty[i.name] = (qty[i.name] || 0) + i.qty));
  const top = Object.entries(qty).sort((a, b) => b[1] - a[1]).slice(0, 5);
  $('topItemsWrap').classList.toggle('hidden', !top.length);
  const max = top[0]?.[1] || 1;
  $('topItems').innerHTML = top.map(([n, q], i) => `<div class="rank"><span class="rn">${i + 1}</span><span style="font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n)}</span><span class="rq num">${q} sold</span><div class="meter"><i style="width:${q / max * 100}%;animation-delay:${i * 80}ms"></i></div></div>`).join('');

  $('billCount').textContent = all.length || '';
  $('billList').innerHTML = all.slice().reverse().map(b => `
    <button class="li ${b.void ? 'void' : ''}" data-id="${b.id}">
      <span class="ic num">#${b.id}</span>
      <span class="body"><span class="l1">${esc(b.table)}</span><span class="l2">${new Date(b.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · ${plural(b.items.reduce((x, i) => x + i.qty, 0), 'item')}</span></span>
      <span class="end"><span class="amt num">${inr(b.total)}</span>${b.void ? '<span class="pill void">Cancelled</span>' : `<span class="pill free">${esc(b.pay)}</span>`}</span>
    </button>`).join('') || `<div class="empty">${IC.receipt}${billsByDay[day] ? 'No bills on this day yet.' : 'Loading bills…'}</div>`;
  $('csvBtn').disabled = !all.length;
  $('csvBtn').style.opacity = all.length ? '' : '.4';
}
$('billList').onclick = e => {
  const li = e.target.closest('.li'); if (!li) return;
  const b = dayBills().find(x => x.id == li.dataset.id); if (b) showReceipt(b, false);
};
$('csvBtn').onclick = () => {
  const rows = [['Bill', 'Date', 'Time', 'Table', 'Payment', 'Items', 'Subtotal', 'Discount', 'GST', 'Total', 'Status']];
  dayBills().forEach(b => { const d = new Date(b.time); rows.push([b.id, d.toLocaleDateString('en-IN'), d.toLocaleTimeString('en-IN'), b.table, b.pay, b.items.map(i => `${i.name} x${i.qty}`).join('; '), b.sub, b.d.toFixed(2), b.tax.toFixed(2), b.total, b.void ? 'Cancelled' : 'Paid']); });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile(`bills_${billDay()}.csv`, csv, 'text/csv');
};

/* ---------- Settings screen ---------- */
/* Theme: 'system' | 'light' | 'dark', kept per phone */
const getTheme = () => { try { return localStorage.getItem('bapa_theme') || 'system'; } catch (e) { return 'system'; } };
function applyTheme() {
  const t = getTheme();
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name=theme-color]').forEach(m => { m.content = dark ? '#0f0e0d' : '#f4f3f0'; m.removeAttribute('media'); });
  document.querySelectorAll('#themeSeg button').forEach(b => { const on = b.dataset.theme === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  moveThumb($('themeSeg'));
}
$('themeSeg').onclick = e => {
  const b = e.target.closest('[data-theme]'); if (!b) return;
  try { localStorage.setItem('bapa_theme', b.dataset.theme); } catch (err) {}
  applyTheme(); hap('select');
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* UPI QR code in Settings */
function renderQrBox() {
  $('qrBox').innerHTML = `<div class="qr-set">
      ${qrV ? `<img class="qr-thumb" src="${qrUrl()}" alt="Your UPI QR code">` : `<div class="qr-empty">${IC.qr}</div>`}
      <div class="stack">
        <button class="btn ${qrV ? 'ghost' : 'dark'}" data-qr="pick">${qrV ? 'Change QR code' : 'Upload QR code'}</button>
        ${qrV ? `<button class="btn text" style="color:var(--danger);height:36px" data-qr="del">Remove</button>` : '<span class="sec-note" style="margin:0">A photo or screenshot of your UPI QR (PhonePe, GPay, Paytm, bank).</span>'}
      </div>
    </div>`;
}
$('qrBox').onclick = e => {
  const a = e.target.closest('[data-qr]')?.dataset.qr; if (!a) return;
  if (a === 'pick') $('qrFile').click();
  if (a === 'del') confirmBox('Remove the QR code?', 'Bills paid by UPI will no longer show a QR code until you upload one again.', 'Remove', async () => {
    try { await api('DELETE', '/api/qr'); }
    catch (err) { if (!(err instanceof AuthError)) toast('Could not remove. Check the internet.', IC.warn); return; }
    qrV = null; renderQrBox(); toast('QR code removed');
  });
};
// Shrink the photo on the phone before upload (max 900px), so it loads fast and stays small in the database
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const png = c.toDataURL('image/png');
      resolve(png.length < 1.4e6 ? png : c.toDataURL('image/jpeg', .9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not an image')); };
    img.src = url;
  });
}
$('qrFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  let image;
  try { image = await shrinkImage(f); } catch (err) { return toast('This file is not an image', IC.warn); }
  toast('Uploading…', IC.info);
  try { qrV = (await api('PUT', '/api/qr', { image })).v; }
  catch (err) { if (!(err instanceof AuthError)) toast(err.message || 'Upload failed', IC.warn); return; }
  renderQrBox(); hap('success'); toast('QR code saved');
};

// Categories in Settings → Menu start folded so a long menu doesn't make the page endless
const openCats = new Set();
function renderSettings() {
  applyTheme();
  renderQrBox();
  const cats = [...S.cats, ...new Set(S.menu.map(m => m.cat).filter(c => !S.cats.includes(c)))];
  const keepCat = $('newCat').value;
  // With no categories yet, new dishes go under "General" until the user adds their own
  $('newCat').innerHTML = (cats.length ? cats : ['General']).map(c => `<option>${esc(c)}</option>`).join('');
  if (cats.includes(keepCat)) $('newCat').value = keepCat;
  $('dishCount').textContent = S.menu.length || '';
  $('menuEdit').innerHTML = !cats.length ? `<div class="card empty anim" style="--i:6">${IC.plate}No dishes yet. Add your first dish above.</div>` : cats.map((c, n) => {
    const items = S.menu.filter(m => m.cat === c);
    const open = openCats.has(c);
    return `<div class="card cat-card anim ${open ? 'open' : ''}" style="--i:${Math.min(n, 8) + 6}">
      <div class="cat-top" ${items.length ? `data-toggle="${esc(c)}" role="button" tabindex="0" aria-expanded="${open}"` : ''}><b>${esc(c)}</b><span class="count">${plural(items.length, 'dish').replace('dishs', 'dishes')}</span>${items.length ? IC.chev.replace('<svg', '<svg class="cat-chev"') : `<button class="del" data-delcat="${esc(c)}" aria-label="Delete category ${esc(c)}">${IC.trash}</button>`}</div>
      ${items.length && open ? `<div class="list" style="border-top:1px solid var(--line)">${items.map(m => `<div class="me" data-id="${m.id}">
        <input data-k="name" value="${esc(m.name)}" aria-label="Dish name">
        <div class="affix"><input data-k="price" type="number" inputmode="decimal" value="${m.price}" aria-label="Price"><span>₹</span></div>
        <button class="del" data-del="${m.id}" aria-label="Delete ${esc(m.name)}">${IC.trash}</button>
      </div>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
  $('tableCount2').textContent = S.tables.length;
  $('tableEdit').innerHTML = S.tables.map((t, i) => `<div class="trow" data-i="${i}">
      <span class="li" style="padding:0;min-height:0;width:auto"><span class="ic">${IC.table}</span></span>
      <input data-tk value="${esc(t)}" aria-label="Table name">
      <button class="del" data-deltable="${i}" aria-label="Delete ${esc(t)}">${IC.trash}</button>
    </div>`).join('');
}
$('menuEdit').oninput = e => {
  const row = e.target.closest('.me'); if (!row) return;
  const m = dish(row.dataset.id); if (!m) return;
  m[e.target.dataset.k] = e.target.dataset.k === 'price' ? Math.max(0, +e.target.value || 0) : e.target.value;
  save();
};
$('menuEdit').onclick = e => {
  const d = e.target.closest('[data-del]');
  if (d) {
    const m = dish(d.dataset.del);
    return confirmBox(`Delete ${m.name}?`, 'It will be removed from the menu and from any running orders. Saved bills are not affected.', 'Delete dish', () => {
      S.menu = S.menu.filter(x => x.id !== m.id);
      for (const t in S.orders) { delete S.orders[t].items[m.id]; if (!Object.keys(S.orders[t].items).length) delete S.orders[t]; }
      save(); renderSettings(); toast(`${m.name} deleted`);
    });
  }
  const c = e.target.closest('[data-delcat]');
  if (c) { S.cats = S.cats.filter(x => x !== c.dataset.delcat); save(); renderSettings(); toast('Category deleted'); return; }
  // Tap a category heading to open or fold its dishes
  const t = e.target.closest('[data-toggle]');
  if (t) { const k = t.dataset.toggle; openCats.has(k) ? openCats.delete(k) : openCats.add(k); hap('select'); renderSettings(); }
};
$('menuEdit').onkeydown = e => { const t = e.target.closest('[data-toggle]'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); t.click(); } };
$('addDishBtn').onclick = () => {
  const name = $('newDish').value.trim(), price = Math.max(0, +$('newPrice').value || 0);
  if (!name) { $('newDish').focus(); return toast('Enter a dish name', IC.info); }
  if (!price) { $('newPrice').focus(); return toast('Enter a price', IC.info); }
  const cat = $('newCat').value || 'General';
  if (!S.cats.includes(cat)) S.cats.push(cat);
  S.menu.push({ id: Date.now(), name, price, cat });
  openCats.add(cat); // show the new dish in its category
  save(); $('newDish').value = ''; $('newPrice').value = ''; renderSettings(); toast(`${name} added to the menu`);
};
$('addCatBtn').onclick = () => promptBox('Add a category', 'e.g. Starters, Sweets', 'Add category', v => {
  if (S.cats.includes(v)) { toast('Category already exists', IC.warn); return false; }
  S.cats.push(v); save(); renderSettings(); $('newCat').value = v; toast(`${v} added`);
});
$('tableEdit').addEventListener('change', e => {
  if (!e.target.matches('[data-tk]')) return;
  const i = +e.target.closest('.trow').dataset.i, old = S.tables[i], v = e.target.value.trim();
  if (isTakeaway(v)) { e.target.value = old; return toast('Takeaway names are used for parcel orders', IC.warn); }
  if (!v || (v !== old && S.tables.includes(v))) { e.target.value = old; return toast(v ? 'A table with this name already exists' : 'Name can\'t be empty', IC.warn); }
  S.tables[i] = v;
  if (S.orders[old]) { S.orders[v] = S.orders[old]; delete S.orders[old]; }
  if (current === old) current = v;
  save();
});
$('tableEdit').onclick = e => {
  const d = e.target.closest('[data-deltable]'); if (!d) return;
  const t = S.tables[+d.dataset.deltable];
  const busy = calc(t).count;
  confirmBox(`Delete ${t}?`, busy ? `${t} has a running order of ${inr(calc(t).total)}. It will be removed too.` : 'You can add it again any time.', 'Delete table', () => {
    S.tables = S.tables.filter(x => x !== t); delete S.orders[t];
    if (current === t) current = 'Takeaway';
    save(); renderSettings(); toast(`${t} deleted`);
  });
};
// Change the sign-in password (this phone stays signed in)
$('pwForm').onsubmit = async e => {
  e.preventDefault();
  const cur = $('pwCur').value, next = $('pwNew').value, again = $('pwNew2').value;
  if (!cur) { $('pwCur').focus(); return toast('Enter the current password', IC.info); }
  if (next.length < 4) { $('pwNew').focus(); return toast('New password must be at least 4 characters', IC.info); }
  if (next !== again) { $('pwNew2').focus(); return toast('The new passwords don\'t match', IC.warn); }
  const btn = $('pwBtn'); btn.disabled = true; btn.textContent = 'Changing…';
  try {
    const r = await fetch('/api/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: cur, next }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { location.href = '/login'; return; }
    if (!r.ok) { toast(j.error || 'Could not change the password', IC.warn); if (/current/i.test(j.error || '')) $('pwCur').focus(); return; }
    ['pwCur', 'pwNew', 'pwNew2'].forEach(id => $(id).value = '');
    document.activeElement?.blur?.();
    hap('success'); toast('Password changed');
  } catch (err) { toast('No internet. Password not changed.', IC.warn); }
  finally { btn.disabled = false; btn.textContent = 'Change password'; }
};
$('addTableBtn').onclick = () => {
  const v = $('newTable').value.trim();
  if (!v) { $('newTable').focus(); return; }
  if (isTakeaway(v)) return toast('Takeaway names are used for parcel orders', IC.warn);
  if (S.tables.includes(v)) return toast('A table with this name already exists', IC.warn);
  S.tables.push(v); save(); $('newTable').value = ''; renderSettings(); toast(`${v} added`);
};

/* ---------- Download (CSV) ---------- */
async function downloadFile(name, text, type) {
  const blob = new Blob([text], { type });
  // Phones: the share sheet lets the user save to Files or send on WhatsApp
  try {
    const file = new File([blob], name, { type });
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
// Coming back to the app: get changes from other phones and refresh running-table timers
document.addEventListener('visibilitychange', () => { if (!document.hidden) { pull(); if (tab === 'tables' && !document.body.classList.contains('in-order')) renderTables(); } });
setInterval(() => { if (!document.hidden && tab === 'tables' && !document.body.classList.contains('in-order')) renderTables(); }, 60000);

// Opening animation: when it finishes (or is tapped), reveal the app with its card entrance
function endIntro() {
  const el = $('intro'); if (!el || el.dataset.done) return;
  el.dataset.done = '1';
  el.style.animation = 'introOut .5s var(--ease) forwards';
  setTimeout(() => {
    el.style.display = 'none'; el.id = 'intro-done'; // hidden rather than removed: React owns this node
    applyTheme();
    document.body.classList.add('entering');
    clearTimeout(enterT); enterT = setTimeout(() => document.body.classList.remove('entering'), 900);
    if (tab === 'tables' && !document.body.classList.contains('in-order')) { $('todayAmt').dataset.v = 0; renderTables(); }
  }, 380);
}
if ($('intro')) {
  if (reduced.matches) { $('intro').style.display = 'none'; $('intro').id = 'intro-done'; }
  else { $('intro').onclick = endIntro; setTimeout(endIntro, 2200); }
}

applyTheme();
show('tables');
}
