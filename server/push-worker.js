// Fedoskin — сервер уведомлений о новых уроках (Cloudflare Worker).
// Как поставить: см. server/README.md. Нужна одна привязка KV с именем PUSH.
//
// Что умеет:
//   GET  /key          — публичный ключ для подписки (ключи создаются сами при первом запросе)
//   POST /subscribe    — {sub, lang}  сохранить подписку телефона
//   POST /unsubscribe  — {endpoint}   удалить подписку
//   GET  /latest       — последнее отправленное уведомление
//   GET  /stats        — сколько подписок (только для админа)
//   POST /notify       — разослать уведомление (только для админа), по 40 телефонов за запрос
//   GET  /lb?id=&city= — рейтинг: топ-50 мира и города + место этого пользователя
//   POST /lb           — {id, secret, nick, city, country, av, m, v, s} обновить свои минуты; {id, secret, hide:true} — убрать себя
//   POST /hit          — {id, p, a} приложение открыли (счётчик посещений; нужна база D1 с именем DB)
//   GET  /visits       — посещаемость: сегодня, за всё время, 30 дней, страны, устройства (только для админа)
//   POST /ev           — {id, e, s, v} действие в приложении (e='tg' — нажали «Написать в Telegram»), s — откуда пришёл человек
// Админ = тот, чей ключ GitHub может записывать в репозиторий приложения. Своих паролей у сервера нет.

const REPO = 'Fedosk1n/fedoskin-app';
const CONTACT = 'mailto:noreply@fedoskin.app';
const PAGE = 40; // free Cloudflare plan: max 50 outgoing requests per call

// "New in {sec}: {name}" in every app language
const TEXT = {
  ru: ['Новое в {sec}', '{name} — уже в приложении'],
  en: ['New in {sec}', '{name} is now in the app'],
  es: ['Nuevo en {sec}', '{name} ya está en la app'],
  pt: ['Novo em {sec}', '{name} já está no app'],
  fr: ['Nouveau dans {sec}', '{name} est dans l’app'],
  de: ['Neu in {sec}', '{name} ist jetzt in der App'],
  ja: ['{sec}に新着', '{name}を追加しました'],
  ko: ['{sec} 새 레슨', '{name} 추가됨'],
  zh: ['{sec} 新课程', '{name} 已上线'],
};
const MORE = { ru: ' и ещё {n}', en: ' and {n} more', es: ' y {n} más', pt: ' e mais {n}', fr: ' et {n} de plus', de: ' und {n} weitere', ja: 'ほか{n}本', ko: ' 외 {n}개', zh: '等{n}个' };

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (!env.PUSH) return json({ error: 'KV binding PUSH is missing' }, 500);
    const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/' ) return json({ ok: true, service: 'fedoskin-push' });
      if (path === '/key') return json({ key: (await vapid(env)).pub });
      if (path === '/latest') return json(JSON.parse((await env.PUSH.get('latest')) || '{}'));
      if (path === '/lb') return await leaderboard(req, env, json);
      if (path === '/hit' && req.method === 'POST') return await hit(req, env, json);
      if (path === '/ev' && req.method === 'POST') return await ev(req, env, json);
      if (req.method !== 'POST' && path !== '/stats' && path !== '/visits') return json({ error: 'not found' }, 404);

      if (path === '/subscribe') {
        const { sub, lang } = await req.json();
        if (!sub || !sub.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return json({ error: 'bad subscription' }, 400);
        const rec = { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, lang: TEXT[lang] ? lang : 'en', t: Date.now() };
        await env.PUSH.put('s:' + await hash(sub.endpoint), JSON.stringify(rec));
        return json({ ok: true });
      }
      if (path === '/unsubscribe') {
        const { endpoint } = await req.json();
        if (endpoint) await env.PUSH.delete('s:' + await hash(endpoint));
        return json({ ok: true });
      }

      // ----- admin only -----
      if (!(await isAdmin(req, env))) return json({ error: 'forbidden' }, 403);
      if (path === '/stats') {
        let n = 0, cursor;
        do { const r = await env.PUSH.list({ prefix: 's:', cursor }); n += r.keys.length; cursor = r.list_complete ? null : r.cursor; } while (cursor);
        return json({ subscribers: n });
      }
      if (path === '/visits') return await visits(env, json);
      if (path === '/notify') {
        const body = await req.json();
        // first page: remember the message so phones without payload support can fetch it
        if (!body.cursor) {
          if (!body.sec || !body.name) return json({ error: 'sec and name are required' }, 400);
          await env.PUSH.put('latest', JSON.stringify({ sec: body.sec, name: body.name, id: body.id || '', more: body.more || 0, ts: Date.now() }));
        }
        const msg = JSON.parse((await env.PUSH.get('latest')) || '{}');
        const keys = await vapid(env);
        const page = await env.PUSH.list({ prefix: 's:', cursor: body.cursor || undefined, limit: PAGE });
        let sent = 0, removed = 0, failed = 0;
        await Promise.all(page.keys.map(async k => {
          const rec = JSON.parse((await env.PUSH.get(k.name)) || 'null');
          if (!rec) return;
          const res = await sendPush(rec, payloadFor(msg, rec.lang), keys).catch(() => null);
          if (res && res.ok) sent++;
          else if (res && (res.status === 404 || res.status === 410)) { await env.PUSH.delete(k.name); removed++; }
          else failed++;
        }));
        return json({ sent, removed, failed, cursor: page.list_complete ? null : page.cursor });
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  },
};

function payloadFor(msg, lang) {
  const t = TEXT[lang] || TEXT.en;
  const fill = s => s.replace('{sec}', msg.sec).replace('{name}', msg.name);
  let body = fill(t[1]);
  if (msg.more > 0) body = msg.name + (MORE[lang] || MORE.en).replace('{n}', msg.more);
  return JSON.stringify({ title: fill(t[0]), body, id: msg.id, tag: 'new-lesson' });
}

async function isAdmin(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const cacheKey = 'adm:' + await hash(token);
  if (await env.PUSH.get(cacheKey)) return true;
  const r = await fetch('https://api.github.com/repos/' + REPO, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'User-Agent': 'fedoskin-push' },
  });
  if (!r.ok) return false;
  const repo = await r.json();
  const ok = !!(repo.permissions && repo.permissions.push);
  if (ok) await env.PUSH.put(cacheKey, '1', { expirationTtl: 3600 });
  return ok;
}

// ---------- helpers ----------
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const concat = (...arrs) => { const out = new Uint8Array(arrs.reduce((a, x) => a + x.length, 0)); let o = 0; for (const x of arrs) { out.set(x, o); o += x.length; } return out; };
async function hash(s) { return b64u(await crypto.subtle.digest('SHA-256', enc.encode(s))).slice(0, 32); }

// VAPID keys: made once, kept in KV
async function vapid(env) {
  const saved = await env.PUSH.get('vapid');
  if (saved) {
    const j = JSON.parse(saved);
    return { pub: j.pub, key: await crypto.subtle.importKey('jwk', j.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']) };
  }
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  await env.PUSH.put('vapid', JSON.stringify({ pub, jwk }));
  return { pub, key: kp.privateKey };
}

async function vapidHeader(endpoint, keys) {
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTACT })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.key, enc.encode(head + '.' + claims));
  return 'vapid t=' + head + '.' + claims + '.' + b64u(sig) + ', k=' + keys.pub;
}

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

// RFC 8291 (aes128gcm) payload encryption. `fixed` is only for the test with the RFC example values.
export async function encryptPayload(plaintext, p256dh, authSecret, fixed) {
  const uaPublic = unb64u(p256dh), auth = unb64u(authSecret);
  let asKeys, asPublic;
  if (fixed) {
    asKeys = { privateKey: await crypto.subtle.importKey('jwk', fixed.jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']) };
    asPublic = unb64u(fixed.pub);
  } else {
    asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  }
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));
  const prkKey = await hmac(auth, ecdh);
  const ikm = (await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])))).slice(0, 32);
  const salt = fixed ? unb64u(fixed.salt) : crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const data = concat(typeof plaintext === 'string' ? enc.encode(plaintext) : plaintext, new Uint8Array([2]));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, data));
  const header = concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic);
  return concat(header, ct);
}

async function sendPush(rec, payload, keys) {
  const body = await encryptPayload(payload, rec.p256dh, rec.auth);
  return fetch(rec.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': await vapidHeader(rec.endpoint, keys),
      'TTL': String(3 * 24 * 3600),
      'Urgency': 'normal',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
    },
    body,
  });
}


// ===== leaderboard (alpha, no accounts) =====
// Everything lives in ONE KV key 'lb' (free KV allows ~1000 writes a day, so the app sends at most every ~10 minutes).
// Each phone has a random secret; only that phone can change its own line. Minutes can't grow faster than real time.
const LB_START = Date.UTC(2026, 9, 28); // alpha start: nobody can have more minutes than have passed since then
const clean = (x, n) => String(x || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const normCity = c => clean(c, 30).toLowerCase().replace(/ё/g, 'е');
async function leaderboard(req, env, json) {
  const board = JSON.parse((await env.PUSH.get('lb')) || '{}');
  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams;
    const me = String(q.get('id') || ''), city = normCity(q.get('city'));
    const all = Object.entries(board).map(([id, r]) => ({ id, ...r })).sort((a, b) => (b.m - a.m) || (a.f - b.f));
    const pack = list => ({
      total: list.length,
      place: list.findIndex(r => r.id === me) + 1,
      top: list.slice(0, 50).map(r => ({ id: r.id, n: r.n, c: r.c, co: r.co, a: r.a, m: r.m, v: r.v, s: r.s }))
    });
    return json({ world: pack(all), city: city ? pack(all.filter(r => normCity(r.c) === city)) : null });
  }
  if (req.method !== 'POST') return json({ error: 'not found' }, 404);
  const b = await req.json();
  const id = String(b.id || '');
  if (!/^\d{6,9}$/.test(id) || !/^[0-9a-f]{32}$/.test(String(b.secret || ''))) return json({ error: 'bad id' }, 400);
  const h = await hash('lb:' + b.secret), old = board[id], now = Date.now();
  if (old && old.h !== h) return json({ error: 'this id belongs to another phone' }, 403);
  if (b.hide) { if (old) { delete board[id]; await env.PUSH.put('lb', JSON.stringify(board)); } return json({ ok: true, hidden: true }); }
  if (!old && Object.keys(board).length >= 20000) return json({ error: 'board is full' }, 507);
  const num = (x, max) => Math.max(0, Math.min(max, Math.floor(+x || 0)));
  // plausibility: minutes grow at most as fast as the clock (+2 min slack); never more than since the alpha started
  const sinceStart = Math.max(0, Math.floor((now - LB_START) / 60000));
  let m = num(b.m, Math.min(sinceStart, 300)); // a new phone can bring at most 5 hours watched before the rating started
  if (old) m = Math.max(old.m, Math.min(m, old.m + Math.ceil((now - old.t) / 60000) + 2));
  const rec = {
    n: clean(b.nick, 20), c: clean(b.city, 30), co: clean(b.country, 30), a: clean(b.av, 16) || 'alpha',
    m, v: Math.min(num(b.v, 1e6), m * 12 + 5), s: Math.min(num(b.s, 3650), Math.ceil((now - LB_START) / 864e5) + 1),
    h, f: old ? old.f : now, t: now
  };
  // skip the write when nothing changed and the last write was recent (saves the daily write limit)
  const same = old && old.m === rec.m && old.v === rec.v && old.s === rec.s && old.n === rec.n && old.c === rec.c && old.co === rec.co && old.a === rec.a;
  if (!(same && now - old.t < 6 * 3600e3)) { board[id] = rec; await env.PUSH.put('lb', JSON.stringify(board)); }
  return json({ ok: true, m: rec.m });
}

// ----- visit counter (D1 database bound as DB) -----
// No cookies and no personal data: the app sends its random device number (stored here only as a hash), the kind of
// device and whether it was opened from the home-screen icon; the country comes from Cloudflare. IP addresses are not
// kept. Days are Moscow days. A "visit" = the app opened after 30+ minutes away (the app decides that).
const mskDay = (t = Date.now()) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10);
let schemaReady = null;
function schema(db) {
  if (!schemaReady) schemaReady = db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS hits (day TEXT PRIMARY KEY, visits INTEGER NOT NULL DEFAULT 0, uniq INTEGER NOT NULL DEFAULT 0, fresh INTEGER NOT NULL DEFAULT 0, app INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE TABLE IF NOT EXISTS seen (day TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY (day, id)) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, first TEXT, country TEXT, plat TEXT) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS geo (day TEXT NOT NULL, country TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, country)) WITHOUT ROWID'),
    // sources (05.11.2026): per day × where people came from × what: visit / uniq / new / tg (taps) / tgu (people who tapped) / svc:<id>
    db.prepare('CREATE TABLE IF NOT EXISTS src (day TEXT NOT NULL, src TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, src, kind)) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS contacted (id TEXT PRIMARY KEY, first TEXT, src TEXT) WITHOUT ROWID'),
  ]).catch(e => { schemaReady = null; throw e; });
  return schemaReady;
}
async function hit(req, env, json) {
  if (!env.DB) return json({ ok: false, nodb: true });
  const b = JSON.parse((await req.text()) || '{}');
  const raw = String(b.id || '').slice(0, 40);
  if (!/^[\w-]{4,40}$/.test(raw)) return json({ error: 'bad id' }, 400);
  const db = env.DB;
  await schema(db);
  const id = await hash('v1:' + raw), day = mskDay();
  const country = /^[A-Z]{2}$/.test((req.cf && req.cf.country) || '') ? req.cf.country : 'XX';
  const plat = ['ios', 'android', 'desktop', 'other'].includes(b.p) ? b.p : 'other';
  const app = b.a ? 1 : 0;
  const [s, d] = await db.batch([
    db.prepare('INSERT OR IGNORE INTO seen (day, id) VALUES (?, ?)').bind(day, id),
    db.prepare('INSERT OR IGNORE INTO devices (id, first, country, plat) VALUES (?, ?, ?, ?)').bind(id, day, country, plat),
  ]);
  const newToday = s.meta.changes > 0 ? 1 : 0, newDevice = d.meta.changes > 0 ? 1 : 0;
  const src = cleanSrc(b.s);
  const more = [db.prepare('INSERT INTO hits (day, visits, uniq, fresh, app) VALUES (?, 1, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET visits = visits + 1, uniq = uniq + excluded.uniq, fresh = fresh + excluded.fresh, app = app + excluded.app').bind(day, newToday, newDevice, app)];
  more.push(srcAdd(db, day, src, 'visit'));
  if (newToday) more.push(srcAdd(db, day, src, 'uniq'));
  if (newDevice) more.push(srcAdd(db, day, src, 'new'));
  if (newToday) {
    more.push(db.prepare('INSERT INTO geo (day, country, n) VALUES (?, ?, 1) ON CONFLICT(day, country) DO UPDATE SET n = n + 1').bind(day, country));
    // the list of who was here only matters for today: drop older days now and then
    if (Math.random() < 0.02) more.push(db.prepare('DELETE FROM seen WHERE day < ?').bind(mskDay(Date.now() - 86400e3)));
  }
  await db.batch(more);
  return json({ ok: true });
}
const cleanSrc = v => (String(v || '').toLowerCase().match(/^[a-z0-9_-]{1,16}$/) || [])[0] || 'none';
const srcAdd = (db, day, src, kind) => db.prepare('INSERT INTO src (day, src, kind, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, src, kind) DO UPDATE SET n = n + 1').bind(day, src, kind);
async function ev(req, env, json) {
  if (!env.DB) return json({ ok: false, nodb: true });
  const b = JSON.parse((await req.text()) || '{}');
  const raw = String(b.id || '').slice(0, 40);
  if (!/^[\w-]{4,40}$/.test(raw) || b.e !== 'tg') return json({ error: 'bad event' }, 400);
  const db = env.DB;
  await schema(db);
  const id = await hash('v1:' + raw), day = mskDay(), src = cleanSrc(b.s);
  const [c] = await db.batch([db.prepare('INSERT OR IGNORE INTO contacted (id, first, src) VALUES (?, ?, ?)').bind(id, day, src)]);
  const more = [srcAdd(db, day, src, 'tg')];
  if (c.meta.changes > 0) more.push(srcAdd(db, day, src, 'tgu'));
  const svc = /^[a-z]{1,12}$/.test(b.v || '') ? b.v : '';
  if (svc) more.push(srcAdd(db, day, src, 'svc:' + svc));
  await db.batch(more);
  return json({ ok: true });
}
async function visits(env, json) {
  if (!env.DB) return json({ nodb: true });
  const db = env.DB;
  await schema(db);
  const day = mskDay();
  const [today, all, devs, days, geoToday, geoAll, plat, srcAll, srcToday, contacted] = await db.batch([
    db.prepare('SELECT visits, uniq, fresh, app FROM hits WHERE day = ?').bind(day),
    db.prepare('SELECT COALESCE(SUM(visits), 0) AS visits, COALESCE(SUM(app), 0) AS app, MIN(day) AS since FROM hits'),
    db.prepare('SELECT COUNT(*) AS n FROM devices'),
    db.prepare('SELECT day, visits, uniq, fresh FROM hits ORDER BY day DESC LIMIT 30'),
    db.prepare('SELECT country, n FROM geo WHERE day = ? ORDER BY n DESC LIMIT 12').bind(day),
    db.prepare('SELECT country, COUNT(*) AS n FROM devices GROUP BY country ORDER BY n DESC LIMIT 12'),
    db.prepare('SELECT plat, COUNT(*) AS n FROM devices GROUP BY plat ORDER BY n DESC'),
    db.prepare('SELECT src, kind, SUM(n) AS n FROM src GROUP BY src, kind'),
    db.prepare('SELECT src, kind, n FROM src WHERE day = ?').bind(day),
    db.prepare('SELECT COUNT(*) AS n FROM contacted'),
  ]);
  const t = today.results[0] || { visits: 0, uniq: 0, fresh: 0, app: 0 }, a = all.results[0] || {};
  return json({
    day,
    today: t,
    all: { visits: a.visits || 0, app: a.app || 0, uniq: (devs.results[0] || {}).n || 0, since: a.since || day },
    days: days.results.reverse(),
    countriesToday: geoToday.results.map(r => [r.country, r.n]),
    countriesAll: geoAll.results.map(r => [r.country, r.n]),
    platforms: plat.results.map(r => [r.plat, r.n]),
    sources: { all: srcAll.results.map(r => [r.src, r.kind, r.n]), today: srcToday.results.map(r => [r.src, r.kind, r.n]), contacted: (contacted.results[0] || {}).n || 0 },
  });
}
