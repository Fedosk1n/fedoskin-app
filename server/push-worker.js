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
    if (!env.DB) return;
    ctx.waitUntil((async () => { await schema(env.DB); await btExpire(env, null).catch(() => {}); if (!env.TG_TOKEN) return; await tgSet(env.DB, 'cron', Date.now()); await tgPull(env, 0); })().catch(() => {}));
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
        const vkey = path.slice(3), vp = new URL(req.url).searchParams.get('p');
        // paid course videos (12.11.2026): only with the pass of THAT course, given to phones that bought it
        const need = await crsNeed(env, vkey);
        if (!(need ? await cpassOk(env, vp, need) : await passOk(env, vp))) return new Response(JSON.stringify({ error: 'pass' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
        return await r2Serve(req, env, vkey, cors, need ? { ok: R2_KEY.test(vkey) } : undefined);
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
      if (path === '/lb/search' && req.method === 'GET') return await lbSearch(req, env, json);
      if (path === '/lb/who' && req.method === 'GET') return await lbWho(req, env, json);
      if (path === '/hit' && req.method === 'POST') return await hit(req, env, json);
      // lessons published less than an hour ago: watching one then gives +10 points (owner 11.11.2026)
      if (path === '/lesson/fresh' && req.method === 'GET') {
        if (!env.DB) return json({ fresh: [] });
        await schema(env.DB);
        const rs = await env.DB.prepare('SELECT id, t FROM lfresh WHERE t > ?').bind(Date.now() - FRESH_MS).all();
        return json({ fresh: (rs.results || []).map(r => [r.id, r.t]), now: Date.now() });
      }
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
      // paid video courses (12.11.2026): order → PayPal → the coach confirms in the admin → the course opens on the phone
      if (['/course/order', '/course/paid', '/course/my', '/course/redeem'].includes(path) && req.method === 'POST') return await crsPublic(req, env, path, json);
      // hero battles (10.11.2026): challenge anyone from the rating, the judges decide at random
      if ((path.startsWith('/bt/') || path.startsWith('/hero/')) && req.method === 'POST') return await battle(req, env, path, json);
      if (req.method !== 'POST' && path !== '/stats' && path !== '/visits' && !path.startsWith('/r2/') && path !== '/rv/list' && path !== '/tg/status' && path !== '/course/list' && path !== '/course/apass') return json({ error: 'not found' }, 404);

      if (path === '/subscribe') {
        const { sub, lang } = await req.json();
        if (!sub || !sub.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return json({ error: 'bad subscription' }, 400);
        const key = 's:' + await hash(sub.endpoint);
        // keep the FIRST subscribe time (a language change re-sends the same phone); t also goes to the key's metadata so the
        // admin's «подписались по дням» is counted from the list alone (12.11.2026)
        let t0 = Date.now();
        try { const old = await env.PUSH.get(key, 'json'); if (old && old.t) t0 = old.t; } catch (_) {}
        const rec = { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, lang: TEXT[lang] ? lang : 'en', t: t0 };
        await env.PUSH.put(key, JSON.stringify(rec), { metadata: { t: t0 } });
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
        // owner 12.11.2026 «в статистику "подписались на уведомления"»: total + by Moscow day of the first subscribe
        let n = 0, cursor; const byDay = {}, old = [];
        do {
          const r = await env.PUSH.list({ prefix: 's:', cursor }); n += r.keys.length;
          r.keys.forEach(k => { if (k.metadata && k.metadata.t) byDay[mskDay(k.metadata.t)] = (byDay[mskDay(k.metadata.t)] || 0) + 1; else old.push(k.name); });
          cursor = r.list_complete ? null : r.cursor;
        } while (cursor);
        let noDate = 0;
        for (let i = 0; i < old.length; i += 50) { // older records: the time is inside the value
          const recs = await Promise.all(old.slice(i, i + 50).map(k => env.PUSH.get(k, 'json').catch(() => null)));
          recs.forEach(x => { if (x && x.t) byDay[mskDay(x.t)] = (byDay[mskDay(x.t)] || 0) + 1; else noDate++; });
        }
        let tee = null;
        if (env.DB) { try { await schema(env.DB); tee = ((await env.DB.prepare("SELECT COUNT(*) AS n FROM hero_own WHERE item = 'tee'").first()) || {}).n || 0; } catch (_) {} }
        return json({ subscribers: n, subDays: Object.entries(byDay).sort((a, b) => a[0] < b[0] ? -1 : 1), noDate, tee, today: mskDay() });
      }
      if (path === '/visits') return await visits(env, json);
      if (path === '/lesson/fresh') { // the admin, right after publishing new lessons
        if (!env.DB) return json({ error: 'nodb' }, 409);
        await schema(env.DB);
        const b = await req.json().catch(() => ({})), ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter(x => /^[a-z0-9-]{1,60}$/.test(x)).slice(0, 30);
        if (ids.length) await env.DB.batch(ids.map(id => env.DB.prepare('INSERT OR IGNORE INTO lfresh (id, t) VALUES (?, ?)').bind(id, Date.now())));
        return json({ ok: true, ids });
      }
      if (path.startsWith('/r2/')) return await r2Admin(req, env, path, json);
      if (path.startsWith('/rv/')) return await rvAdmin(req, env, path, json);
      if (path.startsWith('/course/')) return await crsAdmin(req, env, path, json);
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
// course passes: "<course>.<expiry, base 36>.<signature>" — the same secret, another message, so a lesson pass never opens a course
async function cpassSig(env, cid, exp) { return b64u(await crypto.subtle.sign('HMAC', await passKey(env), enc.encode('c1.' + cid + '.' + exp))).slice(0, 32); }
async function cpassMake(env, cid) { const exp = Math.floor(Date.now() / 1000) + PASS_TTL; return { p: cid + '.' + exp.toString(36) + '.' + await cpassSig(env, cid, exp), exp }; }
async function cpassOk(env, p, cid) {
  const m = /^([a-z0-9]{2,24})\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{32})$/.exec(p || ''); if (!m || m[1] !== cid) return false;
  const exp = parseInt(m[2], 36); if (!(exp > Date.now() / 1000) || exp > Date.now() / 1000 + PASS_TTL + 60) return false;
  return (await cpassSig(env, cid, exp)) === m[3];
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
// ----- the rating in D1 (10.11.2026: «у нас будут сотни тысяч пользователей») -----
// One row per phone; ranks are counted with indexes (no whole-board reads). The old single KV key `lb` is copied in once
// (KV flag lb:mig) and kept untouched as a backup. hid = 1: the person hid from the rating (kept for points/battles).
const LB_COLS = 'id, n, c, co, a, m, v, s, f, lvl';
async function lbMigrate(env) {
  if (await env.PUSH.get('lb:mig')) return;
  const board = JSON.parse((await env.PUSH.get('lb')) || '{}'), db = env.DB, rows = Object.entries(board);
  for (let i = 0; i < rows.length; i += 50) {
    await db.batch(rows.slice(i, i + 50).map(([id, r]) => db.prepare('INSERT OR IGNORE INTO lb (id, n, nl, c, cn, co, a, m, v, s, h, f, t, lvl, rk, hid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)')
      .bind(id, r.n || '', (r.n || '').toLowerCase(), r.c || '', normCity(r.c), r.co || '', r.a || 'alpha', r.m || 0, r.v || 0, r.s || 0, r.h, r.f || Date.now(), r.t || Date.now(), heroLevel(r.m || 0), Math.floor(Math.random() * 1e9))));
  }
  await env.PUSH.put('lb:mig', String(rows.length));
}
async function lbRow(db, id) { return await db.prepare('SELECT * FROM lb WHERE id = ?').bind(id).first(); }
async function leaderboard(req, env, json) {
  if (!env.DB) return await leaderboardKV(req, env, json);
  const db = env.DB; await schema(db); await lbMigrate(env);
  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams;
    const me = String(q.get('id') || ''), city = normCity(q.get('city'));
    const mine = me ? await lbRow(db, me) : null;
    const pack = async (where, args) => {
      const top = (await db.prepare('SELECT ' + LB_COLS + ' FROM lb WHERE hid = 0' + where + ' ORDER BY m DESC, f ASC LIMIT 100').bind(...args).all()).results || [];
      const total = (await db.prepare('SELECT COUNT(*) AS n FROM lb WHERE hid = 0' + where).bind(...args).first()).n;
      let place = 0;
      if (mine && !mine.hid && (!where || mine.cn === city)) place = 1 + (await db.prepare('SELECT COUNT(*) AS n FROM lb WHERE hid = 0' + where + ' AND (m > ? OR (m = ? AND f < ?))').bind(...args, mine.m, mine.m, mine.f).first()).n;
      return { total, place, top: top.map(r => ({ id: r.id, n: r.n, c: r.c, co: r.co, a: r.a, m: r.m, v: r.v, s: r.s })) };
    };
    const out = { world: await pack('', []), city: city ? await pack(' AND cn = ?', [city]) : null, big: 1 };
    await lbExtras(db, out, [...out.world.top, ...(out.city ? out.city.top : [])], me);
    return json(out);
  }
  if (req.method !== 'POST') return json({ error: 'not found' }, 404);
  const b = await req.json();
  const id = String(b.id || '');
  if (!/^\d{6,9}$/.test(id) || !/^[0-9a-f]{32}$/.test(String(b.secret || ''))) return json({ error: 'bad id' }, 400);
  const h = await hash('lb:' + b.secret), old = await lbRow(db, id), now = Date.now();
  if (old && old.h !== h) return json({ error: 'this id belongs to another phone' }, 403);
  if (b.hide) { if (old) await db.prepare('UPDATE lb SET hid = 1 WHERE id = ?').bind(id).run(); return json({ ok: true, hidden: true }); }
  const num = (x, max) => Math.max(0, Math.min(max, Math.floor(+x || 0)));
  const sinceStart = Math.max(0, Math.floor((now - LB_START) / 60000));
  let m = num(b.m, Math.min(sinceStart, 300));
  if (old) m = Math.max(old.m, Math.min(m, old.m + Math.ceil((now - old.t) / 60000) + 2));
  const n = clean(b.nick, 20), c = clean(b.city, 30), co = clean(b.country, 30), a = clean(b.av, 16) || 'alpha';
  const v = Math.min(num(b.v, 1e6), m * 12 + 5), st = Math.min(num(b.s, 3650), Math.ceil((now - LB_START) / 864e5) + 1);
  const same = old && !old.hid && old.m === m && old.v === v && old.s === st && old.n === n && old.c === c && old.co === co && old.a === a;
  if (!(same && now - old.t < 6 * 3600e3)) {
    await db.prepare('INSERT INTO lb (id, n, nl, c, cn, co, a, m, v, s, h, f, t, lvl, rk, hid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0) ' +
      'ON CONFLICT(id) DO UPDATE SET n = excluded.n, nl = excluded.nl, c = excluded.c, cn = excluded.cn, co = excluded.co, a = excluded.a, m = excluded.m, v = excluded.v, s = excluded.s, t = excluded.t, lvl = excluded.lvl, hid = 0')
      .bind(id, n, n.toLowerCase(), c, normCity(c), co, a, m, v, st, h, now, now, heroLevel(m), Math.floor(Math.random() * 1e9)).run();
  }
  return json({ ok: true, m });
}
// search by nick (owner 10.11.2026) — prefix of the name, visible people only, 20 rows
async function lbSearch(req, env, json) {
  if (!env.DB) return json({ error: 'nodb' }, 409);
  const db = env.DB; await schema(db); await lbMigrate(env);
  const q = clean(new URL(req.url).searchParams.get('q'), 20).toLowerCase(), me = String(new URL(req.url).searchParams.get('id') || '');
  if (q.length < 2) return json({ top: [] });
  const hi = q.slice(0, -1) + String.fromCharCode(q.charCodeAt(q.length - 1) + 1);
  const rows = ((await db.prepare('SELECT ' + LB_COLS + ' FROM lb WHERE nl >= ? AND nl < ? AND hid = 0 ORDER BY m DESC LIMIT 20').bind(q, hi).all()).results || [])
    .map(r => ({ id: r.id, n: r.n, c: r.c, co: r.co, a: r.a, m: r.m }));
  const out = { top: rows }; await lbExtras(db, out, rows, me);
  return json(out);
}
// who is behind a friend's battle link (?vs=<id>)
async function lbWho(req, env, json) {
  if (!env.DB) return json({ error: 'nodb' }, 409);
  const db = env.DB; await schema(db); await lbMigrate(env);
  const r = await lbRow(db, String(new URL(req.url).searchParams.get('id') || ''));
  if (!r || r.hid) return json({ error: 'gone' }, 404);
  const out = { id: r.id, n: r.n, co: r.co, m: r.m, lvl: heroLevel(r.m) }; const tmp = [out]; await lbExtras(db, {}, tmp, '');
  return json(out);
}
// battle scores + accessories of the rows shown
async function lbExtras(db, out, rows, me) {
  try {
    const ids = [...new Set(rows.map(r => r.id).concat(me ? [me] : []))];
    if (!ids.length) { out.bt = true; return; }
    const qs = ids.map(() => '?').join(',');
    const rs = await db.prepare('SELECT id, w, l FROM bt_score WHERE id IN (' + qs + ')').bind(...ids).all();
    const sc = {}; (rs.results || []).forEach(r => { sc[r.id] = [r.w, r.l]; });
    const eqs = await db.prepare('SELECT id, eq FROM hero_eq WHERE id IN (' + qs + ')').bind(...ids).all();
    const eq = {}; (eqs.results || []).forEach(r => { try { eq[r.id] = JSON.parse(r.eq); } catch (_) {} });
    rows.forEach(r => { if (sc[r.id]) r.bt = sc[r.id]; if (eq[r.id] && eq[r.id].length) r.eq = eq[r.id]; });
    out.bt = true; if (sc[me]) out.mine = sc[me];
  } catch (_) {}
}
async function leaderboardKV(req, env, json) {
  const board = JSON.parse((await env.PUSH.get('lb')) || '{}');
  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams;
    const me = String(q.get('id') || ''), city = normCity(q.get('city'));
    const all = Object.entries(board).map(([id, r]) => ({ id, ...r })).sort((a, b) => (b.m - a.m) || (a.f - b.f));
    const pack = list => ({
      total: list.length,
      place: list.findIndex(r => r.id === me) + 1,
      top: list.slice(0, 100).map(r => ({ id: r.id, n: r.n, c: r.c, co: r.co, a: r.a, m: r.m, v: r.v, s: r.s }))
    });
    const out = { world: pack(all), city: city ? pack(all.filter(r => normCity(r.c) === city)) : null };
    // battle scores of the people shown (10.11.2026)
    if (env.DB) try {
      await schema(env.DB);
      const ids = [...new Set([...out.world.top, ...(out.city ? out.city.top : [])].map(r => r.id).concat(me ? [me] : []))];
      if (ids.length) {
        const rs = await env.DB.prepare('SELECT id, w, l FROM bt_score WHERE id IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).all();
        const sc = {}; (rs.results || []).forEach(r => { sc[r.id] = [r.w, r.l]; });
        const eqs = await env.DB.prepare('SELECT id, eq FROM hero_eq WHERE id IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).all();
        const eq = {}; (eqs.results || []).forEach(r => { try { eq[r.id] = JSON.parse(r.eq); } catch (_) {} });
        [out.world.top, out.city ? out.city.top : []].forEach(list => list.forEach(r => { if (sc[r.id]) r.bt = sc[r.id]; if (eq[r.id] && eq[r.id].length) r.eq = eq[r.id]; }));
        out.bt = true; if (sc[me]) out.mine = sc[me];
      }
    } catch (_) {}
    return json(out);
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

// ----- hero battles (10.11.2026) -----
// Just for fun: a phone from the rating challenges another one, three judges vote at random (a higher hero level gives a
// slightly better chance), the result is stored and the other phone sees the same battle (same seed) when it opens the app.
// Auth = the rating's own id + secret. Limits (owner 10.11.2026): one challenge per 30 minutes per phone («твой би-бой
// отдыхает»), 3 a day against the same person; the challenged phone gets at most one push per 6 hours.
// Points (owner 10.11.2026, for accessories only, never sold for money): +10 per battle win (losses give nothing),
// +20 per full hour of lessons (the rating's minutes); spent = sum of bought items' prices.
const HERO_LEVELS = [0, 60, 240, 600, 1200, 2100, 3600, 6000];
const BT_REST = 15 * 60e3; // owner 11.11.2026: 30 → 15 minutes
const DJ_SLOT = 30 * 60e3; // the DJ keeps a pair's track for half an hour
// must match HERO.SHOP in hero.js: id → [slot, price]
const SHOP = { neon: ['laces', 80], gloves: ['hands', 100], cardboard: ['floor', 100], knee: ['knees', 120], bandana: ['head', 150], wall: ['bg', 200], city: ['bg', 200], red: ['kicks', 250], box: ['item', 300], fire: ['fx', 500], tee: ['top', 0] }; // tee = not sold: given for push notifications (owner 11.11.2026)
const PTS_WIN = 10, PTS_HOUR = 20, PTS_FRESH = 10, FRESH_MS = 3600e3, PTS_GOLD = 5, PTS_RED = 10; // + bonus for pulling out a rare move (owner 11.11.2026)
const heroLevel = m => { let l = 1; HERO_LEVELS.forEach((x, i) => { if (m >= x) l = i + 1; }); return l; };
const BT_TITLE = { ru: 'Батл!', en: 'Battle!', es: '¡Batalla!', pt: 'Batalha!', fr: 'Battle !', de: 'Battle!', ja: 'バトル！', ko: '배틀!', zh: '斗舞！' };
const BT_BODY = { ru: '{n} вызывает тебя на батл — смотри, кто победил', en: '{n} challenged you to a battle — see who won', es: '{n} te retó a una batalla: mira quién ganó', pt: '{n} te desafiou para uma batalha — veja quem venceu', fr: '{n} te défie en battle — regarde qui a gagné', de: '{n} fordert dich zum Battle heraus — schau, wer gewonnen hat', ja: '{n}からバトルの挑戦！勝者をチェック', ko: '{n}님이 배틀을 신청했어요 — 누가 이겼는지 확인하세요', zh: '{n}向你发起斗舞——快看谁赢了' };
// battles by hand (owner 11.11.2026 «соперник должен ответить в течение суток»): the challenge waits for an answer
const BT_BODY_H = { ru: '{n} вызывает тебя на батл — ответь своим раундом в течение суток', en: '{n} challenged you to a battle — answer with your round within 24 hours', es: '{n} te retó a una batalla: responde con tu ronda en 24 horas', pt: '{n} te desafiou para uma batalha — responda com sua rodada em 24 horas', fr: '{n} te défie en battle — réponds avec ton round sous 24 heures', de: '{n} fordert dich zum Battle heraus — antworte innerhalb von 24 Stunden mit deiner Runde', ja: '{n}からバトルの挑戦！24時間以内に自分のラウンドで応えよう', ko: '{n}님이 배틀을 신청했어요 — 24시간 안에 너의 라운드로 응답해', zh: '{n}向你发起斗舞——24小时内用你的回合应战' };
const BT_TITLE_R = { ru: 'Результат батла', en: 'Battle result', es: 'Resultado de la batalla', pt: 'Resultado da batalha', fr: 'Résultat du battle', de: 'Battle-Ergebnis', ja: 'バトルの結果', ko: '배틀 결과', zh: '斗舞结果' };
const BT_BODY_R = { ru: 'Батл с {n}: судьи решили — смотри результат', en: 'Battle with {n}: the judges have decided — see the result', es: 'Batalla con {n}: los jueces decidieron, mira el resultado', pt: 'Batalha com {n}: os juízes decidiram — veja o resultado', fr: 'Battle contre {n} : les juges ont tranché — regarde le résultat', de: 'Battle mit {n}: Die Jury hat entschieden — schau dir das Ergebnis an', ja: '{n}とのバトル：審査員が判定！結果をチェック', ko: '{n}님과의 배틀: 심사 완료 — 결과를 확인해', zh: '与{n}的斗舞：评委已判定——快看结果' };
const BT_WAIT = 24 * 3600e3;
function btPack(r, eq) {
  eq = eq || {};
  const rd = x => { try { return x ? rbPub(typeof x === 'string' ? JSON.parse(x) : x) : undefined; } catch (_) { return undefined; } };
  const o = { n: r.n, a: { id: r.a, name: r.na, lvl: r.la, eq: eq[r.a] || [] }, b: { id: r.b, name: r.nb, lvl: r.lb, eq: eq[r.b] || [] }, seed: r.seed, votes: JSON.parse(r.votes || '[]'), win: r.win, t: r.t };
  if (r.hst) Object.assign(o, { hand: 1, st: r.hst, dj: r.dj, exp: r.exp, ra: rd(r.hra), rb: r.hst === 'done' ? rd(r.hrb) : undefined, late: r.late ? 1 : 0 });
  return o;
}
// ----- rhythm rounds (owner 11.11.2026 «встрой всё в основной батл… авто или руками»; «трек выбирает диджей») -----
// A battle = the challenger dances one round of the rhythm game (by hand or on auto) to a track the DJ (= this server)
// picks; the other phone is not waiting: its dancer dances on the same track in its owner's style (the shares of
// perfect / good / miss and the picks of its own last round; nobody yet ⇒ by its level). The judges vote by the scores.
// The notes and the scoring MUST match rhythm.js (notesFor / scoreOf) — the server counts the score itself from the hits.
const RB_BEATS = { lofi: [84, -1, .8, 1], boom: [100, 0, 1, 2], funk: [114, 0, 1.25, 3], raw: [128, 1, 1.55, 4] }; // bpm, up, mult, lv
const RB_DIFF = { toprock: 1, kickstep: 1, salsa: 2, indian: 2, sixstep: 1, ccs: 2, backspin: 1, swipe: 2, windmill: 2, backflip: 3, headspin: 3,
  flare: 3, airflare: 3, ninety: 3, freeze: 1, headstand: 2, handstand: 2, airchair: 3, hollowback: 3 };
const RB_NEED = { windmill: 3, backflip: 3, handstand: 3, airchair: 3, headspin: 5, flare: 5, airflare: 5, ninety: 5, hollowback: 5 };
const RB_ROWS = [['toprock', 'kickstep', 'salsa', 'indian'], ['sixstep', 'ccs'], ['backspin', 'swipe', 'windmill', 'headspin', 'flare', 'airflare', 'ninety'],
  ['freeze', 'headstand', 'handstand', 'airchair', 'hollowback']];
const RB_MULT = [0, 1, 1.35, 1.7];
const RB_PAT = [null, [[0, 1, 2, 3]],
  [[0, 1, 1.5, 2, 3], [0, .5, 1, 2, 3], [0, 1, 2, 2.5, 3], [0, 1, 2, 3, 3.5]],
  [[0, .5, 1, 1.5, 2, 3, 3.5], [0, .5, 1.5, 2, 2.5, 3], [0, 1, 1.5, 2, 2.5, 3, 3.5], [0, .5, 1, 2, 2.5, 3.5]]];
const RB_PAT_F = [null, [0, 1, 2], [0, 1, 1.5, 2], [0, .5, 1, 1.5, 2, 2.5]];
const rbMul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rbClamp = (x, a, b) => Math.max(a, Math.min(b, x));
// rare battle-deciding move (11.11.2026) — the SAME formula as btRare in index.html: 1 + 0.5 seeds in 100, side 'a' | 'b'
function btRare(seed) {
  let x = ((seed >>> 0) ^ 0x9E3779B9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0; x = (x ^ (x >>> 16)) >>> 0;
  return x % 100 === 0 ? 'gold' : x % 200 === 1 ? 'red' : null; // 1 % legendary (gold) + 0.5 % mythic (red)
}
function btRareSide(seed) {
  let x = ((seed >>> 0) ^ 0x9E3779B9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0; x = (x ^ (x >>> 16)) >>> 0;
  return (x >>> 8) & 1 ? 'b' : 'a';
}
// <RB2> rules v2 of the rhythm battle (owner 13.11.2026 «продумай систему батлов, сложность элементов, подсчёт очков, сложные
// диджейские биты, рисование траектории»). SOURCE = tools/rb2.js; `python3 tools/rb2_sync.py` copies this block into rhythm.js
// and server/push-worker.js — the phone and the server must count a round exactly the same way. Do not edit the copies.
const RB2 = (() => {
  // the DJ's tracks: bpm, `up` (shifts how dense the notes are), score multiplier, hardness 1–7, note family
  const BEATS = { lofi: [84, -1, .8, 1, 'st'], boom: [100, 0, 1, 2, 'st'], funk: [114, 0, 1.25, 3, 'st'], raw: [128, 1, 1.55, 4, 'st'],
    cut: [104, 0, 1.75, 5, 'sync'], trip: [96, 0, 1.9, 6, 'trip'], dbl: [140, 0, 2.1, 7, 'dbl'] };
  // R = the revision of these tables: the phone and the server play by v2 only when both have the same one (bump it on ANY change
  // of M / ROWS / NEED / beats / patterns — otherwise a phone with old code sends rounds the server counts differently)
  const R = 2;
  // the score multiplier of every move = how hard it is in real breaking. THE OWNER'S NUMBERS (13.11.2026 «исправь: indian 1.3,
  // airflare 2.5, 1990 2, reverse 1990 2, 2000 2, airchair 1.8, flare 2.2, headspin 1.4…» + new footwork). It also sets how dense
  // the taps are (tier: ≤ ×1.1 sparse, ≤ ×1.4 medium, above — dense) and how narrow the trajectory's corridor is
  const M = { toprock: 1, kickstep: 1.1, salsa: 1.1, indian: 1.3,
    hook: 1, sixstep: 1.1, kickout: 1.1, ccs: 1.2, babylove: 1.3, onestep: 1.3, russian: 1.3,
    backspin: 1.1, swipe: 1.3, windmill: 1.4, headspin: 1.4, ninety: 2, rninety: 2, twok: 2, flare: 2.2, airflare: 2.5,
    freeze: 1.1, nike: 1.3, onehand: 1.4, hollowback: 1.7, airchair: 1.8,
    headstand: 1.2, handstand: 1.3 }; // the last two left the game (replaced by nike / onehand); kept for rounds already stored
  const ROWS = [['toprock', 'kickstep', 'salsa', 'indian'], ['hook', 'sixstep', 'kickout', 'ccs', 'babylove', 'onestep', 'russian'],
    ['backspin', 'swipe', 'windmill', 'headspin', 'ninety', 'rninety', 'twok', 'flare', 'airflare'],
    ['freeze', 'nike', 'onehand', 'hollowback', 'airchair']];
  const NEED = { babylove: 2, onestep: 2, russian: 2, windmill: 3, onehand: 3, airchair: 3, headspin: 5, flare: 5, airflare: 5, ninety: 5,
    hollowback: 5, rninety: 6, twok: 6 }; // the hero's level a move needs
  const mult = m => M[m] || 1;
  const tier = m => mult(m) <= 1.1 ? 1 : mult(m) <= 1.4 ? 2 : 3;
  const cl = (x, a, b) => Math.max(a, Math.min(b, x));
  const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const th = a => a.map(x => x / 3); // triplets: thirds of a beat
  // one bar (4 beats) of taps per note family and density level 1–4
  const P = {
    st: [null, [[0, 1, 2, 3]],
      [[0, 1, 1.5, 2, 3], [0, .5, 1, 2, 3], [0, 1, 2, 2.5, 3], [0, 1, 2, 3, 3.5]],
      [[0, .5, 1, 1.5, 2, 3, 3.5], [0, .5, 1.5, 2, 2.5, 3], [0, 1, 1.5, 2, 2.5, 3, 3.5], [0, .5, 1, 2, 2.5, 3.5]],
      [[0, .5, 1, 1.5, 2, 2.5, 3, 3.5], [0, .5, 1, 1.5, 2, 2.75, 3, 3.5], [0, .75, 1, 1.5, 2, 2.5, 3, 3.5], [0, .5, 1, 1.75, 2, 2.5, 3.25, 3.5]]],
    // DJ CUTS: the taps sit between the beats (syncopation)
    sync: [null, [[0, 1.5, 2, 3], [0, 1, 2.5, 3]],
      [[0, .75, 1.5, 2, 3], [0, 1, 1.75, 2.5, 3], [.5, 1, 2, 2.5, 3.5]],
      [[0, .75, 1.5, 2, 2.75, 3.5], [0, .5, 1.25, 2, 2.5, 3.25], [0, .75, 1, 1.75, 2.5, 3, 3.5]],
      [[0, .25, .75, 1.5, 2, 2.25, 2.75, 3.5], [0, .75, 1, 1.5, 1.75, 2.5, 3, 3.25, 3.5], [0, .5, .75, 1.5, 2, 2.5, 2.75, 3.5]]],
    // TRIPLET FLIP: three taps a beat, and now and then a straight bar
    trip: [null, [th([0, 3, 6, 9]), th([0, 3, 6, 8, 9])],
      [th([0, 3, 4, 5, 6, 9]), th([0, 2, 3, 6, 8, 9]), th([0, 3, 6, 7, 8, 9])],
      [th([0, 2, 3, 5, 6, 8, 9]), th([0, 1, 2, 3, 6, 7, 8, 9]), th([0, 3, 4, 5, 6, 9, 10, 11])],
      [th([0, 1, 2, 3, 4, 5, 6, 9, 10, 11]), th([0, 2, 3, 4, 5, 6, 8, 9, 10, 11]), th([0, 1, 2, 3, 6, 7, 8, 9, 10, 11])]],
    // DOUBLE TIME: a fast bar, then a half-time bar
    dblD: [null, [[0, 1, 2, 3]], [[0, .5, 1, 2, 3], [0, 1, 2, 2.5, 3]],
      [[0, .5, 1, 1.5, 2, 3, 3.5], [0, 1, 1.5, 2, 2.5, 3, 3.5]],
      [[0, .5, 1, 1.5, 2, 2.5, 3, 3.5], [0, .5, 1, 1.5, 2, 3, 3.5]]],
    dblH: [null, [[0, 2]], [[0, 2, 3], [0, 1.5, 2]], [[0, 1.5, 2, 3], [0, 2, 2.5, 3]], [[0, 1.5, 2, 3, 3.5], [0, .5, 2, 2.5, 3]]] };
  const PF = [null, [0, 1, 2], [0, 1, 1.5, 2], [0, .5, 1, 1.5, 2, 2.5], [0, .5, 1, 1.5, 2, 2.5]];
  // the round in beats: count-in 4, toprock 8, footwork 8, power 4 of taps + the trajectory, freeze 4 (the big hit on its 4th)
  const B_TOP = 4, B_FOOT = 12, B_POW = 20, B_DRAW = 24, B_DRAW_END = 27.5, B_FRZ = 28, B_BIG = 31;
  const W_DRAW = 5, W_BIG = 3; // a drawn trajectory counts as 5 taps, the freeze hit as 3
  function bar(fam, L, i, rnd) {
    let set;
    if (fam === 'trip') set = rnd() < .3 ? P.st[Math.min(L, 3)] : P.trip[L];
    else if (fam === 'dbl') set = i % 2 ? P.dblH[L] : P.dblD[L];
    else set = P[fam][L];
    return set[Math.floor(rnd() * set.length)];
  }
  // every note: b = its beat, ph = which move it belongs to (0 toprock … 3 freeze), w = weight; draw ⇒ a trajectory until `end`
  function notes(picks, seed, beat) {
    const B = BEATS[beat], fam = B[4], rnd = mul(seed || 1), out = [], L = m => cl(tier(m) + B[1], 1, 4);
    let i = 0;
    const bars = (b0, n, ph) => { for (let k = 0; k < n; k++, i++) bar(fam, L(picks[ph]), i, rnd).forEach(x => out.push({ b: b0 + k * 4 + x, ph, w: 1 })); };
    bars(B_TOP, 2, 0); bars(B_FOOT, 2, 1); bars(B_POW, 1, 2);
    out.push({ b: B_DRAW, end: B_DRAW_END, ph: 2, w: W_DRAW, draw: true });
    PF[L(picks[3])].forEach(x => out.push({ b: B_FRZ + x, ph: 3, w: 1 }));
    out.push({ b: B_BIG, ph: 3, w: W_BIG, big: true });
    return out;
  }
  const base = (n, picks, kind, beat) => (kind === 1 ? 100 : 50) * n.w * mult(picks[n.ph]) * BEATS[beat][2];
  const combo = c => 1 + Math.min(c, 30) * .02;
  // the score from one result per note (1 perfect, 2 good, 3 miss) + where a stray tap broke the combo. A clean round
  // (no miss, no stray tap) = FULL COMBO, +10 %
  function score(picks, seed, beat, hits, brk, level) {
    const br = new Set(brk || []); let s = 0, c = 0, clean = !(brk && brk.length);
    notes(picks, seed, beat).forEach((n, i) => { if (br.has(i)) c = 0; const k = +hits[i]; if (k !== 1 && k !== 2) { c = 0; clean = false; return; } c++; s += base(n, picks, k, beat) * combo(c); });
    return Math.round(s * (clean ? 1.1 : 1) * (1 + .01 * (level || 1)));
  }
  return { R, BEATS, M, ROWS, NEED, tier, mult, notes, score, base, combo, lv: (m, beat) => cl(tier(m) + BEATS[beat][1], 1, 4), B_DRAW, B_DRAW_END };
})();
// </RB2>
function rbNotes(picks, seed, beat) { // only the phase and «big» of each note, in the same order as rhythm.js
  const up = RB_BEATS[beat][1], lv = m => rbClamp(RB_DIFF[m] + up, 1, 3), rnd = rbMul(seed || 1), out = [];
  const bars = (n, d, ph) => { for (let b = 0; b < n; b++) RB_PAT[d][Math.floor(rnd() * RB_PAT[d].length)].forEach(() => out.push({ ph, big: false })); };
  bars(2, lv(picks[0]), 0); bars(2, lv(picks[1]), 1); bars(2, lv(picks[2]), 2);
  RB_PAT_F[lv(picks[3])].forEach(() => out.push({ ph: 3, big: false })); out.push({ ph: 3, big: true });
  return out;
}
function rbScore(picks, seed, beat, hits, brk, level) {
  const notes = rbNotes(picks, seed, beat), br = new Set(brk || []), m = RB_BEATS[beat][2];
  let s = 0, c = 0;
  notes.forEach((n, i) => { if (br.has(i)) c = 0; const k = +hits[i]; if (k === 3) { c = 0; return; } c++; s += (k === 1 ? 100 : 50) * (n.big ? 3 : 1) * RB_MULT[RB_DIFF[picks[n.ph]]] * m * (1 + Math.min(c, 30) * .02); });
  return Math.round(s * (1 + .01 * (level || 1)));
}
// the DJ: the same track for both, fixed per pair and half hour (so /bt/ready and /bt/call agree without storing anything)
// rules v2 (13.11.2026): `pool` = how many of the v2 tracks the DJ may put on — the three hardest (DJ CUTS, TRIPLET FLIP, DOUBLE TIME)
// come in steps: 5 tracks while one of the two is below level 3, all 7 from level 3. pool 0 = an old app: the first four as before.
async function rbDj(a, b, slot, pool) { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('dj:' + a + ':' + b + ':' + slot))); return pool ? Object.keys(RB2.BEATS)[h[0] % pool] : Object.keys(RB_BEATS)[h[0] % 4]; }
const rbPool = (la, lb) => Math.min(la, lb) >= 3 ? 7 : 5;
const rbG = x => { try { return (typeof x === 'string' ? JSON.parse(x) : x).g === 2 ? 2 : 1; } catch (_) { return 1; } };
const rbR = x => { try { return +(typeof x === 'string' ? JSON.parse(x) : x).r || 0; } catch (_) { return 0; } }; // which revision of the v2 tables
// a round the server checks: picks the hero knows, the DJ's track, one result per note; returns the stored form or null
function rbCheck(r, level, beat) {
  if (!r || typeof r !== 'object' || r.b !== beat) return null;
  const g2 = r.g === 2; if (!(g2 ? RB2.BEATS : RB_BEATS)[beat]) return null; // g = which rules the phone played by
  if (g2 && +r.r !== RB2.R) return null; // v2 tables of another revision (the phone's code is older or newer than this server)
  const ROWS = g2 ? RB2.ROWS : RB_ROWS, NEED = g2 ? RB2.NEED : RB_NEED;
  const p = Array.isArray(r.p) ? r.p.map(String) : [];
  // a move above the hero's level counts when the phone says its lesson was watched (round.u, owner 11.11.2026 «открывать движения
  // в игре через уроки») — watching is counted on the phone, like the rating's minutes
  const u = Array.isArray(r.u) ? r.u.slice(0, 8).map(String) : [];
  if (p.length !== 4 || p.some((m, k) => !ROWS[k].includes(m) || ((NEED[m] || 1) > level && !u.includes(m)))) return null;
  const seed = Math.floor(+r.s || 0); if (!(seed >= 1 && seed < 4294967296)) return null;
  const h = String(r.h || ''), n = (g2 ? RB2.notes(p, seed, beat) : rbNotes(p, seed, beat)).length; if (h.length !== n || /[^123]/.test(h)) return null;
  const k = (Array.isArray(r.k) ? r.k : []).slice(0, 300).map(x => Math.floor(+x)).filter(x => x >= 0 && x < n);
  const o = { p, s: seed, b: beat, h, k, au: r.au ? 1 : 0, sc: g2 ? RB2.score(p, seed, beat, h, k, level) : rbScore(p, seed, beat, h, k, level) };
  if (g2) { o.g = 2; o.r = RB2.R; }
  return o;
}
// the other dancer: its own last round's picks (if it still knows them) and hit shares, on the DJ's track; else by level
function rbStand(def, level, beat, g) {
  const g2 = g === 2;
  const rnd = rbMul(crypto.getRandomValues(new Uint32Array(1))[0] | 1), seed = (crypto.getRandomValues(new Uint32Array(1))[0] >>> 1) || 1;
  const pk = (g2 ? RB2.ROWS : RB_ROWS).map((all, k) => { const have = all.filter(m => ((g2 ? RB2.NEED : RB_NEED)[m] || 1) <= level), own = def && def.p && def.p[k]; return all.includes(own) ? own : have[Math.floor(rnd() * have.length)]; }); // own picks were checked when saved (lesson-opened moves too)
  const lv = (g2 ? RB2.BEATS : RB_BEATS)[beat][3];
  let mr, pr;
  if (def && def.n) { mr = rbClamp(def.m / def.n + (rnd() - .5) * .06, 0, .9); pr = rbClamp(def.f / Math.max(1, def.n - def.m), 0, 1); }
  else { mr = rbClamp(.25 - .015 * level + .05 * (lv - 2), .06, .4) * (.5 + rnd()); pr = .75; } // a bit weaker than a person who really taps
  // by level (nobody's own style yet): harder moves have denser notes ⇒ more misses, like for a person (rhythm.js auto does the same)
  const up = g2 ? 0 : RB_BEATS[beat][1], dl = m => g2 ? RB2.lv(m, beat) - 1 : rbClamp(RB_DIFF[m] + up, 1, 3) - 1;
  let h = ''; (g2 ? RB2.notes(pk, seed, beat) : rbNotes(pk, seed, beat)).forEach(nt => { h += rnd() < (def && def.n ? mr : mr + .05 * dl(pk[nt.ph])) ? '3' : rnd() < pr ? '1' : '2'; });
  const o = { p: pk, s: seed, b: beat, h, k: [], au: def ? 0 : 1, sc: g2 ? RB2.score(pk, seed, beat, h, [], level) : rbScore(pk, seed, beat, h, [], level), st: 1 };
  if (g2) { o.g = 2; o.r = RB2.R; }
  return o;
}
const rbPub = r => r && { p: r.p, b: r.b, sc: r.sc, pf: (r.h.match(/1/g) || []).length, gd: (r.h.match(/2/g) || []).length, ms: (r.h.match(/3/g) || []).length, fz: r.h.slice(-1) !== '3' ? 1 : 0, au: r.au, st: r.st || 0, g: r.g === 2 ? 2 : 1, r: +r.r || 0, fc: r.g === 2 && !/3/.test(r.h) && !(r.k && r.k.length) ? 1 : 0,
  dr: r.g === 2 ? +r.h[RB2.notes(r.p, r.s, r.b).findIndex(n => n.draw)] || 3 : undefined }; // dr = how the trajectory was drawn (1 / 2 / 3)
async function heroEq(db, ids) {
  const out = {}; if (!ids.length) return out;
  const rs = await db.prepare('SELECT id, eq FROM hero_eq WHERE id IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).all();
  (rs.results || []).forEach(r => { try { out[r.id] = JSON.parse(r.eq) || []; } catch (_) {} });
  return out;
}
async function btScore(db, a, b, win) {
  const up = 'INSERT INTO bt_score (id, w, l) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET w = w + excluded.w, l = l + excluded.l';
  await db.batch([db.prepare(up).bind(a, win === 'a' ? 1 : 0, win === 'a' ? 0 : 1), db.prepare(up).bind(b, win === 'b' ? 1 : 0, win === 'b' ? 0 : 1)]);
}
// a phone's last round by hand = how its dancer dances when it doesn't answer in time
const btDefSave = (db, id, r, now) => db.prepare('INSERT INTO bt_def (id, d, t) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET d = excluded.d, t = excluded.t')
  .bind(id, JSON.stringify({ p: r.p, n: r.h.length, m: (r.h.match(/3/g) || []).length, f: (r.h.match(/1/g) || []).length }), now);
const btGet = (db, n) => db.prepare('SELECT bt.*, bt_h.ra AS hra, bt_h.rb AS hrb, bt_h.dj, bt_h.exp, bt_h.st AS hst, bt_h.late FROM bt LEFT JOIN bt_h ON bt_h.n = bt.n WHERE bt.n = ?').bind(n).first();
// the judges vote by the scores: 10 % ahead ⇒ each judge ~92 % for you; close scores ⇒ they may disagree
async function btResolve(env, n, rb, late) {
  const db = env.DB, row = await btGet(db, n);
  if (!row || row.hst !== 'wait') return false;
  const ra = JSON.parse(row.hra), p = 1 / (1 + Math.exp(-(ra.sc - rb.sc) / (.04 * Math.max(ra.sc, rb.sc, 1))));
  const votes = [0, 1, 2].map(() => Math.random() < p ? 'a' : 'b'), win = votes.filter(v => v === 'a').length >= 2 ? 'a' : 'b';
  const ch = await db.prepare("UPDATE bt_h SET st = 'done', rb = ?, late = ?, done = ? WHERE n = ? AND st = 'wait'").bind(JSON.stringify(rb), late ? 1 : 0, Date.now(), n).run();
  if (ch.meta && ch.meta.changes === 0) return false; // the other path got there first
  await db.prepare('UPDATE bt SET votes = ?, win = ?, seen = ? WHERE n = ?').bind(JSON.stringify(votes), win, late ? 0 : 1, n).run();
  await btScore(db, row.a, row.b, win);
  try { // tell the challenger the result is there
    const sub = await db.prepare('SELECT sub, lang FROM bt_sub WHERE id = ?').bind(row.a).first();
    if (sub && sub.sub) {
      const L = BT_TITLE_R[sub.lang] ? sub.lang : 'en';
      const res = await sendPush(JSON.parse(sub.sub), JSON.stringify({ title: BT_TITLE_R[L], body: BT_BODY_R[L].replace('{n}', row.nb), tag: 'battle-r' + n, battle: 1 }), await vapid(env)).catch(() => null);
      if (res && (res.status === 404 || res.status === 410)) await db.prepare('DELETE FROM bt_sub WHERE id = ?').bind(row.a).run();
    }
  } catch (_) {}
  return true;
}
// no answer within a day ⇒ the other phone's dancer dances for it (its own last round's style, or by level)
async function btExpire(env, only) {
  const db = env.DB, now = Date.now();
  const rows = (await db.prepare("SELECT bt_h.n, bt_h.b, bt_h.dj, bt_h.ra FROM bt_h WHERE st = 'wait' AND exp <= ?" + (only ? ' AND n = ?' : '') + ' LIMIT 20').bind(...(only ? [now, only] : [now])).all()).results || [];
  for (const r of rows) {
    const op = await lbRow(db, r.b), dr = await db.prepare('SELECT d FROM bt_def WHERE id = ? AND t > ?').bind(r.b, now - 30 * 864e5).first();
    let def = null; try { def = dr && JSON.parse(dr.d); } catch (_) {}
    await btResolve(env, r.n, rbStand(def, heroLevel(op ? op.m : 0), r.dj, rbG(r.ra)), true);
  }
}
async function battle(req, env, path, json) {
  if (!env.DB) return json({ error: 'nodb' }, 409);
  await schema(env.DB);
  const b = JSON.parse((await req.text()) || '{}');
  const id = String(b.id || ''), secret = String(b.secret || '');
  if (!/^\d{6,9}$/.test(id) || !/^[0-9a-f]{32}$/.test(secret)) return json({ error: 'bad id' }, 400);
  await lbMigrate(env);
  const db = env.DB, now = Date.now(), me = await lbRow(db, id);
  if (!me || me.hid || me.h !== await hash('lb:' + secret)) return json({ error: 'not in rating' }, 403);
  if (path === '/bt/inbox' || path === '/bt/ready') await btExpire(env, null).catch(() => {});
  const score = async x => (await db.prepare('SELECT w, l FROM bt_score WHERE id = ?').bind(x).first()) || { w: 0, l: 0 };
  const lastCall = async () => { const r = await db.prepare('SELECT MAX(t) AS t FROM bt WHERE a = ?').bind(id).first(); return r && r.t || 0; };
  const restLeft = async () => Math.max(0, (await lastCall()) + BT_REST - now);
  const wallet = async () => {
    const sc = await score(id), own = await db.prepare('SELECT item FROM hero_own WHERE id = ?').bind(id).all();
    const owned = (own.results || []).map(r => r.item).filter(k => SHOP[k]);
    // the team tee: this phone has notifications on (its subscription is linked) ⇒ it's theirs
    if (!owned.includes('tee') && await db.prepare('SELECT 1 AS x FROM bt_sub WHERE id = ?').bind(id).first()) { await db.prepare('INSERT OR IGNORE INTO hero_own (id, item, t) VALUES (?, ?, ?)').bind(id, 'tee', now).run(); owned.push('tee'); }
    const bon = await db.prepare('SELECT SUM(pts) AS p FROM pts_bonus WHERE id = ?').bind(id).first();
    const earned = sc.w * PTS_WIN + Math.floor((me.m || 0) / 60) * PTS_HOUR + (bon && bon.p || 0);
    const spent = owned.reduce((n, k) => n + SHOP[k][1], 0);
    const eqr = await db.prepare('SELECT eq FROM hero_eq WHERE id = ?').bind(id).first();
    let eq = []; try { eq = JSON.parse(eqr && eqr.eq || '[]'); } catch (_) {}
    return { pts: Math.max(0, earned - spent), earned, owned, eq, score: sc };
  };
  // «Найти соперника» (10.11.2026): a random active phone of about the same level the caller hasn't met today
  if (path === '/bt/find' || (path === '/bt/ready' && b.find)) {
    const myL = heroLevel(me.m), met = new Set(((await db.prepare('SELECT b FROM bt WHERE a = ? AND t > ?').bind(id, now - 864e5).all()).results || []).map(r => r.b));
    const ok = r => r && r.id !== id && !r.hid && !met.has(r.id) && r.t > now - 30 * 864e5;
    const levels = [myL, myL - 1, myL + 1, myL - 2, myL + 2, 1, 2, 3, 4, 5, 6, 7, 8].filter((x, i, a) => x >= 1 && x <= 8 && a.indexOf(x) === i);
    let found = null;
    for (const L of levels) {
      const r0 = Math.floor(Math.random() * 1e9);
      const a = ((await db.prepare('SELECT id, hid, t FROM lb WHERE lvl = ? AND rk >= ? ORDER BY rk LIMIT 12').bind(L, r0).all()).results || []).concat(
        ((await db.prepare('SELECT id, hid, t FROM lb WHERE lvl = ? AND rk < ? ORDER BY rk LIMIT 12').bind(L, r0).all()).results || []));
      const good = a.filter(ok);
      if (good.length) { found = good[Math.floor(Math.random() * good.length)]; break; }
    }
    if (!found) return json({ error: 'nobody' }, 404);
    b.to = found.id; if (path === '/bt/find') path = '/bt/call';
  }
  // before the round (11.11.2026): may this phone battle that one now? who is it, and which track does the DJ put on
  if (path === '/bt/ready') {
    const to = String(b.to || ''), op = await lbRow(db, to);
    if (!op || op.hid || to === id) return json({ error: 'gone' }, 404);
    const rest = await restLeft();
    if (rest > 0) return json({ error: 'rest', rest }, 429);
    const c = await db.prepare('SELECT COUNT(*) AS same FROM bt WHERE a = ? AND b = ? AND t > ?').bind(id, to, now - 864e5).first();
    if ((c && c.same || 0) >= 3) return json({ error: 'limit' }, 429);
    const eq = await heroEq(db, [to]);
    return json({ ok: true, opp: { id: to, name: op.n || ('Breaker ' + to.slice(-4)), lvl: heroLevel(op.m), eq: eq[to] || [], co: op.co || '' }, dj: await rbDj(id, to, Math.floor(now / DJ_SLOT), +b.r === RB2.R ? rbPool(heroLevel(me.m), heroLevel(op.m)) : 0), lvl: heroLevel(me.m), ul: 1, g: +b.r === RB2.R ? 2 : 1, r: RB2.R }); // v2 only for a phone with the same tables (b.r)
  }
  if (path === '/bt/call') {
    const to = String(b.to || ''), op = await lbRow(db, to);
    if (!op || op.hid || to === id) return json({ error: 'gone' }, 404);
    const day = now - 864e5;
    const rest = await restLeft();
    if (rest > 0) return json({ error: 'rest', rest }, 429);
    const c = await db.prepare('SELECT COUNT(*) AS same FROM bt WHERE a = ? AND b = ? AND t > ?').bind(id, to, day).first();
    if ((c && c.same || 0) >= 3) return json({ error: 'limit' }, 429);
    const la = heroLevel(me.m), lb = heroLevel(op.m);
    const p = Math.max(.3, Math.min(.7, .5 + .05 * (la - lb)));
    let ra = null;
    if (b.round) { // a round by hand: the DJ's track of this half hour (or the one before — the round takes ~20 s); the battle waits
      const slot = Math.floor(now / DJ_SLOT), djs = [];
      for (const pool of (b.round.g === 2 ? [rbPool(la, lb), 7, 5] : [0])) djs.push(await rbDj(id, to, slot, pool), await rbDj(id, to, slot - 1, pool));
      ra = rbCheck(b.round, la, djs.includes(b.round.b) ? b.round.b : djs[0]);
      if (!ra) return json({ error: 'round' }, 400);
    }
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] >>> 1;
    // 1 % of auto battles: the seed gives one dancer a rare legendary move (the app shows it) ⇒ all three judges for him
    const tier = ra ? null : btRare(seed), rare = tier && btRareSide(seed);
    const votes = ra ? [] : rare ? [rare, rare, rare] : [0, 1, 2].map(() => Math.random() < p ? 'a' : 'b');
    const win = ra ? '' : votes.filter(v => v === 'a').length >= 2 ? 'a' : 'b';
    const na = me.n || ('Breaker ' + id.slice(-4)), nb = op.n || ('Breaker ' + to.slice(-4));
    const ins = await db.prepare('INSERT INTO bt (a, b, la, lb, na, nb, seed, votes, win, t) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, to, la, lb, na, nb, seed, JSON.stringify(votes), win, now).run();
    const n = ins.meta && ins.meta.last_row_id;
    if (ra) await db.batch([db.prepare('INSERT INTO bt_h (n, a, b, dj, ra, st, exp) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(n, id, to, ra.b, JSON.stringify(ra), 'wait', now + BT_WAIT), btDefSave(db, id, ra, now)]);
    if (!ra) await btScore(db, id, to, win);
    if (rare) await db.prepare('INSERT OR IGNORE INTO pts_bonus (id, ref, pts, t) VALUES (?, ?, ?, ?)').bind(rare === 'a' ? id : to, 'rare:' + n, tier === 'red' ? PTS_RED : PTS_GOLD, now).run(); // ⭐ for the move itself
    // tell the challenged phone — at most once per 6 hours
    try {
      const recent = await db.prepare('SELECT COUNT(*) AS n FROM bt WHERE b = ? AND t > ?').bind(to, now - 6 * 3600e3).first();
      const sub = (ra || (recent && recent.n || 0) <= 1) && await db.prepare('SELECT sub, lang FROM bt_sub WHERE id = ?').bind(to).first();
      if (sub && sub.sub) {
        const L = BT_TITLE[sub.lang] ? sub.lang : 'en';
        const res = await sendPush(JSON.parse(sub.sub), JSON.stringify({ title: BT_TITLE[L], body: (ra ? BT_BODY_H : BT_BODY)[L].replace('{n}', na), tag: 'battle', battle: 1 }), await vapid(env)).catch(() => null);
        if (res && (res.status === 404 || res.status === 410)) await db.prepare('DELETE FROM bt_sub WHERE id = ?').bind(to).run();
      }
    } catch (_) {}
    return json({ ok: true, pending: ra ? 1 : 0, battle: btPack({ n, a: id, b: to, la, lb, na, nb, seed, votes: JSON.stringify(votes), win, t: now, hst: ra ? 'wait' : '', hra: ra, dj: ra && ra.b, exp: now + BT_WAIT }, await heroEq(db, [id, to])), score: await score(id), rest: BT_REST, pts: (await wallet()).pts });
  }
  if (path === '/bt/inbox') {
    const J = 'SELECT bt.*, bt_h.ra AS hra, bt_h.rb AS hrb, bt_h.dj, bt_h.exp, bt_h.st AS hst, bt_h.late FROM bt LEFT JOIN bt_h ON bt_h.n = bt.n ';
    const news = (await db.prepare(J + "WHERE bt.b = ? AND bt.seen = 0 AND bt.win != '' ORDER BY bt.n DESC LIMIT 5").bind(id).all()).results || [];
    // battles by hand: challenges waiting for this phone's answer, results of its own challenges, its challenges still waiting
    const calls = b.v >= 2 ? (await db.prepare(J + "WHERE bt.b = ? AND bt_h.st = 'wait' AND bt_h.exp > ? ORDER BY bt.n LIMIT 10").bind(id, now).all()).results || [] : [];
    const results = b.v >= 2 ? (await db.prepare(J + "WHERE bt.a = ? AND bt_h.st = 'done' AND bt_h.sa = 0 ORDER BY bt.n LIMIT 5").bind(id).all()).results || [] : [];
    const out = b.v >= 2 ? (await db.prepare(J + "WHERE bt.a = ? AND bt_h.st = 'wait' AND bt_h.exp > ? ORDER BY bt.n DESC LIMIT 10").bind(id, now).all()).results || [] : [];
    const all = news.concat(calls, results, out), eq = await heroEq(db, [...new Set(all.map(r => r.a).concat(all.map(r => r.b), id))]);
    const w = await wallet();
    return json({ ok: true, news: news.map(r => btPack(r, eq)), calls: calls.map(r => btPack(r, eq)), results: results.map(r => btPack(r, eq)), out: out.map(r => btPack(r, eq)),
      lvl: heroLevel(me.m), now, score: w.score, rest: await restLeft(), pts: w.pts, earned: w.earned, owned: w.owned, eq: w.eq, ul: 1 });
  }
  if (path === '/bt/seen') {
    if (b.side === 'a') await db.prepare('UPDATE bt_h SET sa = 1 WHERE n = ? AND a = ?').bind(Math.floor(+b.n || 0), id).run(); // a result of my own challenge
    else await db.prepare("UPDATE bt SET seen = 1 WHERE b = ? AND n <= ? AND win != ''").bind(id, Math.floor(+b.n || 0)).run();
    return json({ ok: true });
  }
  // the answer to a challenge by hand: a round by hand, or auto (the dancer by level); then the judges decide at once
  if (path === '/bt/answer') {
    const n = Math.floor(+b.n || 0), row = await db.prepare("SELECT bt.*, bt_h.ra AS hra, bt_h.dj, bt_h.exp, bt_h.st AS hst FROM bt JOIN bt_h ON bt_h.n = bt.n WHERE bt.n = ? AND bt.b = ?").bind(n, id).first();
    if (!row) return json({ error: 'gone' }, 404);
    if (row.hst === 'wait' && row.exp <= now) await btExpire(env, n);
    if (row.hst !== 'wait' || row.exp <= now) { const r2 = await btGet(db, n); return json({ ok: true, late: 1, battle: btPack(r2, await heroEq(db, [r2.a, r2.b])) }); }
    const lvl = heroLevel(me.m);
    // both dance by the challenger's rules (g). An app that doesn't know rules v2 yet answers a v2 challenge ⇒ its dancer dances for it
    const g = rbG(row.hra), same = !!b.round && (b.round.g === 2 ? 2 : 1) === g && (g === 1 || (+b.round.r === RB2.R && rbR(row.hra) === RB2.R)), hand = !b.auto && same;
    const rb = hand ? rbCheck(b.round, lvl, row.dj) : b.auto || g === 2 ? rbStand(null, lvl, row.dj, g) : null;
    if (!rb) return json({ error: 'round' }, 400);
    if (hand) rb.au = 0;
    if (!(await btResolve(env, n, rb, false))) { const r2 = await btGet(db, n); return json({ ok: true, late: 1, battle: btPack(r2, await heroEq(db, [r2.a, r2.b])) }); }
    if (hand) await btDefSave(db, id, rb, now).run();
    const r2 = await btGet(db, n), w = await wallet();
    return json({ ok: true, battle: btPack(r2, await heroEq(db, [r2.a, r2.b])), score: w.score, pts: w.pts });
  }
  // +10 for watching a lesson in the first hour after it was published (once per lesson; a few minutes' grace to finish it)
  if (path === '/hero/fresh') {
    const lid = String(b.lesson || ''), fr = await db.prepare('SELECT t FROM lfresh WHERE id = ?').bind(lid).first();
    if (!fr || now > fr.t + FRESH_MS + 10 * 60e3) { const w = await wallet(); return json({ ok: true, got: 0, late: 1, pts: w.pts, earned: w.earned, owned: w.owned, eq: w.eq }); }
    const ins = await db.prepare('INSERT OR IGNORE INTO pts_bonus (id, ref, pts, t) VALUES (?, ?, ?, ?)').bind(id, 'fresh:' + lid, PTS_FRESH, now).run();
    const w = await wallet();
    return json({ ok: true, got: ins.meta && ins.meta.changes ? PTS_FRESH : 0, pts: w.pts, earned: w.earned, owned: w.owned, eq: w.eq });
  }
  if (path === '/hero/buy') {
    const item = String(b.item || '');
    if (!SHOP[item]) return json({ error: 'item' }, 400);
    const w = await wallet();
    if (w.owned.includes(item)) return json({ ok: true, ...w });
    if (item === 'tee') return json({ error: 'sub', pts: w.pts }, 402); // only for notifications (wallet() gives it once they're on)
    if (w.pts < SHOP[item][1]) return json({ error: 'points', pts: w.pts }, 402);
    await db.prepare('INSERT OR IGNORE INTO hero_own (id, item, t) VALUES (?, ?, ?)').bind(id, item, now).run();
    return json({ ok: true, ...(await wallet()) });
  }
  if (path === '/hero/eq') {
    const w = await wallet(), slots = {};
    (Array.isArray(b.eq) ? b.eq : []).map(String).forEach(k => { if (w.owned.includes(k)) slots[SHOP[k][0]] = k; }); // one per slot
    const eq = Object.values(slots);
    if ((Array.isArray(b.eq) ? b.eq : []).includes('girl')) eq.push('girl'); // b-girl look (11.11.2026) — not an item, rides along with the items
    const lv = (Array.isArray(b.eq) ? b.eq : []).map(String).find(k => /^lv[1-7]$/.test(k)); // an older level look chosen in the wardrobe (11.11.2026) — drawing never goes above the real level
    if (lv) eq.push(lv);
    await db.prepare('INSERT INTO hero_eq (id, eq) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET eq = excluded.eq').bind(id, JSON.stringify(eq)).run();
    return json({ ok: true, eq });
  }
  if (path === '/bt/sub') {
    const s = b.sub || {};
    if (!s.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth) return json({ error: 'sub' }, 400);
    await db.prepare('INSERT INTO bt_sub (id, sub, lang) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET sub = excluded.sub, lang = excluded.lang')
      .bind(id, JSON.stringify({ endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth }), BT_TITLE[b.lang] ? b.lang : 'en').run();
    const w = await wallet(); // gives the team tee
    return json({ ok: true, pts: w.pts, earned: w.earned, owned: w.owned, eq: w.eq });
  }
  return json({ error: 'not found' }, 404);
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
    // hero battles (10.11.2026): every battle, the score of each phone and where to send a «you were challenged» push
    db.prepare('CREATE TABLE IF NOT EXISTS bt (n INTEGER PRIMARY KEY AUTOINCREMENT, a TEXT NOT NULL, b TEXT NOT NULL, la INTEGER, lb INTEGER, na TEXT, nb TEXT, seed INTEGER, votes TEXT, win TEXT, t INTEGER, seen INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE INDEX IF NOT EXISTS bt_b ON bt (b, seen)'),
    db.prepare('CREATE INDEX IF NOT EXISTS bt_a ON bt (a, t)'),
    // the rating (10.11.2026, moved from one KV key so it can hold hundreds of thousands of phones)
    db.prepare('CREATE TABLE IF NOT EXISTS lb (id TEXT PRIMARY KEY, n TEXT, nl TEXT, c TEXT, cn TEXT, co TEXT, a TEXT, m INTEGER NOT NULL DEFAULT 0, v INTEGER, s INTEGER, h TEXT, f INTEGER, t INTEGER, lvl INTEGER, rk INTEGER, hid INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID'),
    db.prepare('CREATE INDEX IF NOT EXISTS lb_m ON lb (hid, m DESC, f)'),
    db.prepare('CREATE INDEX IF NOT EXISTS lb_cm ON lb (cn, hid, m DESC, f)'),
    db.prepare('CREATE INDEX IF NOT EXISTS lb_rk ON lb (lvl, rk)'),
    db.prepare('CREATE INDEX IF NOT EXISTS lb_nl ON lb (nl)'),
    db.prepare('CREATE TABLE IF NOT EXISTS bt_score (id TEXT PRIMARY KEY, w INTEGER NOT NULL DEFAULT 0, l INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS bt_sub (id TEXT PRIMARY KEY, sub TEXT, lang TEXT) WITHOUT ROWID'),
    // rhythm rounds (11.11.2026): both rounds of a battle, and each phone's last round = how its dancer defends
    db.prepare('CREATE TABLE IF NOT EXISTS bt_h (n INTEGER PRIMARY KEY, a TEXT, b TEXT, dj TEXT, ra TEXT, rb TEXT, st TEXT, exp INTEGER, late INTEGER NOT NULL DEFAULT 0, done INTEGER, sa INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE INDEX IF NOT EXISTS bt_h_st ON bt_h (st, exp)'),
    // points for fresh lessons (11.11.2026): when each lesson was published, and bonus points per phone (one per lesson)
    db.prepare('CREATE TABLE IF NOT EXISTS lfresh (id TEXT PRIMARY KEY, t INTEGER) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS pts_bonus (id TEXT NOT NULL, ref TEXT NOT NULL, pts INTEGER, t INTEGER, PRIMARY KEY (id, ref)) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS bt_def (id TEXT PRIMARY KEY, d TEXT, t INTEGER) WITHOUT ROWID'),
    // hero accessories (10.11.2026): what each phone bought (with points, never money) and what it wears
    db.prepare('CREATE TABLE IF NOT EXISTS hero_own (id TEXT NOT NULL, item TEXT NOT NULL, t INTEGER, PRIMARY KEY (id, item)) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS hero_eq (id TEXT PRIMARY KEY, eq TEXT) WITHOUT ROWID'),
    // paid courses (12.11.2026): buyer phones (random id + key hash), orders, owned courses, access codes
    db.prepare('CREATE TABLE IF NOT EXISTS crs_dev (id TEXT PRIMARY KEY, kh TEXT, t INTEGER) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS crs_ord (code TEXT PRIMARY KEY, id TEXT, pid TEXT, course TEXT, usd REAL, st TEXT, t INTEGER, tp INTEGER, td INTEGER, co TEXT, lang TEXT, name TEXT) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS crs_own (id TEXT NOT NULL, course TEXT NOT NULL, t INTEGER, via TEXT, PRIMARY KEY (id, course)) WITHOUT ROWID'),
    db.prepare('CREATE TABLE IF NOT EXISTS crs_code (code TEXT PRIMARY KEY, course TEXT, note TEXT, t INTEGER, used INTEGER NOT NULL DEFAULT 0, uid TEXT) WITHOUT ROWID'),
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
  if (!/^[\w-]{4,40}$/.test(raw) || !/^(tg|cr|crp|sv|so|cta|ctas|cb|cp)$/.test(b.e || '')) return json({ error: 'bad event' }, 400);
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
  if (b.e === 'cb' || b.e === 'cp') { // courses (12.11.2026): cb = opened «Купить», cp = went to PayPal; once a day per person
    await db.batch(await seen([b.e]));
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
  const [today, all, devs, days, geoToday, geoAll, plat, srcAll, srcToday, contacted, svDays, svAll, pT, p7, pA, svSince, coT, co7, coA] = await db.batch([
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
    // the same people by country (owner 10.11.2026): country = where the phone was first seen (devices)
    db.prepare("SELECT COALESCE(d.country, 'XX') AS co, v.e AS e, COUNT(DISTINCT v.id) AS n FROM evu v LEFT JOIN devices d ON d.id = v.id WHERE v.e IN ('sv','so','tg') AND v.day = ? GROUP BY co, v.e").bind(day),
    db.prepare("SELECT COALESCE(d.country, 'XX') AS co, v.e AS e, COUNT(DISTINCT v.id) AS n FROM evu v LEFT JOIN devices d ON d.id = v.id WHERE v.e IN ('sv','so','tg') AND v.day >= ? GROUP BY co, v.e").bind(dayAgo(6)),
    db.prepare("SELECT COALESCE(d.country, 'XX') AS co, v.e AS e, COUNT(DISTINCT v.id) AS n FROM evu v LEFT JOIN devices d ON d.id = v.id WHERE v.e IN ('sv','so','tg') GROUP BY co, v.e"),
  ]);
  const t = today.results[0] || { visits: 0, uniq: 0, fresh: 0, app: 0 }, a = all.results[0] || {};
  return json({ bt: 1, rb: 1, pf: 1, tee: 1, lk: 1, wd: 1, ul: 1, sd: 1, crs: 1, rb2: RB2.R, // this server knows battles, points, the shop and rhythm rounds (admin uses it to ask for a code update)

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
      since: (svSince.results[0] || {}).since || null,
      countries: { today: coT.results.map(r => [r.co, r.e, r.n]), d7: co7.results.map(r => [r.co, r.e, r.n]), all: coA.results.map(r => [r.co, r.e, r.n]) } },
  });
}

// ===== paid video courses (owner 12.11.2026 «раздел КУРСЫ… ссылку на оплату (paypal)… продумай с оплатой и получением курса») =====
// No payment API yet, so the coach confirms each payment himself:
//   app «Купить» → POST /course/order → order code «FT-XXXXX» (the buyer writes it in the PayPal note) + a Telegram note to the coach
//   → the buyer pays by the course's PayPal link → «Я оплатил» → POST /course/paid (another Telegram note)
//   → admin «Курсы» → «Оплата пришла — открыть» → POST /course/grant → crs_own row + a push to the buyer's phone
//   → the app (POST /course/my) gets passes for its courses and plays them.
// Access codes (POST /course/code) open a course without an order: paid another way, a gift, a new phone.
// The buyer = a random id + key made by the app (only the key's hash is kept); `pid` = the app's profile id (for the push).
// Course video files are named crs-<course>-… in R2 and are given only with that course's pass (/v/ above). KV 'crs' (from
// the admin at every publish, POST /course/sync) = course names and prices + `open` (crs- files that are free preview
// lessons or moved out of the course) + `lock` (older files that now belong to a course).
const CRS_ID = /^[a-z0-9]{2,24}$/, CRS_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const crsOrdCode = () => 'FT-' + Array.from(crypto.getRandomValues(new Uint8Array(5)), x => CRS_ABC[x % CRS_ABC.length]).join('');
const CRS_ORD = /^FT-[A-Z0-9]{5}$/;
let crsMetaC = null, crsMetaT = 0;
async function crsMeta(env) {
  if (crsMetaC && Date.now() - crsMetaT < 60e3) return crsMetaC;
  let m = null; try { m = JSON.parse((await env.PUSH.get('crs')) || 'null'); } catch (_) {}
  crsMetaC = m && typeof m === 'object' ? m : { c: {}, open: [], lock: {} }; crsMetaT = Date.now();
  return crsMetaC;
}
async function crsNeed(env, key) {
  const meta = await crsMeta(env);
  const l = meta.lock && meta.lock[key]; // a file that belongs to a course now (also one moved from another course)
  if (l && CRS_ID.test(l)) return l;
  const m = /^crs-([a-z0-9]{2,24})-/.exec(key || '');
  return m && !(meta.open || []).includes(key) ? m[1] : ''; // uploaded for a course: closed unless it is a free / moved-out one
}
async function crsAuth(db, b) {
  const id = String(b.id || ''), k = String(b.k || '');
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(id) || !/^[A-Za-z0-9_-]{24,64}$/.test(k)) return null;
  const kh = await hash('crs:' + k);
  const r = await db.prepare('SELECT kh FROM crs_dev WHERE id = ?').bind(id).first();
  if (!r) { await db.prepare('INSERT OR IGNORE INTO crs_dev (id, kh, t) VALUES (?, ?, ?)').bind(id, kh, Date.now()).run(); const r2 = await db.prepare('SELECT kh FROM crs_dev WHERE id = ?').bind(id).first(); return r2 && r2.kh === kh ? id : null; }
  return r.kh === kh ? id : null;
}
const CRS_LANGS = ['ru', 'en', 'es', 'pt', 'fr', 'de', 'ja', 'ko', 'zh'];
const CRS_PUSH_T = { ru: 'Курс открыт! 🎉', en: 'Your course is open! 🎉', es: '¡Tu curso está abierto! 🎉', pt: 'Seu curso está liberado! 🎉', fr: 'Ton cours est ouvert ! 🎉', de: 'Dein Kurs ist freigeschaltet! 🎉', ja: 'コースが開きました！🎉', ko: '코스가 열렸어요! 🎉', zh: '课程已开通！🎉' };
const CRS_PUSH_B = { ru: '«{n}» — можно смотреть', en: '“{n}” — start watching', es: '«{n}»: ya puedes verlo', pt: '“{n}” — já pode assistir', fr: '« {n} » — tu peux regarder', de: '„{n}“ — jetzt ansehen', ja: '「{n}」— 視聴できます', ko: '‘{n}’ — 지금 볼 수 있어요', zh: '「{n}」——现在可以观看' };
async function crsTell(env, text) { // a note to the coach's Telegram (the chat bot), when it is connected
  try { const owner = await env.PUSH.get('tg:owner'); if (env.TG_TOKEN && owner) await tg(env, 'sendMessage', { chat_id: owner, text }); } catch (_) {}
}
const crsFlag = cc => /^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map(c => 0x1F1A5 + c.charCodeAt(0))) : '';
async function crsPasses(env, db, id) {
  const rs = await db.prepare('SELECT course FROM crs_own WHERE id = ?').bind(id).all();
  const own = (rs.results || []).map(r => r.course), pass = {};
  for (const c of own) pass[c] = await cpassMake(env, c);
  return { own, pass };
}
async function crsPublic(req, env, path, json) {
  if (!env.DB) return json({ ok: false, why: 'nodb' }, 409);
  const db = env.DB; await schema(db);
  const b = JSON.parse((await req.text()) || '{}');
  const id = await crsAuth(db, b);
  if (!id) return json({ ok: false, why: 'auth' }, 403);
  const meta = await crsMeta(env), now = Date.now();
  if (path === '/course/my') {
    const { own, pass } = await crsPasses(env, db, id);
    const ord = await db.prepare('SELECT code, course, st, t FROM crs_ord WHERE id = ? AND t > ? ORDER BY t DESC LIMIT 20').bind(id, now - 60 * 864e5).all();
    return json({ ok: true, own, pass, orders: (ord.results || []).map(r => ({ code: r.code, course: r.course, st: r.st, t: r.t })) });
  }
  if (path === '/course/order') {
    const cid = String(b.course || ''), c = meta.c && meta.c[cid];
    if (!CRS_ID.test(cid) || !c) return json({ ok: false, why: 'course' }, 404);
    if (await db.prepare('SELECT 1 AS x FROM crs_own WHERE id = ? AND course = ?').bind(id, cid).first()) return json({ ok: true, own: true });
    const old = await db.prepare("SELECT code, st FROM crs_ord WHERE id = ? AND course = ? AND st IN ('new', 'paid') ORDER BY t DESC LIMIT 1").bind(id, cid).first();
    if (old) return json({ ok: true, code: old.code, st: old.st });
    const open = await db.prepare("SELECT COUNT(*) AS n FROM crs_ord WHERE id = ? AND st IN ('new', 'paid')").bind(id).first();
    if (open && open.n >= 5) return json({ ok: false, why: 'many' }, 429);
    const co = /^[A-Z]{2}$/.test((req.cf && req.cf.country) || '') ? req.cf.country : 'XX';
    const lang = CRS_LANGS.includes(b.lang) ? b.lang : 'en', name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const pid = /^[\w-]{4,40}$/.test(String(b.pid || '')) ? String(b.pid) : '';
    for (let i = 0; i < 5; i++) {
      const code = crsOrdCode();
      const r = await db.prepare("INSERT OR IGNORE INTO crs_ord (code, id, pid, course, usd, st, t, co, lang, name) VALUES (?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)").bind(code, id, pid, cid, +c.usd || 0, now, co, lang, name).run();
      if (r.meta && r.meta.changes) {
        await crsTell(env, '🛒 Новый заказ курса «' + (c.n || cid) + '» — $' + (+c.usd || 0) + '\nКод заказа: ' + code + '\n' + crsFlag(co) + ' ' + co + ' · язык ' + lang + (name ? ' · ' + name : '') +
          '\n\nКлиент перешёл к оплате. Когда деньги придут в PayPal (в комментарии будет этот код) — откройте доступ: админка → Курсы → Заказы.');
        return json({ ok: true, code, st: 'new' });
      }
    }
    return json({ ok: false, why: 'retry' }, 500);
  }
  if (path === '/course/paid') {
    const code = String(b.code || '').toUpperCase();
    if (!CRS_ORD.test(code)) return json({ ok: false, why: 'bad' }, 400);
    const r = await db.prepare("UPDATE crs_ord SET st = 'paid', tp = ? WHERE code = ? AND id = ? AND st = 'new'").bind(now, code, id).run();
    if (r.meta && r.meta.changes) {
      const o = await db.prepare('SELECT course, usd, co, name FROM crs_ord WHERE code = ?').bind(code).first();
      const c = (meta.c && meta.c[o.course]) || {};
      await crsTell(env, '💰 Клиент нажал «Я оплатил»: курс «' + (c.n || o.course) + '» — $' + o.usd + '\nКод заказа: ' + code + ' · ' + crsFlag(o.co) + (o.name ? ' ' + o.name : '') +
        '\n\nПроверьте PayPal. Деньги пришли → админка → Курсы → Заказы → «Оплата пришла — открыть курс».');
    }
    const o = await db.prepare('SELECT st FROM crs_ord WHERE code = ? AND id = ?').bind(code, id).first();
    return json({ ok: !!o, st: o ? o.st : '' });
  }
  if (path === '/course/redeem') {
    const code = String(b.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!rvOkCode(code)) return json({ ok: false, why: 'bad' }, 400);
    const r = await db.prepare('UPDATE crs_code SET used = ?, uid = ? WHERE code = ? AND used = 0').bind(now, id, code).run();
    if (!r.meta || !r.meta.changes) {
      const x = await db.prepare('SELECT used, uid, course FROM crs_code WHERE code = ?').bind(code).first();
      if (x && x.uid === id) return json({ ok: true, course: x.course, again: true }); // the same phone again: fine
      return json({ ok: false, why: x ? 'used' : 'bad' });
    }
    const x = await db.prepare('SELECT course FROM crs_code WHERE code = ?').bind(code).first();
    await db.prepare('INSERT OR IGNORE INTO crs_own (id, course, t, via) VALUES (?, ?, ?, ?)').bind(id, x.course, now, 'code:' + code).run();
    return json({ ok: true, course: x.course });
  }
  return json({ ok: false }, 404);
}
async function crsAdmin(req, env, path, json) {
  const meta = await crsMeta(env);
  if (path === '/course/apass') { // the admin plays and cuts course videos too
    const pass = {}; for (const c of Object.keys(meta.c || {})) if (CRS_ID.test(c)) pass[c] = (await cpassMake(env, c)).p;
    return json({ ok: true, pass });
  }
  if (path === '/course/sync') {
    const b = await req.json().catch(() => ({})), c = {}, lock = {};
    Object.entries(b.c || {}).forEach(([k, v]) => { if (CRS_ID.test(k) && v) c[k] = { n: String(v.n || '').slice(0, 80), usd: +v.usd || 0 }; });
    const open = (Array.isArray(b.open) ? b.open : []).map(String).filter(x => R2_KEY.test(x)).slice(0, 2000);
    Object.entries(b.lock || {}).forEach(([k, v]) => { if (R2_KEY.test(k) && CRS_ID.test(String(v))) lock[k] = String(v); });
    const m = { c, open, lock, t: Date.now() };
    await env.PUSH.put('crs', JSON.stringify(m)); crsMetaC = m; crsMetaT = Date.now();
    return json({ ok: true });
  }
  if (!env.DB) return json({ error: 'no-db' }, 409);
  const db = env.DB; await schema(db);
  if (path === '/course/list') {
    const [ord, own, codes, fun] = await db.batch([
      db.prepare('SELECT code, id, course, usd, st, t, tp, td, co, lang, name FROM crs_ord ORDER BY t DESC LIMIT 300'),
      db.prepare('SELECT course, COUNT(*) AS n FROM crs_own GROUP BY course'),
      db.prepare('SELECT code, course, note, t, used FROM crs_code ORDER BY t DESC LIMIT 200'),
      db.prepare("SELECT kind, SUM(n) AS n FROM src WHERE kind IN ('u:cb', 'u:cp') GROUP BY kind"),
    ]);
    return json({ ok: true, orders: ord.results || [], owners: Object.fromEntries((own.results || []).map(r => [r.course, r.n])), codes: codes.results || [], funnel: Object.fromEntries((fun.results || []).map(r => [r.kind.slice(2), r.n])), meta });
  }
  const b = JSON.parse((await req.text()) || '{}');
  if (path === '/course/grant' || path === '/course/deny' || path === '/course/undo') {
    const code = String(b.code || '').toUpperCase(); if (!CRS_ORD.test(code)) return json({ error: 'bad' }, 400);
    const o = await db.prepare('SELECT * FROM crs_ord WHERE code = ?').bind(code).first(); if (!o) return json({ error: 'not found' }, 404);
    const now = Date.now();
    if (path === '/course/deny') { await db.prepare("UPDATE crs_ord SET st = 'no', td = ? WHERE code = ?").bind(now, code).run(); return json({ ok: true }); }
    if (path === '/course/undo') { // access opened by mistake: take it back
      await db.batch([db.prepare("UPDATE crs_ord SET st = 'paid', td = NULL WHERE code = ?").bind(code), db.prepare('DELETE FROM crs_own WHERE id = ? AND course = ? AND via = ?').bind(o.id, o.course, 'ord:' + code)]);
      return json({ ok: true });
    }
    await db.batch([db.prepare("UPDATE crs_ord SET st = 'ok', td = ? WHERE code = ?").bind(now, code), db.prepare('INSERT OR IGNORE INTO crs_own (id, course, t, via) VALUES (?, ?, ?, ?)').bind(o.id, o.course, now, 'ord:' + code)]);
    let pushed = false;
    try { // tell the buyer's phone
      const sub = o.pid && await db.prepare('SELECT sub, lang FROM bt_sub WHERE id = ?').bind(o.pid).first();
      if (sub && sub.sub) {
        const L = CRS_PUSH_T[o.lang] ? o.lang : (CRS_PUSH_T[sub.lang] ? sub.lang : 'en'), c = (meta.c && meta.c[o.course]) || {};
        const res = await sendPush(JSON.parse(sub.sub), JSON.stringify({ title: CRS_PUSH_T[L], body: CRS_PUSH_B[L].replace('{n}', c.n || ''), tag: 'course-' + o.course, course: o.course }), await vapid(env)).catch(() => null);
        pushed = !!(res && res.ok);
      }
    } catch (_) {}
    return json({ ok: true, pushed });
  }
  if (path === '/course/code') {
    const cid = String(b.course || ''); if (!CRS_ID.test(cid)) return json({ error: 'bad' }, 400);
    for (let i = 0; i < 5; i++) {
      const code = rvCode();
      const r = await db.prepare('INSERT OR IGNORE INTO crs_code (code, course, note, t) VALUES (?, ?, ?, ?)').bind(code, cid, String(b.note || '').slice(0, 80), Date.now()).run();
      if (r.meta && r.meta.changes) return json({ ok: true, code });
    }
    return json({ error: 'try again' }, 500);
  }
  if (path === '/course/delcode') {
    if (!rvOkCode(b.code)) return json({ error: 'bad' }, 400);
    await db.prepare('DELETE FROM crs_code WHERE code = ? AND used = 0').bind(b.code).run();
    return json({ ok: true });
  }
  return json({ error: 'not found' }, 404);
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
// Models are tried in order; the first that answers is remembered (tgs 'trModel'), refused ones are skipped for a day
// (tgs 'trBad'). Live 10.11.2026: gemma answered «5018: This account is not allowed to access» on the owner's account.
const TR_MODELS = ['@cf/mistralai/mistral-small-3.1-24b-instruct', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/google/gemma-3-12b-it', '@cf/meta/llama-3.1-8b-instruct-fp8-fast'];
const M2M = '@cf/meta/m2m100-1.2b';
async function aiRun(env, system, user) {
  const db = env.DB; await schema(db);
  let bad = {}; try { bad = JSON.parse((await tgGet(db, 'trBad')) || '{}') || {}; } catch (_) {}
  const pref = await tgGet(db, 'trModel');
  const order = [...new Set([pref, ...TR_MODELS].filter(m => m && TR_MODELS.includes(m)))].filter(m => !(bad[m] > Date.now() - 864e5));
  const errs = [];
  for (const model of order.length ? order : TR_MODELS) {
    let r;
    try { r = await env.AI.run(model, { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 1200, temperature: 0.2 }); }
    catch (e) {
      const msg = String(e && e.message || e); errs.push(model.split('/').pop() + ': ' + msg.slice(0, 90));
      if (/5018|not allowed|5007|no such model|not found|deprecat/i.test(msg)) { bad[model] = Date.now(); await tgSet(db, 'trBad', JSON.stringify(bad)); continue; }
      throw new Error(msg);
    }
    // models answer either {response} or the OpenAI shape {choices:[{message:{content}}]}
    let out = r && (r.response ?? r.result?.response ?? r.choices?.[0]?.message?.content ?? r.output_text);
    if (out && typeof out === 'object') out = out.content || JSON.stringify(out);
    out = String(out || '').replace(/^```[a-z]*\s*|```\s*$/g, '').trim();
    if (!out) { errs.push(model + ': empty'); continue; }
    if (pref !== model) await tgSet(db, 'trModel', model);
    aiRun.model = model;
    return out;
  }
  throw new Error('no model: ' + errs.join(' · '));
}
// last resort: the translation-only model (no language detection — the caller passes the languages)
async function m2m(env, text, from, to) {
  const r = await env.AI.run(M2M, { text, source_lang: from, target_lang: to });
  const out = String((r && (r.translated_text || r.result?.translated_text)) || '').trim();
  if (!out) throw new Error('m2m empty');
  aiRun.model = M2M;
  return out;
}
async function trErr(env, e, raw) { try { await tgSet(env.DB, 'trErr', (new Date().toISOString().slice(0, 16) + ' ' + String(e && e.message || e) + (raw ? ' | ' + raw : '')).slice(0, 300)); } catch (_) {} }
// client → coach: {lang (ISO code the client wrote in), ru (Russian translation, '' when the text is already Russian)}
async function trIn(env, text, hint) {
  if (!env.AI || !text || !/\p{L}/u.test(text)) return null;
  let out = '';
  try {
    try { out = await aiRun(env, 'You translate messages into Russian. ' + TR_RULES + ' Answer in exactly this format: the first line is the ISO 639-1 code of the language the message is written in (for example en, es, pt), the second line is exactly ---, then the Russian translation. If the message is already in Russian, write ru, then ---, then nothing.', text); }
    catch (e) {
      if (!/^no model/.test(e.message)) throw e;
      if (/[А-Яа-яЁё]/.test(text)) return { lang: 'ru', ru: '' };
      const from = hint && hint !== 'ru' ? hint : 'en';
      return { lang: from, ru: await m2m(env, text, from, 'ru') };
    }
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
  try { return await aiRun(env, 'Translate the coach\'s message from Russian into ' + (LANG_EN[lang] || lang) + '. ' + TR_RULES + ' Write it the way the coach would say it to his student in that language. Output only the translation.', text); }
  catch (e) { if (/^no model/.test(e.message)) return m2m(env, text, 'ru', lang); throw e; }
}
async function trNote(env, t, text) { // remember the client's language; return the line(s) the coach sees under the original
  const r = await trIn(env, text, (await tgGet(env.DB, 'tl:' + t.id)) || t.lang);
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
    try { res.parsed = await trIn(env, sample, 'es'); res.model = aiRun.model; } catch (e) { res.ok = false; res.error = String(e && e.message || e); return json(res); }
    if (!res.parsed) { res.ok = false; res.error = (await tgGet(env.DB, 'trErr')) || 'no answer'; return json(res); }
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
