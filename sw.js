// Service worker: makes the app installable ("Add to Home Screen"), shows notifications about new lessons and keeps
// lesson videos on the phone. The app's texts and lesson list are never cached, so new lessons always load fresh.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ===== lesson videos on the phone (v/<id>.mp4, v/<id>-intro.mp4, and <our server>/v/<file>.mp4 from Cloudflare R2) =====
// A video is downloaded ONCE, whole, in one go: the player, the app's preloading and the frame preparation for
// scrubbing all read that one download (before, each of them fetched the file separately). Ready files stay in the
// phone's storage (up to the limit the person picked in the app, 1 GB by default), so a lesson opened again plays without the internet. If a video was replaced on
// the site, its saved copy is noticed (checked at most once an hour) and dropped.
const VCACHE = 'fedoskin-video-1', VMAX_FILES = 500, AHEAD_PASS = 3 * 1048576;
// How much the saved videos may take — the person picks it in the app (Профиль → «Память на телефоне», owner 09.11.2026,
// «как в Телеграм»): 0 = don't keep videos, else bytes; kept as a small JSON entry in its own cache, which the page writes.
const VCFG = 'fedoskin-vcfg', VLIMIT_KEY = new URL('vlimit.json', self.registration.scope).href, VLIMIT_DEFAULT = 1024 * 1048576;
let limitP = null;
const getLimit = () => limitP || (limitP = caches.open(VCFG).then(c => c.match(VLIMIT_KEY)).then(r => r ? r.json() : null)
  .then(j => j && typeof j.limit === 'number' && j.limit >= 0 ? j.limit : VLIMIT_DEFAULT).catch(() => VLIMIT_DEFAULT));
// the page changed something in the storage: re-read the limit, forget copies kept in memory, trim to the limit
self.addEventListener('message', e => {
  const d = e.data || {};
  // the lesson screen asks how far the video's download has got (the bar on the video's timeline, owner 09.11.2026)
  if (d.type === 'vprog' && d.url && e.ports && e.ports[0]) { e.waitUntil(progress(d.url).then(x => e.ports[0].postMessage(x)).catch(() => {})); return; }
  if (d.type !== 'vcache') return;
  limitP = null;
  if (d.cmd === 'reset') mem.clear(); else if (d.cmd === 'drop' && d.url) mem.delete(d.url);
  e.waitUntil(trim(null));
});
async function trim(keep){
  try {
    const limit = await getLimit(), c = await caches.open(VCACHE), keys = await c.keys(); const sizes = [];
    for (const k of keys) { const r = await c.match(k); sizes.push([k, +(r && r.headers.get('content-length')) || 0]); }
    let total = sizes.reduce((a, x) => a + x[1], 0), n = sizes.length;
    // the oldest saved go first; the one just saved stays unless it alone is over the limit
    for (const [k, sz] of sizes) { if (total <= limit && n <= VMAX_FILES) break; if (k.url === keep && sz <= limit) continue; await c.delete(k); mem.delete(k.url); total -= sz; n--; }
  } catch (_) {}
}
const dl = new Map();   // video address -> download in progress
const mem = new Map();  // the last couple of saved videos, ready in memory
const checked = new Map();
const fin = new Map();  // finished downloads: address -> {total, saved} (saved = false when the person keeps no videos)
async function progress(key){
  const j = dl.get(key);
  if (j && !j.failed && !j.done) return { st: 'dl', got: j.got, total: j.total };
  const m = mem.get(key); if (m) return { st: 'saved', got: m.buf.length, total: m.buf.length };
  const c = await caches.open(VCACHE), hit = await c.match(key);
  if (hit) { const n = +hit.headers.get('content-length') || 0; return { st: 'saved', got: n, total: n }; }
  const f = fin.get(key); if (f) return { st: f.saved ? 'saved' : 'done', got: f.total, total: f.total };
  return { st: APPLE ? 'off' : 'none' };
}
const APPLE = /iPhone|iPad|iPod|Macintosh/.test(self.navigator.userAgent) && !/Chrome|Android/.test(self.navigator.userAgent);
const isVideo = u => /\/v\/[^/]+\.mp4$/.test(u.pathname) && !/-p3\.mp4$/.test(u.pathname);

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url); if (!isVideo(u) || (u.origin !== location.origin && u.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return;
  // iPhone/iPad/Mac Safari: videos load exactly as before, nothing goes through here (a lesson started from a copy kept
  // here showed only its cover there)
  if (APPLE) return;
  e.respondWith(serveVideo(req, u.origin + u.pathname).catch(() => fetch(req)));
});

function parseRange(h){
  const m = /^bytes=(\d+)-(\d*)$/.exec((h || '').trim()); if (!m) return null;
  return { a: +m[1], b: m[2] === '' ? null : +m[2] };
}
function startDl(key, url){
  const j = { key, buf: null, got: 0, total: 0, done: false, failed: false, readers: 0, ac: new AbortController(), wake: new Set(), idle: 0 };
  j.head = (async () => {
    // the address with its pass (R2 videos need one); saved under the address without it
    const r = await fetch(url || key, { signal: j.ac.signal, cache: 'no-store' });
    const total = +r.headers.get('content-length') || 0;
    if (!r.ok || r.status !== 200 || !total || !r.body) { j.failed = true; return; }
    j.total = total; j.buf = new Uint8Array(total);
    j.type = r.headers.get('content-type') || 'video/mp4'; j.etag = r.headers.get('etag') || ''; j.lm = r.headers.get('last-modified') || '';
    j.all = (async () => {
      const rd = r.body.getReader();
      try {
        for (;;) {
          const x = await rd.read(); if (x.done) break;
          if (j.got + x.value.length > j.total) throw new Error('size');
          j.buf.set(x.value, j.got); j.got += x.value.length;
          j.wake.forEach(f => f()); j.wake.clear();
        }
        if (j.got !== j.total) throw new Error('short');
        j.done = true;
        fin.set(key, { total: j.total, saved: await save(j) }); while (fin.size > 30) fin.delete(fin.keys().next().value);
      } catch (_) { j.failed = true; }
      j.wake.forEach(f => f()); j.wake.clear();
      if (dl.get(key) === j) dl.delete(key);
    })();
  })().catch(() => { j.failed = true; if (dl.get(key) === j) dl.delete(key); });
  dl.set(key, j);
  return j;
}
async function save(j){
  try {
    if (j.total > await getLimit()) return false; // «don't keep» (0), or bigger than the whole allowed space
    const c = await caches.open(VCACHE);
    await c.put(j.key, new Response(j.buf, { headers: { 'Content-Type': j.type, 'Content-Length': String(j.total), 'ETag': j.etag, 'Last-Modified': j.lm, 'X-Saved': String(Date.now()) } }));
    keepMem(j.key, j.buf, { type: j.type, etag: j.etag, lm: j.lm });
    checked.set(j.key, Date.now());
    await trim(j.key);
    return true;
  } catch (_) { return false; }
}
function keepMem(key, buf, meta){ mem.delete(key); mem.set(key, { buf, meta }); while (mem.size > 2) mem.delete(mem.keys().next().value); }
// a file someone replaced on the site: its old copy is dropped (the next opening downloads the new one)
function recheck(key, meta){
  const t = checked.get(key) || 0; if (Date.now() - t < 36e5) return;
  checked.set(key, Date.now());
  fetch(key, { method: 'HEAD', cache: 'no-store' }).then(async r => {
    // gone from the server (a deleted lesson's video): the saved copy goes too
    if (r.status === 404 || r.status === 410) { mem.delete(key); const c = await caches.open(VCACHE); await c.delete(key); return; }
    if (!r.ok) return;
    const et = r.headers.get('etag') || '', lm = r.headers.get('last-modified') || '';
    if ((et && meta.etag && et !== meta.etag) || (!et && lm && meta.lm && lm !== meta.lm)) { mem.delete(key); const c = await caches.open(VCACHE); await c.delete(key); }
  }).catch(() => {});
}
function answer(buf, total, type, range){
  const h = { 'Content-Type': type, 'Accept-Ranges': 'bytes' };
  if (!range) { h['Content-Length'] = String(total); return new Response(buf.slice(0, total), { status: 200, headers: h }); }
  const a = range.a, b = Math.min(range.b == null ? total - 1 : range.b, total - 1);
  if (a >= total || b < a) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + total } });
  h['Content-Range'] = 'bytes ' + a + '-' + b + '/' + total; h['Content-Length'] = String(b - a + 1);
  return new Response(buf.slice(a, b + 1), { status: 206, headers: h });
}
async function serveVideo(req, key){
  const range = parseRange(req.headers.get('range'));
  if (req.headers.get('range') && !range) return fetch(req);
  // 1. already on the phone
  let m = mem.get(key);
  if (!m) {
    const c = await caches.open(VCACHE), hit = await c.match(key);
    if (hit) m = { buf: new Uint8Array(await hit.arrayBuffer()), meta: { type: hit.headers.get('content-type') || 'video/mp4', etag: hit.headers.get('etag') || '', lm: hit.headers.get('last-modified') || '' } }, keepMem(key, m.buf, m.meta);
  }
  if (m) { recheck(key, m.meta); return answer(m.buf, m.buf.length, m.meta.type, range); }
  // 2. being downloaded (or start now)
  let j = dl.get(key); if (!j || j.failed) j = startDl(key, req.url);
  await j.head;
  if (j.failed || !j.total) return fetch(req);
  if (j.done) return answer(j.buf, j.total, j.type, range);
  const a = range ? range.a : 0, b = Math.min(range && range.b != null ? range.b : j.total - 1, j.total - 1);
  if (a >= j.total || b < a) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + j.total } });
  // a jump far ahead of the download: the network answers that part directly, the download goes on
  if (a > j.got + AHEAD_PASS) return fetch(req);
  let pos = a;
  j.readers++; clearTimeout(j.idle);
  const done = () => {
    j.readers--;
    // nobody needs this video any more and it is far from finished: stop (it is not kept half-done)
    if (j.readers <= 0 && !j.done) j.idle = setTimeout(() => { if (j.readers <= 0 && !j.done) { j.ac.abort(); j.failed = true; if (dl.get(key) === j) dl.delete(key); } }, 8000);
  };
  let closed = false;
  const body = new ReadableStream({
    async pull(ctl){
      while (j.got <= pos && !j.failed && !j.done) await new Promise(r => j.wake.add(r));
      if (j.failed && j.got <= pos) { if (!closed) { closed = true; done(); } ctl.error(new Error('download failed')); return; }
      const end = Math.min(j.got, b + 1, pos + 262144);
      ctl.enqueue(j.buf.slice(pos, end)); pos = end;
      if (pos > b) { closed = true; done(); ctl.close(); }
    },
    cancel(){ if (!closed) { closed = true; done(); } }
  });
  const h = { 'Content-Type': j.type, 'Accept-Ranges': 'bytes', 'Content-Length': String(b - a + 1) };
  if (range) h['Content-Range'] = 'bytes ' + a + '-' + b + '/' + j.total;
  return new Response(body, { status: range ? 206 : 200, headers: h });
}

// a push from our server (server/push-worker.js): {title, body, id, tag}
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let msg = null;
    try { msg = e.data ? e.data.json() : null; } catch (_) {}
    if (!msg) msg = { title: 'Fedoskin', body: 'New lesson in the app', id: '' };
    await self.registration.showNotification(msg.title || 'Fedoskin', {
      body: msg.body || '',
      icon: 'icons/icon2-192.png',
      badge: 'icons/icon2-192.png',
      tag: msg.tag || 'new-lesson',
      data: { id: msg.id || '' }
    });
  })());
});

// tap on the notification: open the app on that lesson
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const id = (e.notification.data && e.notification.data.id) || '';
  const url = new URL('./' + (id ? '?lesson=' + encodeURIComponent(id) : ''), self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        await w.focus();
        try { w.postMessage({ type: 'open-lesson', id }); return; } catch (_) {}
      }
    }
    await self.clients.openWindow(url);
  })());
});
