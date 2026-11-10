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
//   POST /ev           — {id, e, s, v, m} действие в приложении: e='tg' — нажали «Написать тренеру» (m — мессенджер),
//                        e='cr' — открыли оплату криптой, e='crp' — нажали «Я оплатил»; s — откуда пришёл человек
//   GET  /pass         — временный пропуск к видео (на 24 часа), только для страницы приложения
//   GET  /v/<файл>.mp4?p=<пропуск> — видео урока из Cloudflare R2 (привязка R2 с именем VIDEOS), отдаёт и куски (Range);
//                        без действующего пропуска — 403 (ссылку нельзя просто скопировать и раздать)
//   GET  /r2/usage     — сколько места занято в R2 (только для админа)
//   POST /r2/mpu?key=  — начать загрузку видео; PUT /r2/mpu?key=&id=&n= — кусок; POST /r2/done?key=&id= {parts} — готово;
//   POST /r2/abort?key=&id= — отменить; DELETE /r2/obj?key= — удалить видео (всё это только для админа)
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
  // Cron trigger (Cloudflare → the worker → Settings → Triggers → Cron: * * * * *): the chat's pull mode, once a minute
  async scheduled(ev, env, ctx) {
    if (!env.TG_TOKEN || !env.DB) return;
    ctx.waitUntil((async () => { await schema(env.DB); await tgSet(env.DB, 'cron', Date.now()); await tgPull(env, 0); })().catch(() => {}));
  },
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, ETag',
      'Access-Control-Max-Age': '86400',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    if (!env.PUSH) return json({ error: 'KV binding PUSH is missing' }, 500);
    // lesson videos from R2 — only with a pass the app got a moment ago (owner 09.11.2026: «ссылки на видео открытые — исправь»)
    if (path.startsWith('/v/') && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        if (!(await passOk(env, new URL(req.url).searchParams.get('p')))) return new Response(JSON.stringify({ error: 'pass' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
        return await r2Serve(req, env, path.slice(3), cors);
      } catch (e) { return json({ error: String(e && e.message || e) }, 500); }
    }
    if (path === '/pass' && req.method === 'GET') {
      const from = req.headers.get('Origin') || (req.headers.get('Referer') || '').replace(/^(https?:\/\/[^/]+).*$/, '$1');
      if (!PASS_FROM.test(from)) return json({ error: 'forbidden' }, 403);
      const r = json(await passMake(env)); r.headers.set('Cache-Control', 'no-store'); return r;
    }
    try {
      if (path === '/' ) return json({ ok: true, service: 'fedoskin-push' });
      if (path === '/key') return json({ key: (await vapid(env)).pub });
      if (path === '/latest') return json(JSON.parse((await env.PUSH.get('latest')) || '{}'));
      if (path === '/lb') return await leaderboard(req, env, json);
      if (path === '/hit' && req.method === 'POST') return await hit(req, env, json);
      if (path === '/ev' && req.method === 'POST') return await ev(req, env, json);
      // reviews from paying clients (09.11.2026): the link check and the form are public, the code itself is the key
      if (path === '/rv/inv' && req.method === 'GET') return await rvInv(req, env, json);
      // chat with the coach (09.11.2026): the client writes in the app, the coach answers in Telegram
      if (path === '/chat/on' && req.method === 'GET') return json({ on: await chatOn(env) });
      if (path === '/chat/get' && req.method === 'GET') return await chatGet(req, env, json);
      if (path.startsWith('/chat/m/') && (req.method === 'GET' || req.method === 'HEAD')) return await chatMedia(req, env, path.slice(8), cors);
      if (path === '/chat/send' && req.method === 'POST') return await chatSend(req, env, json);
      if (path === '/chat/file' && req.method === 'POST') return await chatFile(req, env, json);
      if (path === '/chat/push' && req.method === 'POST') return await chatPush(req, env, json);
      if (path === '/tg/hook' && req.method === 'POST') return await tgHook(req, env, json);
      if (path === '/rv/submit' && req.method === 'POST') return await rvSubmit(req, env, json);
      if (req.method !== 'POST' && path !== '/stats' && path !== '/visits' && !path.startsWith('/r2/') && path !== '/rv/list' && path !== '/tg/status') return json({ error: 'not found' }, 404);

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
      if (path.startsWith('/r2/')) return await r2Admin(req, env, path, json);
      if (path.startsWith('/rv/')) return await rvAdmin(req, env, path, json);
      if (path === '/tg/setup' || path === '/tg/status' || path === '/tg/trtest') return await tgAdmin(req, env, path, json);
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

// ---------- lesson videos in Cloudflare R2 (binding VIDEOS) ----------
// File names are made by the admin: <lesson id>-<random>.mp4, a new name for every upload, so a phone or a browser
// may keep a copy forever (a replaced video simply has another name).
const R2_KEY = /^[a-z0-9][a-z0-9-]{0,80}\.mp4$/;
// Passes: "<expiry, base 36>.<signature>", signed with a random secret kept in KV (made on the first call). Nothing is
// stored per pass. Given only to requests coming from the app's own pages (and local tests).
const PASS_TTL = 24 * 3600, PASS_FROM = /^(https:\/\/fedosk1n\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
let passKeyP = null;
function passKey(env) {
  return passKeyP || (passKeyP = (async () => {
    let s = await env.PUSH.get('vpass');
    if (!s) { s = b64u(crypto.getRandomValues(new Uint8Array(32))); await env.PUSH.put('vpass', s); }
    return crypto.subtle.importKey('raw', enc.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  })().catch(e => { passKeyP = null; throw e; }));
}
async function passSig(env, exp) { return b64u(await crypto.subtle.sign('HMAC', await passKey(env), enc.encode('v1.' + exp))).slice(0, 32); }
async function passMake(env) { const exp = Math.floor(Date.now() / 1000) + PASS_TTL; return { p: exp.toString(36) + '.' + await passSig(env, exp), exp }; }
async function passOk(env, p) {
  const m = /^([0-9a-z]{1,10})\.([A-Za-z0-9_-]{32})$/.exec(p || ''); if (!m) return false;
  const exp = parseInt(m[1], 36); if (!(exp > Date.now() / 1000) || exp > Date.now() / 1000 + PASS_TTL + 60) return false;
  return (await passSig(env, exp)) === m[2];
}
async function r2Serve(req, env, key, cors, opt) {
  const h = new Headers(cors);
  if (!env.VIDEOS || !(opt ? opt.ok : R2_KEY.test(key))) return new Response('not found', { status: 404, headers: h });
  h.set('Accept-Ranges', 'bytes');
  h.set('Cache-Control', opt ? 'private, max-age=604800' : 'public, max-age=31536000, immutable');
  h.set('Content-Type', (opt && opt.ct) || 'video/mp4');
  if (req.method === 'HEAD') {
    const o = await env.VIDEOS.head(key);
    if (!o) return new Response(null, { status: 404, headers: h });
    h.set('ETag', o.httpEtag); h.set('Content-Length', String(o.size));
    return new Response(null, { status: 200, headers: h });
  }
  const rh = req.headers.get('Range');
  const m = rh ? /^bytes=(\d*)-(\d*)$/.exec(rh.trim()) : null;
  let range;
  if (m && (m[1] !== '' || m[2] !== '')) {
    if (m[1] === '') range = { suffix: +m[2] };
    else range = m[2] === '' ? { offset: +m[1] } : { offset: +m[1], length: +m[2] - +m[1] + 1 };
    if (range.length !== undefined && range.length <= 0) range = undefined;
  }
  let o;
  try { o = await env.VIDEOS.get(key, range ? { range } : {}); }
  catch (e) {
    const head = await env.VIDEOS.head(key);
    if (!head) return new Response('not found', { status: 404, headers: h });
    h.set('Content-Range', 'bytes */' + head.size);
    return new Response(null, { status: 416, headers: h });
  }
  if (!o) return new Response('not found', { status: 404, headers: h });
  h.set('ETag', o.httpEtag);
  const size = o.size;
  if (range && o.range) {
    const r = o.range;
    let a, len;
    if ('suffix' in r && r.suffix !== undefined) { len = Math.min(r.suffix, size); a = size - len; }
    else { a = r.offset || 0; len = r.length !== undefined ? Math.min(r.length, size - a) : size - a; }
    h.set('Content-Range', 'bytes ' + a + '-' + (a + len - 1) + '/' + size);
    h.set('Content-Length', String(len));
    return new Response(o.body, { status: 206, headers: h });
  }
  h.set('Content-Length', String(size));
  return new Response(o.body, { status: 200, headers: h });
}
async function r2Admin(req, env, path, json) {
  if (!env.VIDEOS) return json({ error: 'no-bucket' }, 409);
  const q = new URL(req.url).searchParams, key = q.get('key') || '';
  if (path === '/r2/usage') {
    let bytes = 0, count = 0, cursor; const files = [];
    do {
      const r = await env.VIDEOS.list({ cursor, limit: 1000 });
      for (const o of r.objects) { bytes += o.size; count++; if (files.length < 2000) files.push([o.key, o.size]); }
      cursor = r.truncated ? r.cursor : null;
    } while (cursor);
    return json({ ok: true, bytes, count, files });
  }
  if (!R2_KEY.test(key)) return json({ error: 'bad file name' }, 400);
  if (path === '/r2/mpu' && req.method === 'POST') {
    const u = await env.VIDEOS.createMultipartUpload(key, { httpMetadata: { contentType: 'video/mp4' } });
    return json({ id: u.uploadId });
  }
  const id = q.get('id') || '';
  if (path === '/r2/mpu' && req.method === 'PUT') {
    const n = +q.get('n');
    if (!id || !(n >= 1 && n <= 10000) || !req.body) return json({ error: 'bad part' }, 400);
    const part = await env.VIDEOS.resumeMultipartUpload(key, id).uploadPart(n, req.body);
    return json({ n: part.partNumber, etag: part.etag });
  }
  if (path === '/r2/done' && req.method === 'POST') {
    const { parts } = await req.json();
    if (!id || !Array.isArray(parts) || !parts.length) return json({ error: 'no parts' }, 400);
    const o = await env.VIDEOS.resumeMultipartUpload(key, id).complete(parts.map(p => ({ partNumber: +p.n, etag: String(p.etag) })));
    return json({ ok: true, size: o.size });
  }
  if (path === '/r2/abort' && req.method === 'POST') {
    if (id) await env.VIDEOS.resumeMultipartUpload(key, id).abort().catch(() => {});
    return json({ ok: true });
  }
  if (path === '/r2/obj' && req.method === 'DELETE') { await env.VIDEOS.delete(key); return json({ ok: true }); }
  return json({ error: 'not found' }, 404);
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
const dayAgo = n => mskDay(Date.now() - n * 864e5);
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
    // who did what on which day (online services interest, 07.11.2026): e = sv | so:<svc> | tg | tg:<svc>
    db.prepare('CREATE TABLE IF NOT EXISTS evu (e TEXT NOT NULL, id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (e, id, day)) WITHOUT ROWID'),
    // reviews (09.11.2026): one-time invitations the owner makes after a payment, and what clients wrote with them
    // chat (09.11.2026): one thread per phone, its messages, and which Telegram message belongs to which thread
    db.prepare('CREATE TABLE IF NOT EXISTS chat_thr (id TEXT PRIMARY KEY, kh TEXT, name TEXT, lang TEXT, country TEXT, svc TEXT, made INTEGER, last INTEGER, push TEXT) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS chat_msg (n INTEGER PRIMARY KEY AUTOINCREMENT, thr TEXT NOT NULL, dir TEXT NOT NULL, kind TEXT NOT NULL, text TEXT, media TEXT, t INTEGER)'),
    db.prepare('CREATE INDEX IF NOT EXISTS chat_msg_thr ON chat_msg (thr, n)'),
    db.prepare('CREATE TABLE IF NOT EXISTS chat_map (tg INTEGER PRIMARY KEY, thr TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS tgs (k TEXT PRIMARY KEY, v TEXT) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS chat_top (thr TEXT PRIMARY KEY, top INTEGER NOT NULL) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS rv_inv (code TEXT PRIMARY KEY, svc TEXT, note TEXT, made INTEGER, used INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS rv_sub (id TEXT PRIMARY KEY, code TEXT, svc TEXT, name TEXT, country TEXT, stars INTEGER, text TEXT, lang TEXT, made INTEGER, status TEXT NOT NULL DEFAULT \'new\') WITHOUT ROWID'),
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
  if (!/^[\w-]{4,40}$/.test(raw) || !/^(tg|cr|crp|sv|so|cta|ctas)$/.test(b.e || '')) return json({ error: 'bad event' }, 400);
  const db = env.DB;
  await schema(db);
  const id = await hash('v1:' + raw), day = mskDay(), src = cleanSrc(b.s);
  const svc = /^[a-z]{1,12}$/.test(b.v || '') ? b.v : '';
  // a person counted once per day per kind: taps go to `src` as <kind>, the first one that day also as u:<kind>
  const seen = async kinds => {
    const r = await db.batch(kinds.map(k => db.prepare('INSERT OR IGNORE INTO evu (e, id, day) VALUES (?, ?, ?)').bind(k, id, day)));
    return kinds.flatMap((k, i) => [srcAdd(db, day, src, k)].concat(r[i].meta.changes > 0 ? [srcAdd(db, day, src, 'u:' + k)] : []));
  };
  if (b.e === 'sv' || b.e === 'so') { // sv = opened the «Онлайн услуги» tab, so = opened one service (07.11.2026)
    if (b.e === 'so' && !svc) return json({ error: 'bad event' }, 400);
    await db.batch(await seen(b.e === 'sv' ? ['sv'] : ['so', 'so:' + svc])); // so = any service, so:<id> = this one
    return json({ ok: true });
  }
  if (b.e === 'cta' || b.e === 'ctas') { // calm «need help?» call in a lesson (08.11.2026): ctas = chip shown, cta = tapped (v = card | chip)
    const where = /^(card|chip)$/.test(b.v || '') ? b.v : '';
    await db.batch([srcAdd(db, day, src, b.e)].concat(b.e === 'cta' && where ? [srcAdd(db, day, src, 'cta:' + where)] : []));
    return json({ ok: true });
  }
  if (b.e !== 'tg') { // crypto payment: cr = opened the «Оплата криптой» window, crp = tapped «Я оплатил» (07.11.2026)
    await db.batch([srcAdd(db, day, src, b.e)]);
    return json({ ok: true });
  }
  const [c] = await db.batch([db.prepare('INSERT OR IGNORE INTO contacted (id, first, src) VALUES (?, ?, ?)').bind(id, day, src)]);
  const more = [srcAdd(db, day, src, 'tg')];
  if (c.meta.changes > 0) more.push(srcAdd(db, day, src, 'tgu'));
  if (svc) more.push(srcAdd(db, day, src, 'svc:' + svc));
  const via = /^(tg|wa|ig|fb)$/.test(b.m || '') ? b.m : '';
  if (via) more.push(srcAdd(db, day, src, 'via:' + via)); // which messenger was chosen (07.11.2026)
  const ins = ['tg'].concat(svc ? ['tg:' + svc] : []);
  await db.batch(ins.map(k => db.prepare('INSERT OR IGNORE INTO evu (e, id, day) VALUES (?, ?, ?)').bind(k, id, day)));
  await db.batch(more);
  return json({ ok: true });
}
async function visits(env, json) {
  if (!env.DB) return json({ nodb: true });
  const db = env.DB;
  await schema(db);
  const day = mskDay();
  const [today, all, devs, days, geoToday, geoAll, plat, srcAll, srcToday, contacted, svDays, svAll, pT, p7, pA, svSince] = await db.batch([
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
    db.prepare("SELECT day, kind, SUM(n) AS n FROM src WHERE day >= ? AND (kind IN ('sv','u:sv','so','u:so','tg','cr','crp','cta','ctas','cta:card','cta:chip') OR kind LIKE 'so:%' OR kind LIKE 'u:so:%' OR kind LIKE 'svc:%') GROUP BY day, kind").bind(dayAgo(29)),
    db.prepare("SELECT kind, SUM(n) AS n FROM src WHERE kind IN ('sv','so','tg','cr','crp','cta','ctas','cta:card','cta:chip') OR kind LIKE 'so:%' OR kind LIKE 'svc:%' GROUP BY kind"),
    db.prepare('SELECT e, COUNT(DISTINCT id) AS n FROM evu WHERE day = ? GROUP BY e').bind(day),
    db.prepare('SELECT e, COUNT(DISTINCT id) AS n FROM evu WHERE day >= ? GROUP BY e').bind(dayAgo(6)),
    db.prepare('SELECT e, COUNT(DISTINCT id) AS n FROM evu GROUP BY e'),
    db.prepare('SELECT MIN(day) AS since FROM evu'),
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
    // online services interest (07.11.2026): taps per day/kind (30 days), taps all time, distinct people today / 7 days / all
    svc: { days: svDays.results.map(r => [r.day, r.kind, r.n]), all: svAll.results.map(r => [r.kind, r.n]),
      people: { today: pT.results.map(r => [r.e, r.n]), d7: p7.results.map(r => [r.e, r.n]), all: pA.results.map(r => [r.e, r.n]) },
      since: (svSince.results[0] || {}).since || null },
  });
}

// ===== reviews from paying clients (owner 09.11.2026 «оставить отзыв может только клиент, который оплатил») =====
// The owner makes a one-time link in the admin after a client has paid (POST /rv/invite) and sends it in the chat.
// The app opens ?review=<code>: GET /rv/inv checks it, POST /rv/submit stores the review and burns the code. The owner
// reads new reviews in the admin (GET /rv/list), publishes the good ones into reviews.js and marks them (POST /rv/set).
const RV_ABC = 'abcdefghjkmnpqrstuvwxyz23456789', RV_LANGS = ['ru', 'en', 'es', 'pt', 'fr', 'de', 'ja', 'ko', 'zh'];
const RV_SVC = /^[a-z]{1,12}$/;
function rvCode(n = 10) { const b = crypto.getRandomValues(new Uint8Array(n)); return Array.from(b, x => RV_ABC[x % RV_ABC.length]).join(''); }
const rvOkCode = c => /^[a-z0-9]{10}$/.test(String(c || ''));
async function rvInv(req, env, json) {
  if (!env.DB) return json({ ok: false, why: 'nodb' });
  const c = new URL(req.url).searchParams.get('c');
  if (!rvOkCode(c)) return json({ ok: false, why: 'bad' });
  await schema(env.DB);
  const r = await env.DB.prepare('SELECT svc, used FROM rv_inv WHERE code = ?').bind(c).first();
  if (!r) return json({ ok: false, why: 'bad' });
  if (r.used) return json({ ok: false, why: 'used' });
  return json({ ok: true, svc: r.svc || '' });
}
async function rvSubmit(req, env, json) {
  if (!env.DB) return json({ ok: false, why: 'nodb' });
  const b = JSON.parse((await req.text()) || '{}');
  const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const text = String(b.text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000);
  const stars = Math.round(+b.stars);
  const lang = RV_LANGS.includes(b.lang) ? b.lang : 'en';
  if (!rvOkCode(b.c)) return json({ ok: false, why: 'bad' }, 400);
  if (name.length < 2 || text.length < 10 || !(stars >= 1 && stars <= 5)) return json({ ok: false, why: 'fields' }, 400);
  const db = env.DB;
  await schema(db);
  const now = Date.now();
  // burn the code first: one link = one review, even if two taps arrive at once
  const u = await db.prepare('UPDATE rv_inv SET used = ? WHERE code = ? AND used = 0').bind(now, b.c).run();
  if (!u.meta || !u.meta.changes) {
    const r = await db.prepare('SELECT used FROM rv_inv WHERE code = ?').bind(b.c).first();
    return json({ ok: false, why: r ? 'used' : 'bad' }, 409);
  }
  const inv = await db.prepare('SELECT svc FROM rv_inv WHERE code = ?').bind(b.c).first();
  const country = /^[A-Z]{2}$/.test((req.cf && req.cf.country) || '') ? req.cf.country : '';
  await db.prepare('INSERT INTO rv_sub (id, code, svc, name, country, stars, text, lang, made, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, \'new\')')
    .bind(rvCode(12), b.c, (inv && inv.svc) || '', name, country, stars, text, lang, now).run();
  return json({ ok: true });
}
async function rvAdmin(req, env, path, json) {
  if (!env.DB) return json({ error: 'no-db' }, 409);
  const db = env.DB;
  await schema(db);
  if (path === '/rv/list') {
    const inv = await db.prepare('SELECT code, svc, note, made, used FROM rv_inv ORDER BY made DESC LIMIT 200').all();
    const sub = await db.prepare('SELECT id, code, svc, name, country, stars, text, lang, made, status FROM rv_sub ORDER BY made DESC LIMIT 300').all();
    return json({ inv: inv.results || [], sub: sub.results || [] });
  }
  const b = JSON.parse((await req.text()) || '{}');
  if (path === '/rv/invite') {
    const svc = RV_SVC.test(b.svc || '') ? b.svc : '';
    const note = String(b.note || '').slice(0, 80);
    for (let i = 0; i < 5; i++) {
      const code = rvCode();
      const r = await db.prepare('INSERT OR IGNORE INTO rv_inv (code, svc, note, made) VALUES (?, ?, ?, ?)').bind(code, svc, note, Date.now()).run();
      if (r.meta && r.meta.changes) return json({ ok: true, code });
    }
    return json({ error: 'try again' }, 500);
  }
  if (path === '/rv/set') {
    if (!/^[a-z0-9]{12}$/.test(b.id || '') || !['new', 'ok', 'no'].includes(b.status)) return json({ error: 'bad' }, 400);
    await db.prepare('UPDATE rv_sub SET status = ? WHERE id = ?').bind(b.status, b.id).run();
    return json({ ok: true });
  }
  if (path === '/rv/delinv') {
    if (!rvOkCode(b.code)) return json({ error: 'bad' }, 400);
    await db.prepare('DELETE FROM rv_inv WHERE code = ? AND used = 0').bind(b.code).run();
    return json({ ok: true });
  }
  return json({ error: 'not found' }, 404);
}

// ===== chat with the coach through Telegram (owner 09.11.2026 «клиент работает в интерфейсе приложения, я ему отвечаю
// в тг на самом деле») =====
// Secret TG_TOKEN (Cloudflare → the worker → Settings → Variables and Secrets) = the bot from @BotFather. The admin's
// «Подключить» (POST /tg/setup) points the bot's webhook here and makes a one-time link t.me/<bot>?start=<code>; the
// owner taps Start there and his Telegram chat becomes the coach's (KV tg:owner). A client's message (the app, no
// account: phone id + its own random key) goes into D1 and to the owner's Telegram; the owner answers with «Reply» on that
// message — text, photo, video — and the answer lands in the client's chat (+ a web push if the phone allowed them).
// Media live in R2 under chat/<thread>/…, served only with a signed address.
const CHAT_ID = /^[\w-]{4,40}$/, CHAT_KEY = /^[A-Za-z0-9_-]{16,64}$/, CHAT_MAX = 95 * 1048576, CHAT_HOUR = 30;
const SVC_RU = { online: 'Онлайн-ведение', rv: 'Разбор / консультация', consult: 'Консультация', review: 'Разбор', full: 'Полное ведение', coach: 'Тренер для тренера' };
const LANG_RU = { ru: 'рус', en: 'англ', es: 'исп', pt: 'порт', fr: 'франц', de: 'нем', ja: 'япон', ko: 'кор', zh: 'кит' };
const flag = cc => /^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map(c => 0x1F1A5 + c.charCodeAt(0))) : '';
async function tg(env, method, body) {
  const isForm = body instanceof FormData;
  const r = await fetch('https://api.telegram.org/bot' + env.TG_TOKEN + '/' + method, { method: 'POST', body: isForm ? body : JSON.stringify(body || {}), headers: isForm ? {} : { 'Content-Type': 'application/json' } });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error('telegram ' + method + ': ' + (j.description || r.status));
  return j.result;
}
async function chatOn(env) { return !!(env.TG_TOKEN && env.DB && (await env.PUSH.get('tg:owner'))); }
async function chatSign(env, key, days) { const exp = Math.floor(Date.now() / 1000) + days * 86400; return exp.toString(36) + '.' + b64u(await crypto.subtle.sign('HMAC', await passKey(env), enc.encode('cm.' + key + '.' + exp))).slice(0, 32); }
async function chatSigOk(env, key, s) {
  const m = /^([0-9a-z]{1,10})\.([A-Za-z0-9_-]{32})$/.exec(s || ''); if (!m) return false;
  const exp = parseInt(m[1], 36); if (!(exp > Date.now() / 1000)) return false;
  return b64u(await crypto.subtle.sign('HMAC', await passKey(env), enc.encode('cm.' + key + '.' + exp))).slice(0, 32) === m[2];
}
const chatKeyOk = k => /^chat\/[A-Za-z0-9_-]{8,40}\/[a-z0-9]{12}\.(jpg|png|webp|gif|mp4|mov|webm|m4v)$/.test(k);
const CT = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/mp4' };
async function chatMedia(req, env, key, cors) {
  const s = new URL(req.url).searchParams.get('s');
  if (!chatKeyOk(key) || !(await chatSigOk(env, key, s))) return new Response('forbidden', { status: 403, headers: cors });
  return r2Serve(req, env, key, cors, { ok: true, ct: CT[key.split('.').pop()] });
}
// the client's thread: made on the first message; later calls must bring the same key
async function chatThread(env, b, req, make) {
  const raw = String(b.id || ''), k = String(b.k || '');
  if (!CHAT_ID.test(raw) || !CHAT_KEY.test(k)) return { err: 'bad' };
  const db = env.DB; await schema(db);
  const id = (await hash('c1:' + raw)).slice(0, 24), kh = await hash('ck:' + k);
  let t = await db.prepare('SELECT * FROM chat_thr WHERE id = ?').bind(id).first();
  if (t && t.kh !== kh) return { err: 'key' };
  if (!t) {
    if (!make) return { id, none: true };
    const country = /^[A-Z]{2}$/.test((req.cf && req.cf.country) || '') ? req.cf.country : '';
    t = { id, kh, name: '', lang: 'en', country, svc: '', made: Date.now(), last: 0, push: null, fresh: true };
    await db.prepare('INSERT INTO chat_thr (id, kh, name, lang, country, svc, made, last) VALUES (?, ?, ?, ?, ?, ?, ?, 0)').bind(id, kh, '', 'en', country, '', t.made).run();
  }
  const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 40), lang = LANG_RU[b.lang] ? b.lang : '', svc = /^[a-z]{1,12}$/.test(b.svc || '') ? b.svc : '';
  if ((name && name !== t.name) || (lang && lang !== t.lang) || (svc && svc !== t.svc)) {
    t.name = name || t.name; t.lang = lang || t.lang; t.svc = svc || t.svc;
    await db.prepare('UPDATE chat_thr SET name = ?, lang = ?, svc = ? WHERE id = ?').bind(t.name, t.lang, t.svc, id).run();
  }
  return { t };
}
async function chatLimited(env, thr) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM chat_msg WHERE thr = ? AND dir = 'in' AND t > ?").bind(thr, Date.now() - 3600e3).first();
  return (r && r.c) >= CHAT_HOUR;
}
function chatHead(t) {
  return '💬 ' + (t.name || 'Без имени') + (t.country ? ' ' + flag(t.country) : '') + (t.svc ? ' · ' + (SVC_RU[t.svc] || t.svc) : '') + ' · ' + (LANG_RU[t.lang] || t.lang) + ' · #' + t.id.slice(0, 5);
}
const CHAT_HINT = '\n\n↩️ Чтобы ответить клиенту — смахните это сообщение влево (или «Ответить») и пишите. Можно фото и видео.';
// ----- translator (owner 10.11.2026 «чтобы был его оригинальный текст, затем перевод… я пишу на своём языке, ему приходит
// только на его языке»): Cloudflare Workers AI, binding `AI` (Settings → Bindings → Workers AI). The client's text goes
// to the coach as the original + a Russian translation; the coach's Russian goes to the client translated into the language
// the client writes in (detected, kept in tgs 'tl:<thread>'; fallback = the app language). «!» at the start = send as is.
// Free plan: 10 000 neurons/day ≈ 400+ short messages with gemma-3-12b. No AI binding ⇒ everything as before.
const TR_MODEL = '@cf/google/gemma-3-12b-it';
const LANG_EN = { ru: 'Russian', en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', it: 'Italian', pl: 'Polish', nl: 'Dutch', tr: 'Turkish', uk: 'Ukrainian', ar: 'Arabic', id: 'Indonesian', vi: 'Vietnamese', th: 'Thai', sv: 'Swedish', fi: 'Finnish', ro: 'Romanian', cs: 'Czech', he: 'Hebrew', hi: 'Hindi', kk: 'Kazakh', ky: 'Kyrgyz', uz: 'Uzbek' };
const TR_RULES = 'This is a private chat between a breakdance (breaking) coach and his student. Keep breaking move names in English as dancers say them (windmill, flare, airflare, headspin, swipes, turtle, munchmill, 1990, 2000, freeze, chair freeze, toprock, footwork, 6-step, 3-step, CC, kick-out, godown, powermove, handstand, baby freeze). Keep names, emojis, links, numbers and line breaks. Keep the tone: casual stays casual, slang stays slang. Never add explanations, quotes or notes.';
async function aiRun(env, system, user) {
  const r = await env.AI.run(TR_MODEL, { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 1200, temperature: 0.2 });
  // models answer either {response} or the OpenAI shape {choices:[{message:{content}}]}
  let out = r && (r.response ?? r.result?.response ?? r.choices?.[0]?.message?.content ?? r.output_text);
  if (out && typeof out === 'object') out = out.content || JSON.stringify(out);
  out = String(out || '').replace(/^```[a-z]*\s*|```\s*$/g, '').trim();
  if (!out) throw new Error('empty answer: ' + JSON.stringify(r).slice(0, 160));
  return out;
}
async function trErr(env, e, raw) { try { await tgSet(env.DB, 'trErr', (new Date().toISOString().slice(0, 16) + ' ' + String(e && e.message || e) + (raw ? ' | ' + raw : '')).slice(0, 300)); } catch (_) {} }
// client → coach: {lang (ISO code the client wrote in), ru (Russian translation, '' when the text is already Russian)}
async function trIn(env, text) {
  if (!env.AI || !text || !/\p{L}/u.test(text)) return null;
  let out = '';
  try {
    out = await aiRun(env, 'You translate messages into Russian. ' + TR_RULES + ' Answer in exactly this format: the first line is the ISO 639-1 code of the language the message is written in (for example en, es, pt), the second line is exactly ---, then the Russian translation. If the message is already in Russian, write ru, then ---, then nothing.', text);
    // lenient: «es», «**es**», «Language: es», then a line of dashes; no dashes ⇒ the whole answer is the translation
    const clean = out.replace(/\*\*/g, '');
    const m = /^\s*(?:[A-Za-z ]*:\s*)?([a-z]{2})\b[^\n]*\n\s*-{3,}\s*\n?([\s\S]*)$/i.exec(clean);
    let lang = '', ru = '';
    if (m) { lang = m[1].toLowerCase(); ru = m[2].trim(); }
    else if (/[А-Яа-яЁё]/.test(clean) && !/^[\s\S]*-{3,}/.test(clean)) ru = clean.trim();
    else { await trErr(env, 'unexpected answer', out.slice(0, 200)); return null; }
    return { lang, ru: lang === 'ru' || ru === text.trim() ? '' : ru };
  } catch (e) { await trErr(env, e, out.slice(0, 120)); return null; }
}
async function trOut(env, text, lang) {
  return aiRun(env, 'Translate the coach\'s message from Russian into ' + (LANG_EN[lang] || lang) + '. ' + TR_RULES + ' Write it the way the coach would say it to his student in that language. Output only the translation.', text);
}
async function trNote(env, t, text) { // remember the client's language; return the line(s) the coach sees under the original
  const r = await trIn(env, text);
  if (!r) return '';
  if (r.lang && r.lang !== 'ru') await tgSet(env.DB, 'tl:' + t.id, r.lang);
  return r.ru ? '\n\n🇷🇺 ' + r.ru : '';
}
// Topics (owner 10.11.2026 «от всех клиентов в один общий чат — неудобно»): with «Threaded mode» on for the bot (BotFather →
// mini app → Bot Settings), every client gets a topic of his own in the coach's chat with the bot (Bot API 9.4
// createForumTopic in private chats); the coach just writes in that topic. Topic ids in D1 chat_top. Topics off ⇒ the
// old single chat where the coach answers with «Reply». A failed attempt is remembered for 10 min (tgs 'notop').
const topicName = t => ((t.name || 'Без имени') + (t.country ? ' ' + flag(t.country) : '') + (t.svc ? ' · ' + (SVC_RU[t.svc] || t.svc) : '')).slice(0, 120);
async function chatTopic(env, t, owner) {
  const row = await env.DB.prepare('SELECT top FROM chat_top WHERE thr = ?').bind(t.id).first();
  if (row) return row.top;
  const no = parseInt(await tgGet(env.DB, 'notop')) || 0;
  if (Date.now() - no < 10 * 60e3) return 0;
  try {
    const r = await tg(env, 'createForumTopic', { chat_id: owner, name: topicName(t) });
    const top = r.message_thread_id;
    await env.DB.prepare('INSERT OR REPLACE INTO chat_top (thr, top) VALUES (?, ?)').bind(t.id, top).run();
    await tgSet(env.DB, 'notopErr', '');
    await tg(env, 'sendMessage', { chat_id: owner, message_thread_id: top, text: 'Новый клиент: ' + chatHead(t).replace(/^💬 /, '') + '\n\nПишите ответ прямо в этой теме — текст, фото, видео. Он придёт клиенту в приложение.' + (env.AI && t.lang !== 'ru' ? '\n\n🌐 Пишите по-русски — клиент получит перевод на свой язык. Без перевода (ссылка, фраза на английском) — начните сообщение с «!».' : '') + '\n\nПамятка — /help' }).catch(() => {});
    return top;
  } catch (e) {
    const msg = String(e && e.message || e);
    // BOT_TOPIC_WRONG_HOME = Telegram-wide failure since 09.11.2026 (tdlib/telegram-bot-api#944); each refused try may leave
    // a ghost «topic created» notice, so then wait 6 h instead of 10 min
    await tgSet(env.DB, 'notop', Date.now() + (/WRONG_HOME/.test(msg) ? 6 * 3600e3 - 10 * 60e3 : 0));
    await tgSet(env.DB, 'notopErr', msg.slice(0, 200)); return 0;
  }
}
async function chatToOwner(env, t, send) {
  const owner = await env.PUSH.get('tg:owner');
  await schema(env.DB);
  let top = await chatTopic(env, t, owner), m;
  try { m = await send(owner, top); }
  catch (e) {
    if (!top || !/thread|topic/i.test(e.message)) throw e;
    await env.DB.prepare('DELETE FROM chat_top WHERE thr = ?').bind(t.id).run(); // the coach deleted the topic ⇒ a new one
    top = await chatTopic(env, t, owner); m = await send(owner, top);
  }
  if (m && m.message_id) await env.DB.prepare('INSERT OR REPLACE INTO chat_map (tg, thr) VALUES (?, ?)').bind(m.message_id, t.id).run();
}
async function chatSend(req, env, json) {
  if (!(await chatOn(env))) return json({ ok: false, why: 'off' }, 409);
  const b = JSON.parse((await req.text()) || '{}');
  const text = String(b.text || '').replace(/\r/g, '').trim().slice(0, 3000);
  if (!text) return json({ ok: false, why: 'empty' }, 400);
  const { t, err } = await chatThread(env, b, req, true);
  if (err) return json({ ok: false, why: err }, 403);
  if (await chatLimited(env, t.id)) return json({ ok: false, why: 'limit' }, 429);
  const now = Date.now();
  const r = await env.DB.prepare("INSERT INTO chat_msg (thr, dir, kind, text, t) VALUES (?, 'in', 'text', ?, ?)").bind(t.id, text, now).run();
  await env.DB.prepare('UPDATE chat_thr SET last = ? WHERE id = ?').bind(now, t.id).run();
  await schema(env.DB);
  const tr = await trNote(env, t, text);
  try { await chatToOwner(env, t, (owner, top) => tg(env, 'sendMessage', top ? { chat_id: owner, message_thread_id: top, text: (text + tr).slice(0, 4096) } : { chat_id: owner, text: (chatHead(t) + '\n\n' + text + tr + (t.fresh ? CHAT_HINT : '')).slice(0, 4096) })); }
  catch (e) { return json({ ok: true, n: r.meta && r.meta.last_row_id, late: true }); } // kept; Telegram was not reachable
  return json({ ok: true, n: r.meta && r.meta.last_row_id });
}
async function chatFile(req, env, json) {
  if (!(await chatOn(env))) return json({ ok: false, why: 'off' }, 409);
  if (!env.VIDEOS) return json({ ok: false, why: 'nobucket' }, 409);
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const { t, err } = await chatThread(env, q, req, true);
  if (err) return json({ ok: false, why: err }, 403);
  if (await chatLimited(env, t.id)) return json({ ok: false, why: 'limit' }, 429);
  const ct = (req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v' }[ct];
  if (!ext) return json({ ok: false, why: 'type' }, 415);
  const len = +req.headers.get('Content-Length') || 0;
  if (len > CHAT_MAX) return json({ ok: false, why: 'big' }, 413);
  const buf = await req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > CHAT_MAX) return json({ ok: false, why: 'big' }, 413);
  const kind = ct.startsWith('image/') ? 'photo' : 'video', key = 'chat/' + t.id + '/' + rvCode(12) + '.' + ext;
  await env.VIDEOS.put(key, buf, { httpMetadata: { contentType: ct } });
  const cap = String(q.cap || '').slice(0, 900), now = Date.now();
  const r = await env.DB.prepare("INSERT INTO chat_msg (thr, dir, kind, text, media, t) VALUES (?, 'in', ?, ?, ?, ?)").bind(t.id, kind, cap, key, now).run();
  await env.DB.prepare('UPDATE chat_thr SET last = ? WHERE id = ?').bind(now, t.id).run();
  await schema(env.DB);
  const tr = cap ? await trNote(env, t, cap) : '';
  try {
    await chatToOwner(env, t, async (owner, top) => {
      const head = top ? cap + tr : chatHead(t) + (cap ? '\n\n' + cap + tr : '') + (t.fresh ? CHAT_HINT : '');
      const big = kind === 'photo' ? buf.byteLength > 9.5 * 1048576 : buf.byteLength > 49 * 1048576;
      if (big) {
        const link = new URL(req.url).origin + '/chat/m/' + key + '?s=' + await chatSign(env, key, 30);
        return tg(env, 'sendMessage', { chat_id: owner, ...(top ? { message_thread_id: top } : {}), text: ((head ? head + '\n\n' : '') + '📎 ' + (kind === 'photo' ? 'Фото' : 'Видео') + ' (' + (buf.byteLength / 1048576).toFixed(0) + ' МБ — больше лимита Telegram): ' + link).slice(0, 4096) });
      }
      const f = new FormData(); f.append('chat_id', owner); if (top) f.append('message_thread_id', String(top)); if (head) f.append('caption', head.slice(0, 1024));
      f.append(kind === 'photo' ? 'photo' : 'video', new Blob([buf], { type: ct }), 'file.' + ext);
      if (kind === 'video') f.append('supports_streaming', 'true');
      return tg(env, kind === 'photo' ? 'sendPhoto' : 'sendVideo', f);
    });
  } catch (e) { return json({ ok: true, n: r.meta && r.meta.last_row_id, late: true }); }
  return json({ ok: true, n: r.meta && r.meta.last_row_id });
}
async function chatGet(req, env, json) {
  if (!env.DB) return json({ msgs: [] });
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const { t, err, none, id } = await chatThread(env, q, req, false);
  if (err) return json({ ok: false, why: err }, 403);
  if (none) return json({ msgs: [], on: await chatOn(env) });
  await tgPull(env).catch(() => {}); // pull mode: bring the coach's fresh answers first
  const after = Math.max(0, parseInt(q.after) || 0);
  const r = await env.DB.prepare('SELECT n, dir, kind, text, media, t FROM chat_msg WHERE thr = ? AND n > ? ORDER BY n LIMIT 200').bind(t.id, after).all();
  const origin = new URL(req.url).origin;
  const msgs = await Promise.all((r.results || []).map(async m => ({ n: m.n, d: m.dir, k: m.kind, t: m.text || '', at: m.t, m: m.media ? origin + '/chat/m/' + m.media + '?s=' + await chatSign(env, m.media, 7) : '' })));
  return json({ msgs, on: await chatOn(env) });
}
async function chatPush(req, env, json) {
  const b = JSON.parse((await req.text()) || '{}');
  const { t, err, none } = await chatThread(env, b, req, false);
  if (err) return json({ ok: false, why: err }, 403);
  if (none) return json({ ok: false, why: 'none' });
  const s = b.sub || {};
  if (!s.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth) return json({ ok: false, why: 'sub' }, 400);
  await env.DB.prepare('UPDATE chat_thr SET push = ? WHERE id = ?').bind(JSON.stringify({ endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth }), t.id).run();
  return json({ ok: true });
}
const PUSH_TITLE = { ru: 'Ответ тренера', en: 'Your coach replied', es: 'Tu entrenador respondió', pt: 'Seu treinador respondeu', fr: 'Ton coach a répondu', de: 'Dein Coach hat geantwortet', ja: 'コーチから返信', ko: '코치의 답장', zh: '教练回复了你' };
const PUSH_MEDIA = { ru: 'Фото или видео', en: 'Photo or video', es: 'Foto o video', pt: 'Foto ou vídeo', fr: 'Photo ou vidéo', de: 'Foto oder Video', ja: '写真または動画', ko: '사진 또는 동영상', zh: '图片或视频' };
async function tgHook(req, env, json) {
  if (!env.TG_TOKEN || req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== (await env.PUSH.get('tg:hook'))) return json({ ok: false }, 403);
  const u = await req.json().catch(() => ({}));
  await tgUpdate(env, u.message);
  return json({ ok: true });
}
// one message to the bot (from the webhook or from getUpdates in the pull mode)
const TG_HELP = 'Памятка: как отвечать клиентам\n\n' +
  '• У каждого клиента своя тема с его именем. Откройте её и пишите — текст, фото, видео. Ответ придёт клиенту в приложение.\n' +
  '• Без тем: смахните сообщение клиента влево («Ответить») и пишите.\n' +
  '• 🌐 Перевод: сообщение клиента приходит оригиналом, ниже — перевод 🇷🇺. Вы пишете по-русски — клиент получает только на своём языке, а бот показывает, что ушло («↪️ Клиент получил…»).\n' +
  '• «!» в начале сообщения — отправить как есть, без перевода (ссылка, фраза на английском). Сам знак «!» клиент не увидит.\n' +
  '• 👍 под вашим сообщением — ответ дошёл до клиента.\n' +
  '• Видео до 20 МБ (больше бот Telegram не заберёт — сожмите или пришлите ссылку).';
async function tgUpdate(env, m) {
  const json = () => null;
  if (!m || !m.chat) return;
  const owner = await env.PUSH.get('tg:owner'), from = String(m.chat.id);
  try {
    const start = /^\/start(?:\s+(\S+))?/.exec(m.text || '');
    if (start) {
      const bind = await env.PUSH.get('tg:bind');
      if (start[1] && bind && start[1] === bind) {
        await env.PUSH.put('tg:owner', from); await env.PUSH.delete('tg:bind');
        await tg(env, 'sendMessage', { chat_id: from, text: 'Готово ✓ Сюда будут приходить сообщения клиентов из приложения Fedoskin team.\n\nЧтобы ответить клиенту — смахните его сообщение влево (или «Ответить») и пишите: текст, фото, видео. Ответ появится у него в приложении.' });
      } else if (from !== owner) await tg(env, 'sendMessage', { chat_id: from, text: 'This bot only delivers messages to the coach. Write from the Fedoskin team app → Coaching.' });
      return json({ ok: true });
    }
    if (from !== owner) return json({ ok: true }); // only the coach talks to clients through the bot
    if (/^\/(help|pamyatka|памятка)(?:[\s@]|$)/i.test(m.text || '')) { await tg(env, 'sendMessage', { chat_id: from, ...(m.message_thread_id ? { message_thread_id: m.message_thread_id } : {}), text: TG_HELP }); return json({ ok: true }); }
    await schema(env.DB);
    const top = m.message_thread_id || 0, inTop = top ? { message_thread_id: top } : {};
    let map = top ? await env.DB.prepare('SELECT thr FROM chat_top WHERE top = ?').bind(top).first() : null;
    const rep = m.reply_to_message && m.reply_to_message.message_id;
    if (!map && rep) map = await env.DB.prepare('SELECT thr FROM chat_map WHERE tg = ?').bind(rep).first();
    if (!map) { await tg(env, 'sendMessage', { chat_id: from, ...inTop, text: top ? '⚠️ Эта тема не связана с клиентом. Откройте тему с именем клиента и напишите ответ там.' : '⚠️ Не понял, кому это. Напишите в теме клиента (или смахните его сообщение влево — «Ответить») и отправьте ответ ещё раз.', reply_to_message_id: m.message_id }); return json({ ok: true }); }
    const t = await env.DB.prepare('SELECT * FROM chat_thr WHERE id = ?').bind(map.thr).first();
    if (!t) return json({ ok: true });
    let kind = 'text', media = '', text = m.text || m.caption || '', sentTr = '';
    const inT = m.message_thread_id ? { message_thread_id: m.message_thread_id } : {};
    // the coach writes in Russian ⇒ the client gets his own language only («!» at the start = as is)
    if (text.startsWith('!')) text = text.slice(1).trim();
    else if (env.AI && text && /[А-Яа-яЁё]/.test(text)) {
      await schema(env.DB);
      const tl = (await tgGet(env.DB, 'tl:' + t.id)) || t.lang || 'en';
      if (tl !== 'ru') {
        try { text = await trOut(env, text, tl); sentTr = (LANG_RU[tl] || tl); }
        catch (e) { await trErr(env, e); await tg(env, 'sendMessage', { chat_id: from, ...inT, text: '⚠️ Переводчик сейчас не ответил — сообщение НЕ отправлено. Отправьте его ещё раз. Чтобы отправить без перевода, начните с «!».', reply_to_message_id: m.message_id }); return json({ ok: true }); }
      }
    }
    const file = m.photo ? m.photo[m.photo.length - 1] : m.video || m.animation || (m.document && /^(image|video)\//.test(m.document.mime_type || '') ? m.document : null);
    if (file) {
      const mime = m.photo ? 'image/jpeg' : (file.mime_type || 'video/mp4');
      kind = mime.startsWith('image/') ? 'photo' : 'video';
      if ((file.file_size || 0) > 20 * 1048576) { await tg(env, 'sendMessage', { chat_id: from, ...(m.message_thread_id ? { message_thread_id: m.message_thread_id } : {}), text: '⚠️ Файл больше 20 МБ — бот Telegram не может его забрать. Сожмите видео или пришлите ссылку.', reply_to_message_id: m.message_id }); return json({ ok: true }); }
      if (!env.VIDEOS) { await tg(env, 'sendMessage', { chat_id: from, ...(m.message_thread_id ? { message_thread_id: m.message_thread_id } : {}), text: '⚠️ Нет хранилища R2 — фото и видео пока не отправить, только текст.', reply_to_message_id: m.message_id }); return json({ ok: true }); }
      const f = await tg(env, 'getFile', { file_id: file.file_id });
      const r = await fetch('https://api.telegram.org/file/bot' + env.TG_TOKEN + '/' + f.file_path);
      if (!r.ok) throw new Error('download ' + r.status);
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/quicktime': 'mov', 'video/webm': 'webm' }[mime] || (kind === 'photo' ? 'jpg' : 'mp4');
      media = 'chat/' + t.id + '/' + rvCode(12) + '.' + ext;
      await env.VIDEOS.put(media, await r.arrayBuffer(), { httpMetadata: { contentType: mime } });
    } else if (!text) { await tg(env, 'sendMessage', { chat_id: from, ...(m.message_thread_id ? { message_thread_id: m.message_thread_id } : {}), text: '⚠️ Такое пока не передаётся — отправьте текст, фото или видео.', reply_to_message_id: m.message_id }); return json({ ok: true }); }
    const now = Date.now();
    await env.DB.prepare("INSERT INTO chat_msg (thr, dir, kind, text, media, t) VALUES (?, 'out', ?, ?, ?, ?)").bind(t.id, kind, text.slice(0, 4000), media || null, now).run();
    await env.DB.prepare('UPDATE chat_thr SET last = ? WHERE id = ?').bind(now, t.id).run();
    let pushed = false;
    if (t.push) {
      const rec = JSON.parse(t.push), L = PUSH_TITLE[t.lang] ? t.lang : 'en';
      const res = await sendPush(rec, JSON.stringify({ title: PUSH_TITLE[L], body: (text || PUSH_MEDIA[L]).slice(0, 140), tag: 'chat', chat: 1 }), await vapid(env)).catch(() => null);
      pushed = !!(res && res.ok);
      if (res && (res.status === 404 || res.status === 410)) await env.DB.prepare('UPDATE chat_thr SET push = NULL WHERE id = ?').bind(t.id).run();
    }
    if (sentTr) {
      const first = !(await tgGet(env.DB, 'trhint:' + t.id)); if (first) await tgSet(env.DB, 'trhint:' + t.id, 1);
      await tg(env, 'sendMessage', { chat_id: from, ...inT, text: '↪️ Клиент получил (' + sentTr + '): ' + text.slice(0, 3800) + (first ? '\n\nБез перевода — начните сообщение с «!». Памятка — /help' : ''), reply_to_message_id: m.message_id }).catch(() => {});
    }
    try { await tg(env, 'setMessageReaction', { chat_id: from, message_id: m.message_id, reaction: [{ type: 'emoji', emoji: '👍' }] }); }
    catch (_) { await tg(env, 'sendMessage', { chat_id: from, ...(m.message_thread_id ? { message_thread_id: m.message_thread_id } : {}), text: '✓ Доставлено', reply_to_message_id: m.message_id }).catch(() => {}); }
    if (!pushed && !t.push) await env.PUSH.get('tg:nopush:' + t.id).then(async seen => { if (!seen) { await env.PUSH.put('tg:nopush:' + t.id, '1', { expirationTtl: 30 * 86400 }); await tg(env, 'sendMessage', { chat_id: from, ...(m.message_thread_id ? { message_thread_id: m.message_thread_id } : {}), text: 'ℹ️ У этого клиента не включены уведомления — он увидит ответ, когда откроет чат в приложении.' }).catch(() => {}); } });
  } catch (e) {
    await tg(env, 'sendMessage', { chat_id: from, ...(m.message_thread_id ? { message_thread_id: m.message_thread_id } : {}), text: '⚠️ Не получилось доставить: ' + String(e && e.message || e).slice(0, 200), reply_to_message_id: m.message_id }).catch(() => {});
  }
}
// ----- pull mode (10.11.2026): Telegram answered setWebhook with «bad webhook: Failed to resolve host» — its servers
// could not reach *.workers.dev. Then the worker fetches the coach's messages itself (getUpdates): every minute from the
// Cron trigger, every few seconds while a client has the chat open (/chat/get), and on the admin's «Проверить».
// State in D1 table tgs (k, v): mode = hook|pull, off = next update id, lock = busy-until / last pull time, cron = last tick.
async function tgGet(db, k) { const r = await db.prepare('SELECT v FROM tgs WHERE k = ?').bind(k).first(); return r ? r.v : null; }
async function tgSet(db, k, v) { await db.prepare('INSERT INTO tgs (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, String(v)).run(); }
async function tgPull(env, gap = 3000) {
  if (!env.TG_TOKEN || !env.DB) return;
  const db = env.DB; await schema(db);
  if ((await tgGet(db, 'mode')) !== 'pull') return;
  const now = Date.now();
  // claim: only one pull at a time, and not more often than `gap`
  const c = await db.prepare("INSERT INTO tgs (k, v) VALUES ('lock', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v WHERE CAST(tgs.v AS INTEGER) < ?").bind(String(now + 30000), now - gap).run();
  if (!c.meta || !c.meta.changes) return;
  try {
    let off = parseInt(await tgGet(db, 'off')) || 0;
    const ups = await tg(env, 'getUpdates', { offset: off || undefined, timeout: 0, limit: 50, allowed_updates: ['message'] });
    for (const u of ups) {
      off = u.update_id + 1; await tgSet(db, 'off', off); // saved first: a message is never handled twice
      await tgUpdate(env, u.message);
    }
  } finally { await tgSet(db, 'lock', Date.now()); }
}
async function tgAdmin(req, env, path, json) {
  if (!env.TG_TOKEN) return json({ error: 'no-token' }, 409);
  if (!env.DB) return json({ error: 'no-db' }, 409);
  if (path === '/tg/status') {
    const me = await tg(env, 'getMe').catch(e => ({ err: e.message }));
    if (me.err) return json({ error: 'token: ' + me.err }, 409);
    await schema(env.DB);
    if (!(await tgGet(env.DB, 'cmds'))) { await tg(env, 'setMyCommands', { commands: [{ command: 'help', description: 'Памятка: как отвечать клиентам' }] }).then(() => tgSet(env.DB, 'cmds', 1)).catch(() => {}); }
    // topics: what Telegram says about the bot + the last failure; «Проверить» lets the next client message try again at once
    const topics = { on: !!me.has_topics_enabled, err: (await tgGet(env.DB, 'notopErr')) || '' }, ai = !!env.AI, trErrLast = (await tgGet(env.DB, 'trErr')) || '';
    await tgSet(env.DB, 'notop', 0);
    const mode = await tgGet(env.DB, 'mode');
    if (mode === 'pull') {
      await tgPull(env, 0).catch(() => {});
      const cron = parseInt(await tgGet(env.DB, 'cron')) || 0;
      return json({ bot: me.username, owner: !!(await env.PUSH.get('tg:owner')), hook: true, mode, cron: cron && Date.now() - cron < 5 * 60e3, topics, ai, trErr: trErrLast });
    }
    const info = await tg(env, 'getWebhookInfo').catch(() => ({}));
    return json({ bot: me.username, owner: !!(await env.PUSH.get('tg:owner')), hook: !!(info.url && info.url.endsWith('/tg/hook')), hookErr: info.last_error_message || '', mode: 'hook', topics, ai, trErr: trErrLast });
  }
  // /tg/trtest: the admin's «Проверить переводчик» — both directions on a sample, with the model's raw answer
  if (path === '/tg/trtest') {
    if (!env.AI) return json({ ok: false, error: 'no-ai' });
    await schema(env.DB);
    const b = await req.json().catch(() => ({}));
    const sample = String(b.text || 'Hola coach, no puedo hacer más de una vuelta y media de flare y me duelen las muñecas').slice(0, 500);
    const res = { ok: true, sample };
    try { res.raw = await aiRun(env, 'You translate messages into Russian. ' + TR_RULES + ' Answer in exactly this format: the first line is the ISO 639-1 code of the language the message is written in (for example en, es, pt), the second line is exactly ---, then the Russian translation. If the message is already in Russian, write ru, then ---, then nothing.', sample); } catch (e) { res.ok = false; res.error = String(e && e.message || e); return json(res); }
    res.parsed = await trIn(env, sample);
    try { res.back = await trOut(env, 'Привет! Пришли видео сбоку, посмотрю где теряешь скорость.', (res.parsed && res.parsed.lang) || 'es'); } catch (e) { res.ok = false; res.error = 'back: ' + String(e && e.message || e); }
    if (res.ok && res.parsed) await tgSet(env.DB, 'trErr', '');
    return json(res);
  }
  // /tg/setup: point the webhook here, make a one-time binding link for the coach's own Telegram
  const me = await tg(env, 'getMe');
  const secret = b64u(crypto.getRandomValues(new Uint8Array(24))), bind = rvCode(16);
  await env.PUSH.put('tg:hook', secret); await env.PUSH.put('tg:bind', bind, { expirationTtl: 3600 });
  await schema(env.DB);
  let mode = 'hook';
  try { await tg(env, 'setWebhook', { url: new URL(req.url).origin + '/tg/hook', secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true }); }
  catch (e) { // Telegram can't reach us ⇒ we go to Telegram (getUpdates works only without a webhook)
    mode = 'pull';
    await tg(env, 'deleteWebhook', { drop_pending_updates: true }).catch(() => {});
    await tgSet(env.DB, 'off', 0); await tgSet(env.DB, 'lock', 0);
  }
  await tgSet(env.DB, 'mode', mode);
  return json({ ok: true, mode, bot: me.username, link: 'https://t.me/' + me.username + '?start=' + bind, owner: !!(await env.PUSH.get('tg:owner')) });
}
